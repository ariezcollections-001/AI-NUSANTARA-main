"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Coins,
  Sparkles,
  Scale,
  Info,
  Send,
  ArrowLeft,
  Copy,
  Download,
  Volume2,
  X,
  ShoppingCart,
  FileDown,
  Search,
  Trash2,
  Bell,
} from "lucide-react";

export interface FeatureItem {
  title: string;
  slug: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "guru" | "umkm" | "mahasiswa";
}

export interface AIGeneratorProps {
  isMaintenance: boolean;
  characterBalance: number;
  onBalanceUpdated: (newBalance: number) => void;
  externalSelectedFeature?: FeatureItem | null;
  onFeatureSelect?: (feature: FeatureItem | null) => void;
}

interface MonetizationDetails {
  input_characters: number;
  output_characters: number;
  total_deducted: number;
  previous_balance: number;
  remaining_balance: number;
}

export const mockFeatureCards: FeatureItem[] = [
  {
    title: "Gen RPP",
    slug: "gen-rpp",
    description: "Buat RPP Merdeka lengkap, guru, asesmen, dan rubrik.",
    icon: Zap,
    category: "guru",
  },
  {
    title: "Buat Soal",
    slug: "buat-soal",
    description: "Buat soal HOTS pilihan ganda dan esai lengkap.",
    icon: CheckCircle2,
    category: "guru",
  },
  {
    title: "Koreksi Tugas",
    slug: "koreksi-tugas",
    description: "Beri feedback tugas siswa secara objektif.",
    icon: ShieldAlert,
    category: "guru",
  },
  {
    title: "Bahan Ajar",
    slug: "bahan-ajar",
    description: "Produksi materi ajar menarik dan mudah dipahami.",
    icon: Sparkles,
    category: "guru",
  },
  {
    title: "Bedah Jurnal",
    slug: "bedah-jurnal",
    description: "Ringkas latar belakang, metode, dan hasil jurnal akademis.",
    icon: Scale,
    category: "mahasiswa",
  },
  {
    title: "Rangkum Buku",
    slug: "rangkum-buku",
    description: "Buat ringkasan bab buku yang padat dan mudah dipahami.",
    icon: Info,
    category: "mahasiswa",
  },
  {
    title: "Kerangka Skripsi",
    slug: "kerangka-skripsi",
    description: "Buat outline skripsi bab 1-5 dengan judul dan arahan riset.",
    icon: CheckCircle2,
    category: "mahasiswa",
  },
  {
    title: "TikTok Viral",
    slug: "tiktok-viral",
    description: "Buat skrip video jualan 30-60 detik dengan hook mematikan.",
    icon: Zap,
    category: "umkm",
  },
  {
    title: "Caption IG",
    slug: "caption-ig",
    description: "Tulis caption Instagram jualan persuasif dengan hashtag.",
    icon: AlertOctagon,
    category: "umkm",
  },
  {
    title: "Ide Bisnis",
    slug: "ide-bisnis",
    description: "Analisis tren pasar lokal dan rekomendasikan ide UMKM modal kecil.",
    icon: Scale,
    category: "umkm",
  },
  {
    title: "Bahasa Formal",
    slug: "bahasa-formal",
    description: "Ubah teks bisnis kasar menjadi bahasa formal korporat.",
    icon: ShieldAlert,
    category: "umkm",
  },
];

const categoryLabels: Record<FeatureItem["category"], string> = {
  guru: "Klaster Guru",
  mahasiswa: "Klaster Mahasiswa",
  umkm: "Klaster UMKM",
};

const packages = [
  { id: "pkg_15k", name: "Paket Cuan Rakyat 15K", price: 15000, characters: 25000 },
  { id: "pkg_35k", name: "Paket Cuan Rakyat 35K", price: 35000, characters: 65000 },
  { id: "pkg_75k", name: "Paket Cuan Rakyat 75K", price: 75000, characters: 150000 },
];

