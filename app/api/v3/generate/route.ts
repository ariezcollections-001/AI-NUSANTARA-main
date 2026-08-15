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
import { getAppUrl } from "@/lib/url";
import { getFreeKeyPool, getPaidKeyPool, blockKey, type KeyProvider, type RotatingKey } from "@/lib/aiVault";

export const runtime = "edge";

const MAX_OUTPUT_TOKENS = 4096;
const MAX_INPUT_LENGTH = 32000;
const DEFAULT_TEMPERATURE = 0.2;

/* Hitung jumlah KARAKTER sesungguhnya (Unicode code point), bukan unit UTF-16.
   Ini membuat pemotongan saldo akurat untuk emoji & huruf non-Latin. */
const charCount = (s: string): number => Array.from(s ?? "").length;

/* Fallback system instruction when no feature prompt matches. */
const DEFAULT_FEATURE_INSTRUCTION =
  "Fitur AI tidak dikenal. Tolak dengan ramah sambil mohon maaf: 'Mohon maaf sekali ya 🙏, sepertinya fitur yang kamu pilih belum tersedia. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊' Jangan berikan respons lain." +
  "Jawab dalam bahasa Indonesia yang jelas dan profesional. Jangan pernah " +
  "mengarang fakta. Jika informasi tidak lengkap, nyatakan dengan jujur. " +
  "Berikan langkah praktis konkret bila relevan.";

/*
 * Per-feature system prompts — keyed by the EXACT `id` emitted by the
 * `fiturNusantara` menu in components/responsive/*.tsx. All 12 directory
 * cards (GURU / MAHASISWA / UMKM / UMUM) resolve to a tailored prompt, so
 * none of them silently falls back to the DEFAULT instruction.
 */
/*
 * 13 Fitur AI Nusantara — Role-Lock Constraint v3.0
 * KEY: ID fitur harus 100% sinkron dengan frontend TampilanPC.tsx
 */
