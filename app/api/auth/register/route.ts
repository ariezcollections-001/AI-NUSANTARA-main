import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan kata sandi wajib diisi." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Kata sandi minimal 6 karakter." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Resolve the app URL dynamically from the request origin/host so local
    // testing redirects to localhost and production stays on the Vercel domain.
    let appUrl =
      request.headers.get("origin") ||
      (request.headers.get("host")?.includes("localhost")
        ? `http://${request.headers.get("host")}`
        : `https://${request.headers.get("host")}`) ||
      "http://localhost:3000";

    // Defender: selama `next dev`, paksa localhost supaya redirect_to yang
    // dikirim ke Supabase dijamin localhost (tidak mungkin nyasar ke Vercel).
    if (process.env.NODE_ENV === "development" && !appUrl.includes("localhost")) {
      appUrl = "http://localhost:3000";
    }

    console.log(
      "[REGISTER DEBUG] origin:",
      request.headers.get("origin"),
      "host:",
      request.headers.get("host"),
      "final appUrl:",
      appUrl,
    );

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/api/auth/callback`,
      },
    });

    if (error) {
      const lowerMessage = error.message?.toLowerCase() ?? "";
      const isAlreadyRegistered =
        lowerMessage.includes("already registered") ||
        lowerMessage.includes("already exists") ||
        lowerMessage.includes("user already registered");

      return NextResponse.json(
        {
          error: isAlreadyRegistered
            ? "Email sudah terdaftar. Silakan masuk dan gunakan fitur kirim ulang verifikasi jika diperlukan."
            : error.message || "Gagal membuat akun.",
        },
        { status: isAlreadyRegistered ? 409 : error.status ?? 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Akun berhasil dibuat. Silakan cek email untuk konfirmasi.",
        user: { email: data.user?.email ?? email, id: data.user?.id ?? null },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Terjadi kesalahan server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
