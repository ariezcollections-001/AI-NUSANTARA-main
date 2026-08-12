import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/url";

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

    // Resolve app URL dynamically from the request origin so local testing
    // redirects to localhost and production stays on the Vercel domain.
    const appUrl = getAppUrl(request);
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
