/**
 * AI-NUSANTARA — Core AI Streaming Engine Interaction (v2)
 * --------------------------------------------------------
 * Endpoint:  POST /api/v2/generate
 * Runtime:   Edge (optimized for low-latency text parsing & streaming)
 *
 * Pipeline:
 *   1. Ingest the incoming POST payload (user prompt `message` + selected
 *      feature context tag `feature` / `featureId`).
 *   2. Authenticate the caller through the Supabase session metadata
 *      (cookie-based server client).
 *   3. Read the caller's active `character_balance` from the `users` table.
 *   4. Initialize the Google Generative AI SDK context with a resilient
 *      API-key selection strategy and call `gemini-1.5-flash` with a
 *      real-time streaming request.
 *   5. Bridge the Gemini token stream into a Server-Sent Events
 *      `ReadableStream` so every token is flushed to the client instantly.
 *   6. On successful stream termination, evaluate the total characters
 *      generated and decrement the user's character balance through an
 *      authoritative (service-role) database update.
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const MAX_OUTPUT_TOKENS = 4096;
const MAX_INPUT_LENGTH = 32000;

const DEFAULT_FEATURE_INSTRUCTION =
  "Bertindaklah sebagai asisten AI yang membantu, informatif, dan jujur. Jawab dalam bahasa Indonesia yang jelas dan profesional. Jangan pernah mengarang fakta. Jika informasi tidak lengkap, nyatakan dengan jujur. Berikan langkah praktis konkret bila relevan.";

const FEATURE_INSTRUCTIONS: Record<string, string> = {
  "gen-rpp":
    "Bertindaklah sebagai Konsultan Kurikulum Merdeka Kemendikbud Ristek. Buat dokumen RPP/Modul Ajar yang super lengkap, sistematis, mencakup Tujuan Pembelajaran, Langkah Kegiatan Alur MERDEKA, dan Rubrik Asesmen.",
  "buat-soal":
    "Buat soal ujian pilihan ganda dan esai yang berkualitas tinggi, HOTS (Higher Order Thinking Skills), lengkap dengan kunci jawaban dan pembahasan.",
  "koreksi-tugas":
    "Analisis tugas siswa dan berikan umpan balik yang konstruktif, nilai objektif, serta saran perbaikan.",
  "bahan-ajar":
    "Buat materi bahan ajar teks yang menarik, eduktif, dan mudah dipahami siswa.",
  "tiktok-viral":
    "Bertindaklah sebagai Scriptwriter TikTok & Reels handal Indonesia. Buat skrip video durasi 30-60 detik yang memiliki Hook mematikan di 3 detik pertama, Storytelling persuasif, dan Call to Action jualan yang melipatgandakan konversi.",
  "caption-ig":
    "Buat caption Instagram jualan yang estetik, persuasif, menggunakan teknik copywriting AIDA, dan dilengkapi hashtag relevan.",
  "ide-bisnis":
    "Analisis tren pasar lokal Indonesia dan berikan ide bisnis UMKM modal kecil untung besar lengkap dengan analisis SWOT singkat.",
  "bahasa-formal":
    "Ubah gaya bahasa teks draf kasar bisnis menjadi bahasa formal korporat/surat resmi yang profesional.",
  "bedah-jurnal":
    "Bertindaklah sebagai Profesor Akademis. Bedah dan rangkum jurnal ilmiah ini menjadi ringkasan metodologi, temuan kunci, dan celah penelitian (research gap).",
  "rangkum-buku":
    "Buat rangkuman bab buku secara padat, komprehensif, dan mudah dipahami untuk bahan belajar.",
  "kerangka-skripsi":
    "Buat struktur outline kerangka skripsi bab 1 sampai bab 5 lengkap dengan saran judul berdasarkan topik yang diinput.",
};

interface GenerateRequestBody {
  message?: string;
  prompt?: string;
  feature?: string;
  featureId?: string;
}

interface MonetizationResult {
  input_characters: number;
  output_characters: number;
  total_deducted: number;
  previous_balance: number;
  remaining_balance: number;
  balance_updated: boolean;
}
function resolveFeatureInstruction(feature: string): string {
  if (feature && FEATURE_INSTRUCTIONS[feature]) {
    return FEATURE_INSTRUCTIONS[feature];
  }
  return DEFAULT_FEATURE_INSTRUCTION;
}

function buildSystemInstruction(
  feature: string,
  userInput: string,
  userEmail: string,
): string {
  const instruction = resolveFeatureInstruction(feature);
  return `${instruction}

Email pengguna: ${userEmail || "anon@ai-nusantara.local"}

Petunjuk tambahan: Jawab dalam bahasa Indonesia yang jelas dan profesional. Jangan pernah mengarang fakta. Jika informasi tidak lengkapi, nyatakan dengan jujur. Berikan langkah praktis konkret bila relevan.

Input pengguna:
${userInput}`;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      user: null as null,
      supabase,
      error: "Autentikasi pengguna diperlukan." as const,
    };
  }
  return { user: data.user, supabase, error: null };
}

async function fetchUserBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("character_balance")
      .eq("id", userId)
      .single<{ character_balance: number }>();
    if (error || !data) return null;
    const balance = Number(data.character_balance);
    return Number.isFinite(balance) ? balance : null;
  } catch {
    return null;
  }
}

async function deductCharacterBalance(
  userId: string,
  totalDeducted: number,
  currentBalance: number,
): Promise<MonetizationResult["remaining_balance"] | null> {
  const newBalance = Math.max(0, currentBalance - totalDeducted);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const updated = await adminAny
    .from("users")
    .update({ character_balance: newBalance })
    .eq("id", userId)
    .select("character_balance")
    .single();
  if (
    !updated.error &&
    updated.data &&
    typeof updated.data.character_balance === "number"
  ) {
    return updated.data.character_balance;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    /* ---- 1. Ingest the incoming payload (user prompt + feature tag) ---- */
    const rawBody = (await request.json().catch(() => ({}))) as GenerateRequestBody;

    const message = String(rawBody.message ?? rawBody.prompt ?? "").trim();
    const feature = String(rawBody.feature ?? rawBody.featureId ?? "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Parameter 'message' (prompt pengguna) wajib diisi." },
        { status: 400 },
      );
    }

    if (message.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        {
          error: `Panjang input melebihi batas maksimum ${MAX_INPUT_LENGTH} karakter.`,
        },
        { status: 400 },
      );
    }

    /* ---- 2. Secure context entry via session metadata ----------------- */
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    /* ---- 3. Fetch active account payload (character balance) ----------- */
    const supabase = await createClient();
    const currentBalance = await fetchUserBalance(supabase, user.id);
    if (currentBalance === null) {
      return NextResponse.json(
        { error: "Profil pengguna tidak ditemukan." },
        { status: 401 },
      );
    }

    // Emergency Intercept: reject if the user cannot even afford the input.
    if (message.length > currentBalance) {
      return NextResponse.json(
        {
          error: "Saldo karakter tidak mencukupi untuk memproses permintaan ini.",
          current_balance: currentBalance,
        },
        { status: 402 },
      );
    }

    /* ---- 4. Initialize Google Generative AI SDK context ---------------- */
    const apiKey =
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      "";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Kunci API Gemini belum dikonfigurasi di environment server.",
        },
        { status: 503 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const systemInstruction = buildSystemInstruction(
      feature,
      message,
      user.email ?? "",
    );

    const geminiStream = await model.generateContentStream({
      systemInstruction,
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        topP: 0.95,
      },
    });

    /* ---- 5. Real-time SSE text-streaming engine ------------------------ */
    const encoder = new TextEncoder();

    const eventStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let outputCharacters = 0;
        try {
          for await (const chunk of geminiStream.stream) {
            const token = chunk.text();
            if (token) {
              outputCharacters += token.length;
              const payload = JSON.stringify({ type: "token", text: token });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }

          /* ---- 6. Successful termination -> balance deduction ---------- */
          const inputCharacters = message.length;
          const totalDeducted = inputCharacters + outputCharacters;

          const remainingBalance = await deductCharacterBalance(
            user.id,
            totalDeducted,
            currentBalance,
          );

          const monetization: MonetizationResult = {
            input_characters: inputCharacters,
            output_characters: outputCharacters,
            total_deducted: totalDeducted,
            previous_balance: currentBalance,
            remaining_balance:
              remainingBalance !== null ? remainingBalance : currentBalance,
            balance_updated: remainingBalance !== null,
          };

          const donePayload = JSON.stringify({
            type: "done",
            monetization,
          });
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${donePayload}\n\n`),
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const errorPayload = JSON.stringify({ type: "error", error: errMsg });
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${errorPayload}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(eventStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform, must-revalidate",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Kesalahan server: ${errorMessage}` },
      { status: 500 },
    );
  }
}

