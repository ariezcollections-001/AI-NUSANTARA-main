"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDashboardLive } from "@/components/DashboardLiveContext";
import {
  ArrowLeft,
  Send,
  Copy,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
  Wallet,
  ChevronDown,
  Settings,
  History,
  LogOut,
  AlertTriangle,
} from "lucide-react";

interface FiturNusantara {
  id: string;
  nama: string;
  desc: string;
  cat: string;
  contoh: string;
}

interface ResponsiveDashboardProps {
  maxInputChars?: number;
}

interface MonetizationResult {
  input_characters: number;
  output_characters: number;
  total_deducted: number;
  previous_balance: number;
  remaining_balance: number;
  balance_updated: boolean;
}

interface SseFrame {
  text?: string;
  type?: "done" | "error";
  error?: string;
  monetization?: MonetizationResult;
}

const fiturNusantara: FiturNusantara[] = [
  {
    id: "gen-rpp",
    nama: "⚡ Gen RPP",
    desc: "Buat RPP Merdeka lengkap, guru, asesmen, dan rubrik.",
    cat: "GURU",
    contoh: "Buatkan RPP Matematika kelas 7 tentang aljabar dengan model pembelajaran PBL.",
  },
  {
    id: "buat-soal",
    nama: "📝 Buat Soal",
    desc: "Buat soal HOTS pilihan ganda dan esai lengkap.",
    cat: "GURU",
    contoh: "Buatkan 5 soal HOTS pilihan ganda tentang fotosintesis untuk kelas 8.",
  },
  {
    id: "koreksi-tugas",
    nama: "🛠️ Koreksi Tugas",
    desc: "Beri feedback tugas siswa secara objektif.",
    cat: "GURU",
    contoh: "Koreksi esai siswa tentang perjuangan kemerdekaan dan beri nilai objektif.",
  },
  {
    id: "bahan-ajar",
    nama: "📚 Bahan Ajar",
    desc: "Produksi materi ajar menarik dan mudah dipahami.",
    cat: "GURU",
    contoh: "Susun bahan ajar tentang sistem tata surya untuk kelas 6 SD.",
  },
  {
    id: "bedah-jurnal",
    nama: "📊 Bedah Jurnal",
    desc: "Ringkas latar belakang, metode, dan hasil jurnal akademis.",
    cat: "MAHASISWA",
    contoh: "Bedah jurnal tentang pengaruh sosial media terhadap hasil belajar siswa.",
  },
  {
    id: "rangkum-buku",
    nama: "📖 Rangkum Buku",
    desc: "Buat ringkasan bab buku yang padat dan mudah dipahami.",
    cat: "MAHASISWA",
    contoh: "Rangkum bab 4 buku Psikologi Pendidikan tentang teori belajar kognitif.",
  },
  {
    id: "kerangka-skripsi",
    nama: "🎓 Kerangka Skripsi",
    desc: "Buat outline skripsi bab 1-5 dengan judul dan arahan riset.",
    cat: "MAHASISWA",
    contoh: "Buat kerangka skripsi tentang analisis kepuasan pelanggan PT XYZ.",
  },
  {
    id: "tiktok-viral",
    nama: "🔥 TikTok Viral",
    desc: "Buat skrip video jualan 30-60 detik dengan hook mematikan.",
    cat: "UMKM",
    contoh: "Buat skrip video TikTok untuk jualan kopi sachet dengan harga 5rb.",
  },
  {
    id: "caption-ig",
    nama: "🖼️ Caption IG",
    desc: "Tulis caption Instagram jualan persuasif dengan hashtag.",
    cat: "UMKM",
    contoh: "Buat 5 caption Instagram untuk promosi baju batik akhir tahun.",
  },
  {
    id: "ide-bisnis",
    nama: "📈 Ide Bisnis",
    desc: "Analisis tren pasar lokal dan rekomendasi ide UMKM modal kecil.",
    cat: "UMKM",
    contoh: "Berikan 3 ide bisnis modal 5 juta untuk kalangan milenial di kota kecil.",
  },
  {
    id: "bahasa-formal",
    nama: "💼 Bahasa Formal",
    desc: "Ubah teks bisnis kasar menjadi bahasa formal korporat.",
    cat: "UMKM",
    contoh: "Ubah pesan WhatsApp 'Mau nanya soal harga barangnya' menjadi bahasa formal.",
  },
  {
    id: "audio-mp3",
    nama: "🎙️ Audio MP3 Manusia Luwes",
    desc: "Buat skrip narasi audio dengan nuansa suara manusia alami dan heartfelt.",
    cat: "UMUM",
    contoh: "Buatkan naskah narasi audio promosi untuk produk lokal dengan gaya bicara santai.",
  },
  {
    id: "generator-propaganda",
    nama: "📢 Generator Propaganda Konten",
    desc: "Rancang materi persuasif dan konten propaganda yang kuat dan menarik.",
    cat: "UMUM",
    contoh: "Buatkan 3 varian konten propaganda untuk kampanye anti-narkoba di kalangan remaja.",
  },
];

