import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

export async function POST(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ success: false, error: verify.error }, { status: verify.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || body.user_id || "").trim();
    const balance = Number(body.balance ?? body.character_balance);

    if (!userId) {
      return NextResponse.json({ success: false, error: "Parameter userId wajib diisi." }, { status: 400 });
    }

    if (!Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ success: false, error: "Saldo tidak valid (harus angka >= 0)." }, { status: 400 });
    }

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResponse = await (admin as any)
      .from("users")
      .update({ character_balance: Math.floor(balance) })
      .eq("id", userId)
      .select()
      .single();

    if (updateResponse.error || !updateResponse.data) {
      throw updateResponse.error ?? new Error("Pengguna tidak ditemukan.");
    }

    return NextResponse.json({ success: true, user: updateResponse.data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui saldo.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}