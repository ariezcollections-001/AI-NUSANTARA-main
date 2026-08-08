import { createClient } from "./server";
import type { Database } from "./types";

export async function verifyFounder() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return {
      error: "Autentikasi Founder diperlukan.",
      status: 401,
    } as const;
  }

  const profile = await supabase
    .from("founder")
    .select("role")
    .eq("id", authData.user.id)
    .single<{ role: string }>();

  if (profile.error || profile.data?.role !== "founder") {
    return {
      error: "Akses founder ditolak.",
      status: 403,
    } as const;
  }

  return {
    supabase,
    founderId: authData.user.id,
    founderEmail: authData.user.email ?? "",
  } as const;
}
