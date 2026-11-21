import "server-only";

import {
  createSupabaseTempleRepository,
  createTempleServices,
} from "@kambaru/backend";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getRequestSupabase } from "@/lib/server/auth";
import { supabaseConfig } from "@/lib/supabase/config";

export async function getBackendServices() {
  const supabase = await getRequestSupabase();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

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
