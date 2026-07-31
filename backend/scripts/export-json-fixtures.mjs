import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rootDir = resolve(backendDir, "..");
const outputDir = join(rootDir, "database", "fixtures");
const compileDir = mkdtempSync(join(tmpdir(), "kambaru-fixtures-"));
const tsc = join(rootDir, "node_modules", ".bin", "tsc");

execFileSync(tsc, [
  join(backendDir, "src", "mock-data.ts"),
  join(backendDir, "src", "types.ts"),
  "--outDir", compileDir,
  "--module", "commonjs",
  "--target", "es2020",
  "--skipLibCheck",
]);

const fixtureModule = JSON.parse(
  JSON.stringify(
    await import(`file://${join(compileDir, "mock-data.js")}`),
  ),
);
const { devotees, beneficiaries, enrollments } = fixtureModule.default ?? fixtureModule;

const compact = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));

const devoteeRows = devotees.map((row) => compact({
  id: row.id,
  devotee_no: row.devoteeNo,
  full_name: row.fullName,
  date_of_birth: row.dateOfBirth,
  phone_primary: row.phonePrimary,
  phone_alternate: row.phoneAlternate,
  email: row.email,
  rashi: row.rashi,
  nakshatra: row.nakshatra,
  gotra: row.gotra,
  notes: row.notes,
  address_line1: row.addressLine1,
  address_line2: row.addressLine2,
  address_city: row.addressCity,
  address_district: row.addressDistrict,
  address_state: row.addressState,
  address_postal_code: row.addressPostalCode,
  archived_at: null,
  created_at: row.createdAt,
  modified_at: row.modifiedAt,
}));

const beneficiaryRows = beneficiaries.map((row) => compact({
  id: row.id,
  devotee_id: row.devoteeId,
  full_name: row.fullName,
  relation: row.relation,
  phone: row.phone,
  rashi: row.rashi,
  nakshatra: row.nakshatra,
  gotra: row.gotra,
  notes: row.notes,
  archived_at: null,
  created_at: row.createdAt,
  modified_at: row.modifiedAt,
}));

const enrollmentRows = enrollments.map((row) => compact({
  id: row.id,
  devotee_id: row.devoteeId,
  for_self: row.forSelf,
  beneficiary_id: row.beneficiaryId,
  annual_month: row.annualMonth,
  annual_day: row.annualDay,
  leap_day_policy: row.leapDayPolicy,
  address_mode: row.addressMode,
  custom_address_line1: row.customAddress?.line1,
  custom_address_line2: row.customAddress?.line2,
  custom_address_city: row.customAddress?.city,
  custom_address_district: row.customAddress?.district,
  custom_address_state: row.customAddress?.state,
  custom_address_postal_code: row.customAddress?.postalCode,
  status: row.status,
  fee_minor: row.feeMinor,
  currency: row.currency,
  payment_reference: row.paymentReference,
  enrollment_date: row.enrollmentDate,
  notes: row.notes,
  created_by: row.createdBy,
  created_at: row.createdAt,
  modified_at: row.modifiedAt,
}));

mkdirSync(outputDir, { recursive: true });
const writeJson = (name, rows) =>
  writeFileSync(join(outputDir, name), `${JSON.stringify(rows, null, 2)}\n`);

writeJson("devotees.json", devoteeRows);
writeJson("beneficiaries.json", beneficiaryRows);
writeJson("pooja_enrollments.json", enrollmentRows);
writeJson("pooja_occurrences.json", []);
writeJson("audit_events.json", []);
writeJson("metadata.json", {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  synthetic_data_only: true,
  temple_timezone: "Asia/Kolkata",
  counts: {
    devotees: devoteeRows.length,
    beneficiaries: beneficiaryRows.length,
    pooja_enrollments: enrollmentRows.length,
    pooja_occurrences: 0,
    audit_events: 0,
  },
});

console.log(readFileSync(join(outputDir, "metadata.json"), "utf8"));
