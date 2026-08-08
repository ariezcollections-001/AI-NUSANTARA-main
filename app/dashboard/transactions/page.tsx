"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { History, AlertCircle, CheckCircle2, Loader2, Calendar, Hash, QrCode } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Transaction = {
  id: string;
  package: string;
  qrisAmount: number;
  chars: number;
  provider: string;
  status: "success" | "pending" | "failed";
  createdAt: string;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Transaction[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const ready = useRoleGuard("user");

  useEffect(() => {
    if (!ready) return;
    setIsMounted(true);
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const loadTransactions = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("bikinai_transactions");
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardShell initialBalance={0} isMaintenance={false} onLogout={async () => {}} showChrome={false}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-white">Riwayat Transaksi</h1>
              <p className="text-sm text-slate-400">Log kuota paket yang pernah dibeli melalui QRIS Midtrans.</p>
            </div>
            <button
              onClick={() => router.push("/dashboard/checkout")}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
            >
              <QrCode className="w-4 h-4" />
              Beli Paket
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Memuat data transaksi...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 text-center">
              <History className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Belum ada riwayat transaksi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-mono">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Paket</th>
                    <th className="py-3 pr-4">QRIS</th>
                    <th className="py-3 pr-4">CHARS</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                      <td className="py-3 pr-4 font-mono text-slate-300">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          {tx.id}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-white">{tx.package}</td>
                      <td className="py-3 pr-4 text-slate-300 font-mono">
                        Rp{Number(tx.qrisAmount).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 pr-4 text-amber-400 font-bold">{tx.chars}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            tx.status === "success"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40"
                              : tx.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/40"
                              : "bg-red-500/10 text-red-400 border border-red-500/40"
                          }`}
                        >
                          {tx.status === "success" && <CheckCircle2 className="w-3 h-3" />}
                          {tx.status === "pending" && <Loader2 className="w-3 h-3 animate-spin" />}
                          {tx.status === "failed" && <AlertCircle className="w-3 h-3" />}
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(tx.createdAt).toLocaleString("id-ID")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}