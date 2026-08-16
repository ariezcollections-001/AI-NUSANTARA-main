import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFreeKeyPool, getPaidKeyPool, blockKey } from "@/lib/aiVault";
import type { RotatingKey } from "@/lib/aiVault";
import { createClient } from "@/lib/supabase/server";

/**
 * AI-NUSANTARA — Asisten Dokumen (✨ AI Generate)
 * -----------------------------------------------
 * Endpoint khusus asisten dokumen: membantu pengguna mengisi, memperbaiki, dan
 * memformat kertas dokumen A4 di kolom kanan AIWorkbench.
 *
 * Berbeda dengan /api/v3/generate (stream token per-token untuk 14 fitur),
 * route ini KEMBALIKAN JSON TERSTRUKTUR agar UI bisa mengemudi alur bertanya
 * field-satu-per-satu, mengisi template, dan revisi secara tidak-menghancurkan.
 *
 * Auth: best-effort (pakai session bila ada; anon bila tidak) — tidak memotong
 * saldo karakter, karena asisten ini hanya membantu mengisi kertas sampingan.
 * API key: kolam global Gemini/OpenRouter (sama seperti v3) — berputar otomatis,
 * blockKey 60s bila 401/403/429.
 */

const MODEL = "gemini-flash-lite-latest";
const MAX_TOKENS = 4096;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ai-nusantara.local";

interface AiAction {
  label: string;
  type: "copy" | "append" | "revise" | "template";
  payload?: string;
}
interface TalkResult {
  reply: string;
  questions: string[];
  nextField: string | null;
  filledData: Record<string, string>;
  actions: AiAction[];
}
interface TalkRequest {
  message?: string;
  docText?: string;
  filledData?: Record<string, string>;
  history?: Array<{ role: "user" | "ai"; content: string }>;
  feature?: string;
}

async function resolveEmail(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? "anon@ai-nusantara.local";
    } catch {
    return "anon@ai-nusantara.local";
  }
}

async function callGemini(
  key: string,
  systemInstruction: string,
  userText: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent({
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.2, topP: 0.95 },
  });
  return result.response.text();
}

async function callOpenRouter(
  key: string,
  systemInstruction: string,
  userText: string,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": APP_URL,
      "X-Title": "AI-Nusantara Asisten Dokumen",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userText },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
    }),
    });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
        const err: Error & { status: number } = Object.assign(
      new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`),
      { status: res.status },
    );
    throw err;
  }
  const j = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return j?.choices?.[0]?.message?.content ?? "";
}

/**
 * Parsing JSON toleran dari output LLM: lepas fence ```json, lalu cocokkan
 * kurung kurawal. Bila tak valid → paksa sebagai `reply` agar UI tetap tampil.
 */
function parseTalkJson(raw: string): TalkResult {
  const fallback = (text: string): TalkResult => ({
    reply: text.replace(/```[\s\S]*?```/g, "").trim(),
    questions: [],
    nextField: null,
    filledData: {},
    actions: [],
  });

  const candidates: string[] = [];
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) candidates.push(m[1].trim());
  candidates.push(raw.trim());

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Partial<TalkResult>;
      if (obj && typeof obj.reply === "string") return normalize(obj);
    } catch { /* lanjut ke brace-match */ }
    const i = c.indexOf("{");
    if (i >= 0) {
      let depth = 0,
        inStr = false,
        esc = false,
        end = -1;
      for (let k = i; k < c.length; k++) {
        const ch = c[k];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { end = k + 1; break; }
        }
      }
      if (end > i) {
        try {
          const obj = JSON.parse(c.slice(i, end)) as Partial<TalkResult>;
          if (obj && typeof obj.reply === "string") return normalize(obj);
        } catch { /* lanjut */ }
      }
    }
  }
    return fallback(raw);
}

function normalize(obj: Partial<TalkResult>): TalkResult {
  const questions = Array.isArray(obj.questions)
    ? obj.questions.filter((q): q is string => typeof q === "string" && q.length > 0)
    : [];
  const filledData = obj.filledData && typeof obj.filledData === "object" ? obj.filledData : {};
  const actions: AiAction[] = Array.isArray(obj.actions)
    ? obj.actions.filter(
        (a): a is AiAction =>
          !!a && typeof a === "object" && typeof a.label === "string" && typeof a.type === "string",
      )
    : [];
  return {
    reply: typeof obj.reply === "string" ? obj.reply : "",
    questions: questions.slice(0, 3),
    nextField: typeof obj.nextField === "string" && obj.nextField.length ? obj.nextField : null,
    filledData,
    actions,
  };
}

