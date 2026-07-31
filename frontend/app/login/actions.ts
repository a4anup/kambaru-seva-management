"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInResult =
  | { ok: true }
  | { ok: false; message: string };

export async function signIn(
  identity: string,
  password: string,
): Promise<SignInResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identity.trim(),
    password,
  });
  if (error || !data.user) {
    return { ok: false, message: "Unable to sign in. Check your credentials." };
  }

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!staff?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, message: "Unable to sign in. Check your credentials." };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
