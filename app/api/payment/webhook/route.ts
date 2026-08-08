import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const packageByGrossAmount: Record<number, number> = {
  15000: 50000,
  35000: 150000,
  75000: 400000,
};

function determineQuota(orderId: string, amount: number) {
  if (packageByGrossAmount[amount]) return packageByGrossAmount[amount];
  if (orderId.includes("pemula")) return 50000;
  if (orderId.includes("pro")) return 150000;
  if (orderId.includes("founder")) return 400000;
  return 0;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const transactionStatus = String(payload.transaction_status || payload.transactionStatus || "").toLowerCase();
  const orderId = String(payload.order_id || payload.orderId || "").trim();
  const userEmail = String(payload.user_email || payload.customer_details?.email || payload.userEmail || "").trim();
  const grossAmount = Number(payload.gross_amount ?? payload.grossAmount ?? 0);

  if (!transactionStatus || !orderId || !userEmail) {
    return NextResponse.json({ received: false, reason: "Payload tidak lengkap." }, { status: 400 });
  }

  if (transactionStatus !== "settlement" && transactionStatus !== "capture") {
    return NextResponse.json({ received: true, status: transactionStatus });
  }

  const addedQuota = determineQuota(orderId, grossAmount);
  if (addedQuota <= 0) {
    return NextResponse.json({ received: false, reason: "Paket pembayaran tidak dikenali." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const response = await admin
      .from("users")
      .select("id,character_balance")
      .eq("email", userEmail)
      .single<{ id: string; character_balance?: number }>();

    if (response.error || !response.data) {
      return NextResponse.json({ received: false, reason: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const current = Number(response.data.character_balance || 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResponse = await (admin as any)
      .from("users")
      .update({ character_balance: current + addedQuota })
      .eq("email", userEmail)
      .select()
      .single();

    if (updateResponse.error || !updateResponse.data) {
      throw updateResponse.error ?? new Error("Gagal memperbarui saldo pengguna.");
    }

    return NextResponse.json({ received: true, quota_added: addedQuota, email: userEmail });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Midtrans webhook gagal.";
    return NextResponse.json({ received: false, error: errorMessage }, { status: 500 });
  }
}
