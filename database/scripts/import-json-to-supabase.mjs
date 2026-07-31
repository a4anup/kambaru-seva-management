import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(new URL("../..", import.meta.url).pathname);
const fixtureDir = resolve(rootDir, "database", "fixtures");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing fixtures.");
}

function stableUuid(source) {
  const hex = createHash("sha256").update(`kambaru:${source}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function load(name) {
  return JSON.parse(await readFile(resolve(fixtureDir, name), "utf8"));
}

async function upsert(table, rows) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`${table} import failed (${response.status}): ${await response.text()}`);
  }
  console.log(`Imported ${rows.length} ${table} rows`);
}

const devotees = (await load("devotees.json")).map((row) => ({
  ...row,
  id: stableUuid(row.id),
}));
const beneficiaries = (await load("beneficiaries.json")).map((row) => ({
  ...row,
  id: stableUuid(row.id),
  devotee_id: stableUuid(row.devotee_id),
}));
const enrollments = (await load("pooja_enrollments.json")).map((row) => ({
  ...row,
  id: stableUuid(row.id),
  devotee_id: stableUuid(row.devotee_id),
  beneficiary_id: row.beneficiary_id ? stableUuid(row.beneficiary_id) : null,
  created_by: null,
}));

await upsert("devotees", devotees);
await upsert("beneficiaries", beneficiaries);
await upsert("pooja_enrollments", enrollments);

console.log("Synthetic JSON fixtures are now available through Supabase.");
