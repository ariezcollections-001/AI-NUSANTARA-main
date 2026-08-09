import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.FOUNDER_SEED_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "Seed token tidak dikonfigurasi." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const providedToken = String(body.seed_token ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (providedToken !== secret) {
    return NextResponse.json({ error: "Token seed tidak valid." }, { status: 401 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password founder wajib diisi." }, { status: 400 });
  }

  const admin = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase URL atau service role key belum tersedia." }, { status: 500 });
  }

  const authAdminUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users`;
  const createResponse = await fetch(authAdminUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "founder" },
    }),
  });

  const createResult = await createResponse.json().catch(() => null);

  if (!createResponse.ok) {
    return NextResponse.json(
      { error: createResult?.message || "Gagal membuat akun Founder." },
      { status: createResponse.status || 500 },
    );
  }

  // Pastikan baris pengguna founder juga ada di table users.
  const userResponse = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (userResponse.error || !userResponse.data) {
    // Insert into users table with regular user role (optional, for compatibility)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("users") as any).insert({ email, role: "user", character_balance: 10000 });
  }

  // Insert/update founder table (authoritative source for founder access)
  const founderResponse = await admin
    .from("founder")
    .select("id")
    .eq("email", email)
    .single();

  if (founderResponse.error || !founderResponse.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("founder") as any).insert({ email, role: "founder" });
  }

  return NextResponse.json({ success: true, email, info: "Akun Founder terdaftar. Silakan login dengan email dan password Anda." });
}
