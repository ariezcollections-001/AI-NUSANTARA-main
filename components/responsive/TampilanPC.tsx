"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Copy, FileText, Sparkles, Loader2 } from "lucide-react";

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

/* ========================================================================
 * 4-COLUMN HORIZONTAL DIRECTORY — Fitur AI Nusantara Catalogue
 * ====================================================================== */
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
    nama: "🛡️ Koreksi Tugas",
    desc: "Beri feedback tugas siswa secara objektif.",
    cat: "GURU",
    contoh: "Koreksi esai siswa tentang sejarah proklamasi dan beri nilai objektif.",
  },
  {
    id: "bahan-ajar",
    nama: "📚 Bahan Ajar",
    desc: "Produksi materi ajar menarik dan mudah dipahami.",
    cat: "GURU",
    contoh: "Susun bahan ajar singkat tentang sistem tata surya untuk kelas 6 SD.",
  },
  {
    id: "asisten-skripsi",
    nama: "🎓 Asisten Skripsi",
    desc: "Bantu susun kerangka, bab, dan arahan riset skripsi.",
    cat: "MAHASISWA",
    contoh: "Susun kerangka skripsi bab 1-5 tentang pengaruh media sosial terhadap minat baca.",
  },
  {
    id: "ringkas-buku",
    nama: "📖 Ringkas Buku",
    desc: "Buat ringkasan bab buku yang padat dan mudah dipahami.",
    cat: "MAHASISWA",
    contoh: "Rangkum bab 3 buku tentang metode penelitian kualitatif secara padat.",
  },
  {
    id: "parafrase-teks",
    nama: "✍️ Parafrase Teks",
    desc: "Tulis ulang teks akademis dengan gaya berbeda.",
    cat: "MAHASISWA",
    contoh: "Parafrase paragraf akademis berikut agar lebih mudah dipahami tanpa mengubah makna.",
  },
  {
    id: "caption-tiktok",
    nama: "🔥 Caption TikTok",
    desc: "Buat skrip video jualan 30-60 detik dengan hook mematikan.",
    cat: "UMKM",
    contoh: "Buat skrip video TikTok 30 detik promosi kopi lokal dengan hook yang kuat.",
  },
  {
    id: "strategi-bisnis",
    nama: "📊 Strategi Bisnis",
    desc: "Analisis tren pasar dan rekomendasi ide UMKM modal kecil.",
    cat: "UMKM",
    contoh: "Analisis SWOT untuk usaha katering rumahan di kota kecil.",
  },
  {
    id: "copywriting-brosur",
    nama: "📣 Copywriting Brosur",
    desc: "Tulis teks brosur produk persuasif yang menjual.",
    cat: "UMKM",
    contoh: "Tulis teks brosur persuasif untuk produk keripik singkong sambal matah.",
  },
  {
    id: "audio-mp3",
    nama: "🎧 Audio MP3 Manusia Luwes",
    desc: "Tulis narasi suara natural yang luwes dan enak didengar.",
    cat: "UMUM",
    contoh: "Tulis narasi suara yang luwes dan natural untuk iklan radio 30 detik.",
  },
  {
    id: "generator-propaganda",
    nama: "📢 Generator Propaganda Konten",
    desc: "Bantu produksi konten promosi dan publikasi massa.",
    cat: "UMUM",
    contoh: "Susun materi publikasi kampanye produk untuk media massa dan komunitas.",
  },
];

const KLASTER_URUTAN: { cat: string; label: string; ribbon: string }[] = [
  {
    cat: "GURU",
    label: "★ KLASTER GURU",
    ribbon: "bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950",
  },
  {
    cat: "MAHASISWA",
    label: "★ KLASTER MAHASISWA",
    ribbon: "bg-gradient-to-r from-sky-500 to-blue-600 text-white",
  },
  {
    cat: "UMKM",
    label: "★ KLASTER UMKM",
    ribbon: "bg-gradient-to-r from-emerald-500 to-green-600 text-white",
  },
  {
    cat: "UMUM",
    label: "★ KLASTER UMUM",
    ribbon: "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white",
  },
];


