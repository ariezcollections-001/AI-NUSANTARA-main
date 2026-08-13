import { createClient } from "./server";
import type { Database } from "./types";

/**
 * Verifikasi akses Founder dengan FALLBACK:
 *   1. Prioritas: tabel `public.founder` (jika ada) — role = 'founder'.
 *   2. Fallback : tabel `public.users` — role = 'founder'.
 *
 * Tabel `public.founder` dibuat oleh migrasi 003, tetapi TERKADANG belum ada
 * (mis. database di-reset / migrasi 003 belum dijalankan di project yg dipakai).
 * Dengan fallback ke `public.users`, Founder tetap bisa dikenali & bisa
 * menyimpan Vault/key walau tabel `founder` belum dibuat — tanpa crash.
 */
export async function verifyFounder() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return {
      error: "Autentikasi Founder diperlukan.",
      status: 401,
    } as const;
  }

  const userId = authData.user.id;

  // 1) Coba tabel `public.founder` (primer)
  let founderOk = false;
  try {
    const profile = await supabase
      .from("founder")
      .select("role")
      .eq("id", userId)
      .maybeSingle<{ role: string }>();
    if (!profile.error && profile.data?.role === "founder") {
      founderOk = true;
    }
  } catch {
    // tabel founder tidak ada → fallback ke users di bawah
  }

  // 2) Jika tabel founder kosong/tidak ada, cek `public.users` (fallback)
  if (!founderOk) {
    try {
      const userProfile = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle<{ role: string }>();
      if (!userProfile.error && userProfile.data?.role === "founder") {
        founderOk = true;
      }
    } catch {
      // abaikan
    }
  }

  if (!founderOk) {
    return {
      error:
        "Akses founder ditolak. Pastikan akun memiliki role='founder' (tabel founder atau users).",
      status: 403,
    } as const;
  }

  return {
    supabase,
    founderId: userId,
    founderEmail: authData.user.email ?? "",
  } as const;
}
