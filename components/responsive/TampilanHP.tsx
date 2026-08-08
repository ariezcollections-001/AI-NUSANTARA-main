"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Copy, FileText, Sparkles, Loader2 } from "lucide-react";

interface FiturNusantara {
  id: string;
  nama: string;
  desc: string;
  cat: string;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

interface ResponsiveDashboardProps {
  maxInputChars?: number;
}

const fiturNusantara: FiturNusantara[] = [
  { id: "gen-rpp", nama: "⚡ Gen RPP", desc: "Buat RPP Merdeka lengkap, guru, asesmen, dan rubrik.", cat: "GURU" },
  { id: "buat-soal", nama: "📝 Buat Soal", desc: "Buat soal HOTS pilihan ganda dan esai lengkap.", cat: "GURU" },
  { id: "koreksi-tugas", nama: "🛡️ Koreksi Tugas", desc: "Beri feedback tugas siswa secara objektif.", cat: "GURU" },
  { id: "bahan-ajar", nama: "📚 Bahan Ajar", desc: "Produksi materi ajar menarik dan mudah dipahami.", cat: "GURU" },
  { id: "bedah-jurnal", nama: "⚖️ Bedah Jurnal", desc: "Ringkas latar belakang, metode, dan hasil jurnal akademis.", cat: "MAHASISWA" },
  { id: "rangkum-buku", nama: "📖 Rangkum Buku", desc: "Buat ringkasan bab buku yang padat dan mudah dipahami.", cat: "MAHASISWA" },
  { id: "kerangka-skripsi", nama: "🎓 Kerangka Skripsi", desc: "Buat outline skripsi bab 1-5 dengan judul dan arahan riset.", cat: "MAHASISWA" },
  { id: "tiktok-viral", nama: "🔥 TikTok Viral", desc: "Buat skrip video jualan 30-60 detik dengan hook mematikan.", cat: "UMKM" },
  { id: "caption-ig", nama: "🛍️ Caption IG", desc: "Tulis caption Instagram jualan persuasif dengan hashtag.", cat: "UMKM" },
  { id: "ide-bisnis", nama: "📊 Ide Bisnis", desc: "Analisis tren pasar lokal dan rekomendasi ide UMKM modal kecil.", cat: "UMKM" },
  { id: "bahasa-formal", nama: "💼 Bahasa Formal", desc: "Ubah teks bisnis kasar menjadi bahasa formal korporat.", cat: "UMKM" },
];

export default function TampilanHP({ maxInputChars = 500 }: ResponsiveDashboardProps) {
  const [activeTab, setActiveTab] = useState("GURU");
  const [selectedFitur, setSelectedFitur] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedFiturData = fiturNusantara.find((item) => item.id === selectedFitur) || null;

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleBackToHome = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFitur(null);
    setMessages([]);
    setStreamingText("");
    setErrorMessage(null);
    setIsStreaming(false);
    setIsLoading(false);
    setInputText("");
  };

