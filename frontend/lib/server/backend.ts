import "server-only";

import {
  createSupabaseTempleRepository,
  createTempleServices,
} from "@kambaru/backend";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function getBackendServices() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/login");

  const { url, anonKey } = supabaseConfig();
  const repository = createSupabaseTempleRepository({
    url,
    anonKey,
    accessToken: session.access_token,
  });
  return {
    ...createTempleServices(repository),
    user,
    supabase,
  };
}