export default function TampilanPC({ maxInputChars = 500 }: ResponsiveDashboardProps) {
  const [selectedFitur, setSelectedFitur] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedFiturData =
    fiturNusantara.find((item) => item.id === selectedFitur) || null;

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /* ====================================================================
   * 3. STREAM V2 PIPELINE TARGET (handleGenerateText)
   * ================================================================== */
  const handleGenerateText = async () => {
    const trimmedInput = promptInput.trim();
    if (!trimmedInput || !selectedFitur || isLoading) return;

    // Reset text outputs & toggle status loops
    setAiResponse("");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // POST to brand new v2 backend route
      const response = await fetch("/api/v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptInput, feature: selectedFitur }),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 405) {
        alert("Akses ditolak atau metode tidak diizinkan.");
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }

      if (!response.ok) {
        let errorMsg = "Gagal memproses permintaan.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMsg = errorData.error;
          }
        } catch {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error("Streaming tidak didukung oleh browser ini.");
      }

      let buffer = "";

      // while-loop stream reader -> progressive token append
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const linesArr = buffer.split("\n");
        buffer = linesArr.pop() || "";

        for (const line of linesArr) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.type === "token" && typeof data.text === "string") {
              setAiResponse((prev) => prev + data.text);
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghubungi AI.";
      setErrorMessage(errorMsg);
    } finally {
      // Turn off loading upon stream completion
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

  const handleExportWord = (text: string) => {
    if (!text) return;
    const safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>BIKIN AI - ${selectedFiturData?.nama ?? "Output"}</title></head><body style="font-family:Calibri, sans-serif; font-size:12pt;">${safeText.replace(/\n/g, "<br/>")}</body></html>`;
    const blob = new Blob(["\ufeff", html], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BIKIN-AI-${selectedFiturData?.id ?? "output"}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ====================================================================
   * 2. INSIDE INTERIOR FLOW — THE HORIZONTAL 2-COLUMN SPLIT DESK
   * ================================================================== */
  if (selectedFitur && selectedFiturData) {
    return (
      <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
        {/* Workspace Top Ribbon Header */}
        <div className="w-full shrink-0 bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm">
          <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setSelectedFitur(null);
                setAiResponse("");
                setPromptInput("");
                setErrorMessage(null);
                setIsLoading(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-200 transition-all active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              ⬅ KEMBALI KE BERANDA
            </button>
            <div className="min-w-0 flex items-center gap-2 flex-1 justify-center">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <h1 className="text-xs font-black text-amber-400 truncate">
                {selectedFiturData.nama}
              </h1>
            </div>
            <div className="shrink-0">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Klaster {selectedFiturData.cat} • AI Active
              </span>
            </div>
          </div>
        </div>

        {/* Interior Workspace Desk — locked to 1 frame height */}
        <div className="w-full h-full flex flex-col max-h-[calc(100vh-80px)] overflow-hidden p-3 pt-2">
          <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
            {/* LEFT DESK SIDE — Input Form (span-5 / 40%) */}
            <div className="col-span-5 flex flex-col gap-3 min-h-0">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {selectedFiturData.nama}
                  </h2>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {selectedFiturData.desc}
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <p className="text-[9px] font-mono text-slate-500 mb-1">
                    💡 PILIHAN PERINTAH:
                  </p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {selectedFiturData.contoh}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col flex-1 min-h-0">
                <textarea
                  value={promptInput}
                  onChange={(e) =>
                    setPromptInput(e.target.value.slice(0, maxInputChars))
                  }
                  maxLength={maxInputChars}
                  onKeyDown={handleKeyDown}
                  placeholder={`Tulis perintah untuk ${selectedFiturData.nama}... (maks ${maxInputChars} karakter)`}
                  className="w-full flex-1 bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none resize-none"
                />
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800 shrink-0">
                  <span
                    className={`text-[9px] font-mono ${
                      promptInput.length >= Math.max(0, maxInputChars - 50)
                        ? "text-amber-400"
                        : "text-slate-500"
                    }`}
                  >
                    {promptInput.length} / {maxInputChars}
                  </span>
                  <button
                    onClick={handleGenerateText}
                    disabled={!promptInput.trim() || isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    GENERATE / MULAI BIKIN
                  </button>
                </div>
              </div>
            </div>


            {/* RIGHT DESK SIDE — Jendela Gelap Output (span-7 / 60%) */}
            <div className="col-span-7 flex flex-col min-h-0">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider ml-1">
                    Terminal AI — Output
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  {isLoading && !aiResponse && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      AI sedang mengetik...
                    </div>
                  )}
                  {aiResponse && (
                    <div className="text-xs leading-relaxed whitespace-pre-wrap text-slate-100 font-mono">
                      {aiResponse}
                    </div>
                  )}
                  {!isLoading && !aiResponse && !errorMessage && (
                    <p className="text-[10px] text-slate-500 font-mono">
                      Menunggu perintah... jalankan GENERATE untuk memulai.
                    </p>
                  )}
                  {errorMessage && (
                    <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-[10px] font-mono">
                      ⚠️ {errorMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. BIND ACTION MACROS — COPY TEXT HOOK */}
              <div className="mt-2 flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiResponse);
                  }}
                  disabled={!aiResponse || isLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-200 transition-all active:scale-95 disabled:opacity-40"
                >
                  <Copy className="w-3 h-3" />
                  📋 Salin Cepat
                </button>
                <button
                  onClick={() => handleExportWord(aiResponse)}
                  disabled={!aiResponse || isLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border border-blue-500 text-[10px] font-mono font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                >
                  <FileText className="w-3 h-3" />
                  📄 Ekspor ke MS Word
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  /* ====================================================================
   * 1. 4-COLUMN HORIZONTAL DIRECTORY GRID FRAMEWORK
   * ================================================================== */
  return (
    <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 p-3 flex flex-col">
      {/* Spanduk Selamat Datang Mini */}
      <div className="w-full shrink-0 bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 rounded-xl p-3 mb-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white truncate">
              👋 Selamat Datang di BIKIN AI
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight truncate">
              Pilih salah satu dari{" "}
              <span className="text-amber-400 font-semibold">
                {fiturNusantara.length} fitur AI Nusantara
              </span>{" "}
              di bawah. Klik kartu fitur untuk membuka antarmuka generator AI!
            </p>
          </div>
        </div>
      </div>

      {/* 4-Column Horizontal Directory Grid */}
      <div className="w-full flex-1 grid grid-cols-4 gap-3 mt-1 overflow-hidden h-full max-h-[calc(100vh-80px)]">
        {KLASTER_URUTAN.map((klaster) => {
          const items = fiturNusantara.filter(
            (item) => item.cat === klaster.cat,
          );
          return (
            <div
              key={klaster.cat}
              className="flex flex-col min-h-0 overflow-hidden"
            >
              {/* Column header ribbon banner */}
              <div
                className={`shrink-0 rounded-t-lg px-3 py-1.5 ${klaster.ribbon}`}
              >
                <h2 className="text-[11px] font-black uppercase tracking-wider">
                  {klaster.label}
                </h2>
              </div>

              {/* Feature cards listed vertically downwards */}
              <div className="flex-1 overflow-y-auto space-y-1.5 mt-1.5 pr-0.5 min-h-0">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedFitur(item.id);
                      setAiResponse("");
                      setPromptInput("");
                    }}
                    className="w-full text-left p-2 bg-slate-900/40 border border-slate-800/80 rounded-xl hover:border-amber-500/50 hover:bg-slate-900 transition-all cursor-pointer group shadow-md hover:shadow-lg hover:shadow-amber-500/5 active:scale-[0.98]"
                  >
                    <h3 className="text-xs font-bold group-hover:text-amber-400 transition-colors truncate">
                      {item.nama}
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

