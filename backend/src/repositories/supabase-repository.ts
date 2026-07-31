import type { DataSnapshot, TempleRepository } from "./contracts";
import type { SaveDevoteeInput, SaveEnrollmentInput } from "../types";
import {
  mapBeneficiary,
  mapDevotee,
  mapEnrollment,
  type BeneficiaryRow,
  type DevoteeRow,
  type EnrollmentRow,
} from "./row-mappers";

export interface SupabaseRepositoryConfig {
  url: string;
  anonKey: string;
  accessToken: string;
}

async function selectTable<T>(
  config: SupabaseRepositoryConfig,
  table: string,
): Promise<T[]> {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase query failed for ${table} (${response.status}).`);
  }
  return response.json() as Promise<T[]>;
}

async function callRpc<T>(
  config: SupabaseRepositoryConfig,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text();
    if (response.status === 409 || details.includes("STALE_RECORD")) {
      throw new Error("CONFLICT");
    }
    throw new Error(`Supabase mutation failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function createSupabaseTempleRepository(
  config: SupabaseRepositoryConfig,
): TempleRepository {
  if (!config.url || !config.anonKey || !config.accessToken) {
    throw new Error("An authenticated Supabase configuration is required.");
  }
  return {
    async loadSnapshot(): Promise<DataSnapshot> {
      const [devotees, beneficiaries, enrollments] = await Promise.all([
        selectTable<DevoteeRow>(config, "devotees"),
        selectTable<BeneficiaryRow>(config, "beneficiaries"),
        selectTable<EnrollmentRow>(config, "pooja_enrollments"),
      ]);
      return {
        devotees: devotees.map(mapDevotee),
        beneficiaries: beneficiaries.map(mapBeneficiary),
        enrollments: enrollments.map(mapEnrollment),
      };
    },
    async createDevotee(input: SaveDevoteeInput) {
      const row = await callRpc<DevoteeRow>(config, "create_devotee", {
        input_payload: input,
      });
      return mapDevotee(row);
    },
    async updateDevotee(
      input: SaveDevoteeInput & { id: string; expectedModifiedAt: string },
    ) {
      const row = await callRpc<DevoteeRow>(config, "update_devotee", {
        devotee_id: input.id,
        expected_modified_at: input.expectedModifiedAt,
        input_payload: input,
      });
      return mapDevotee(row);
    },
    async createEnrollment(input: SaveEnrollmentInput) {
      const row = await callRpc<EnrollmentRow>(config, "create_pooja_enrollment", {
        input_payload: input,
      });
      return mapEnrollment(row);
    },
    async updateEnrollment(
      input: SaveEnrollmentInput & { id: string; expectedModifiedAt: string },
    ) {
      const row = await callRpc<EnrollmentRow>(config, "update_pooja_enrollment", {
        enrollment_id: input.id,
        expected_modified_at: input.expectedModifiedAt,
        input_payload: input,
      });
      return mapEnrollment(row);
    },
  };
}
