import assert from "node:assert/strict";
import { test } from "node:test";
import {
  database,
  createDevotee,
  createPooja,
  updateDevotee,
  labels,
  staffId,
  inactiveId,
} from "./database.mjs";

await test("clean migration: verified defaults, primary inheritance, custom isolation, audit and correction", async () => {
  const db = await database();
  try {
    const devotee = await createDevotee(db);
    assert.equal(devotee.address_verification_status, "verified");
    const primary = await createPooja(db, devotee.id);
    const second = await createPooja(db, devotee.id);
    const custom = await createPooja(db, devotee.id, {
      addressMode: "custom",
      customAddress: { line1: "Other test address" },
    });
    assert.equal(custom.custom_address_verification_status, "verified");
    const returned = await updateDevotee(db, devotee, {
      addressVerificationStatus: "unverified",
      addressVerificationReason: "Courier returned",
    });
    assert.equal(returned.address_verification_status, "unverified");
    assert.equal(returned.address_verification_changed_by, staffId);
    assert.ok(returned.address_verification_changed_at);
    const rows = await labels(db);
    for (const enrollment of [primary, second])
      assert.equal(
        rows.find((r) => r.id === enrollment.id).address_verification_status,
        "unverified",
      );
    assert.equal(
      rows.find((r) => r.id === custom.id).address_verification_status,
      "verified",
    );
    const directory = (
      await db.query(
        "select public.devotee_directory_page('Synthetic Devotee') as page",
      )
    ).rows[0].page;
    assert.equal(
      directory.items.find((r) => r.id === devotee.id)
        .primary_address_pooja_count,
      2,
    );
    const register = (
      await db.query(
        "select public.pooja_register_page('all', '2026-11-21', $1) as page",
        [primary.pooja_no],
      )
    ).rows[0].page;
    assert.equal(
      register.items[0].devotee_address_verification_status,
      "unverified",
    );
    const event = (
      await db.query(
        "select * from public.audit_events where entity_id=$1 and action='address_verification_changed'",
        [devotee.id],
      )
    ).rows;
    assert.equal(event.length, 1);
    assert.equal(event[0].before_json.address_verification_status, "verified");
    assert.equal(
      event[0].after_json.address_verification_reason,
      "Courier returned",
    );
    const corrected = await updateDevotee(db, returned, {
      addressLine1: "Corrected synthetic address",
    });
    assert.equal(corrected.address_verification_status, "unverified");
    assert.equal(corrected.address_verification_reason, "Courier returned");
    assert.deepEqual(
      corrected.address_verification_changed_at,
      returned.address_verification_changed_at,
    );
    const verified = await updateDevotee(db, corrected, {
      addressVerificationStatus: "verified",
      addressVerificationReason: "",
    });
    assert.equal(verified.address_verification_status, "verified");
    assert.equal(verified.address_verification_reason, null);
    assert.equal(
      (await labels(db)).find((r) => r.id === primary.id)
        .address_verification_status,
      "verified",
    );
    await assert.rejects(
      updateDevotee(db, returned, { addressVerificationStatus: "unverified" }),
      /STALE_RECORD/,
    );
    await assert.rejects(
      updateDevotee(db, verified, { addressVerificationStatus: "invalid" }),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});

await test("custom status updates do not affect primary or other enrollments; snapshots stay frozen", async () => {
  const db = await database();
  try {
    const devotee = await createDevotee(db);
    const primary = await createPooja(db, devotee.id);
    const custom = await createPooja(db, devotee.id, {
      addressMode: "custom",
      customAddress: { line1: "Independent test address" },
    });
    await db.query(
      `insert into public.pooja_occurrences (enrollment_id, service_date, recipient_name_snapshot, address_snapshot_json)
      values ($1, '2026-11-21', 'Synthetic recipient', '{"line1":"Original test address"}')`,
      [custom.id],
    );
    let changed = (
      await db.query(
        "select * from public.update_pooja_enrollment($1,$2,$3::jsonb)",
        [
          custom.id,
          custom.modified_at,
          JSON.stringify({
            forSelf: true,
            addressMode: "custom",
            customAddress: { line1: "Corrected independent address" },
            customAddressVerificationStatus: "unverified",
            customAddressVerificationReason: "Returned",
          }),
        ],
      )
    ).rows[0];
    assert.equal(changed.custom_address_verification_changed_by, staffId);
    let rows = await labels(db);
    assert.equal(
      rows.find((r) => r.id === primary.id).address_verification_status,
      "verified",
    );
    assert.equal(
      rows.find((r) => r.id === custom.id).address_verification_status,
      "unverified",
    );
    changed = (
      await db.query(
        "select * from public.update_pooja_enrollment($1,$2,$3::jsonb)",
        [
          custom.id,
          changed.modified_at,
          JSON.stringify({
            forSelf: true,
            addressMode: "custom",
            customAddress: { line1: "Another correction" },
          }),
        ],
      )
    ).rows[0];
    assert.equal(changed.custom_address_verification_status, "unverified");
    await db.query(
      `insert into public.pooja_occurrences (enrollment_id, service_date, recipient_name_snapshot, address_snapshot_json)
      values ($1, '2027-11-21', 'Synthetic recipient', '{}')`,
      [custom.id],
    );
    const snapshots = (
      await db.query(
        "select * from public.pooja_occurrences where enrollment_id=$1 order by service_date",
        [custom.id],
      )
    ).rows;
    assert.equal(snapshots[0].address_verification_status_snapshot, "verified");
    assert.equal(
      snapshots[0].address_snapshot_json.line1,
      "Original test address",
    );
    assert.equal(
      snapshots[1].address_verification_status_snapshot,
      "unverified",
    );
    await assert.rejects(
      db.query(
        "update public.pooja_occurrences set address_verification_status_snapshot='unverified' where id=$1",
        [snapshots[0].id],
      ),
      /immutable/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.audit_events where entity_id=$1 and action='address_verification_changed'",
          [custom.id],
        )
      ).rows[0].n,
      1,
    );
    await createPooja(db, devotee.id, {
      status: "paused",
      customAddressVerificationStatus: "unverified",
    });
    await createPooja(db, devotee.id, {
      status: "cancelled",
      customAddressVerificationStatus: "unverified",
    });
    assert.equal((await labels(db)).length, 2);
  } finally {
    await db.close();
  }
});

