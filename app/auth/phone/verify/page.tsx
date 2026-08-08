"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function PhoneVerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-center">
        <ShieldOff className="mx-auto mb-5 h-14 w-14 text-amber-400" />
        <h1 className="text-3xl font-black text-white mb-4">Phone auth fallback dinonaktifkan</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Mode login telepon lokal tidak lagi didukung. Gunakan login email/password atau Google OAuth resmi di halaman masuk.
        </p>
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-3xl bg-amber-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400"
          >
            Kembali ke Login
          </Link>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-200 transition hover:border-amber-400 hover:text-white"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
