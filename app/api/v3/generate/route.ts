/**
 * AI-NUSANTARA — Core AI Streaming Engine Interaction (v3)
 * ---------------------------------------------------------
 * Endpoint : POST /api/v3/generate
 * Runtime  : Edge (low-latency streaming + token parsing)
 *
 * Brand-new, ADDITIONAL engine route. It does NOT rewrite the committed
 * `app/api/v2/generate/route.ts` — that wire path stays untouched so the
 * dashboard client keeps working unchanged.
 *
 * v3 enhancements over the v2 engine:
 *   1. Model selection via `model` — Gemini family (`gemini-1.5-flash`,
 *      `gemini-1.5-pro`, ...) plus OpenRouter passthrough when `model` is
 *      prefixed with `openrouter/<provider-model>` and an OPENROUTER_API_KEY
 *      is configured.
 *   2. Caller-overridable `temperature` and `maxTokens`.
 *   3. Native AbortSignal: the SSE stream is tied to `request.signal` so the
 *      client's AbortController cleanly tears the stream down on disconnect.
 *   4. SSE token framing: `data: {"text":"..."}`.
 *   5. Per-feature system prompts covering all 12 fiturNusantara cards.
 *
 * Pipeline (mirrors v2 for accounting consistency):
 *   auth -> read character_balance -> 401/403 -> resolve provider ->
 *   stream tokens as SSE -> deduct balance on completion.
 *
 * Wire contract:
 *   POST /api/v3/generate
 *   Body : { message: string, feature?: string, model?: string,
 *           temperature?: number, maxTokens?: number }
 *   Resp : text/event-stream
 *     data: {"text":"<token>"}            (one frame per chunk)
 *     data: {"type":"done","monetization":{...}}  (final frame)
 *     data: {"type":"error","error":"<msg>"}       (on failure)
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const MAX_OUTPUT_TOKENS = 4096;
const MAX_INPUT_LENGTH = 32000;
const DEFAULT_TEMPERATURE = 0.3;

/* Fallback system instruction when no feature prompt matches. */
const DEFAULT_FEATURE_INSTRUCTION =
  "Bertindaklah sebagai asisten AI yang membantu, informatif, dan jujur. " +
  "Jawab dalam bahasa Indonesia yang jelas dan profesional. Jangan pernah " +
  "mengarang fakta. Jika informasi tidak lengkap, nyatakan dengan jujur. " +
  "Berikan langkah praktis konkret bila relevan.";

/* Per-feature system prompts — aligned to the 12 fiturNusantara cards. */
const FEATURE_INSTRUCTIONS: Record<string, string> = {
  "gen-rpp":
    "Bertindaklah sebagai Konsultan Kurikulum Merdeka Kemendikbud Ristek. Buat dokumen RPP/Modul Ajar super lengkap dan sistematis, mencakup Tujuan Pembelajaran, Langkah Kegiatan Alur MERDEKA, dan Rubrik Asesmen.",
  "buat-soal":
    "Buat soal ujian pilihan ganda dan esai yang berkualitas tinggi (HOTS), lengkap dengan kunci jawaban dan pembahasan rasional tiap opsi.",
  "koreksi-tugas":
    "Analisis karya tugas siswa secara objektif, beri umpan balik konstruktif, nilai adil, dan saran perbaikan yang spesifik.",
  "bahan-ajar":
    "Produksi materi bahan ajar teks yang menarik, eduktif, dan mudah dipahami, dengan contoh konkret dan poin kunci yang disusun rapi.",
  "asisten-skripsi":
    "Bantu susun kerangka skripsi: judul, abstrak, pendahuluan, tinjauan pustaka, metodologi, serta bab 1-5 lengkap poin bahasan.",
  "ringkas-buku":
    "Rangkum bab buku secara padat, komprehensif, dan mudah dipahami, mengekstrak temuan dan poin kunci utama.",
  "parafrase-teks":
    "Tulis ulang teks akademis atau artikel dengan gaya bahasa yang berbeda tanpa mengubah makna, gagasan, atau temuan aslinya.",
  "caption-tiktok":
    "Bertindaklah sebagai Scriptwriter TikTok & Reels handal Indonesia. Buat skrip video 30-60 detik dengan hook mematikan di 3 detik, storytelling persuasif, dan call-to-action jualan.",
  "strategi-bisnis":
    "Analisis tren pasar lokal Indonesia dan berikan ide bisnis UMKM modal kecil untung besar lengkap analisis SWOT singkat dan rencana aksi praktis.",
  "copywriting-brosur":
    "Tulis teks brosur produk yang persuasif, menggunakan teknik copywriting AIDA, dan lengkapi dengan headline yang menonjol.",
  "audio-mp3":
    "Tulis narasi suara yang luwes dan natural, cocok untuk audio MP3 manusia luwes, dengan alur cerita yang mengalir.",
  "generator-propaganda":
    "Bantu produksi konten promosi dan publikasi massa yang konsisten, menarik, dan selaras dengan pesan merek.",
};