  const handleSendMessage = async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput || !selectedFitur || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText("");
    setIsLoading(true);
    setErrorMessage(null);
    setStreamingText("");

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(
        `/api/ai/process?featureId=${encodeURIComponent(selectedFitur)}&userInput=${encodeURIComponent(trimmedInput)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

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

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const reply = data?.output || data?.data?.reply || "Tidak ada respons dari AI.";
        setMessages((prev) => [...prev, { role: "ai", content: reply }]);
      } else {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Streaming tidak didukung oleh browser ini.");
        }

        const decoder = new TextDecoder();
        let accumulatedText = "";
        setIsStreaming(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setStreamingText(accumulatedText);
        }

        setMessages((prev) => [...prev, { role: "ai", content: accumulatedText }]);
        setStreamingText("");
        setIsStreaming(false);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungi AI.";
      setErrorMessage(errorMsg);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `⚠️ Error: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingText("");
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
          <title>${selectedFiturData?.nama || "Ekspor AI"}</title>
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

    const blob = new Blob(["\ufeff", htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFiturData?.id || "hasil-ai"}-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getLastAIResponse = (): string => {
    const aiMessages = messages.filter((msg) => msg.role === "ai");
    if (aiMessages.length === 0) return "";
    return aiMessages[aiMessages.length - 1].content;
  };

  if (selectedFitur && selectedFiturData) {
    return (
      <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
        {/* Chat Header */}
        <div className="w-full bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm shrink-0">
          <div className="w-full px-2 py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={handleBackToHome}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-200 transition-all active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-3 h-3" />
                BACK
              </button>
              <div className="min-w-0">
                <h1 className="text-xs font-black text-amber-400 truncate">
                  {selectedFiturData.nama}
                </h1>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider truncate">
                  Klaster {selectedFiturData.cat}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Bubbles Stream Area */}
        <div className="flex-1 w-full px-2 py-2 overflow-y-auto">
          <div className="space-y-2">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-2 shadow-lg shadow-amber-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xs font-bold text-white mb-1">
                  {selectedFiturData.nama}
                </h2>
                <p className="text-[10px] text-slate-400 max-w-xs mb-2">
                  {selectedFiturData.desc}
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 max-w-xs text-left">
                  <p className="text-[9px] font-mono text-slate-500 mb-1">CONTOH:</p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {selectedFiturData.id === "gen-rpp" && "Buatkan RPP Matematika kelas 7 tentang aljabar dengan model PBL."}
                    {selectedFiturData.id === "buat-soal" && "Buatkan 5 soal HOTS pilihan ganda tentang fotosintesis untuk kelas 8."}
                    {selectedFiturData.id === "koreksi-tugas" && "Berikut tugas siswa saya: [tempel teks tugas]. Tolong koreksi dan beri nilai."}
                    {selectedFiturData.id === "bahan-ajar" && "Buatkan bahan ajar tentang sistem tata surya untuk siswa SD kelas 6."}
                    {selectedFiturData.id === "bedah-jurnal" && "Bedah jurnal ini: [tempel abstrak jurnal]. Fokus pada metodologi dan temuan."}
                    {selectedFiturData.id === "rangkum-buku" && "Rangkumkan bab 3 buku 'Laskar Pelangi' secara padat."}
                    {selectedFiturData.id === "kerangka-skripsi" && "Buatkan kerangka skripsi tentang pengaruh media sosial terhadap minat belajar siswa."}
                    {selectedFiturData.id === "tiktok-viral" && "Buatkan skrip TikTok 45 detik untuk jualan produk skincare lokal dengan hook mematikan."}
                    {selectedFiturData.id === "caption-ig" && "Buatkan caption Instagram untuk produk keripik singkong dengan teknik AIDA."}
                    {selectedFiturData.id === "ide-bisnis" && "Kasih saya 5 ide bisnis UMKM modal di bawah 1 juta untuk anak muda di kota."}
                    {selectedFiturData.id === "bahasa-formal" && "Ubah kalimat ini menjadi bahasa formal: 'Gue mau tanya soal harga barangnya dong'."}
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-br-md shadow-lg shadow-amber-500/10"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isStreaming && streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-md">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3 bg-amber-400 ml-1 animate-pulse" />
                </div>
              </div>
            )}

            {isLoading && !isStreaming && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  AI sedang mengetik...
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="flex justify-center">
                <div className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-[10px] font-mono">
                  ⚠️ {errorMessage}
                </div>
              </div>
            )}

            {/* Action Buttons Below AI Response */}
            {getLastAIResponse() && !isStreaming && !isLoading && (
              <div className="flex flex-wrap items-center gap-1.5 justify-end mt-1">
                <button
                  onClick={() => handleCopyText(getLastAIResponse())}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-200 transition-all active:scale-95"
                >
                  <Copy className="w-3 h-3" />
                  📋 Salin Cepat
                </button>
                <button
                  onClick={() => handleExportWord(getLastAIResponse())}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border border-blue-500 text-[10px] font-mono font-bold text-white transition-all active:scale-95"
                >
                  <FileText className="w-3 h-3" />
                  📄 Ekspor ke MS Word
                </button>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Floating Centered Bottom Input */}
        <div className="w-full px-2 pb-2 pt-1 shrink-0">
          <div className="w-full max-w-3xl mx-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, maxInputChars))}
                maxLength={maxInputChars}
                onKeyDown={handleKeyDown}
                placeholder={`Tulis perintah untuk ${selectedFiturData.nama}...`}
                rows={2}
                className="w-full bg-transparent px-3 py-2 text-[11px] text-slate-100 placeholder-slate-500 outline-none resize-none"
              />
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800">
                <span className={`text-[9px] font-mono ${inputText.length >= Math.max(0, maxInputChars - 50) ? "text-amber-400" : "text-slate-500"}`}>
                  {inputText.length} / {maxInputChars}
                </span>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isStreaming || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  {isStreaming || isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Kirim
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 p-2 flex flex-col">
      {/* Spanduk Selamat Datang Mini */}
      <div className="w-full shrink-0 bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 rounded-xl p-2 mb-2 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black text-white truncate">
              👋 Selamat Datang
            </h1>
            <p className="text-[10px] text-slate-400 leading-tight truncate">
              Pilih fitur AI di bawah
            </p>
          </div>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 flex flex-col">
        <h2 className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-slate-400 shrink-0">
          Menu Utama Platform AI
        </h2>

        {/* Tombol Klaster Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-1.5 border-b border-slate-800 pb-1.5 shrink-0">
          {["GURU", "MAHASISWA", "UMKM"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              ★ KLASTER {tab}
            </button>
          ))}
        </div>

        {/* Grid 11 Fitur Nusantara - Compact */}
        <div className="grid grid-cols-1 gap-1.5 overflow-y-auto min-h-0 pb-1">
          {fiturNusantara
            .filter((item) => item.cat === activeTab)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedFitur(item.id)}
                className="text-left p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-amber-500/50 hover:bg-slate-900 transition-all cursor-pointer group shadow-md hover:shadow-lg hover:shadow-amber-500/5 active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-bold mb-0.5 group-hover:text-amber-400 transition-colors truncate">
                      {item.nama}
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-tight">{item.desc}</p>
                  </div>
                  <div className="w-5 h-5 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all">
                    <Send className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}