const toolVariants: Record<string, { id: string; label: string }[]> = {
  "gen-rpp": [
    { id: "formal-kedinasan", label: "Format Formal Kedinasan" },
    { id: "ringkas-1-halaman", label: "Ringkas 1 Halaman" },
    { id: "kreatif-interaktif", label: "Kreatif Interaktif" },
    { id: "asesmen-lengkap", label: "Asesmen Lengkap dengan Rubrik" },
  ],
  "buat-soal": [
    { id: "hots-pilihan-ganda", label: "HOTS Pilihan Ganda" },
    { id: "hots-esai", label: "HOTS Esai" },
    { id: "campuran", label: "Campuran PG dan Esai" },
  ],
  "koreksi-tugas": [
    { id: "objektif", label: "Objektif dan Constructive" },
    { id: "rubrik", label: "Berdasarkan Rubrik" },
  ],
  "bahan-ajar": [
    { id: "presentasi", label: "Presentasi Slide" },
    { id: "modul", label: "Modul Cetak" },
    { id: "media-sosial", label: "Media Sosial Edukasi" },
    { id: "visual", label: "Visual dan Infografis" },
  ],
  "bedah-jurnal": [
    { id: "ringkasan", label: "Ringkasan eksekutif" },
    { id: "metodologi", label: "Fokus Metodologi" },
    { id: "hasil-dan-pembahasan", label: "Hasil dan Pembahasan" },
  ],
  "rangkum-buku": [
    { id: "ringkas-per-bab", label: "Ringkas per Bab" },
    { id: "poin-penting", label: "Poin Penting Saja" },
    { id: "contoh-soal", label: "Dengan Contoh Soal" },
  ],
  "kerangka-skripsi": [
    { id: "bab-1-5", label: "Bab 1-5 Lengkap" },
    { id: "minimal-berkelanjutan", label: "Minimal Bernilai Publikasi" },
  ],
  "tiktok-viral": [
    { id: "30-detik", label: "30 Detik" },
    { id: "60-detik", label: "60 Detik" },
    { id: "hook-pertama", label: "Hook di Detik Pertama" },
  ],
  "caption-ig": [
    { id: "persuasif", label: "Persuasif" },
    { id: "storytelling", label: "Storytelling Lokal" },
    { id: "mikro-influencer", label: "Mikro Influencer" },
  ],
  "ide-bisnis": [
    { id: "modal-kecil", label: "Modal Kecil" },
    { id: "lokasi", label: "Sesuai Lokasi" },
    { id: "tren", label: "Berdasarkan Tren" },
  ],
  "bahasa-formal": [
    { id: "peringatan", label: "Peringatan Formal" },
    { id: "proposal", label: "Proposal Kerja" },
    { id: "kontrak", label: "Kontrak Sederhana" },
  ],
};

