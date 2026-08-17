import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFreeKeyPool, getPaidKeyPool, blockKey } from "@/lib/aiVault";
import type { RotatingKey } from "@/lib/aiVault";
import { createClient } from "@/lib/supabase/server";
import { getFeatureSettings } from "@/lib/featureSettings";
import { getCatalogFeature } from "@/lib/featureCatalog";
import { buildStrictLayeredPrompt, checkUserMessageSafety } from "@/lib/aiStrictEngine";

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
const MAX_TOKENS = 8192;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ai-nusantara.local";

interface AiAction {
  label: string;
    type: "copy" | "append" | "revise" | "template" | "summarize" | "translate" | "expand" | "bullet" | "to_table" | "tone_down";
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
  temperature = 0.3,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent({
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature, topP: 0.95 },
  });
  return result.response.text();
}

async function callOpenRouter(
  key: string,
  systemInstruction: string,
  userText: string,
  temperature = 0.3,
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
      temperature,
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

ATURAN SCOPE / BATASAN FITUR (WAJIB): Kamu HANYA melayani seputar FITUR yang dipilih (lihat __FEATURE__). JANGAN menulis atau membuat dokumen/topik/pembahasan di luar fitur itu. Bila user bertanya hal yang TIDAK berkaitan sama sekali dengan fitur ini — mis. memilih fitur "Gen RPP" lalu meminta dibuatkan resep masakan, surat lamaran, atau topik lain — TOLAK dengan ramah & arahkan kembali: jelaskan bahwa kamu khusus membantu fitur yang ia pilih, lalu tawarkan kembali mengerjakan tujuan fitur itu. JANGAN memasukkan konten di luar fitur ke kertas dokumen (biarkan actions kosong untuk permintaan off-topic). Edit/perbaikan isi kertas yang memang sudah terkait fitur tetap dilayani. Jaga kertas dokumen selalu dalam lingkup fitur yang dipilih.

ATURAN KOLEKSI FIELD: SELALU cek isi kertas DOKUMEN terkini untuk tahu field mana yang SUDAH terisi (hasil AI maupuan isian MANUAL user — mis. "Nama: Budi" yang diketik langsung di kertas). JANGAN menanya ulang field yang sudah terlihat terisi di DOKUMEN. Anggap isian di kertas (termasuk yang ketik manual) sebagai sumber kebenaran, dan laporkan lewat "filledData". Baru tanyakan field yang memang belum ada di dokumen, SATU per SATU via "questions" (1-3 pilihan cepat). Jika dokumen kosong & riwayat kosong → questions=["Mata pelajaran apa yang akan kamu buat?"], nextField="mapel". Bila user minta edit/revisi sebuah field (mis. "ubah namanya jadi Andi"), kerjakan lewat aksi "revise" — JANGAN hanya menanya ulang.

ATURAN MENGUASAI ISI KERTAS (WAJIB):
- Kamu SELALU memakai isi kertas saat ini (lihat DOKUMEN) dan DATA YANG SUDAH TERISI sebagai dasar.
- Teks yang sudah ada di kertas TIDAK BOLEH hilang, kecuali user meminta menghapus bagian tertentu.
- User boleh minta EDIT apa pun: memperbaiki kata/kalimat, mengubah/ganti bagian, menghapus sebagian teks, menyisip, atau menjadikan dokumen murni. Patuhi permintaan itu.
- Jika user minta edit parsial (mis. "ubah kalimat X", "hapus bagian Y", "ganti judul") → aksi "revise" berisi SELURUH dokumen hasil akhir: mulai dari isi kertas sekarang, gabungkan semua field dari DATA YANG SUDAH TERISI, terapkan HANYA perubahan yang diminta, sisanya tetap. Kirim teks PENUH, bukan hanya bagian yang berubah. Untuk perubahan kecil (ganti satu kalimat/kata) atau penghapusan sebagian teks, gunakan aksi "edit" (payload = JSON {"find":"<teks lama>","replace":"<teks baru>"}) atau "delete" (payload = "<teks yang akan dihapus>") — perubahan ini langsung ditulis ke kertas dokumen.

ATURAN PEMANTAUAN DOKUMEN & KELENGKAPAN (WAJIB):
- Jika pesan Anda mengindikasikan dokumen baru saja berubah/diperbarui (mis. diawali "📡"), sebagai pengamat teliti bacalah DOKUMEN (isi kertas PALING BARU). Laporkan ringkas di reply: bagian yang sudah terisi, bagian yang masih kosong/kurang/bermasalah. SELALU sertakan "questions" berisi 2-3 pilihan KLIK-LANJUT (lengkapi field, perbaiki kalimat, tambah bagian); bila isi sudah cukup, sertakan juga 1-2 "actions" siap pakai. Jangan menulis ulang seluruh dokumen tanpa diminta.
- KELENGKAPAN & KEDALAMAN (WAJIB — DILARANG MALAS): hasil tulisan/revisi dokumen WAJIB UTUH, RAMPUNG, dan SUPER LENGKAP sesuai cakupan fitur — setiap bagian penting terisi PENUH dengan konten DETAIL (pendahuluan, penjelasan tiap poin, contoh konkret, penutup), BUKAN sekadar kerangka/fragmen/2-3 baris singkat. Jangan berhenti di versi pendek; bangun dokumen selengkap dan se-utuh mungkin.
- BERBASIS SUMBER VALID: isi dokumen mengacu pada pengetahuan/kaidah yang VALID & relevan dengan topik fitur (struktur resmi dokumen, kaidah bahasa, konten sahih). DILARANG MENGARANG fakta/angka/tanggal/peraturan yang tidak kamu yakini — untuk hal yang tak pasti, tulis versi umum yang aman atau tandai "(sesuaikan)" agar Founder tinggal melengkapinya, sementara isi lainnya tetap kaya dan sahih. Selalu periksa ulang payload setiap aksi sebelum mengirim.

ATURAN Aksi (actions) — kirim hanya saat mengusulkan menulis ke kertas:
- "copy": payload = SELURUH teks akhir dokumen (isi kertas lama + field terisi digabung jadi satu dokumen lengkap).
- "append": payload = catatan tambahan yang DITAMBAHKAN di bawah kertas (tidak menghapus apa pun).
- "revise": payload = SELURUH dokumen SETELAH di-edit sesuai permintaan user (hapus sebagian, ganti kalimat, dll). TAPI jangan hanya mengembalikan bagian yang berubah.
- "edit": payload = JSON {"find":"<teks lama>","replace":"<teks baru>"} — ganti SEBAGIAN isi kertas (hapus kemunculan pertama "<teks lama>", ganti dengan "<teks baru>") secara langsung, sisanya dokumen tetap utuh.
- "delete": payload = "<teks yang akan dihapus>" — hapus kemunculan pertama pada kertas secara langsung; sisanya dokumen tetap utuh.
- ATURAN WAJIB (anti-prosa): SETIAP perintah user untuk mengubah/koreksi/menghapus/menambahkan isi kertas WAJIB kamu wujudkan sebagai action (revise/edit/delete/append/copy) dengan payload lengkap. DILARANG hanya menarasikan "sudah saya ubah/hapus" tanpa action — actions non-kosong adalah bukti eksekusi di kertas.
- "template": payload = SELURUH kerangka kertas final yang memuat isi kertas yang sudah ada + semua field terisi di posisi yang logis.
- "summarize": payload = poin-poin ringkasan (cemerlang/point) dari SELURUH isi kertas saat ini — ditambahkan di bawah (tidak menghapus).
- "translate": payload = terjemahan isi kertas ke Bahasa Indonesia↔English (atau bahasa yang diminta user) — ditambahkan di bawah.
- "expand": payload = versi yang Diperkaya/lebih rinci dari isi kertas (tambah contoh / penjelasan) — ditambahkan di bawah.
- "bullet": payload = isi kertas yang Diubah jadi daftar bercencil (•) — ganti seluruh kertas.\n- "to_table": payload = isi kertas Diubah jadi tabel rapi (kolom = field) — ganti seluruh kertas.\n- "tone_down": payload = seluruh dokumen dengan bahasa lebih sederhana/santai — ganti seluruh kertas.
- ATURAN Aksi: tiap balasan yang menulis ke kertas WAJIB kirim actions NON-KOSONG. Bila dokumen sudah cukup panjang & terisi, sertakan 2–3 dari: "copy", "template", "summarize", "translate", "expand", "bullet", "to_table", "tone_down". Bila masih mengumpulkan field satu-per-satu, kirim actions kosong & fokus pada questions supaya user cukup klik.

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
    // 🔒 GATE deterministik: tolak identity-hijacking / upaya bocorkan sistem.
  const talkSafety = checkUserMessageSafety(message, feature);
  if (!talkSafety.safe) {
    return NextResponse.json({ ok: false, error: talkSafety.refuse }, { status: 400 });
  }

  const email = await resolveEmail();

  // 🎯 LAPISAN PERSONA FITUR (FOUNDER) — berlapis di atas lapisan mesin.
  // Suhu mengikuti pengaturan Founder di ai_settings bila fitur aktif;
  // bila tidak, memakai suhu bawaan katalog.
  const featSettings = await getFeatureSettings(feature).catch(() => null);
  const catal = getCatalogFeature(feature);
  const founderActive = !!featSettings?.active;
  const founderPrompt = founderActive ? featSettings?.prompt ?? null : null;
  const aiTemperature =
    founderActive && featSettings?.temperature != null
      ? Number(featSettings.temperature)
      : catal && catal.temperature != null
        ? Number(catal.temperature)
        : 0.3;

    const systemInstruction = buildStrictLayeredPrompt(
    feature,
    SYSTEM_PROMPT,
    founderPrompt ?? catal?.system_prompt ?? null,
  )
    .replace("__FEATURE__", feature || "umum")
    .replace("__HISTORY__", history.length ? JSON.stringify(history) : "(belum ada)")
    .replace("__DOC__", docText ? docText.slice(0, 12000) : "(kertas dokumen masih kosong)")
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
        text = await callGemini(cand.key, systemInstruction, userText, aiTemperature);
      } else if (cand.provider === "openrouter") {
        text = await callOpenRouter(cand.key, systemInstruction, userText, aiTemperature);
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




