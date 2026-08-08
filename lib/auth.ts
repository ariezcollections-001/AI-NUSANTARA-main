import { supabase } from "@/lib/supabase/client";
import { getAllowedLoginTarget } from "@/lib/auth-routing";

type LoginRole = "user" | "founder";

type ManualLoginSuccess = {
  success: true;
  target: "/dashboard" | "/x-founder-control-99f7jK";
  userId: string;
  email: string | null;
};

type ManualLoginFailure = {
  success: false;
  error: string;
  reason?: "invalid_input" | "not_found" | "not_confirmed" | "role_missing" | "server_error";
};

export type ManualLoginResult = ManualLoginSuccess | ManualLoginFailure;

const ACCOUNT_NOT_FOUND_MARKERS = [
  "invalid login credentials",
  "user not found",
  "email not found",
  "no account",
  "user_not_found",
  "invalid credentials",
];

const EMAIL_NOT_CONFIRMED_MARKERS = [
  "email not confirmed",
  "email_not_confirmed",
  "email is not confirmed",
];

function isAccountNotFoundError(message: string) {
  const lower = message.toLowerCase();
  return ACCOUNT_NOT_FOUND_MARKERS.some((marker) => lower.includes(marker));
}

function isEmailNotConfirmedError(message: string) {
  const lower = message.toLowerCase();
  return EMAIL_NOT_CONFIRMED_MARKERS.some((marker) => lower.includes(marker));
}

export async function resolveUserRole(userId: string): Promise<LoginRole | null> {
  const { data: profileData, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string }>();

  if (!profileError && profileData) {
    if (profileData.role === "user") return "user";
    if (profileData.role === "founder") return "founder";
  }

  const { data: founderData, error: founderError } = await supabase
    .from("founder")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string }>();

  if (!founderError && founderData?.role === "founder") {
    return "founder";
  }

  // Default fallback for authenticated users with no explicit role row.
  return "user";
}

export async function manualLoginWithPassword(
  email: string,
  password: string,
): Promise<ManualLoginResult> {
  if (!email || !password) {
    return {
      success: false,
      error: "Email dan kata sandi wajib diisi.",
      reason: "invalid_input",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session) {
    const errorMessage = error?.message || "Email atau kata sandi salah.";

    if (isAccountNotFoundError(errorMessage)) {
      return {
        success: false,
        error: "❌ Akun Anda belum terdaftar! Silakan klik tombol 'Daftar Akun Baru' di bawah terlebih dahulu untuk mendaftarkan email resmi Anda.",
        reason: "not_found",
      };
    }

    if (isEmailNotConfirmedError(errorMessage) || (data?.user && !data.user.email_confirmed_at)) {
      return {
        success: false,
        error: "⚠️ Akun Anda belum aktif! Supabase Cloud telah mengirimkan link verifikasi resmi ke email Anda. Silakan buka kotak masuk/folder spam email Anda, lalu klik 'Confirm Email' terlebih dahulu agar pintu gerbang BIKIN AI terbuka!",
        reason: "not_confirmed",
      };
    }

    return {
      success: false,
      error: errorMessage,
      reason: "server_error",
    };
  }

  const user = data.user;
  if (!user) {
    return {
      success: false,
      error: "Login gagal. Tidak dapat memuat data pengguna.",
      reason: "server_error",
    };
  }

  if (!user.email_confirmed_at) {
    return {
      success: false,
      error: "⚠️ Akun Anda belum aktif! Supabase Cloud telah mengirimkan link verifikasi resmi ke email Anda. Silakan buka kotak masuk/folder spam email Anda, lalu klik 'Confirm Email' terlebih dahulu agar pintu gerbang BIKIN AI terbuka!",
      reason: "not_confirmed",
    };
  }

  const role = await resolveUserRole(user.id);
  const founderRoute = getAllowedLoginTarget(role, "founder");
  if (founderRoute.ok && founderRoute.target) {
    return {
      success: true,
      target: founderRoute.target,
      userId: user.id,
      email: user.email ?? null,
    };
  }

  const userRoute = getAllowedLoginTarget(role, "user");
  if (userRoute.ok && userRoute.target) {
    return {
      success: true,
      target: userRoute.target,
      userId: user.id,
      email: user.email ?? null,
    };
  }

  await supabase.auth.signOut();
  return {
    success: false,
    error: founderRoute.error || userRoute.error || "Login berhasil, tetapi peran akun tidak ditemukan. Pastikan akun Founder Anda terdaftar di table 'founder' atau akun User terdaftar di table 'users'.",
    reason: "role_missing",
  };
}