export const AIGenerator: React.FC<AIGeneratorProps> = ({
  isMaintenance,
  characterBalance,
  onBalanceUpdated,
  externalSelectedFeature,
  onFeatureSelect,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [monetization, setMonetization] = useState<MonetizationDetails | null>(null);
  const [errorResponse, setErrorResponse] = useState<{
    status?: number;
    error?: string;
    details?: unknown;
  } | null>(null);
  const [inputWarning, setInputWarning] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [features] = useState<FeatureItem[]>(mockFeatureCards);
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [templateVariant, setTemplateVariant] = useState<string>("");
  const [premiumAudioLoading, setPremiumAudioLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("sales-tiktok");

  useEffect(() => {
    setIsMounted(true);

    const supabase = createClient();
    supabase.auth.getUser().then((result) => {
      if (result.data?.user?.email) {
        setUserEmail(result.data.user.email);
      }
    });
  }, []);

  const handleFeatureSelect = (feature: FeatureItem) => {
    if (onFeatureSelect) {
      onFeatureSelect(feature);
    } else {
      setSelectedFeature(feature);
    }
    setOutput(null);
    setMonetization(null);
    setErrorResponse(null);
    setPrompt("");
    setTemplateVariant("");
  };

  const handleBackToMenu = () => {
    if (onFeatureSelect) {
      onFeatureSelect(null);
    } else {
      setSelectedFeature(null);
    }
    setOutput(null);
    setMonetization(null);
    setErrorResponse(null);
    setPrompt("");
    setTemplateVariant("");
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadOutputFile = () => {
    if (!output) return;
    const effectiveFeature = externalSelectedFeature !== undefined ? externalSelectedFeature : selectedFeature;
    const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-nusantara-${effectiveFeature?.slug || "output"}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generatePremiumAudio = async () => {
    if (!output || premiumAudioLoading) return;
    setPremiumAudioLoading(true);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: output, voice: selectedVoice }),
      });
      if (!res.ok) throw new Error("Gagal membuat audio premium");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-nusantara-audio-${selectedVoice}.mp3`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Gagal membuat audio. Silakan coba lagi.");
    } finally {
      setPremiumAudioLoading(false);
    }
  };

  const inputLength = prompt.length;
  const isBalanceEnoughForInput = characterBalance > 0 && characterBalance >= inputLength;

  const handleBalanceUpdated = (newBalance: number) => {
    onBalanceUpdated(newBalance);
    try {
      localStorage.setItem("ai_nusantara_balance", String(newBalance));
    } catch {
      // ignore localStorage write failures
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    if (prompt.length > 500) {
      setErrorResponse({
        status: 400,
        error: "Input melebihi batas 500 karakter. Mohon ringkas prompt Anda.",
      });
      return;
    }

    const effectiveFeature = externalSelectedFeature !== undefined ? externalSelectedFeature : selectedFeature;
    if (!effectiveFeature) {
      setErrorResponse({
        status: 400,
        error: "Pilih fitur AI terlebih dahulu sebelum mengirim.",
      });
      return;
    }

    setLoading(true);
    setErrorResponse(null);
    setOutput(null);
    setMonetization(null);

    try {
      const params = new URLSearchParams({
        featureId: effectiveFeature.slug,
        userInput: prompt,
        userEmail: userEmail || "",
        templateVariant: templateVariant || "",
      });

      const res = await fetch(`/api/ai/process?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setErrorResponse({
          status: res.status,
          error: errorData.error || "Terjadi kesalahan pada permintaan API.",
        });
        if (errorData.current_balance !== undefined) {
          handleBalanceUpdated(errorData.current_balance);
        }
        setLoading(false);
        return;
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedOutput = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedOutput += chunk;
          setOutput(accumulatedOutput);
        }
      }

      // Calculate monetization after streaming completes
      const monetization = {
        input_characters: prompt.length,
        output_characters: accumulatedOutput.length,
        total_deducted: prompt.length + accumulatedOutput.length,
        previous_balance: characterBalance,
        remaining_balance: Math.max(0, characterBalance - (prompt.length + accumulatedOutput.length)),
      };

      setMonetization(monetization);

      if (monetization.remaining_balance !== undefined) {
        handleBalanceUpdated(monetization.remaining_balance);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Gagal terhubung ke server API.";
      setErrorResponse({
        status: 500,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // ===== FEATURE MENU VIEW (no chat I/O here) =====
  if (isMounted && !externalSelectedFeature && !selectedFeature) {
    return (
      <div className="space-y-6">
        {/* 11 Fitur Nusantara - Feature Menu */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="mb-5">
            <p className="text-[10px] uppercase font-mono tracking-widest text-amber-300">
              11 Fitur Nusantara
            </p>
            <h3 className="mt-2 text-lg font-black text-white">
              Menu Utama Platform AI: Terpisah untuk Sekolah & Bisnis Lokal
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Klik salah satu fitur di bawah untuk membuka klaster chat AI. Kotak input dan panel output akan muncul di dalam fitur yang aktif.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {(["guru", "mahasiswa", "umkm"] as const).map((cat) => {
              const label = categoryLabels[cat];
              const emoji = cat === "guru" ? "👨‍🏫" : cat === "mahasiswa" ? "🧑‍🎓" : "🛍️";
              return (
                <section key={cat} className="rounded-3xl border border-slate-800 bg-zinc-900 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="mb-5 border-b border-slate-800 pb-4">
                    <p className="text-[10px] uppercase font-mono tracking-widest text-amber-300">
                      {label}
                    </p>
                    <h4 className="mt-2 text-sm font-black text-white">
                      {emoji} {label.toUpperCase()}
                    </h4>
                  </div>
                  <div className="grid gap-4">
                    {features
                      .filter((feature) => feature.category === cat)
                      .map((feature) => {
                        const Icon = feature.icon;
                        return (
                          <button
                            key={feature.slug}
                            onClick={() => handleFeatureSelect(feature)}
                            className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-amber-400/60 hover:bg-slate-900"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-amber-300">
                                <Icon className="h-5 w-5" />
                              </div>
                              <h5 className="text-sm font-bold text-white">
                                {feature.title}
                              </h5>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-400">
                              {feature.description}
                            </p>
                          </button>
                        );
                      })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari fitur..."
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-full sm:w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPrompt("");
                  setErrorResponse(null);
                  setOutput(null);
                  setMonetization(null);
                  setTemplateVariant("");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:border-amber-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Bersihkan Layar Chat
              </button>
              <button
                onClick={() => alert("Fitur notifikasi akan segera hadir!")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:border-amber-400 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Pengumuman
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== ACTIVE FEATURE CLUSTER VIEW (chat I/O lives here) =====
  const effectiveFeature = externalSelectedFeature !== undefined ? externalSelectedFeature : selectedFeature;
  
  return (
    <div className="space-y-6">
      {/* Active Feature Cluster Header */}
      {effectiveFeature && (
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-zinc-900 to-slate-950 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-amber-300 border border-amber-400/30">
                <effectiveFeature.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-widest text-amber-300">
                  {categoryLabels[effectiveFeature.category]}
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  {categoryLabels[effectiveFeature.category]}: {effectiveFeature.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400 max-w-2xl">{effectiveFeature.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBackToMenu}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white transition hover:border-amber-400"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Menu Fitur
            </button>
          </div>
        </div>
      )}

      {/* Template Variant Radio Buttons */}
      {effectiveFeature && toolVariants[effectiveFeature.slug] && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <p className="text-[10px] uppercase font-mono tracking-widest text-amber-300 mb-3">
            Varian Gaya Desain - {effectiveFeature.title}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toolVariants[effectiveFeature.slug].map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setTemplateVariant(variant.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  templateVariant === variant.id
                    ? "border-amber-400 bg-amber-950/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    templateVariant === variant.id ? "border-amber-400" : "border-slate-500"
                  }`}>
                    {templateVariant === variant.id && (
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <span className={`text-xs font-bold ${
                    templateVariant === variant.id ? "text-amber-300" : "text-slate-300"
                  }`}>
                    {variant.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat I/O Container - inside active cluster */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        {/* Glassmorphism Alert Banner */}
        <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/60 backdrop-blur-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white mb-0.5">💡 Pengguna wajib melakukan validasi sebelum memakai hasil AI.</p>
                <p className="text-[11px] text-slate-400">Pemeriksaan fakta, penelitian mandiri, dan penyesuaian konteks resmi tetap menjadi tanggung jawab pengguna.</p>
              </div>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('info-banner');
                if (el) el.style.display = 'none';
              }}
              className="shrink-0 text-slate-500 hover:text-white transition-colors"
              aria-label="Tutup banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {errorResponse && (
          <div className={`mb-4 p-4 rounded-2xl border ${
            errorResponse.status === 503
              ? "bg-red-950/40 border-red-800/50 text-red-300"
              : errorResponse.status === 402
              ? "bg-amber-950/40 border-amber-800/50 text-amber-300"
              : "bg-red-950/40 border-red-800/50 text-red-300"
          }`}>
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold border border-current px-2 py-0.5 rounded">
                    HTTP {errorResponse.status || "ERR"}
                  </span>
                  <h3 className="font-bold uppercase">Request Cancelled</h3>
                </div>
                <p className="font-sans text-xs leading-relaxed font-medium">
                  {errorResponse.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Monetization Ledger */}
        {monetization && (
          <div className="mb-4 rounded-2xl border border-slate-800 bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-mono">
                <Coins className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Pay-Per-Character Ledger
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 px-2 py-0.5 font-bold rounded">
                Total = Input + Output
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Input Chars</p>
                <p className="font-black text-slate-200 text-sm mt-0.5">+{monetization.input_characters}</p>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Output Chars</p>
                <p className="font-black text-sky-400 text-sm mt-0.5">+{monetization.output_characters}</p>
              </div>
              <div className="bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40">
                <p className="text-[10px] text-amber-400 uppercase font-bold">Total Debited</p>
                <p className="font-black text-red-400 text-sm mt-0.5">-{monetization.total_deducted}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
              <span>Awal: <strong className="text-slate-200">{monetization.previous_balance}</strong></span>
              <span>→</span>
              <span>Sisa Saldo: <strong className="text-emerald-400 font-bold">{monetization.remaining_balance} CHARS</strong></span>
            </div>
          </div>
        )}

        {/* AI Output Panel */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-zinc-900 min-h-[240px] flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <label className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Output AI
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyOutput}
                disabled={!output}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy className="w-3 h-3" />
                {copied ? "Disalin" : "Salin Cepat"}
              </button>
              <button
                type="button"
                onClick={downloadOutputFile}
                disabled={!output}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileDown className="w-3 h-3" />
                Ekspor ke MS Word
              </button>
              {output && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 font-bold rounded">
                  {output.length} CHARS
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex-1">
            {output ? (
              <div className="rounded-xl bg-black/60 border border-slate-800 p-4 text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap selection:bg-amber-400 selection:text-black">
                {output}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center p-6 text-slate-600 space-y-2 border-2 border-dashed border-slate-800 rounded-xl">
                <Info className="w-8 h-8 text-slate-700" />
                <p className="text-xs font-mono">
                  Respons AI akan muncul di sini. Kirim prompt di bawah untuk memulai.
                </p>
              </div>
            )}
          </div>

          {output ? (
            <div className="px-4 pb-3 flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    const utterance = new SpeechSynthesisUtterance(output);
                    window.speechSynthesis.speak(utterance);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-bold uppercase tracking-widest text-slate-300 transition hover:border-amber-400"
              >
                <Volume2 className="w-3 h-3" />
                Voice Read
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300"
                >
                  <option value="sales-tiktok">🎤 Sales TikTok FYP</option>
                  <option value="kakak-ayu">🧑‍🍼 Kakak Ayu Olshop</option>
                  <option value="narator-pro">🎙️ Narator Profesional</option>
                </select>
                <button
                  type="button"
                  onClick={generatePremiumAudio}
                  disabled={!output || premiumAudioLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 font-bold uppercase tracking-widest text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {premiumAudioLoading ? "Memproses..." : "🔊 Ubah Menjadi Audio Suara Manusia (MP3)"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Chat Input Form - inside active cluster */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Input Prompt AI
            </label>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-500 uppercase font-bold">Length:</span>
              <span className={`font-bold border px-1.5 py-0.5 rounded ${isBalanceEnoughForInput ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" : "bg-red-950/40 text-red-400 border-red-800/50"}`}>
                {inputLength.toLocaleString("id-ID")} CHARS
              </span>
            </div>
          </div>

          <textarea
            value={prompt}
            maxLength={500}
            onChange={(e) => {
              const nextValue = e.target.value;
              setPrompt(nextValue);
              setInputWarning(
                nextValue.length >= 500
                  ? "⚠️ Batas sistem 500 karakter tercapai. Silakan ringkas pesan Anda."
                  : "",
              );
            }}
            placeholder={
              characterBalance <= 0
                ? "⚠️ Saldo Kuota Karakter Anda Habis! Silakan lakukan isi ulang."
                : effectiveFeature
                ? `Ketik instruksi untuk fitur: ${effectiveFeature.title}`
                : "Masukkan pertanyaan, data, atau instruksi analisis..."
            }
            rows={4}
            disabled={loading || characterBalance <= 0}
            className={`w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none ${characterBalance <= 0 ? "placeholder:text-red-400 bg-red-950/20" : ""}`}
          />

          {/* Counter and Pre-Check */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-300">Pre-Check Saldo:</span>
              </div>
              {isBalanceEnoughForInput ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CUKUP (+{characterBalance - inputLength} chars sisa)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>KURANG {(inputLength - characterBalance).toLocaleString("id-ID")} CHARS</span>
                </div>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-500">
              {inputLength} / 500
            </div>
          </div>

          {inputWarning ? (
            <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-red-400 text-[11px] font-mono">
              {inputWarning}
            </div>
          ) : null}

          {/* Send Button with Paper Plane Icon */}
          <button
            type="submit"
            disabled={loading || !prompt.trim() || !isBalanceEnoughForInput || isMaintenance}
            className={`w-full py-3.5 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-2xl border transition-all ${
              isMaintenance
                ? "bg-red-950/40 text-red-400 border-red-800/50 cursor-not-allowed"
                : !isBalanceEnoughForInput
                ? "bg-amber-950/30 text-amber-400 border-amber-800/40 cursor-not-allowed"
                : loading || !prompt.trim()
                ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 hover:from-amber-400 hover:to-orange-400 shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                <span>PROSES AI (TEMP 0.0)...</span>
              </>
            ) : isMaintenance ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>MAINTENANCE MODE (HTTP 503)</span>
              </>
            ) : !isBalanceEnoughForInput ? (
              <>
                <Coins className="w-4 h-4" />
                <span>SALDO TIDAK CUKUP (ISI ULANG)</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>KIRIM PROMPT AI</span>
              </>
            )}
          </button>

          {/* Refill Button - Always visible under input */}
          <button
            type="button"
            onClick={() => setShowPackages(true)}
            className="w-full py-3 px-4 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            🛒 ISI ULANG SALDO / BELI PAKET
          </button>

          {/* Disclaimer */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            💡 Peringatan: AI ini adalah asisten pembantu tugas administrasi Anda. Pengguna diwajibkan untuk memeriksa, meneliti, dan menyelaraskan kembali setiap hasil output sebelum digunakan secara resmi.
          </p>
        </form>
      </div>

      {/* Package Modal */}
      {showPackages && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">🛒 PILIH PAKET ISULANG</h3>
              <button onClick={() => setShowPackages(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {packages.map((pkg) => (
                <a
                  key={pkg.id}
                  href={`/dashboard/checkout?package=${pkg.id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:border-amber-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-black text-white">{pkg.name}</p>
                    <p className="text-xs text-slate-400">{pkg.characters.toLocaleString("id-ID")} CHARS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-amber-400">Rp {pkg.price.toLocaleString("id-ID")}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};