await test("invitation deduplication keeps a warning if any identical source is unverified", async () => {
  const db = await database();
  try {
    const a = await createDevotee(db, {
      fullName: "AAA Synthetic",
      addressVerificationStatus: "verified",
    });
    await createDevotee(db, {
      fullName: "ZZZ Synthetic",
      addressVerificationStatus: "unverified",
    });
    await createPooja(db, a.id, {
      addressMode: "custom",
      customAddress: {
        line1: "Test address 1",
        city: "Test City",
        state: "Test State",
        postalCode: "000000",
      },
    });
    for (const scope of ["all", "devotees"]) {
      const recipients = (
        await db.query(
          "select public.label_invitation_recipients($1) as rows",
          [scope],
        )
      ).rows[0].rows;
      const match = recipients.filter(
        (r) => r.address_line === "Test address 1",
      );
      assert.equal(match.length, 1);
      assert.equal(match[0].address_verification_status, "unverified");
    }
    const recipients = (
      await db.query(
        "select public.label_invitation_recipients('beneficiaries') as rows",
      )
    ).rows[0].rows;
    assert.equal(
      recipients.find((r) => r.address_line === "Test address 1")
        .address_verification_status,
      "verified",
    );
  } finally {
    await db.close();
  }
});

await test("inactive and anonymous users cannot change verification or read label addresses", async () => {
  const db = await database();
  try {
    const devotee = await createDevotee(db);
    const pooja = await createPooja(db, devotee.id);
    await db.exec(`set request.jwt.claim.sub = '${inactiveId}'`);
    await assert.rejects(
      updateDevotee(db, devotee, { addressVerificationStatus: "unverified" }),
      /FORBIDDEN/,
    );
    await assert.rejects(
      db.query("select * from public.update_pooja_enrollment($1,$2,$3)", [
        pooja.id,
        pooja.modified_at,
        '{"customAddressVerificationStatus":"unverified"}',
      ]),
      /NOT_AUTHORIZED/,
    );
    assert.equal((await labels(db)).length, 0);
    assert.equal(
      (
        await db.query(
          "update public.devotees set address_verification_status='unverified' where id=$1 returning id",
          [devotee.id],
        )
      ).rows.length,
      0,
    );
    await db.exec("set role anon; set request.jwt.claim.sub = ''");
    await assert.rejects(createDevotee(db), /permission denied/);
    await assert.rejects(labels(db), /permission denied/);
  } finally {
    await db.close();
  }
});