const SYSTEM_PROMPT = `Kamu adalah "Asisten AI Nusantara" — asisten pribadi AI yang membantu pengguna mengisi, memperbaiki, dan memformat kertas dokumen A4 di kolom kanan.

PRINSIP: Baca konteks (DOKUMEN, DATA YANG SUDAH TERISI, RIWAYAT, FITUR). JANGAN pernah mengarang fakta/statistik. Jawaban singkat, ramah, Bahasa Indonesia.

ATURAN KOLEKSI FIELD: Jika ada field penting belum terisi (mis. Mapel, Kelas, Nama, Judul, Tujuan) dan belum pernah ditanya, tanyakan SATU per SATU via "questions" (1-3 pilihan cepat). Jika dokumen kosong & riwayat kosong → questions=["Mata pelajaran apa yang akan kamu buat?"], nextField="mapel". Setelah field terpenuhi, beri pertanyaan lanjutan atau tawarkan aksi.

ATURAN Aksi (actions) — kirim hanya saat mengusulkan menulis ke kertas:
- "copy": payload = teks utuh MENGGANTI isi kertas.
- "append": payload = catatan tambahan DITAMBAHKAN di bawah kertas (tidak menghapus).
- "revise": payload = versi dokumen penuh yang sudah direvisi (mengganti).
- "template": payload = kerangka dokumen siap pakai untuk kertas.

FORMAT KELUARAN: Jawab HANYA satu objek JSON tunggal (TANPA fence kode, TANPA prologue/epilogue).
Skema: {"reply":string,"questions":string[],"nextField":string|null,"filledData":object,"actions":array<{label:string,type:string,payload?:string>}>}.
Contoh: {"reply":"Mari mulai! Mapel apa yang kamu buat?","questions":["IPA kelas 5","Matematika kelas 6","Ketik manual"],"nextField":"mapel","filledData":{},"actions":[]}

FITUR: __FEATURE__
RIWAYAT: __HISTORY__
DOKUMEN: __DOC__
DATA YANG SUDAH TERISI: __FILLED__
Email pengguna: __EMAIL__
PESAN USER: __MESSAGE__`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TalkRequest;
  const message = String(body.message ?? "").slice(0, 16000);
  const userText =
    message === "__START__" || message.trim() === ""
      ? "Saya ingin kamu membantu mengisi & memperbaiki kertas dokumen. Apa yang perlu kamu ketahui / tanyakan dulu?"
      : message;

  const docText = body.docText ?? "";
  const filledData = body.filledData ?? {};
  const history = body.history ?? [];
  const feature = body.feature ?? "";
  const email = await resolveEmail();

  const systemInstruction = SYSTEM_PROMPT
    .replace("__FEATURE__", feature || "umum")
    .replace("__HISTORY__", history.length ? JSON.stringify(history) : "(belum ada)")
    .replace("__DOC__", docText ? docText.slice(0, 6000) : "(kertas dokumen masih kosong)")
    .replace("__FILLED__", JSON.stringify(filledData))
    .replace("__EMAIL__", email)
    .replace("__MESSAGE__", userText);

  const freePool = await getFreeKeyPool();
  const paidPool = await getPaidKeyPool();
  const pool: RotatingKey[] = [
    ...freePool.filter((c) => c.provider !== "elevenlabs"),
    ...paidPool,
  ];

  if (pool.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Layanan AI belum dikonfigurasi. Hubungi Founder → KOLAM TOKEN GLOBAL (VAULT API KEY RAHASIA) → tambahkan Gemini/OpenRouter Key, atau isi GOOGLE_GEMINI_API_KEY di .env.local.",
      },
      { status: 503 },
    );
  }

  let lastErr = "";
  for (const cand of pool) {
    try {
      let text: string;
      if (cand.provider === "gemini") {
        text = await callGemini(cand.key, systemInstruction, userText);
      } else if (cand.provider === "openrouter") {
        text = await callOpenRouter(cand.key, systemInstruction, userText);
      } else {
        throw new Error(`Provider ${cand.provider} tidak didukung`);
      }
      const parsed = parseTalkJson(text);
      return NextResponse.json({ ok: true, ...parsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      if (/(^|\s)(401|403|429)([.,\s]|$)/.test(msg) || /quota|rate.?limit|invalid.?key/i.test(msg)) {
        blockKey(cand.provider, cand.key);
      }
      continue;
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: `Gagal menghubungi AI — semua kunci sedang dibatasi atau tidak valid. (${lastErr.slice(0, 200)})`,
    },
    { status: 503 },
  );
}




