import "server-only";

import { cache } from "react";
import type { StaffSession } from "@/components/auth/StaffSessionProvider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Per-request memoization. The root layout and the page render in the same
// request and both need the authenticated user; without cache() each one made
// its own network round trip to Supabase Auth. React's cache() is scoped to a
// single server request, so no auth state is ever shared between requests.

/** One Supabase server client per request (reads that request's cookies). */
export const getRequestSupabase = cache(createSupabaseServerClient);

/** Server-verified user for this request (getUser hits Supabase Auth once). */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await getRequestSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error ? null : user;
});

/** Active staff profile for this request, or null if signed out/deactivated. */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const supabase = await getRequestSupabase();
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("display_name, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return null;
  return { id: user.id, displayName: profile.display_name, role: profile.role };
});
