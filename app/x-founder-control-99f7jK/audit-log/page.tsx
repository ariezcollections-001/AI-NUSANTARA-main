import Link from "next/link";

const mockAuditLogs = [
  {
    timestamp: "2026-07-28 18:15:02",
    ipAddress: "103.25.86.12",
    activity: "User membeli paket QRIS Rp15.000",
    securityStatus: "Safe",
  },
  {
    timestamp: "2026-07-28 18:12:41",
    ipAddress: "198.51.100.22",
    activity: "Bot terdeteksi menyerang sistem",
    securityStatus: "Danger",
  },
  {
    timestamp: "2026-07-28 18:08:17",
    ipAddress: "203.119.123.75",
    activity: "Admin founder masuk ke dashboard Founder Control",
    securityStatus: "Safe",
  },
  {
    timestamp: "2026-07-28 18:02:08",
    ipAddress: "10.0.0.23",
    activity: "Percobaan login failed 5 kali dari IP asing",
    securityStatus: "Danger",
  },
];

export default function AuditLogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Founder Control Audit Log</p>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mt-2">Security Monitor Live</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Monitor audit siber premium dalam tampilan Dark-Ops. Data mock diperbarui untuk
tes visibilitas log sistem dan aktivitas keamanan.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              Status: <span className="font-semibold text-amber-100">Operational</span>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead className="bg-slate-900/95 text-slate-400 uppercase text-[11px] tracking-[0.2em]">
                <tr>
                  <th className="px-4 py-4">Waktu Kejadian</th>
                  <th className="px-4 py-4">Alamat IP User</th>
                  <th className="px-4 py-4">Aktivitas</th>
                  <th className="px-4 py-4">Status Keamanan</th>
                </tr>
              </thead>
              <tbody>
                {mockAuditLogs.map((log, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-slate-950/80" : "bg-slate-900/80"}>
                    <td className="px-4 py-4 text-slate-200">{log.timestamp}</td>
                    <td className="px-4 py-4 text-slate-300 font-mono">{log.ipAddress}</td>
                    <td className="px-4 py-4 text-slate-200">{log.activity}</td>
                    <td className={
                      `px-4 py-4 font-semibold ${
                        log.securityStatus === "Danger" ? "text-rose-400" : "text-emerald-400"
                      }`
                    }>
                      {log.securityStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
