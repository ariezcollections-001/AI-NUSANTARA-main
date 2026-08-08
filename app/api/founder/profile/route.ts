import { NextResponse } from "next/server";
import { verifyFounder } from "@/lib/supabase/founder";

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ ok: false, error: verify.error }, { status: verify.status });
  }

  try {
    const userResponse = await verify.supabase.auth.getUser();
    if (userResponse.error || !userResponse.data?.user) {
      throw userResponse.error ?? new Error("Founder user not found.");
    }

    const user = userResponse.data.user;
    const name = String(user.user_metadata?.full_name || user.user_metadata?.name || "Founder");

    return NextResponse.json({ ok: true, data: { name, email: user.email || "" } });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Gagal memuat profil founder.";
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ ok: false, error: verify.error }, { status: verify.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();

    if (!name || !email || !password) {
      return NextResponse.json({ ok: false, error: "name, email, and password are required" }, { status: 400 });
    }

    const updateResponse = await verify.supabase.auth.updateUser({
      email,
      password,
      data: { full_name: name },
    });

    if (updateResponse.error) {
      return NextResponse.json({ ok: false, error: updateResponse.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Gagal menyimpan profil founder.";
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
