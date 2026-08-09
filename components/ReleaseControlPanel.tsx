"use client";

import React, { useEffect, useRef, useState } from "react";

type ReleaseInfo = {
  version: string;
  label: string;
  commit: string;
  deployed_at: string;
  deployed_by: string;
};

type EnvironmentInfo = {
  commit: string;
  ref: string;
  vercelEnv: string;
};

type ReleaseState = {
  current: ReleaseInfo | null;
  previous: ReleaseInfo | null;
  history: ReleaseInfo[];
  environment: EnvironmentInfo;
};

export default function ReleaseControlPanel() {
  const [state, setState] = useState<ReleaseState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("current");
  const [retryCount, setRetryCount] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  async function loadState(retries = 2) {
    try {
      const res = await fetch("/api/founder/release", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        if (retries > 0) {
          setRetryCount(retries);
          await new Promise((r) => setTimeout(r, 1000));
          return loadState(retries - 1);
        }
        setAuthorized(false);
        setMessage({ type: "error", text: data?.error || `Gagal memuat status release (${res.status}).` });
        setLoading(false);
        return;
      }
      setAuthorized(true);
      setState(data.data);
      setRetryCount(0);
    } catch {
      if (retries > 0) {
        setRetryCount(retries);
        await new Promise((r) => setTimeout(r, 1000));
        return loadState(retries - 1);
      }
      setAuthorized(false);
      setMessage({ type: "error", text: "Kesalahan jaringan saat memuat status release." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    
    // Store previous focus
    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [previewOpen]);

  useEffect(() => {
    if (!previewOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [previewOpen]);

  useEffect(() => {
    if (previewOpen && previewRef.current) {
      // Focus trap: focus the modal when it opens
      previewRef.current.focus();
    }
  }, [previewOpen]);

  async function runAction(action: string, extra: Record<string, unknown> = {}, retries = 2) {
    setActionLoading(action);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status >= 500 && retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
          // Keep actionLoading during retry to prevent double-submit
          return runAction(action, extra, retries - 1);
        }
        setMessage({ type: "error", text: data?.error || `Aksi gagal (${res.status}).` });
        setActionLoading(null);
        return;
      }
      setState(data.data);
      setActionLoading(null);
      if (action === "deploy") {
        setMessage({ type: "success", text: `🚀 Release ${data.data.current.version} berhasil di-deploy dan dicatat di audit log.` });
      } else if (action === "rollback") {
        setMessage({ type: "success", text: `↩️ Rollback ke ${data.data.current.version} berhasil dieksekusi.` });
      } else if (action === "preview") {
        setMessage({ type: "success", text: `👁️ Preview versi ${data.data.release.version} dibuka.` });
        setPreviewOpen(true);
      }
    } catch {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        // Keep actionLoading during retry to prevent double-submit
        return runAction(action, extra, retries - 1);
      }
      setMessage({ type: "error", text: "Kesalahan jaringan saat menjalankan aksi release." });
      setActionLoading(null);
    }
  }

  function confirmDeploy() {
    if (!window.confirm("Apakah Anda yakin ingin men-deploy build terbaru ke produksi? Aksi ini akan mencatat versi baru dan tidak bisa dibatalkan.")) return;
    runAction("deploy");
  }

  function confirmRollback() {
    if (!state?.previous) return;
    if (!window.confirm(`Apakah Anda yakin ingin rollback ke versi ${state.previous.version}? Versi ${state.current?.version ?? "current"} akan menjadi versi sebelumnya.`)) return;
    runAction("rollback");
  }

  function previewVersion() {
    if (!state) return;
    if (selectedVersion !== "current" && selectedVersion !== "previous") {
      const found = state.history.find((r) => r.version === selectedVersion);
      if (!found) {
        setMessage({ type: "error", text: "Versi yang dipilih tidak ditemukan." });
        return;
      }
    }
    const versionLabel = selectedVersion === "current" && state.current
      ? state.current.version
      : selectedVersion === "previous" && state.previous
        ? state.previous.version
        : selectedVersion;
    if (!window.confirm(`Buka preview untuk versi ${versionLabel}?`)) return;
    runAction("preview", { target: selectedVersion });
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function timeAgo(iso: string) {
    try {
      const now = Date.now();
      const then = new Date(iso).getTime();
      const seconds = Math.floor((now - then) / 1000);
      if (seconds < 60) return `${seconds} detik yang lalu`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} menit yang lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam yang lalu`;
      const days = Math.floor(hours / 24);
      return `${days} hari yang lalu`;
    } catch {
      return "";
    }
  }

  function getSelectedRelease() {
    if (!state) return null;
    if (selectedVersion === "current") return state.current;
    if (selectedVersion === "previous") return state.previous;
    return state.history.find((r) => r.version === selectedVersion) ?? null;
  }

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          <span className="text-sm text-slate-400">
            Memeriksa akses Release Control...
            {retryCount > 0 && <span className="ml-2 text-xs text-amber-400">(percobaan ulang {retryCount})</span>}
          </span>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return null;
  }

  if (authorized === null && !loading) {
    return null;
  }

  if (!state) {
    return null;
  }

  const envBadge =
    state.environment.vercelEnv === "production"
      ? "PRODUCTION"
      : state.environment.vercelEnv === "preview"
        ? "PREVIEW"
        : "DEVELOPMENT";

  const selectedRelease = getSelectedRelease();

  return (
    <div className="bg-slate-900 rounded-3xl border border-rose-500/30 p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-rose-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🚀</span>
          <div>
            <h3 className="text-md font-bold tracking-wide text-rose-300">RELEASE CONTROL PANEL</h3>
            <p className="text-[11px] text-slate-500">FOUNDER-ONLY · Deploy, Rollback & Preview rilis aplikasi</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-400">
          🔒 {envBadge}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-rose-800/40">
          <div className="text-[10px] uppercase tracking-[0.3em] text-rose-400 font-mono">Versi Aktif</div>
          {state.current ? (
            <>
              <div className="mt-2 text-3xl font-bold text-white font-mono">{state.current.version}</div>
              <div className="mt-1 text-xs text-slate-400">
                {state.current.label} · commit <span className="font-mono text-rose-300">{state.current.commit.slice(0, 7)}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {formatDate(state.current.deployed_at)} · {timeAgo(state.current.deployed_at)} · oleh {state.current.deployed_by}
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-slate-500">Belum ada release terdaftar.</div>
          )}
        </div>
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-mono">Versi Sebelumnya</div>
          {state.previous ? (
            <>
              <div className="mt-2 text-3xl font-bold text-slate-200 font-mono">{state.previous.version}</div>
              <div className="mt-1 text-xs text-slate-500">
                {state.previous.label} · commit <span className="font-mono text-slate-400">{state.previous.commit.slice(0, 7)}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                {formatDate(state.previous.deployed_at)} · {timeAgo(state.previous.deployed_at)} · oleh {state.previous.deployed_by}
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-slate-500">Belum ada versi sebelumnya.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={confirmDeploy}
          disabled={actionLoading !== null}
          className="px-4 py-3 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-bold text-xs rounded-xl shadow-lg hover:from-rose-500 hover:to-orange-400 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="Deploy versi terbaru ke produksi"
        >
          {actionLoading === "deploy" ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>MEN-DEPLOY...</span>
            </>
          ) : (
            <><span aria-hidden="true">🚀</span> <span>DEPLOY LATEST</span></>
          )}
        </button>

        <button
          onClick={confirmRollback}
          disabled={!state.previous || actionLoading !== null}
          className="px-4 py-3 bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl shadow-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="Rollback ke versi sebelumnya"
        >
          {actionLoading === "rollback" ? (
            <>
              <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>ROLLBACK...</span>
            </>
          ) : (
            <><span aria-hidden="true">↩️</span> <span>ROLLBACK PREVIOUS</span></>
          )}
        </button>

        <button
          onClick={previewVersion}
          disabled={actionLoading !== null}
          className="px-4 py-3 bg-sky-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-sky-500 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="Preview versi yang dipilih"
        >
          {actionLoading === "preview" ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>MENGAMBIL PREVIEW...</span>
            </>
          ) : (
            <><span aria-hidden="true">👁️</span> <span>PREVIEW VERSION</span></>
          )}
        </button>
      </div>

      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-sky-400 font-mono">Pilih Versi untuk Preview</div>
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            disabled={actionLoading !== null}
            className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Pilih versi untuk preview"
          >
            {state.current && <option value="current">{state.current.version} — Versi Aktif</option>}
            {state.previous && <option value="previous">{state.previous.version} — Versi Sebelumnya</option>}
            {state.history.slice(0, 5).map((r) => (
              <option key={r.version + r.deployed_at} value={r.version}>
                {r.version} — {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={previewVersion}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-xs font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Lihat Detail
          </button>
        </div>
      </div>

      {state.history.length > 0 && (
        <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-mono mb-3">Riwayat 10 Release Terakhir</div>
          <div className="space-y-2 max-h-56 overflow-y-auto" role="list" aria-label="Riwayat release">
            {state.history.map((r, i) => (
              <div key={r.version + r.deployed_at + i} className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800" role="listitem">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-rose-300">{r.version}</span>
                  <span className="text-[11px] text-slate-400">{r.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-mono">{r.commit.slice(0, 7)}</div>
                  <div className="text-[10px] text-slate-600">{formatDate(r.deployed_at)} · {timeAgo(r.deployed_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <span className="text-[11px] text-slate-500 font-mono">
          ENV: {state.environment.vercelEnv} · BRANCH: {state.environment.ref || "—"}
        </span>
        <span className="text-[11px] text-slate-500 font-mono">
          COMMIT: {state.environment.commit ? state.environment.commit.slice(0, 7) : "—"}
        </span>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm font-bold ${
            message.type === "success"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
          }`}
          role="alert"
          aria-live="assertive"
        >
          {message.text}
        </div>
      )}

      {previewOpen && state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewOpen(false);
            }
          }}
        >
          <div 
            ref={previewRef} 
            className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden outline-none"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
              <div>
                <div id="preview-title" className="text-xs uppercase tracking-[0.3em] text-sky-400">👁️ Preview Release</div>
                <div className="text-lg font-bold text-white">
                  {selectedRelease?.version ?? selectedVersion}
                </div>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 rounded px-2 py-1"
                aria-label="Tutup preview"
              >
                Tutup
              </button>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const release = selectedRelease;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Versi</div>
                        <div className="mt-1 font-mono font-bold text-slate-100">
                          {release?.version ?? "—"}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Label</div>
                        <div className="mt-1 font-bold text-slate-100">
                          {release?.label ?? "—"}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Commit</div>
                        <div className="mt-1 font-mono text-xs text-sky-300">
                          {release?.commit ? `${release.commit.slice(0, 7)}` : "—"}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Waktu</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {release?.deployed_at ? formatDate(release.deployed_at) : "—"}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Preview menampilkan metadata versi yang dipilih. Deploy penuh dilakukan melalui tombol 🚀 DEPLOY LATEST di panel ini.
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}