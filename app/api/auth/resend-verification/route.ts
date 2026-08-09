import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email wajib diisi untuk mengirim ulang verifikasi." },
        { status: 400 },
      );
    }

    // Build app URL from request to ensure correct domain in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ??     process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/login`,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Gagal mengirim ulang email verifikasi." },
        { status: error.status ?? 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Email verifikasi berhasil dikirim ulang. Silakan cek kotak masuk email Anda.",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