interface GenerateRequestBody {
  message?: string;
  prompt?: string;
  feature?: string;
  featureId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface MonetizationResult {
  input_characters: number;
  output_characters: number;
  total_deducted: number;
  previous_balance: number;
  remaining_balance: number;
  balance_updated: boolean;
}

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
}

interface ResolvedModel {
  provider: "gemini" | "openrouter";
  modelName: string;
}

/* Auth + monetization helpers (mirror v2 so accounting stays consistent). */

async function getAuthenticatedUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      user: null,
      error: "Autentikasi diperlukan. Silakan masuk terlebih dahulu.",
    };
  }
  const user: AuthenticatedUser = {
    id: data.user.id,
    email: data.user.email ?? null,
  };
  return { user, error: null };
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
): Promise<number | null> {
  try {
    const adminAny = createAdminClient();
    const newBalance = Math.max(0, currentBalance - totalDeducted);
    const updated = await adminAny
      .from("users")
      .update({ character_balance: newBalance })
      .eq("id", userId)
      .select("character_balance")
      .single<{ character_balance: number }>();
    if (
      !updated.error &&
      updated.data &&
      typeof updated.data.character_balance === "number"
    ) {
      return updated.data.character_balance;
    }
  } catch {
    /* balance service unavailable — reported as not-updated to the caller */
  }
  return null;
}

function buildSystemInstruction(
  feature: string,
  userInput: string,
  userEmail: string,
): string {
  const instruction =
    FEATURE_INSTRUCTIONS[feature] ?? DEFAULT_FEATURE_INSTRUCTION;
  return `${instruction}\n\nEmail pengguna: ${userEmail || "anon@ai-nusantara.local"}\n\nPanduan: Jawab dalam bahasa Indonesia yang jelas dan profesional, komprehensif namun padat, hindari halusinasi, dan berikan langkah praktis konkret bila relevan. Jangan pernah mengarang fakta.\n\nInput pengguna:\n${userInput}`;
}

/*
 * Resolve which upstream provider to use.
 *   `model` starting with `openrouter/` -> OpenRouter (REST streaming).
 *   any other `model` -> Gemini model name.
 *   no `model` -> default Gemini `gemini-1.5-flight`.
 */
function resolveProvider(model?: string): ResolvedModel {
  const trimmed = (model ?? "").trim();
  if (trimmed.toLowerCase().startsWith("openrouter/")) {
    return { provider: "openrouter", modelName: trimmed.slice("openrouter/".length) };
  }
  return { provider: "gemini", modelName: trimmed ? trimmed : "gemini-1.5-flash" };
}

function sseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  /* 1. Ingest payload. `prompt`/`featureId` accepted as aliases for parity. */
  const rawBody = (await request.json().catch(() => ({}))) as GenerateRequestBody;
  const message = String(rawBody.message ?? rawBody.prompt ?? "").trim().slice(0, MAX_INPUT_LENGTH);
  const feature = String(rawBody.feature ?? rawBody.featureId ?? "").trim();
  const model = rawBody.model?.trim();
  const temperature = Number(rawBody.temperature) || DEFAULT_TEMPERATURE;
  const maxTokens = Math.min(
    Number(rawBody.maxTokens) || MAX_OUTPUT_TOKENS,
    MAX_OUTPUT_TOKENS,
  );

  if (!message) {
    return NextResponse.json(
      { error: "Parameter 'message' (atau 'prompt') diperlukan." },
      { status: 400 },
    );
  }

  /* 2. Authenticate caller through session metadata. */
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: authError ?? "Autentikasi pengguna diperlukan." },
      { status: 401 },
    );
  }

  /* 3. Authorise via character balance (mirrors v2 monetisation). */
  const supabase = await createClient();
  const currentBalance = await fetchUserBalance(supabase, user.id);
  if (currentBalance === null) {
    return NextResponse.json({ error: "Gagal memuat saldo karakter pengguna." }, { status: 403 });
  }
  if (currentBalance <= 0) {
    return NextResponse.json({ error: "Saldo karakter Anda tidak mencukupi." }, { status: 403 });
  }

  /* 4. Resolve provider + upstream key. */
  const { provider, modelName } = resolveProvider(model);

  try {
    if (provider === "gemini") {
      return await streamFromGemini({
        apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? "",
        modelName,
        systemInstruction: buildSystemInstruction(feature, message, user.email ?? ""),
        message,
        temperature,
        maxTokens,
        signal: request.signal,
        user,
        currentBalance,
      });
    }

    return await streamFromOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      modelName,
      systemInstruction: buildSystemInstruction(feature, message, user.email ?? ""),
      message,
      temperature,
      maxTokens,
      signal: request.signal,
      user,
      currentBalance,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-nusantara-main.vercel.app",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Kesalahan mesin AI: ${errorMessage}` }, { status: 500 });
  }
}

