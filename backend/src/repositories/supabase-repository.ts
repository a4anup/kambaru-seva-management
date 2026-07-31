import type { DataSnapshot, TempleRepository } from "./contracts";
import {
  mapBeneficiary,
  mapDevotee,
  mapEnrollment,
  type BeneficiaryRow,
  type DevoteeRow,
  type EnrollmentRow,
} from "./row-mappers";

async function selectTable<T>(table: string): Promise<T[]> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase data source requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase query failed for ${table} (${response.status}).`);
  }
  return response.json() as Promise<T[]>;
}

export const SupabaseTempleRepository: TempleRepository = {
  async loadSnapshot(): Promise<DataSnapshot> {
    const [devotees, beneficiaries, enrollments] = await Promise.all([
      selectTable<DevoteeRow>("devotees"),
      selectTable<BeneficiaryRow>("beneficiaries"),
      selectTable<EnrollmentRow>("pooja_enrollments"),
    ]);
    return {
      devotees: devotees.map(mapDevotee),
      beneficiaries: beneficiaries.map(mapBeneficiary),
      enrollments: enrollments.map(mapEnrollment),
    };
  },
};
