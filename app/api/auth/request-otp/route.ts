import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyCaptcha(captchaToken: string | undefined) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET || process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return true;
  }

  if (!captchaToken) {
    return false;
  }

  const isTurnstile = Boolean(process.env.CLOUDFLARE_TURNSTILE_SECRET);
  const endpoint = isTurnstile
    ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    : "https://www.google.com/recaptcha/api/siteverify";

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", captchaToken);

  const result = await fetch(endpoint, {
    method: "POST",
    body,
  });

  const payload = await result.json().catch(() => null);
  return Boolean(payload?.success);
}

async function sendWhatsappFallback(phone: string, message: string) {
  const url = process.env.WHATSAPP_API_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) {
    return false;
  }

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ phone, message }),
  });
  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const captchaToken = String(body.captcha_token ?? "").trim();

  if (!email && !phone) {
    return NextResponse.json({ error: "Email atau nomor telepon wajib diisi." }, { status: 400 });
  }

  const captchaValid = await verifyCaptcha(captchaToken);
  if (!captchaValid) {
    return NextResponse.json({ error: "Captcha tidak valid atau tidak terverifikasi." }, { status: 400 });
  }

  const supabase = await createClient();

  if (email) {
    const response = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (response.error) {
      return NextResponse.json({ error: response.error.message }, { status: 500 });
    }
  }

  if (phone) {
    const response = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (response.error) {
      return NextResponse.json({ error: response.error.message }, { status: 500 });
    }

    const shouldSendWa = Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_KEY);
    if (shouldSendWa) {
      await sendWhatsappFallback(phone, "Kode OTP Anda akan dikirim melalui SMS dan WhatsApp dalam beberapa saat. Jika belum menerima, silakan cek kembali.");
    }
  }

  if (email && !phone) {
    return NextResponse.json({ message: "Email OTP sudah dikirim. Periksa kotak masuk Anda." });
  }

  if (phone) {
    return NextResponse.json({ message: "Kode OTP SMS dikirim. Harap verifikasi dengan kode 6 digit." });
  }

  return NextResponse.json({ message: "Permintaan OTP diterima." });
}
