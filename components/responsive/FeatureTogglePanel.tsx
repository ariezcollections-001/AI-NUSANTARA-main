"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { useFeaturePrefs } from "@/lib/useFeaturePrefs";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";

/**
 * 🎛️ PANEL TOMBOL GESER FITUR (sisi user).
 * Tombol kecil di beranda → membuka modal daftar fitur dengan switch
 * aktif/nonaktif. Fitur yang dimatikan disembunyikan dari beranda
 * (disimpan di localStorage per perangkat).
 */
export default function FeatureTogglePanel() {
  const [open, setOpen] = useState(false);
  const { isEnabled, toggleFeature, resetAllFeatures, hiddenCount } = useFeaturePrefs();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hiddenCount ? `${hiddenCount} fitur sedang disembunyikan` : "Atur fitur yang tampil di beranda"}
        className="relative inline-flex items-center gap-1.5 rounded-lg bg-black/40 border border-yellow-400/30 px-2.5 py-1.5 text-white hover:border-yellow-400/60 transition-all active:scale-95"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black uppercase tracking-wider">Fitur</span>
        {hiddenCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[9px] font-black text-slate-950 flex items-center justify-center">
            {hiddenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-2 sm:items-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-yellow-400/30 bg-[#030712] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">
                🎛️ Atur Tampilan Fitur
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2 py-1 rounded-lg bg-black/40 border border-yellow-400/30 text-[10px] font-bold text-white hover:border-yellow-400/60"
              >
                ✕ Tutup
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
              Geser tombol untuk <b className="text-white">menampilkan</b> /{" "}
              <b className="text-slate-300">menyembunyikan</b> fitur di beranda. Pengaturan
              tersimpan di perangkat ini.
            </p>

            <div className="space-y-2">
              {FEATURE_CATALOG.map((f) => {
                const on = isEnabled(f.feature_slug);
                return (
                  <div
                    key={f.feature_slug}
                    className={`flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border transition-colors ${
                      on ? "border-emerald-500/30" : "border-slate-700/60 opacity-70"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{f.feature_name}</div>
                      <div className={`text-[9px] font-bold ${on ? "text-emerald-400" : "text-slate-500"}`}>
                        {on ? "● AKTIF" : "○ NONAKTIF"} · {f.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleFeature(f.feature_slug)}
                      className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
                        on ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                      title={on ? "Geser untuk menyembunyikan" : "Geser untuk menampilkan"}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          on ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetAllFeatures}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                ↺ Tampilkan Semua
              </button>
              <span className="text-[9px] text-slate-500">
                {hiddenCount ? `${hiddenCount} fitur disembunyikan` : "Semua fitur tampil"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}