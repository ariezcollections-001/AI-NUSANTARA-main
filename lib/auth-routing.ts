export type LoginIntent = "user" | "founder";
export type LoginRouteTarget = "/dashboard" | "/x-founder-control-99f7jK";

export function getAllowedLoginTarget(
  role: "user" | "founder" | null | undefined,
  intent: LoginIntent,
): { ok: boolean; target: LoginRouteTarget | null; error?: string } {
  if (intent === "user") {
    if (role === "user") {
      return { ok: true, target: "/dashboard" };
    }

    if (role === "founder") {
      return {
        ok: false,
        target: null,
        error: "Akun ini tidak terdaftar sebagai pengguna biasa. Gunakan login Founder jika Anda memiliki akses khusus.",
      };
    }

    return {
      ok: false,
      target: null,
      error: "Peran akun tidak tersedia. Silakan gunakan login Founder jika Anda memiliki akses khusus.",
    };
  }

  if (role === "founder") {
    return { ok: true, target: "/x-founder-control-99f7jK" };
  }

  if (role === "user") {
    return {
      ok: false,
      target: null,
      error: "Akun ini tidak terdaftar sebagai Founder. Gunakan login user biasa.",
    };
  }

  return {
    ok: false,
    target: null,
    error: "Peran akun tidak tersedia. Pastikan akun Anda memiliki akses Founder.",
  };
}
