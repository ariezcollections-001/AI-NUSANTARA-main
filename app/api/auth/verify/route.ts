import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const token = String(body.token ?? "").trim();

  if (!token || (!email && !phone)) {
    return NextResponse.json(
      { error: "Email atau nomor telepon dan kode OTP wajib diisi." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const type = email ? "email" : "sms";

  const payload: Record<string, string> = {
    token,
    type,
  };

  if (email) {
    payload.email = email;
  } else {
    payload.phone = phone;
  }

  // Supabase Verify OTP payload can vary by auth method.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await supabase.auth.verifyOtp(payload as any);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