const FEATURE_INSTRUCTIONS: Record<string, string> = {
  "gen-rpp": "Berbicaralah sebagai Pakar Kurikulum Merdeka Kemendikbudristek. TUGAS MUTLAK: Buat RPP Kurikulum Merdeka yang lengkap, rapi, mencakup ATP, Langkah Pembelajaran, dan Profil Pelajar Pancasila. KAMU HANYA melayani pembuatan RPP/modul ajar. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan RPP. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan RPP. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊' Langsung berikan output tanpa basa-basi.",
  "buat-soal": "Berbicaralah sebagai Profesor Pembuat Evaluasi Akademik. TUGAS MUTLAK: Generate bank soal ujian (pilihan ganda/esai) lengkap dengan kunci jawaban dan bobot nilai berdasarkan materi masukan user. KAMU HANYA melayani pembuatan soal ujian. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan soal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan soal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "koreksi-tugas": "Berbicaralah sebagai Guru Penguji Senior yang ramah namun tetap objektif dan penuh empati. TUGAS MUTLAK: Koreksi teks jawaban tugas siswa, berikan nilai angka 1-100, jabarkan letak kesalahan, dan berikan revisi perbaikan yang benar. KAMU HANYA melayani koreksi jawaban tugas siswa. DILARANG KERAS menjawab pertanyaan atau diskusi di luar koreksi tugas. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar koreksi tugas. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bahan-ajar": "Berbicaralah sebagai Ahli Desain Pembelajaran Instruksional. TUGAS MUTLAK: Susun modul materi rangkuman bahan ajar siap presentasi per poin (bullet points) yang padat, jelas, dan mudah dijelaskan di papan tulis. KAMU HANYA melayani penyusunan bahan ajar/materi belajar. DILARANG KERAS menjawab pertanyaan atau diskusi di luar penyusunan bahan ajar. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penyusunan bahan ajar. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bedah-jurnal": "Berbicaralah sebagai Peneliti Utama Jurnal Internasional Scopus Q1. TUGAS MUTLAK: Bedah teks jurnal masukan user, lalu jabarkan abstrak, metodologi, temuan kunci, kelemahan riset, dan rekomendasi masa depan. KAMU HANYA melayani bedah/analisis jurnal ilmiah. DILARANG KERAS menjawab pertanyaan atau diskusi di luar bedah jurnal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar bedah jurnal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "rangkum-buku": "Berbicaralah sebagai Peringkas Buku Profesional. TUGAS MUTLAK: Peras bab buku yang tebal menjadi ringkasan eksekutif per bab yang sangat padat tanpa menghilangkan substansi teori utama. KAMU HANYA melayani peringkasan buku/teks buku. DILARANG KERAS menjawab pertanyaan atau diskusi di luar peringkasan buku. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar peringkasan buku. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "kerangka-skripsi": "Berbicaralah sebagai Dosen Pembimbing Skripsi yang Ramah dan Suportif. TUGAS MUTLAK: Buat outline struktur proposal skripsi Bab 1 sampai Bab 5 lengkap dengan saran judul alternatif dan rekomendasi landasan teori. KAMU HANYA melayani penyusunan kerangka/sistematika skripsi. DILARANG KERAS menjawab pertanyaan atau diskusi di luar penyusunan skripsi. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penyusunan skripsi. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "tiktok-viral": "Berbicaralah sebagai Social Media Growth Hacker spesialis FYP TikTok Indonesia. TUGAS MUTLAK: Buat draf naskah video pendek dengan format kaku: Hook 3 detik pertama, Storyline konten, dan Call To Action (CTA) menjual, plus 5 hashtag magnet views. KAMU HANYA melayani pembuatan skrip/konten video pendek TikTok/Reels. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan skrip video. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan skrip video. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "caption-ig": "Berbicaralah sebagai Copywriter Agensi Kreatif Digital. TUGAS MUTLAK: Buat caption Instagram yang estetik, memicu interaksi (engagement), persuasif, dan dilengkapi barisan tagar relevan yang rapi. KAMU HANYA melayani pembuatan caption/konten Instagram. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan caption. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan caption. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "ide-bisnis": "Berbicaralah sebagai Konsultan Bisnis Korporasi Senior. TUGAS MUTLAK: Lakukan analisis SWOT kilat, petakan target pasar, dan berikan 3 taktik gerilya untuk memenangkan produk UMKM buatan user di pasar lokal. KAMU HANYA melayani analisis strategi/ide bisnis dan UMKM. DILARANG KERAS menjawab pertanyaan atau diskusi di luar analisis ide bisnis. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar analisis ide bisnis. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bahasa-formal": "Berbicaralah sebagai Sekretaris Eksekutif dan Ahli Korespondensi Bisnis. TUGAS MUTLAK: Ubah total teks acak/kasual dari user menjadi surat penawaran bisnis resmi, proposal formal, atau email korporat yang berwibawa tinggi. KAMU HANYA melayani penyelarasan/pembuatan teks bahasa formal dan surat resmi. DILARANG KERAS menjawab pertanyaan atau diskusi di luar perubahan teks formal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penulisan formal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "generator-propaganda": "Berbicaralah sebagai Direktur Propaganda dan Kampanye Kreatif Masal. TUGAS MUTLAK: Buat narasi copywriting iklan persuasif berskala luas yang membakar emosi, memicu urgensi pembelian, dan menggempur psikologis pasar digital Indonesia. KAMU HANYA melayani pembuatan narasi propaganda/iklan persuasif. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan narasi propaganda. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan narasi propaganda. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "audio-mp3-manusia": "Berbicaralah sebagai AI Voice Over Director & Scriptwriter. TUGAS MUTLAK: Ubah masukan teks dari user menjadi draf naskah pembacaan suara audio (Voice Over Script) yang memiliki intonasi manja, luwes, natural seperti manusia asli, lengkap dengan tanda jeda baca (tanda koma, titik, tanda penekanan nada [intonasi naik/turun]) agar siap diumpankan ke mesin Text-to-Speech MP3! KAMU HANYA melayani pembuatan naskah Voice Over/narasi audio. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan naskah VO. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan naskah audio. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "chat-ai": "Berbicaralah sebagai Asisten AI generik yang ramah, jujur, dan bersolutif. Tugasmu adalah berdiskusi bebas dengan pengguna — kamu BOLEH membahas topik APAPUN: sains, teknologi, budaya, seni, bisnis, agama, politik, atau hal santai sehari-hari. Tidak ada batasan topik. Jaga tetap jujur, berikan langkah praktis ringkas + contoh konkret saat relevan, dan jangan pernah mengarang fakta. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong. Wajib selalu menjawab dengan SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU apa pun yang diketik user, di fitur mana pun — dilarang keras memaki, memarahi, menghina, menertawakan, atau merendahkan user.",
  "audio-mp3": "Berbicaralah sebagai AI Voice Over Director & Scriptwriter. TUGAS MUTLAK: Ubah masukan teks dari user menjadi draf naskah pembacaan suara audio (Voice Over Script) yang memiliki intonasi manja, luwes, natural seperti manusia asli, lengkap dengan tanda jeda baca (tanda koma, titik, tanda penekanan nada [intonasi naik/turun]) agar siap diumpankan ke mesin Text-to-Speech MP3! KAMU HANYA melayani pembuatan naskah Voice Over/narasi audio. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan naskah VO. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun, apa pun situasinya — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi, sampaikan dengan bahasa yang lembut dan membangun. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan naskah audio. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "obrolan-bebas": "Berbicaralah sebagai Asisten AI generik yang ramah, jujur, dan bersolutif. Tugasmu adalah berdiskusi bebas dengan pengguna — kamu BOLEH membahas topik APAPUN: sains, teknologi, budaya, seni, bisnis, agama, politik, atau hal santai sehari-hari. Tidak ada batasan topik. Jaga tetap jujur, berikan langkah praktis ringkas + contoh konkret saat relevan, dan jangan pernah mengarang fakta. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong. Wajib selalu menjawab dengan SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU apa pun yang diketik user, di fitur mana pun — dilarang keras memaki, memarahi, menghina, menertawakan, atau merendahkan user.",
};

