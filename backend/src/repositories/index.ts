import type { TempleRepository } from "./contracts";
import { JsonTempleRepository } from "./json-repository";
import { SupabaseTempleRepository } from "./supabase-repository";

export type DataSource = "mock" | "supabase";

export function configuredDataSource(): DataSource {
  return process.env.KAMBARU_DATA_SOURCE === "supabase" ? "supabase" : "mock";
}

export function createTempleRepository(): TempleRepository {
  return configuredDataSource() === "supabase"
    ? SupabaseTempleRepository
    : JsonTempleRepository;
}

export const TempleData = createTempleRepository();
export type { DataSnapshot, TempleRepository } from "./contracts";
