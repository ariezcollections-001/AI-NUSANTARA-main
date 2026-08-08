import React, { useState } from "react";
import { Copy, Check, FileCode, Database } from "lucide-react";

export const CodeViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const routeCode = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

/**
 * AI-NUSANTARA Backend API Route
 * Next.js App Router: app/api/ai/route.ts
 *
 * Fitur Utama:
 * 1. Global Maintenance Intercept (503 status)
 * 2. Pay-Per-Character System (Persiapan Saldo Pre-check & Real-time Deduction Post-AI)
 * 3. Temperature 0.0 Anti-Hallucination Rigid System Prompt
 */

// Inisialisasi Klien Supabase dengan Service Role Key untuk operasi database aman di server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://your-supabase-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-supabase-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Inisialisasi Gemini AI SDK (@google/genai)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// System Prompt Kaku Anti-Halusinasi AI-NUSANTARA
const RIGID_SYSTEM_PROMPT = \`Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi.\`;

export async function POST(req: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // KRITERIA 1: GLOBAL MAINTENANCE INTERCEPT
    // Cek parameter 'global_maintenance_mode' di tabel founder_config
    // ------------------------------------------------------------------
    try {
      const { data: founderConfig, error: configError } = await supabase
        .from("founder_config")
        .select("global_maintenance_mode")
        .limit(1)
        .maybeSingle();

      if (!configError && founderConfig?.global_maintenance_mode === true) {
        return NextResponse.json(
          { error: "AI-NUSANTARA sedang dalam pemeliharaan sistem." },
          { status: 503 }
        );
      }
    } catch (maintError) {
      console.warn("Maintenance check skipped/error fallback:", maintError);
    }

    // Parse Body Request
    const body = await req.json();
    const { prompt, user_id, userId } = body;
    const targetUserId = user_id || userId;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Prompt tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID wajib disertakan untuk verifikasi saldo karakter." },
        { status: 401 }
      );
    }

    // ------------------------------------------------------------------
    // KRITERIA 2 (BAGIAN 1): HITUNG KARAKTER INPUT & PRE-CHECK SALDO
    // ------------------------------------------------------------------
    const inputCharacterCount = prompt.length;

    // Ambil saldo karakter user dari tabel public.users
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id, character_balance")
      .eq("id", targetUserId)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json(
        { error: "User tidak ditemukan di sistem AI-NUSANTARA." },
        { status: 404 }
      );
    }

    const currentBalance = Number(userRecord.character_balance ?? 0);

    // Cek apakah saldo awal cukup setidaknya untuk menampung karakter Input
    if (currentBalance < inputCharacterCount) {
      return NextResponse.json(
        {
          error: "Saldo karakter Anda tidak mencukupi untuk memproses permintaan ini.",
          current_balance: currentBalance,
          required_input_characters: inputCharacterCount,
        },
        { status: 402 }
      );
    }

    // ------------------------------------------------------------------
    // KRITERIA 3: HIT GEMINI AI DENGAN TEMPERATUR 0.0 & SYSTEM PROMPT KAKU
    // ------------------------------------------------------------------
    const aiClient = getGeminiClient();
    
    // Panggil model gemini-3.6-flash dengan temperatur 0.0
    const aiResponse = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: RIGID_SYSTEM_PROMPT,
        temperature: 0.0,
      },
    });

    const outputText = aiResponse.text || "Maaf, data input tidak mencukupi untuk menghasilkan analisis yang valid.";

    // ------------------------------------------------------------------
    // KRITERIA 2 (BAGIAN 2): HITUNG OUTPUT & POTONG SALDO REAL-TIME
    // Rumus: Total Potong = Karakter Input + Karakter Output
    // ------------------------------------------------------------------
    const outputCharacterCount = outputText.length;
    const totalCharacterDeduction = inputCharacterCount + outputCharacterCount;

    // Hitung saldo baru (tidak membiarkan nilai di bawah 0)
    const newBalance = Math.max(0, currentBalance - totalCharacterDeduction);

    // Kurangi kolom character_balance user di tabel public.users secara real-time
    const { error: updateError } = await supabase
      .from("users")
      .update({
        character_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Gagal memperbarui saldo karakter user:", updateError);
    }

    // Kirimkan response sukses beserta rincian pemotongan saldo
    return NextResponse.json(
      {
        success: true,
        output: outputText,
        monetization: {
          input_characters: inputCharacterCount,
          output_characters: outputCharacterCount,
          total_deducted: totalCharacterDeduction,
          previous_balance: currentBalance,
          remaining_balance: newBalance,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error pada route AI-NUSANTARA:", error);
    return NextResponse.json(
      {
        error: error.message || "Terjadi kesalahan internal pada server AI-NUSANTARA.",
      },
      { status: 500 }
    );
  }
}`;

  const sqlSchema = `-- SQL Schema Setup untuk Database Supabase AI-NUSANTARA

-- 1. Tabel founder_config untuk Maintenance Intercept
CREATE TABLE IF NOT EXISTS public.founder_config (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  global_maintenance_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert nilai default maintenance (false)
INSERT INTO public.founder_config (global_maintenance_mode)
VALUES (false)
ON CONFLICT DO NOTHING;

-- 2. Tambah kolom character_balance ke tabel public.users jika belum ada
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS character_balance BIGINT DEFAULT 10000;

-- 3. Kebijakan Keamanan RLS (Row Level Security)
ALTER TABLE public.founder_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role read/write founder_config" ON public.founder_config FOR ALL USING (true);
`;

  const copyCode = () => {
    navigator.clipboard.writeText(routeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* File Location Header */}
      <div className="bg-white border-2 border-[#141414] p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#141414] text-white border border-[#141414]">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#141414] font-mono">app/api/ai/route.ts</h2>
              <span className="text-[10px] bg-green-100 border border-[#141414] text-green-800 px-2 py-0.5 font-mono font-bold">
                SIAP COPY-PASTE
              </span>
            </div>
            <p className="text-xs text-[#141414]/70 font-sans">
              Kode Full-Stack Backend Route Next.js App Router (TypeScript) Rapi &amp; Lengkap.
            </p>
          </div>
        </div>

        <button
          onClick={copyCode}
          className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 ${
            copied
              ? "bg-green-400 text-[#141414]"
              : "bg-[#141414] hover:bg-amber-400 hover:text-[#141414] text-white"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>BERHASIL DISALIN!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>SALIN KODE route.ts</span>
            </>
          )}
        </button>
      </div>

      {/* Code Editor Preview */}
      <div className="bg-[#141414] border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <div className="bg-[#262626] px-4 py-2 border-b border-[#141414] flex items-center justify-between text-xs font-mono text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-red-500 inline-block border border-[#141414]" />
            <span className="w-3 h-3 bg-amber-500 inline-block border border-[#141414]" />
            <span className="w-3 h-3 bg-green-500 inline-block border border-[#141414]" />
            <span className="ml-2 font-bold text-white">app/api/ai/route.ts</span>
          </div>
          <span>Next.js App Router API Route</span>
        </div>

        <pre className="p-5 text-xs font-mono text-[#00FF00] overflow-x-auto leading-relaxed max-h-[500px] overflow-y-auto selection:bg-amber-400 selection:text-[#141414]">
          <code>{routeCode}</code>
        </pre>
      </div>

      {/* SQL Migration Assistant */}
      <div className="bg-white border-2 border-[#141414] p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#141414] pb-3">
          <div className="flex items-center space-x-2 font-mono">
            <Database className="w-4 h-4 text-[#141414]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#141414]">
              Supabase DDL SQL Schema Migration
            </h3>
          </div>
          <button
            onClick={copySql}
            className="px-3 py-1.5 bg-[#E4E3E0] hover:bg-white text-[#141414] border border-[#141414] text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[1px_1px_0px_0px_rgba(20,20,20,1)]"
          >
            {copiedSql ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-700" />
                <span>SQL Disalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin SQL</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 bg-[#141414] border border-[#141414] text-xs font-mono text-amber-300 overflow-x-auto">
          <code>{sqlSchema}</code>
        </pre>
      </div>
    </div>
  );
};

