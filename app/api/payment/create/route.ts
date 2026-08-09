import { NextResponse } from "next/server";

const packageMap = {
  pemula: { amount: 15000, quota: 50000, label: "Paket Pemula" },
  pro: { amount: 35000, quota: 150000, label: "Paket Pro Bisnis" },
  founder: { amount: 75000, quota: 400000, label: "Paket Founder Choice" },
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const packageId = String(payload.packageId || "").trim();
  const userEmail = String(payload.userEmail || "").trim();
  const validPackageIds = Object.keys(packageMap) as Array<keyof typeof packageMap>;

  if (!validPackageIds.includes(packageId as keyof typeof packageMap)) {
    return NextResponse.json({ error: "Paket pembayaran tidak valid." }, { status: 400 });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json(
      { error: "Midtrans server key tidak terkonfigurasi. Hubungi Founder." },
      { status: 500 },
    );
  }

  const orderId = `ai-nusantara-${packageId}-${Date.now()}`;
  const selectedPackage = packageMap[packageId as keyof typeof packageMap];

  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: selectedPackage.amount,
    },
    item_details: [
      {
        id: packageId,
        price: selectedPackage.amount,
        quantity: 1,
        name: selectedPackage.label,
      },
    ],
    customer_details: {
      email: userEmail || "guest@ai-nusantara.local",
    },
    enabled_payments: ["qris", "gopay", "shopeepay", "bank_transfer"],
  };

  try {
    const response = await fetch("https://app.sandbox.midtrans.com/snap/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data?.message || "Gagal membuat transaksi Midtrans." }, { status: 502 });
    }

    return NextResponse.json({
      snap_token: data.token,
      redirect_url: data.redirect_url,
      order_id: orderId,
    });
  } catch (e) {
    console.warn("Midtrans create payment failed:", e);
    return NextResponse.json({ error: "Koneksi ke Midtrans gagal." }, { status: 502 });
  }
}
