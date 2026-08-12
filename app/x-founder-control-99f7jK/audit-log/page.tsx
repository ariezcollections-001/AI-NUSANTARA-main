"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditEntry = {
  id: number | string;
  timestamp: string;
  ip_address: string | null;
  event_type: string;
  details: Record<string, unknown> | null;
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/audit", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Gagal memuat log (${res.status})`);
        setLogs([]);
        return;
      }
      setLogs(data.logs || []);
    } catch (err) {
      setError("Kesalahan jaringan saat memuat log audit.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const formattedLogs = logs.map((log) => ({
    ...log,
    detailText: log.details ? JSON.stringify(log.details) : "",
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Founder Control Audit Log</p>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mt-2">Security Monitor Live</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Monitor audit keamanan real-time dari tabel security_logs. Data diambil langsung dari database Supabase.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadLogs()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            ⟳ Muat Ulang
          </button>
          <Link
            href="/x-founder-control-99f7jK"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-500 hover:text-amber-300"
          >
            ← Kembali ke Dashboard Utama
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live audit</p>
              <h2 className="text-2xl font-bold text-white">Security Monitor Live</h2>
            </div>
            <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Status:{" "}
              <span className="font-semibold text-amber-100">
                {loading ? "Memuat..." : error ? "Gagal" : `${formattedLogs.length} entri`}
              </span>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-slate-200">
                  <thead className="bg-slate-900/95 text-slate-400 uppercase text-[11px] tracking-[0.2em]">
                    <tr>
                      <th className="px-4 py-4">Waktu Kejadian</th>
                      <th className="px-4 py-4">Tipe Event</th>
                      <th className="px-4 py-4">Alamat IP</th>
                      <th className="px-4 py-4">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          {loading ? "Memuat log audit..." : "Belum ada log audit."}
                        </td>
                      </tr>
                    ) : (
                      formattedLogs.map((log, idx) => (
                        <tr
                          key={String(log.id) ?? idx}
                          className={idx % 2 === 0 ? "bg-slate-950/80" : "bg-slate-900/80"}
                        >
                          <td className="px-4 py-4 text-slate-200 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-4">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-amber-300">
                              {log.event_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-300 font-mono">{log.ip_address || "—"}</td>
                          <td className="px-4 py-4 text-slate-400 text-xs font-mono break-all">
                            {log.detailText || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
