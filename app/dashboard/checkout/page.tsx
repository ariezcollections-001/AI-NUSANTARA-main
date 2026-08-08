"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRoleGuard } from "@/lib/useRoleGuard";

const paymentPackages = [
  {
    id: "pemula",
    title: "📦 Paket Pemula",
    price: 15000,
    quota: 50000,
    description: "50.000 Karakter AI untuk mulai produktif.",
  },
  {
    id: "pro",
    title: "🚀 Paket Pro Bisnis",
    price: 35000,
    quota: 150000,
    description: "150.000 Karakter AI untuk skala jualan dan konten.",
  },
  {
    id: "founder",
    title: "👑 Paket Founder Choice",
    price: 75000,
    quota: 400000,
    description: "400.000 Karakter AI untuk Founder dan tim elite.",
  },
];

interface MidtransSnapWindow extends Window {
  snap?: {
    pay: (
      token: string,
      options: {
        onSuccess?: () => void;
        onPending?: () => void;
        onError?: () => void;
        onClose?: () => void;
      },
    ) => void;
  };
}

function loadMidtransSnap() {
  if (typeof window === "undefined") return;
  const win = window as MidtransSnapWindow;
  if (win.snap) return;
  const scriptId = "midtrans-snap-script";
  if (document.getElementById(scriptId)) return;
  const script = document.createElement("script");
  script.id = scriptId;
  script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
  script.async = true;
  document.body.appendChild(script);
}

export default function CheckoutPage() {
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState(paymentPackages[0]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [qrisEnabled, setQrisEnabled] = useState<boolean>(true);
  const ready = useRoleGuard("user");

  useEffect(() => {
    if (!ready) return;
    loadMidtransSnap();

    const supabase = createClient();
    supabase.auth.getUser().then((result) => {
      if (result.data?.user?.email) {
        setUserEmail(result.data.user.email);
      }
    });

    // Check QRIS toggle from Founder config
    try {
      const qrisVal = localStorage.getItem('founder_config_qris_enabled');
      if (qrisVal !== null) {
        setQrisEnabled(qrisVal === 'true');
      }
    } catch {
      // ignore
    }
  }, [ready]);

  const handleChoosePackage = async () => {
    setLoading(true);
    setStatusMessage("Memproses paket pembayaran dan memuat Snap Midtrans...");

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          userEmail,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatusMessage(data.error || "Gagal membuat pembayaran. Coba lagi nanti.");
        return;
      }

      if (typeof window === "undefined") {
        setStatusMessage("Gagal memuat Midtrans Snap. Muat ulang halaman.");
        return;
      }
      const win = window as MidtransSnapWindow;
      if (!win.snap) {
        setStatusMessage("Gagal memuat Midtrans Snap. Muat ulang halaman.");
        return;
      }

      setStatusMessage("Menampilkan popup pembayaran QRIS/E-Wallet...");
      win.snap.pay(data.snap_token, {
        onSuccess: () => {
          setStatusMessage("Pembayaran berhasil. Sistem akan memproses kuota Anda.");
          router.push("/dashboard");
        },
        onPending: () => {
          setStatusMessage("Pembayaran menunggu konfirmasi. Silakan selesaikan pembayaran di aplikasi Anda.");
        },
        onError: () => {
          setStatusMessage("Terjadi kesalahan saat membuka menu pembayaran. Coba lagi.");
        },
        onClose: () => {
          setStatusMessage("Popup pembayaran ditutup. Coba lagi jika ingin melanjutkan.");
        },
      });
    } catch {
      setStatusMessage("Gagal menghubungi server pembayaran. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl border border-[#2f3a55] bg-[#0b1220]/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="mb-8 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-300">Checkout Paket AI-NUSANTARA</p>
            <h1 className="mt-4 text-4xl font-extrabold text-white">Pilih Paket Kuota AI dan Bayar Sekarang</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300 max-w-2xl mx-auto">
              Nikmati paket karakter AI yang dirancang khusus untuk Guru, Mahasiswa, dan UMKM. Pembayaran QRIS/E-Wallet langsung terhubung ke Midtrans.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {paymentPackages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackage(pkg)}
                className={`rounded-3xl border p-6 text-left transition ${
                  selectedPackage.id === pkg.id
                    ? "border-amber-400 bg-[#141a2b] shadow-[0_20px_60px_rgba(250,204,21,0.18)]"
                    : "border-[#26314a] bg-[#0f172a] hover:border-amber-300"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black text-white">{pkg.title}</h2>
                  <div className="rounded-full bg-[#1f2937] px-3 py-1 text-xs uppercase tracking-widest text-slate-300">
                    {pkg.quota.toLocaleString("id-ID")} chars
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-6">{pkg.description}</p>
                <div className="flex items-center justify-between text-white">
                  <span className="text-xs uppercase text-slate-400">Harga</span>
                  <span className="text-2xl font-extrabold text-amber-300">Rp {pkg.price.toLocaleString("id-ID")}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-[#26314a] bg-[#08101f] p-6">
            <h2 className="text-lg font-black text-white">Informasi Pembayaran</h2>
            <p className="mt-3 text-sm text-slate-400">
              Paket yang dipilih: <span className="font-bold text-white">{selectedPackage.title}</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Email pengguna: <span className="font-bold text-white">{userEmail || "(tidak login)"}</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Jika Anda belum login, setelah pembayaran kuota akan ditautkan ke akun yang terdeteksi dari browser Anda.
            </p>
            {!qrisEnabled ? (
              <div className="mt-6 rounded-2xl border border-rose-500/50 bg-rose-500/10 p-6 text-center">
                <div className="text-4xl mb-3">🔧</div>
                <h3 className="text-lg font-bold text-rose-400">Gerbang Pembayaran Sedang dalam Perawatan</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Maaf, sistem pembayaran QRIS sedang dalam maintenance. Silakan coba lagi beberapa saat. Terima kasih atas kesabaran Anda.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleChoosePackage}
                disabled={loading}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-black uppercase tracking-widest text-[#111827] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Memproses pembayaran..." : "Pilih Paket & Bayar Sekarang"}
              </button>
            )}
            {statusMessage ? (
              <div className="mt-4 rounded-2xl border border-[#334155] bg-[#0f172a] p-4 text-sm text-slate-300">
                {statusMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
