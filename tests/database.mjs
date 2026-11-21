import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readdir, readFile } from "node:fs/promises";

export const migrationName = "20261121090000_address_verification.sql";
export const staffId = "00000000-0000-4000-8000-000000000001";
export const inactiveId = "00000000-0000-4000-8000-000000000002";

// Isolated PostgreSQL engine; no network, credentials, or production data.
// Supabase owns auth.users/auth.uid and default grants; reproduce those here.
export async function database({ beforeUpgrade } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    alter default privileges in schema public grant all on tables to authenticated;
    alter default privileges in schema public grant all on sequences to authenticated;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (name === migrationName && beforeUpgrade) await beforeUpgrade(db);
    // pgcrypto supplies gen_random_uuid on Supabase. PG 17 has it built in;
    // PGlite does not ship the redundant extension itself.
    const sql = (await readFile(new URL(name, directory), "utf8")).replace(
      "create extension if not exists pgcrypto;",
      "",
    );
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration failed: ${name}: ${error.message}`);
    }
  }
  await db.exec(`
    insert into auth.users(id, email) values
      ('${staffId}', 'staff@example.invalid'), ('${inactiveId}', 'inactive@example.invalid');
    update public.staff_profiles set is_active = true where user_id = '${staffId}';
    set role authenticated;
    set request.jwt.claim.sub = '${staffId}';
  `);
  return db;
}

export async function createDevotee(db, input = {}) {
  return (
    await db.query("select * from public.create_devotee($1::jsonb)", [
      JSON.stringify({
        fullName: "Synthetic Devotee",
        addressLine1: "Test address 1",
        city: "Test City",
        state: "Test State",
        postalCode: "000000",
        ...input,
      }),
    ])
  ).rows[0];
}

export async function createPooja(db, devoteeId, input = {}) {
  return (
    await db.query("select * from public.create_pooja_enrollment($1::jsonb)", [
      JSON.stringify({
        devoteeId,
        forSelf: true,
        annualMonth: 11,
        annualDay: 21,
        addressMode: "devotee_primary",
        ...input,
      }),
    ])
  ).rows[0];
}

export async function updateDevotee(db, row, input) {
  return (
    await db.query("select * from public.update_devotee($1, $2, $3::jsonb)", [
      row.id,
      row.modified_at,
      JSON.stringify({ fullName: row.full_name, ...input }),
    ])
  ).rows[0];
}

export async function labels(db, date = "2026-11-21") {
  return (
    await db.query("select public.label_recipients('custom', $1) as rows", [
      date,
    ])
  ).rows[0].rows;
}