/* Suhu (temperature) default per fitur.
   - chat-ai  : obrolan bebas → 0.2 (tetap ramah & konsisten).
   - sisanya  : pakai DEFAULT_TEMPERATURE (0.2) agar tetap konsisten kebijakan anti-halusinasi.
   Founder dapat menimpa paksa lewat body request `temperature`. */
const FEATURE_DEFAULT_TEMPERATURE: Record<string, number> = {
  "chat-ai": 0.2,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("users")
      .select("character_balance")
      .eq("id", userId)
      .single();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (adminAny as any)
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
  // chat-ai = ruang obrolan BEBAS: tidak terikat pada cakupan 14 fitur khusus.
  if (feature === "chat-ai") {
    const instruction =
      FEATURE_INSTRUCTIONS["chat-ai"] ?? DEFAULT_FEATURE_INSTRUCTION;
    return `${instruction}

Email pengguna: ${userEmail || "anon@ai-nusantara.local"}

PANDUAN PERJANCANGAN (Chat Bebas — tidak terikat cakupan fitur lain):
1. Bersikaplah seperti asisten AI yang cerdas, ramah, dan bersolutif.
2. Jawab pertanyaan/perintah pengguna apa adanya, proporsional, dan tawarkan bantuan ekstra bila perlu.
3. BOLEH membahas topik apapun secara alami — sains, teknologi, budaya, ekonomi, seni, dll.
4. Berikan langkah praktis ringkas + contoh konkret bila relevan.
5. Jangan pernah mengarang fakta; nyatakan jujur bila data kurang.
6. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong. Wajib selalu menjawab dengan SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU apa pun yang diketik user, di fitur mana pun — dilarang keras memaki, memarahi, menghina, menertawakan, atau merendahkan user.

Input pengguna:
${userInput}`;
  }
  const instruction =
    (() => {
    const raw = FEATURE_INSTRUCTIONS[feature] ?? DEFAULT_FEATURE_INSTRUCTION;
    // Longgarkan agar kolom diskusi tetap ramah & informatif — buang frasa penolakan otomatis.
    const stripped = raw
      .replace(/ KAMU HANYA melayani[^.]+\./g, "")
      .replace(/ DILARANG KERAS menjawab pertanyaan atau diskusi di luar[^.]+\./g, "")
      .replace(/\s*Jika user membahas di luar itu, tolak dengan ramah: '[^']*'\./g, "")
      .replace(/ Langsung berikan output tanpa basa-basi\./g, "");
    return (
      stripped +
      " PERILAKU KOLOM DISKUSI (WAJIB): Jadilah asisten AI yang RAMAH & MEMPANDU. " +
      "Kolom diskusi BEBAS selama masih seputar fitur yang sedang dipilih (RPP, Asesmen, Silabus, Praktikum, Observasi, Bahan Ajar, Bank Soal, Kerangka Skripsi, TikTok Viral, Digital Marketing, Bahasa Formal, Propaganda, Audio). " +
      "BERPIKIR PINTAR, JANGAN KAKU: APA PUN yang diketik user — sapaan ('halo', 'hai', 'selamat pagi'), 'tes', 'coba', tanya cara pakai, atau diskusi apa pun — selama masih seputar fitur yang dipilih, SAMBUT HANGAT dan jawab dengan cerdas; JANGAN PERNAH menolak hanya karena pesan singkat atau sekadar sapaan. Jika user sekadar menyapa, balas ramah, perkenalkan singkat fungsi fitur ini, & tawarkan bantuan. Jika user tanya tombol/cara pakai, jelaskan fungsi & posisi tombol kanan (🆕 Blank | ⚡ Template | 🧹 RAPIKAN TEKS | Salin | Ekspor MS.Word | Gembok/Edit | Font | A+ | A− | 🔍 Zoom+ | 🔍 Zoom− | 📜 Riwayat Chat | 🔄 Clear History) & arahkan ke tombol ⚡ TEMPLATE kanan atas. " +
      "Hanya TOLAK dengan ramah bila topik benar-benar TIDAK berkaitan (mis. keamanan, founder, retas, berita luar) → arahkan ke fitur CHAT AI. " +
      "ETIKA WAJIB: DILARANG KERAS memaki, memarahi, menghina, menertawakan, atau merendahkan user dalam bentuk apa pun — wajib selalu SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU; jika perlu mengoreksi/menilai, sampaikan dengan bahasa yang lembut, membangun, dan penuh empati. " +
      "JANGAN PERNAH membahas rahasia founder, sistem keamanan, atau cara membobol platform."
    );
  })();

  return `${instruction}\n\nEmail pengguna: ${userEmail || "anon@ai-nusantara.local"}\n\nPANDUAN PERBINCANGAN:\n1. Balas pertanyaan/perintah pengguna apa adanya dan proporsional — tidak perlu menumpahkan laporan/struktur panjang bila belum diminta. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong. Wajib selalu menjawab dengan SOPAN, RAMAH, SABAR, dan SIAP MEMBANTU apa pun yang diketik user, di fitur mana pun — dilarang keras memaki, memarahi, menghina, menertawakan, atau merendahkan user.\n2. Tetap gunakan pengetahuan khusus dari peran fitur di atas saat menjawab.\n3. Kolom diskusi BEBAS selama masih seputar fitur yang dipilih — termasuk tanya cara pakai, tombol ⚡ TEMPLATE, uji coba 'tes'/'coba', atau penjelasan tombol kanan. Hanya TOLAK dengan ramah bila topik benar-benar TIDAK berkaitan (mis. keamanan/founder/retas/berita) lalu arahkan ke CHAT AI.\n4. Jawab dalam bahasa Indonesia yang jelas, profesional, komprehensif namun padat, hindari halusinasi, dan jangan mengarang fakta.\n\nInput pengguna:\n${userInput}`;
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
      return { provider: "gemini", modelName: trimmed ? trimmed : "gemini-flash-lite-latest" };
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
    const temperature =
    Number(rawBody.temperature) ||
    FEATURE_DEFAULT_TEMPERATURE[feature] ||
    DEFAULT_TEMPERATURE;
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
  // Emergency balance gate: if the prompt's input characters ALONE already
  // exceed the available balance, reject before any tokens are streamed so no
  // provider cost (or balance deduction) is ever incurred.
  if (message.length > currentBalance) {
    return NextResponse.json(
      {
        error:
          "Panjang prompt melebihi saldo karakter Anda. Sisa saldo " +
          currentBalance +
          " karakter, tetapi prompt Anda berisi " +
          message.length +
          " karakter. Perpendek prompt atau tambah saldo terlebih dahulu.",
      },
      { status: 402 },
    );
  }

    /* 4. Resolve provider + rotasi key.
   * 🔁 ROTATOR: pool GRATIS (Gemini + OpenRouter) dipakai dulu, round-robin.
   *    PAID hanya dipakai bila SEMUA free exhausted, dan otomatis balik ke
   *    free begitu free pulih. Transparan — dashboard user tidak terganggu. */
  const { provider, modelName } = resolveProvider(model);

  // Kolam free (semua key gratis — kedua provider) + cadangan paid.
  const freePool = await getFreeKeyPool();
  const paidPool = await getPaidKeyPool();

  // Urutkan kandidat: free dulu (provider asli request), lalu paid cadangan.
  const forcedProvider: KeyProvider | null = provider === "gemini" ? "gemini" : provider === "openrouter" ? "openrouter" : null;
  const candidates: RotatingKey[] = [
    ...freePool.filter((c) => forcedProvider ? c.provider === forcedProvider : true),
    ...paidPool,
  ];

  // Jaring pengaman: jika tidak ada key dari provider yang diminta, izinkan
  // provider lain agar transparan ke user tetap jalan.
  const effective = candidates.length
    ? candidates
    : [...freePool, ...paidPool];

  if (effective.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada API key AI yang tersedia di Vault Founder." },
      { status: 503 },
    );
  }

  try {
    return await streamWithRotation({
      keyPool: effective,
      modelName,
      systemInstruction: buildSystemInstruction(feature, message, user.email ?? ""),
      message,
      temperature,
      maxTokens,
      signal: request.signal,
      user,
      currentBalance,
      appUrl: getAppUrl(request),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Kesalahan mesin AI: ${errorMessage}` }, { status: 500 });
  }
}

/* Provider: Google Gemini + OpenRouter (unified rotation). */

interface RotationDeps {
  keyPool: RotatingKey[];
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

/**
 * 🔁 Unified streaming dengan rotasi key lintas-provider.
 *
 * Mencoba setiap key pada titik SETUP (tempat 401/429 biasanya muncul):
 *   - Gemini  : `generateContentStream()` melempar pd saat dipanggil.
 *   - OpenRouter : fetch REST -> cek status sebelum membuka stream.
 * Bila satu key kena 401/429 -> `blockKey()` (cooldown 60s) lalu lanjut ke
 * key berikutnya di pool (free dulu, paid cadangan). Transparan ke user.
 */
async function streamWithRotation(deps: RotationDeps): Promise<Response> {
  const {
    keyPool, modelName, systemInstruction, message,
    temperature, maxTokens, signal, user, currentBalance, appUrl,
  } = deps;

  const encoder = new TextEncoder();
  let closed = false;
  const closeStream = () => { if (closed) return; closed = true; };
  const abortHandler = () => closeStream();
  signal.addEventListener("abort", abortHandler);

  const eventStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let outputCharacters = 0;
      let lastError = "";

      try {
        // ── Coba setiap key sampai satu berhasil SETUP ─────────────────────
        for (const candidate of keyPool) {
          if (signal.aborted) break;

          try {
            if (candidate.provider === "gemini") {
              const genAI = new GoogleGenerativeAI(candidate.key);
              const model = genAI.getGenerativeModel({ model: modelName });
              const geminiStream = await model.generateContentStream({
                systemInstruction,
                contents: [{ role: "user", parts: [{ text: message }] }],
                generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.95 },
              });

              // Streaming sukses → kirim token + monetisasi
              for await (const chunk of geminiStream.stream) {
                if (signal.aborted) break;
                const token = chunk.text();
                if (token) {
                  outputCharacters += charCount(token);
                  if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`));
                }
              }
            } else {
              // OpenRouter — OpenAI-compatible streaming REST
              const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                signal,
                headers: {
                  Authorization: `Bearer ${candidate.key}`,
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

              if (orResponse.status === 401 || orResponse.status === 429) {
                throw Object.assign(new Error(`OpenRouter ${orResponse.status}`), { status: orResponse.status });
              }
              if (!orResponse.ok) {
                const errBody = await orResponse.text().catch(() => "");
                throw new Error(`OpenRouter menolak (${orResponse.status}): ${errBody}`);
              }

              const reader = orResponse.body?.getReader();
              if (!reader) throw new Error("OpenRouter tidak mendukung streaming.");
              const decoder = new TextDecoder();
              let buffer = "";
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
                  if (dataStr === "[DONE]") continue;
                  try {
                    const payload = JSON.parse(dataStr) as {
                      choices?: Array<{ delta?: { content?: string } }>;
                    };
                    const delta = payload?.choices?.[0]?.delta?.content;
                    if (typeof delta === "string" && delta) {
                      outputCharacters += charCount(delta);
                      if (!closed) controller.enqueue(sseData({ text: delta }));
                    }
                  } catch {
                    /* abaikan frame SSE rusak */
                  }
                }
              }
              reader.releaseLock?.();
            }

            // ── Berhasil → deduksi saldo + done frame ──────────────────
            if (!closed && !signal.aborted) {
              const inputCharacters = charCount(message.trim());
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
            return; // selesai — hentikan pencarian key

          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const status =
              (err as { status?: number })?.status ||
              (/401/.test(errMsg) ? 401 : /429|rate.?limit|quota/i.test(errMsg) ? 429 : 0);

            if (status === 401 || status === 429) {
              blockKey(candidate.provider, candidate.key);
              lastError = `Key ${candidate.provider} ditolak (${status}) — dicoba key berikutnya`;
              continue; // lanjut ke key berikutnya di pool
            }
            // Error non-rate-limit: hentikan loop, lapor ke user
            lastError = errMsg;
            break;
          }
        }

        // Semua key gagal → kirim error frame
        if (!closed && !signal.aborted) {
          controller.enqueue(sseData({ type: "error", error: lastError || "Semua API key AI gagal." }));
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
              const inputCharacters = charCount(message.trim());
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
                outputCharacters += charCount(delta);
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

