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

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      return NextResponse.json(
        { error: error?.message || "Email atau kata sandi salah." },
        { status: error?.status ?? 401 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Login berhasil.",
        user: {
          email: data.user.email,
          id: data.user.id,
        },
        session: data.session,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Terjadi kesalahan server. Coba lagi nanti." },
      { status: 500 },
    );
  }
}