const CATEGORIES = ["GURU", "MAHASISWA", "UMKM", "UMUM"];

const CATEGORY_COLORS: Record<string, string> = {
  GURU: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  MAHASISWA: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  UMKM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  UMUM: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
};


export default function TampilanPC({
  maxInputChars = 500,
}: ResponsiveDashboardProps) {
  const router = useRouter();
  const {
    characterBalance,
    platformName,
    userEmail,
    isMaintenance,
    onRefresh,
    onLogout,
    onDeleteAccount,
  } = useDashboardLive();
  const [selectedFitur, setSelectedFitur] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localBalance, setLocalBalance] = useState(0);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getInitials = (email: string) => {
    if (!email) return "U";
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  const selectedFiturData =
    fiturNusantara.find((item) => item.id === selectedFitur) || null;

  const handleBackToHome = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFitur(null);
    setAiResponse("");
    setPromptInput("");
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleGenerateText = async () => {
    const trimmedInput = promptInput.trim();
    if (!trimmedInput || !selectedFitur || isLoading) return;

    setIsLoading(true);
    setAiResponse("");
    setErrorMessage(null);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/v3/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedInput,
          feature: selectedFitur,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(
          "Server responded with " + response.status + ": " + errBody,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming reader unavailable.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const trimmedFrame = frame.trim();
          if (!trimmedFrame.startsWith("data:")) continue;

          const dataStr = trimmedFrame.slice(5).trim();

          if (dataStr === "[DONE]") {
            setIsLoading(false);
            abortControllerRef.current = null;
            return;
          }

          try {
            const payload = JSON.parse(dataStr) as SseFrame;

            if (payload.type === "error") {
              setErrorMessage(payload.error ?? "Unknown streaming error.");
              setIsLoading(false);
              abortControllerRef.current = null;
              return;
            }

            if (payload.type === "done") {
              if (
                payload.monetization &&
                payload.monetization.balance_updated
              ) {
                setLocalBalance(payload.monetization.remaining_balance);
              }
              setIsLoading(false);
              abortControllerRef.current = null;
              return;
            }

            const token = payload.text;
            if (typeof token === "string" && token) {
              setAiResponse((prev) => prev + token);
            }
          } catch {
            /* ignore malformed SSE frame, keep streaming */
          }
        }
      }

      setIsLoading(false);
      abortControllerRef.current = null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerateText();
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Teks berhasil disalin ke clipboard!");
    } catch {
      alert("❌ Gagal menyalin teks. Silakan salin manual.");
    }
  };

  const handleExportWord = (text: string) => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${selectedFiturData?.nama || "Hasil AI Nusantara"}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
            h1 { color: #b45309; border-bottom: 3px solid #f59e0b; padding-bottom: 12px; }
            p { margin-bottom: 16px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${selectedFiturData?.nama || "Hasil AI Nusantara"}</h1>
          <p>${text.replace(/\n/g, "<br/>")}</p>
          <hr/>
          <p style="font-size: 11px; color: #888;">Dihasilkan oleh BIKIN AI - Platform Nusantara pada ${new Date().toLocaleString("id-ID")}</p>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", htmlContent], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFiturData?.id || "hasil-ai"}-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 p-3 flex flex-col gap-2">
      {/* Top Header Ribbon - unified pitch-black premium bar, no fixed/sticky, wired to live auth props */}
      <div className="w-full bg-slate-950 text-slate-100 border-b border-slate-800/80 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-black tracking-wider text-sm">
            {platformName || "BIKIN AI"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 px-3 py-1.5 flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo User</span>
            <span className="text-xs font-black text-white font-mono">
              {(characterBalance > 0 ? characterBalance : localBalance).toLocaleString("id-ID")} CHARS
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/checkout")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            title="ISI ULANG SALDO / BELI PAKET"
          >
            🛒 ISI ULANG SALDO
          </button>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh Status"
            className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-200 hover:border-amber-500/50 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {/* Avatar Profile Dropdown - wired to live auth context */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-slate-900/60 border border-slate-800 p-1 pl-1 pr-1.5 text-slate-200 hover:border-amber-500/50 transition-all"
              title="Menu Akun"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-black text-slate-950">
                {getInitials(userEmail || "user@email.com")}
              </div>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showProfileDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    {isMaintenance ? (
                      <p className="text-[10px] font-black uppercase text-red-400 mb-1">
                        ⚠️ Maintenance Mode
                      </p>
                    ) : null}
                    <p className="text-xs font-mono text-slate-400 truncate">
                      {userEmail || "user@email.com"}
                    </p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        router.push("/dashboard/settings");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      ⚙️ Pengaturan Akun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        router.push("/dashboard/transactions");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      📊 Riwayat Transaksi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-red-400 hover:bg-red-950/40 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      🚪 Keluar (Logout)
                    </button>
                    <div className="border-t border-slate-800 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileDropdown(false);
                          onDeleteAccount?.();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-red-500 hover:bg-red-950/60 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        🗑️ Hapus Akun Selamanya
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedFitur && selectedFiturData ? (
        <>
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800">
            <button type="button" onClick={handleBackToHome} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-all active:scale-95">
              <ArrowLeft className="w-3 h-3" />
              Kembali
            </button>
            <div className="min-w-0 flex items-center gap-2 flex-1 justify-center">
              <h2 className="text-sm font-black text-white truncate">{selectedFiturData.nama}</h2>
              <span className="text-[10px] text-slate-400 truncate">{selectedFiturData.desc}</span>
            </div>
            <div className="shrink-0 w-8" />
          </div>

          <div className="w-full flex-1 grid grid-cols-2 gap-0 overflow-hidden min-h-0 bg-slate-950">
            <div className="w-[40%] flex flex-col border-r border-slate-800 bg-slate-900/30 min-h-0">
              <div className="shrink-0 px-3 py-2 border-b border-slate-800">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-300">Input Prompt</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Masukkan instruksi Anda</label>
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value.slice(0, maxInputChars))}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedFiturData.contoh ? "Contoh: " + selectedFiturData.contoh : "Ketik instruksi di sini..."}
                    rows={10}
                    className="w-full resize-none rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{promptInput.length} / {maxInputChars}</span>
                    <span className="text-[10px] text-slate-500">Enter = kirim</span>
                  </div>
                </div>
                <button type="button" onClick={handleGenerateText} disabled={!promptInput.trim() || isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Generate AI
                    </>
                  )}
                </button>
                {errorMessage && (
                  <div className="rounded-xl bg-red-950/50 border border-red-800/50 p-3">
                    <p className="text-[10px] font-bold text-red-400">Terjadi Kesalahan</p>
                    <p className="text-[10px] text-red-300/80 mt-1 leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                {aiResponse && (
                  <button type="button" onClick={() => handleExportWord(aiResponse)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all active:scale-95">
                    <FileText className="w-4 h-4" />
                    Export Word
                  </button>
                )}
              </div>
            </div>

            <div className="w-[60%] flex flex-col bg-slate-950 min-h-0">
              <div className="shrink-0 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-300">Output AI</h3>
                {aiResponse && (
                  <button type="button" onClick={() => handleCopyText(aiResponse)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-all active:scale-95">
                    <Copy className="w-3 h-3" />
                    📋 Salin Cepat
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                {isLoading && !aiResponse && (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="text-[10px] font-medium">Sedang memproses...</span>
                    </div>
                  </div>
                )}

                {aiResponse && (
                  <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 m-3">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-200">{aiResponse}</pre>
                  </div>
                )}

                {!aiResponse && !isLoading && (
                  <div className="flex items-center justify-center h-full text-slate-600">
                    <div className="text-center space-y-1">
                      <Sparkles className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-[10px] font-medium">Output akan muncul di sini...</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="shrink-0 px-3 py-2 border-t border-slate-800/80 flex flex-row items-center gap-2 justify-end bg-slate-950">
                <button
                  type="button"
                  disabled={!aiResponse}
                  onClick={() => {
                    navigator.clipboard.writeText(aiResponse);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Salin hasil ke clipboard"
                >
                  <Copy className="w-3 h-3" />
                  📋 Salin Cepat
                </button>
                <button
                  type="button"
                  disabled={!aiResponse}
                  onClick={() => handleExportWord(aiResponse)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-amber-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Ekspor hasil ke dokumen Word"
                >
                  <FileText className="w-3 h-3" />
                  📄 Ekspor ke MS Word
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full flex-1 grid grid-cols-4 gap-3 overflow-hidden bg-slate-950 mt-1">
          {CATEGORIES.map((kat) => {
            const headerClass =
              CATEGORY_COLORS[kat] ||
              "bg-slate-800 text-slate-300 border-slate-700";

            return (
              <div key={kat} className="flex flex-col min-h-0">
                <div
                  className={`shrink-0 rounded-t-lg border-b px-3 py-2 text-center ${headerClass}`}
                >
                  <h2 className="text-[11px] font-black uppercase tracking-wider">
                    ★ {kat}
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 p-2 min-h-0">
                  {fiturNusantara
                    .filter((item) => item.cat === kat)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedFitur(item.id);
                          setAiResponse("");
                          setPromptInput("");
                          setErrorMessage(null);
                          setIsLoading(false);
                        }}
                        className="w-full text-left p-2 bg-slate-900/40 border border-slate-800 rounded-xl hover:border-amber-500/50 cursor-pointer transition-all group"
                      >
                        <h3 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                          {item.nama}
                        </h3>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          {item.desc}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