await test("upgraded database: existing addresses default verified, old occurrence snapshots remain untouched", async () => {
  let previousDevoteeId;
  let previousOccurrenceId;
  const db = await database({
    beforeUpgrade: async (db) => {
      const devotee = (
        await db.query(
          "insert into public.devotees(full_name) values ('Legacy synthetic') returning id",
        )
      ).rows[0];
      previousDevoteeId = devotee.id;
      const pooja = (
        await db.query(
          "insert into public.pooja_enrollments(devotee_id,for_self,annual_month,annual_day) values ($1,true,11,21) returning id",
          [devotee.id],
        )
      ).rows[0];
      previousOccurrenceId = (
        await db.query(
          "insert into public.pooja_occurrences(enrollment_id,service_date,recipient_name_snapshot,address_snapshot_json) values ($1,'2025-11-21','Legacy synthetic','{\"line1\":\"Legacy address\"}') returning id",
          [pooja.id],
        )
      ).rows[0].id;
    },
  });
  try {
    assert.equal(
      (
        await db.query(
          "select address_verification_status from public.devotees where id=$1",
          [previousDevoteeId],
        )
      ).rows[0].address_verification_status,
      "verified",
    );
    const old = (
      await db.query("select * from public.pooja_occurrences where id=$1", [
        previousOccurrenceId,
      ])
    ).rows[0];
    assert.equal(old.address_verification_status_snapshot, null);
    assert.deepEqual(old.address_snapshot_json, { line1: "Legacy address" });
  } finally {
    await db.close();
  }
});

await test("backend repository and services round-trip verification through RPCs and label read models", async () => {
  const { build } = await import("esbuild");
  const output = await build({
    entryPoints: ["backend/src/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const { createSupabaseTempleRepository, createTempleServices } = await import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
  );
  const db = await database();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      const functionName = new URL(url).pathname.split("/").at(-1);
      const input = JSON.parse(options.body);
      let result;
      if (functionName === "create_devotee")
        result = (
          await db.query("select * from public.create_devotee($1)", [
            JSON.stringify(input.input_payload),
          ])
        ).rows[0];
      else if (functionName === "update_devotee")
        result = (
          await db.query("select * from public.update_devotee($1,$2,$3)", [
            input.devotee_id,
            input.expected_modified_at,
            JSON.stringify(input.input_payload),
          ])
        ).rows[0];
      else if (functionName === "devotee_directory_page")
        result = (
          await db.query(
            "select public.devotee_directory_page($1,$2,$3,$4) as data",
            [
              input.search_text,
              input.initial_letter,
              input.page_size,
              input.page_offset,
            ],
          )
        ).rows[0].data;
      else if (functionName === "label_recipients")
        result = (
          await db.query(
            "select public.label_recipients($1,$2,$3,$4) as data",
            [
              input.filter_mode,
              input.target_date,
              input.range_from,
              input.range_to,
            ],
          )
        ).rows[0].data;
      else if (functionName === "label_invitation_recipients")
        result = (
          await db.query(
            "select public.label_invitation_recipients($1) as data",
            [input.scope],
          )
        ).rows[0].data;
      else throw new Error(`Unexpected test RPC: ${functionName}`);
      return Response.json(result);
    };
    const services = createTempleServices(
      createSupabaseTempleRepository({
        url: "https://synthetic.example.invalid",
        anonKey: "synthetic-key",
        accessToken: "synthetic-token",
      }),
    );
    const initial = await services.devotees.create({
      fullName: "Synthetic Roundtrip",
    });
    assert.equal(initial.addressVerificationStatus, "verified");
    await createPooja(db, initial.id);
    const updated = await services.devotees.update({
      id: initial.id,
      expectedModifiedAt: initial.modifiedAt,
      fullName: initial.fullName,
      addressVerificationStatus: "unverified",
      addressVerificationReason: "Returned",
    });
    assert.equal(updated.addressVerificationStatus, "unverified");
    assert.equal(updated.addressVerificationReason, "Returned");
    assert.equal(updated.primaryAddressPoojaCount, 1);
    assert.equal(updated.addressVerificationChangedBy, staffId);
    const rows = await services.labels.listForDate({
      mode: "custom",
      date: "2026-11-21",
    });
    assert.equal(
      rows.find((row) => row.id).addressVerificationStatus,
      "unverified",
    );
    const invitations = await services.labels.listInvitation("devotees");
    assert.equal(
      invitations.find((row) => row.name === initial.fullName)
        .addressVerificationStatus,
      "unverified",
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db.close();
  }
});