/* Provider: Google Gemini (via @google/generative-ai SDK). */

interface GeminiDeps {
  apiKey: string;
  modelName: string;
  systemInstruction: string;
  message: string;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
  user: AuthenticatedUser;
  currentBalance: number;
}

async function streamFromGemini(deps: GeminiDeps): Promise<Response> {
  const { apiKey, modelName, systemInstruction, message, temperature, maxTokens, signal, user, currentBalance } = deps;

  if (!apiKey) {
    return NextResponse.json({ error: "Kunci API Gemini belum dikonfigurasi di environment server." }, { status: 503 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const geminiStream = await model.generateContentStream({
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.95 },
  });

  const encoder = new TextEncoder();
  let closed = false;
  const closeStream = () => { if (closed) return; closed = true; };
  const abortHandler = () => closeStream();
  signal.addEventListener("abort", abortHandler);

  const eventStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let outputCharacters = 0;
      try {
        for await (const chunk of geminiStream.stream) {
          if (signal.aborted) break;
          const token = chunk.text();
          if (token) {
            outputCharacters += token.length;
            if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`));
          }
        }

        if (!closed && !signal.aborted) {
          const inputCharacters = message.length;
          const totalDeducted = inputCharacters + outputCharacters;
          const remaining = await deductCharacterBalance(user.id, totalDeducted, currentBalance);
          const monetization: MonetizationResult = {
            input_characters: inputCharacters,
            output_characters: outputCharacters,
            total_deducted: totalDeducted,
            previous_balance: currentBalance,
            remaining_balance: remaining ?? currentBalance,
            balance_updated: remaining !== null,
          };
          controller.enqueue(sseData({ type: "done", monetization }));
        }
      } catch (err) {
        if (!closed && !signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(sseData({ type: "error", error: msg }));
        }
      } finally {
        signal.removeEventListener("abort", abortHandler);
        closeStream();
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
}

/* Provider: OpenRouter (OpenAI-compatible streaming REST). */

interface OpenRouterDeps {
  apiKey: string;
  modelName: string;
  systemInstruction: string;
  message: string;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
  user: AuthenticatedUser;
  currentBalance: number;
  appUrl: string;
}

async function streamFromOpenRouter(deps: OpenRouterDeps): Promise<Response> {
  const { apiKey, modelName, systemInstruction, message, temperature, maxTokens, signal, user, currentBalance, appUrl } = deps;

  if (!apiKey) {
    return NextResponse.json({ error: "Kunci API OpenRouter belum dikonfigurasi di environment server." }, { status: 503 });
  }

  const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl,
      "X-Title": "AI-Nusantara v3 Engine",
    },
    body: JSON.stringify({
      model: modelName,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message },
      ],
    }),
  });

  if (!orResponse.ok) {
    const errBody = await orResponse.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenRouter menolak permintaan (${orResponse.status}): ${errBody}` },
      { status: orResponse.status },
    );
  }

  const reader = orResponse.body?.getReader();
  if (!reader) {
    return NextResponse.json({ error: "Provider tidak mendukung streaming respons." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let closed = false;
  const closeStream = () => { if (closed) return; closed = true; };
  const abortHandler = () => closeStream();
  signal.addEventListener("abort", abortHandler);

  let buffer = "";
  let outputCharacters = 0;

  const eventStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          if (signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: true });

                    let frameEnd = buffer.indexOf("\n\n");
          while (frameEnd >= 0) {
            const frame = buffer.slice(0, frameEnd).trim();
            buffer = buffer.slice(frameEnd + 2);
            frameEnd = buffer.indexOf("\n\n");

            if (!frame.startsWith("data:")) continue;
            const dataStr = frame.slice(5).trim();

            if (dataStr === "[DONE]") {
              const inputCharacters = message.length;
              const totalDeducted = inputCharacters + outputCharacters;
              const remaining = await deductCharacterBalance(user.id, totalDeducted, currentBalance);
              const monetization: MonetizationResult = {
                input_characters: inputCharacters,
                output_characters: outputCharacters,
                total_deducted: totalDeducted,
                previous_balance: currentBalance,
                remaining_balance: remaining ?? currentBalance,
                balance_updated: remaining !== null,
              };
              if (!closed) controller.enqueue(sseData({ type: "done", monetization }));
              return; // terminate the readable stream
            }

            try {
              const payload = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = payload?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                outputCharacters += delta.length;
                if (!closed) controller.enqueue(sseData({ text: delta }));
              }
            } catch {
              /* ignore malformed SSE frame, keep streaming */
            }
          }
        }
      } catch (err) {
        if (!closed && !signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(sseData({ type: "error", error: msg }));
        }
      } finally {
        signal.removeEventListener("abort", abortHandler);
        closeStream();
        reader.releaseLock?.();
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
}

