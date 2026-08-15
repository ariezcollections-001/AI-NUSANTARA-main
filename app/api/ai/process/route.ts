import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVaultKeys } from "@/lib/aiVault";

const requestHistory: Record<string, number[]> = {};

const featureInstructions: Record<string, string> = {
  "gen-rpp":
    "Berbicaralah sebagai Pakar Kurikulum Merdeka Kemendikbudristek. TUGAS MUTLAK: Buat RPP Kurikulum Merdeka yang lengkap, rapi, mencakup ATP, Langkah Pembelajaran, dan Profil Pelajar Pancasila. KAMU HANYA melayani pembuatan RPP/modul ajar. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan RPP. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan RPP. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊' Langsung berikan output tanpa basa-basi.",
  "buat-soal":
    "Berbicaralah sebagai Profesor Pembuat Evaluasi Akademik. TUGAS MUTLAK: Generate bank soal ujian (pilihan ganda/esai) lengkap dengan kunci jawaban dan bobot nilai berdasarkan materi masukan user. KAMU HANYA melayani pembuatan soal ujian. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan soal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan soal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "koreksi-tugas":
    "Berbicaralah sebagai Guru Penguji Senior yang kritis namun objektif. TUGAS MUTLAK: Koreksi teks jawaban tugas siswa, berikan nilai angka 1-100, jabarkan letak kesalahan, dan berikan revisi perbaikan yang benar. KAMU HANYA melayani koreksi jawaban tugas siswa. DILARANG KERAS menjawab pertanyaan atau diskusi di luar koreksi tugas. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar koreksi tugas. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bahan-ajar":
    "Berbicaralah sebagai Ahli Desain Pembelajaran Instruksional. TUGAS MUTLAK: Susun modul materi rangkuman bahan ajar siap presentasi per poin (bullet points) yang padat, jelas, dan mudah dijelaskan di papan tulis. KAMU HANYA melayani penyusunan bahan ajar/materi belajar. DILARANG KERAS menjawab pertanyaan atau diskusi di luar penyusunan bahan ajar. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penyusunan bahan ajar. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bedah-jurnal":
    "Berbicaralah sebagai Peneliti Utama Jurnal Internasional Scopus Q1. TUGAS MUTLAK: Bedah teks jurnal masukan user, lalu jabarkan abstrak, metodologi, temuan kunci, kelemahan riset, dan rekomendasi masa depan. KAMU HANYA melayani bedah/analisis jurnal ilmiah. DILARANG KERAS menjawab pertanyaan atau diskusi di luar bedah jurnal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar bedah jurnal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "rangkum-buku":
    "Berbicaralah sebagai Peringkas Buku Profesional. TUGAS MUTLAK: Peras bab buku yang tebal menjadi ringkasan eksekutif per bab yang sangat padat tanpa menghilangkan substansi teori utama. KAMU HANYA melayani peringkasan buku/teks buku. DILARANG KERAS menjawab pertanyaan atau diskusi di luar peringkasan buku. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar peringkasan buku. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "kerangka-skripsi":
    "Berbicaralah sebagai Dosen Pembimbing Skripsi Tergalak. TUGAS MUTLAK: Buat outline struktur proposal skripsi Bab 1 sampai Bab 5 lengkap dengan saran judul alternatif dan rekomendasi landasan teori. KAMU HANYA melayani penyusunan kerangka/sistematika skripsi. DILARANG KERAS menjawab pertanyaan atau diskusi di luar penyusunan skripsi. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penyusunan skripsi. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "tiktok-viral":
    "Berbicaralah sebagai Social Media Growth Hacker spesialis FYP TikTok Indonesia. TUGAS MUTLAK: Buat draf naskah video pendek dengan format kaku: Hook 3 detik pertama, Storyline konten, dan Call To Action (CTA) menjual, plus 5 hashtag magnet views. KAMU HANYA melayani pembuatan skrip/konten video pendek TikTok/Reels. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan skrip video. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan skrip video. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "caption-ig":
    "Berbicaralah sebagai Copywriter Agensi Kreatif Digital. TUGAS MUTLAK: Buat caption Instagram yang estetik, memicu interaksi (engagement), persuasif, dan dilengkapi barisan tagar relevan yang rapi. KAMU HANYA melayani pembuatan caption/konten Instagram. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan caption. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan caption. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "ide-bisnis":
    "Berbicaralah sebagai Konsultan Bisnis Korporasi Senior. TUGAS MUTLAK: Lakukan analisis SWOT kilat, petakan target pasar, dan berikan 3 taktik gerilya untuk memenangkan produk UMKM buatan user di pasar lokal. KAMU HANYA melayani analisis strategi/ide bisnis dan UMKM. DILARANG KERAS menjawab pertanyaan atau diskusi di luar analisis ide bisnis. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar analisis ide bisnis. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "bahasa-formal":
    "Berbicaralah sebagai Sekretaris Eksekutif dan Ahli Korespondensi Bisnis. TUGAS MUTLAK: Ubah total teks acak/kasual dari user menjadi surat penawaran bisnis resmi, proposal formal, atau email korporat yang berwibawa tinggi. KAMU HANYA melayani penyelarasan/pembuatan teks bahasa formal dan surat resmi. DILARANG KERAS menjawab pertanyaan atau diskusi di luar perubahan teks formal. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar penulisan formal. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "generator-propaganda":
    "Berbicaralah sebagai Direktur Propaganda dan Kampanye Kreatif Masal. TUGAS MUTLAK: Buat narasi copywriting iklan persuasif berskala luas yang membakar emosi, memicu urgensi pembelian, dan menggempur psikologis pasar digital Indonesia. KAMU HANYA melayani pembuatan narasi propaganda/iklan persuasif. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan narasi propaganda. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan narasi propaganda. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "audio-mp3-manusia":
    "Berbicaralah sebagai AI Voice Over Director & Scriptwriter. TUGAS MUTLAK: Ubah masukan teks dari user menjadi draf naskah pembacaan suara audio (Voice Over Script) yang memiliki intonasi manja, luwes, natural seperti manusia asli, lengkap dengan tanda jeda baca (tanda koma, titik, tanda penekanan nada [intonasi naik/turun]) agar siap diumpankan ke mesin Text-to-Speech MP3! KAMU HANYA melayani pembuatan naskah Voice Over/narasi audio. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan naskah VO. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan naskah audio. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "chat-ai":
    "Berbicaralah sebagai Asisten AI generik yang ramah, jujur, dan bersolutif. Tugasmu adalah berdiskusi bebas dengan pengguna — kamu BOLEH membahas topik APAPUN: sains, teknologi, budaya, seni, bisnis, agama, politik, atau hal santai sehari-hari. Tidak ada batasan topik. Jaga tetap jujur, berikan langkah praktis ringkas + contoh konkret saat relevan, dan jangan pernah mengarang fakta. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong.",
  "audio-mp3":
    "Berbicaralah sebagai AI Voice Over Director & Scriptwriter. TUGAS MUTLAK: Ubah masukan teks dari user menjadi draf naskah pembacaan suara audio (Voice Over Script) yang memiliki intonasi manja, luwes, natural seperti manusia asli, lengkap dengan tanda jeda baca (tanda koma, titik, tanda penekanan nada [intonasi naik/turun]) agar siap diumpankan ke mesin Text-to-Speech MP3! KAMU HANYA melayani pembuatan naskah Voice Over/narasi audio. DILARANG KERAS menjawab pertanyaan atau diskusi di luar pembuatan naskah VO. Jika user menyapa, bertanya, atau hanya mencoba-coba (mis. 'halo', 'hai', 'tes', 'coba'), sambut hangat & jawab dengan cerdas sesuai fitur ini — JANGAN menolak sekadar karena sapaan atau uji coba. Hanya tolak dengan ramah bila topik benar-benar di luar fitur ini: 'Mohon maaf sekali ya 🙏, saat ini saya hanya dapat membantu seputar pembuatan naskah audio. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊'",
  "obrolan-bebas":
    "Berbicaralah sebagai Asisten AI generik yang ramah, jujur, dan bersolutif. Tugasmu adalah berdiskusi bebas dengan pengguna — kamu BOLEH membahas topik APAPUN: sains, teknologi, budaya, seni, bisnis, agama, politik, atau hal santai sehari-hari. Tidak ada batasan topik. Jaga tetap jujur, berikan langkah praktis ringkas + contoh konkret saat relevan, dan jangan pernah mengarang fakta. JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong.",
};

function normalizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

async function getFounderConfig(keyName: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_value")
      .eq("key_name", keyName)
      .maybeSingle<{ key_value: string }>();

    if (!response.error && response.data && typeof response.data.key_value === "string") {
      return response.data.key_value;
    }
  } catch (error) {
    console.warn("Supabase founder_config lookup failed:", error);
  }

  return "";
}

// ==================== SISTEM HYBRID 2 KRAN OTOMATIS ====================
// Kran 1: Rotator Gratisan (Free-tier API Keys)
// Kran 2: Failover Berbayar (Premium API Key)

interface KranKey {
  provider: "gemini" | "openrouter";
  key: string;
  isPaid?: boolean;
}

let kran1RotationIndex = 0;
let kran1Keys: KranKey[] = [];
let kran2Key: KranKey | null = null;
let kran2KeyLoaded = false;

async function loadKran1Keys(): Promise<KranKey[]> {
  try {
    // 🔴 Vault ("KOLAM TOKEN GLOBAL") adalah sumber utama kunci GRATISAN —
    // mencakup Gemini DAN OpenRouter gratis. Kunci berbayar (paidGemini)
    // sudah dipisah dari vault.gemini di getVaultKeys(), jadi tidak pernah
    // tercampur ke Kran 1 (gratis).
    const vault = await getVaultKeys();
    const legacyRaw = await getFounderConfig("gemini_api_keys_free");
    let legacy: string[] = [];
    try {
      if (legacyRaw && legacyRaw.trim() !== "") legacy = JSON.parse(legacyRaw) as string[];
      if (!Array.isArray(legacy)) legacy = [];
    } catch {
      legacy = [];
    }

    // Gabungan key GRATIS Gemini (Vault + legacy), dedupe & valid.
    const mergedGemini = Array.from(
      new Set(
        [...vault.gemini, ...legacy].map((k) => k.trim()).filter((k) => k.length > 0),
      ),
    );

    // 🔁 OPENROUTER GRATIS juga masuk Kran 1 → gratis benar-benar bergilir
    // antara Gemini dan OpenRouter (transparan ke user).
    const mergedOpenRouter = Array.from(
      new Set(vault.openrouter.map((k) => k.trim()).filter((k) => k.length > 0)),
    );

    if (mergedGemini.length === 0 && mergedOpenRouter.length === 0) return [];

    const keys: KranKey[] = [
      ...mergedGemini.map((key) => ({
        provider: "gemini" as const,
        key,
        isPaid: false,
      })),
      ...mergedOpenRouter.map((key) => ({
        provider: "openrouter" as const,
        key,
        isPaid: false,
      })),
    ];
    return keys;
  } catch {
    return [];
  }
}

async function loadKran2Key(): Promise<KranKey | null> {
  if (kran2KeyLoaded) return kran2Key;
  
  try {
    const paidKey = process.env.NEXT_PUBLIC_GEMINI_PAID_KEY || "";
    if (paidKey && paidKey.trim().length > 0) {
      kran2Key = {
        provider: "gemini" as const,
        key: paidKey.trim(),
        isPaid: true,
      };
    } else {
      const configPaidKey = await getFounderConfig("gemini_api_key_paid");
      if (configPaidKey && configPaidKey.trim().length > 0 && !configPaidKey.startsWith("AQ_FALLBACK_")) {
        kran2Key = {
          provider: "gemini" as const,
          key: configPaidKey.trim(),
          isPaid: true,
        };
      }
    }
  } catch {
    kran2Key = null;
  }
  
  kran2KeyLoaded = true;
  return kran2Key;
}

async function getNextKran1Key(): Promise<KranKey | null> {
  if (kran1Keys.length === 0) {
    kran1Keys = await loadKran1Keys();
  }
  
  if (kran1Keys.length === 0) return null;
  
  const key = kran1Keys[kran1RotationIndex % kran1Keys.length];
  kran1RotationIndex++;
  return key;
}

async function findBestApiKey() {
  // Prioritaskan Kran 1 (Rotator Gratisan)
  const kran1Key = await getNextKran1Key();
  if (kran1Key) {
    return kran1Key;
  }

  // Fallback ke Kran 2 (Berbayar) jika Kran 1 habis
  const kran2Key = await loadKran2Key();
  if (kran2Key) {
    return kran2Key;
  }

  // Fallback akhir: cek konfigurasi lama
  const geminiKey = await getFounderConfig("gemini_api_key");
        if (geminiKey.startsWith("AQ_FALLBACK_")) {
    return {
      provider: "gemini" as const,
      key: geminiKey,
      isPaid: false,
    };
  }

    // 🔴 Fallback OpenRouter: pakai Vault terlebih dahulu, lalu legacy config.
  const vault = await getVaultKeys();
  const vaultOpenRouter = vault.openrouter.find((k) => k.length > 10);
  if (vaultOpenRouter) {
    return {
      provider: "openrouter" as const,
      key: vaultOpenRouter,
      isPaid: false,
    };
  }

  const openrouterKey = await getFounderConfig("openrouter_api_key");
  if (openrouterKey) {
    return {
      provider: "openrouter" as const,
      key: openrouterKey,
      isPaid: false,
    };
  }

  return null;
}

function buildSystemPrompt(featureId: string, userInput: string, userEmail: string) {
  const instruction = (() => {
    const rawInstruction = featureInstructions[featureId] || "Fitur AI tidak dikenal. Tolak dengan ramah sambil mohon maaf: 'Mohon maaf sekali ya 🙏, sepertinya fitur yang kamu pilih belum tersedia. Untuk diskusi yang lebih bebas, tenang saja — silakan buka fitur CHAT AI di kategori Umum ya, di sana kita bisa mengobrol apa saja dengan senang hati! 😊' Jangan berikan respons lain.";
    // Longgarkan perilaku penolakan otomatis agar kolom diskusi selalu ramah & memandu.
    const stripped = rawInstruction
      .replace(/ KAMU HANYA melayani[^.]+\./g, "")
      .replace(/ DILARANG KERAS menjawab pertanyaan atau diskusi di luar[^.]+\./g, "")
      .replace(/\s*Jika user membahas di luar itu, tolak dengan ramah: '[^']*'\./g, "")
      .replace(/ Langsung berikan output tanpa basa-basi\./g, "");
    return (
      stripped +
      " PERILAKU KOLOM DISKUSI (WAJIB): Jadilah asisten AI yang RAMAH & MEMPANDU. " +
      "Kolom diskusi BEBAS selama masih seputar fitur yang sedang dipilih — termasuk sapaan, 'halo', 'hai', 'tes', 'coba', tanya cara pakai, tombol template ⚡, atau penjelasan tombol kanan. " +
      "BERPIKIR PINTAR, JANGAN KAKU: APA PUN yang diketik user selama masih seputar fitur yang dipilih — SAMBUT HANGAT dan jawab dengan cerdas; JANGAN PERNAH menolak hanya karena pesan singkat atau sekadar sapaan. Jika user sekadar menyapa, balas ramah, perkenalkan singkat fitur ini, & tawarkan bantuan. Jika user bingung / bertanya cara membuat / tanya tombol — jelaskan fungsi & posisi tombol kanan (🆕 Blank | ⚡ Template | 🧹 RAPIKAN TEKS | Salin | Ekspor MS.Word | Gembok/Edit | Font | A+ | A− | 🔍 Zoom+ | 🔍 Zoom−) lalu arahkan ke tombol ⚡ TEMPLATE kanan atas untuk mengisi form otomatis. " +
      "Hanya TOLAK dengan ramah bila topik benar-benar TIDAK berkaitan dengan fitur yang dipilih (mis. keamanan, founder, retas, berita luar) → arahkan ke fitur CHAT AI. " +
      "JANGAN PERNAH membahas rahasia founder, sistem keamanan, atau cara membobol platform."
    );
  })();
  return `${instruction}\n\nEmail User: ${userEmail || "anon@ai-nusantara.local"}\n\nPetunjuk tambahan: JANGAN pernah memulai atau menyelipkan sapaan 'Halo', 'Hai', 'Selamat datang' pada setiap balasan; sambutan pembuka hanya sekali di awal bila kolom obrolan masih kosong. Jawab dalam bahasa Indonesia, ringkas tetapi komprehensif, hindari halusinasi, dan berikan langkah praktis jika diperlukan. Jangan membuat informasi fiktif.\n\nInput pengguna:\n${userInput}`;
}

async function callAIApi(systemPrompt: string, provider: "gemini" | "openrouter", apiKey: string) {
  try {
    if (provider === "gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: { text: systemPrompt },
            temperature: 0.2,
            maxOutputTokens: 800,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        const isRateLimit = response.status === 429 || 
                           errorText.toLowerCase().includes("rate limit") ||
                           errorText.toLowerCase().includes("quota") ||
                           errorText.toLowerCase().includes("too many requests");
        
        if (isRateLimit) {
          throw new Error(`RATE_LIMIT_429: ${errorText}`);
        }
        throw new Error(`API_ERROR_${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return normalizeValue(data?.candidates?.[0]?.output || data?.output || "");
    }

    const response = await fetch("https://api.openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 🔁 Model default agar OpenRouter gratis tetap jalan di Kran 1;
        // dapat ditimpa lewat founder_config "openrouter_model_default".
        model: (await getFounderConfig("openrouter_model_default")) || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: systemPrompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const isRateLimit = response.status === 429 ||
                         errorText.toLowerCase().includes("rate limit") ||
                         errorText.toLowerCase().includes("quota");
      
      if (isRateLimit) {
        throw new Error(`RATE_LIMIT_429: ${errorText}`);
      }
      throw new Error(`API_ERROR_${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return normalizeValue(data?.choices?.[0]?.message?.content || data?.output || "");
  } catch (error) {
    console.warn("AI provider call failed:", error);
    throw error;
  }
}

async function callAIApiWithFailover(systemPrompt: string, provider: "gemini" | "openrouter", apiKey: string, isPaidKey: boolean = false): Promise<string> {
  try {
    return await callAIApi(systemPrompt, provider, apiKey);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes("RATE_LIMIT_429");

    // 🔁 Jika key GRATIS kena rate-limit, JANGAN langsung lompat ke paid.
    // Coba SEMUA key gratis lain (getNextKran1Key round-robin) dulu, baru
    // fallback ke Kran 2 (berbayar). Ini mencegah paid terpicu saat key
    // gratis lain masih mampu — sesuai keinginan Founder agar tagihan
    // diminimalkan. Transparan ke user (tidak ada error di dashboard).
    if (isRateLimit && !isPaidKey) {
      // Coba beberapa key gratis lain (maksimal jumlah Kran 1).
      const maxFreeTries = Math.max(1, kran1Keys.length);
      for (let i = 0; i < maxFreeTries; i++) {
        const nextFree = await getNextKran1Key();
        if (!nextFree) break;
        if (nextFree.key === apiKey) continue; // sudah dicoba
        try {
          const result = await callAIApi(systemPrompt, nextFree.provider, nextFree.key);
          console.warn(`Kran 1 switched to next free key (${nextFree.provider}) - success`);
          return result;
        } catch (nextErr) {
          const nm = nextErr instanceof Error ? nextErr.message : String(nextErr);
          if (nm.includes("RATE_LIMIT_429")) continue; // coba key gratis berikutnya
          throw nextErr; // error non-rate-limit → berhenti
        }
      }

      // SEMUA key gratis gagal → baru fallback ke Kran 2 (berbayar).
      console.warn("Semua Kran 1 (free) gagal, fallback ke Kran 2 (paid)...");
      const kran2 = await loadKran2Key();
      if (kran2) {
        try {
          const result = await callAIApi(systemPrompt, kran2.provider, kran2.key);
          console.warn("Kran 2 (paid) success - failover activated");
          return result;
        } catch (kran2Error) {
          console.error("Kran 2 also failed:", kran2Error);
          throw kran2Error;
        }
      }
    }

    throw error;
  }
}

function calculateMonetization(input: string, output: string) {
  const inputCharacters = input.length;
  const outputCharacters = output.length || 0;
  const totalDeducted = inputCharacters + outputCharacters;

  return {
    input_characters: inputCharacters,
    output_characters: outputCharacters,
    total_deducted: totalDeducted,
    previous_balance: 0,
    remaining_balance: 0,
  };
}

async function updateUserBalanceIfNeeded(
  userId: string,
  amount: number,
  currentBalance: number,
): Promise<number> {
  const targetBalance = Math.max(0, currentBalance + amount);

  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any;
    const updated = await adminAny
      .from("users")
      .update({ character_balance: targetBalance })
      .eq("id", userId)
      .select("character_balance")
      .single();

    if (!updated.error && updated.data && typeof updated.data.character_balance === "number") {
      return updated.data.character_balance;
    }
  } catch (error) {
    console.warn("Supabase user balance update failed:", error);
  }

  return targetBalance;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const featureId = String(payload.featureId || "").trim();
  const userInput = String(payload.userInput || "").trim();
  const userEmail = String(payload.userEmail || "").trim();

  if (!featureId || !userInput) {
    return NextResponse.json(
      { error: "featureId dan userInput diperlukan." },
      { status: 400 },
    );
  }

  if (!featureInstructions[featureId]) {
    return NextResponse.json(
      { error: "Fitur AI tidak dikenali." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();
  const user = authResult.data?.user;

  if (!user) {
    return NextResponse.json(
      { error: "Autentikasi pengguna diperlukan." },
      { status: 401 },
    );
  }

  const email = userEmail || user.email || "anon@ai-nusantara.local";

  const userRecord = await supabase
    .from("users")
    .select("character_balance,email")
    .eq("id", user.id)
    .single();

  const userData = userRecord.data as { character_balance?: number; email?: string } | null;
  const currentBalance = Number(userData?.character_balance ?? 0) || 0;

  const apiKeyData = await findBestApiKey();
  const systemPrompt = buildSystemPrompt(featureId, userInput, email);

  try {
    const suspiciousPatterns = [/drop\s+table/i, /<script\b/i, /union\s+select/i, /--\s*$/i];
    const foundSuspicious = suspiciousPatterns.some((p) => p.test(userInput));

    const now = Date.now();
    const hist = requestHistory[user.id] || [];
    const newHist = hist.filter((t) => now - t <= 10000);
    newHist.push(now);
    requestHistory[user.id] = newHist;

    if (foundSuspicious || newHist.length > 10) {
      try {
        const admin = createAdminClient();
        const cfg = await admin
          .from("founder_config")
          .select("key_value")
          .eq("key_name", "banned_users")
          .single<{ key_value: string }>();
        let banned: string[] = [];
        if (!cfg.error && cfg.data && cfg.data.key_value) {
          try {
            banned = JSON.parse(cfg.data.key_value);
          } catch {
            banned = [];
          }
        }

        if (!banned.includes(user.id)) banned.push(user.id);
        const adminClient = admin as unknown as {
          from: (table: string) => {
            upsert: (
              row: { key_name: string; key_value: string },
              opts: { onConflict: string[]; returning: string },
            ) => Promise<{ error?: unknown }>
            insert: (row: { event_type: string; ip_address: string; details: Record<string, unknown>; timestamp: string }) => Promise<{ error?: unknown }>
          }
        };

        const response = await adminClient.from("founder_config").upsert(
          { key_name: "banned_users", key_value: JSON.stringify(banned) },
          { onConflict: ["key_name"], returning: "representation" },
        );

        if (response.error) {
          throw response.error;
        }

        await adminClient.from("security_logs").insert({
          event_type: "AUTO_BAN",
          ip_address: String(request.headers.get("x-forwarded-for") || "unknown"),
          details: { reason: foundSuspicious ? "suspicious_payload" : "bruteforce" },
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("auto-ban update failed", e);
      }

      return NextResponse.json(
        { error: "Akun Anda diblokir permanen oleh Founder karena pelanggaran siber!", code: "auto_ban" },
        { status: 403 },
      );
    }
  } catch (e) {
    console.warn("auto-ban check failed", e);
  }

  let output = "";
  let source = "fallback";
  let usedKran: "kran1_free" | "kran2_paid" | "fallback" = "fallback";

  if (apiKeyData) {
    source = apiKeyData.provider;
    usedKran = apiKeyData.isPaid ? "kran2_paid" : "kran1_free";
    
    try {
      output = await callAIApiWithFailover(
        systemPrompt, 
        apiKeyData.provider, 
        apiKeyData.key, 
        apiKeyData.isPaid || false
      );
    } catch (apiError) {
      console.error("All Kran attempts failed:", apiError);
      output = "";
      usedKran = "fallback";
    }
  }

  if (!output) {
    output = `Fitur (${featureId}) diproses dalam mode fallback karena API key belum tersedia.\n\n${systemPrompt}`;
    source = "fallback";
    usedKran = "fallback";
  }

  const monetization = calculateMonetization(userInput, output);
  monetization.previous_balance = currentBalance;

  if (monetization.total_deducted > currentBalance) {
    return NextResponse.json(
      {
        error: "Saldo karakter tidak mencukupi untuk memproses permintaan.",
        current_balance: currentBalance,
      },
      { status: 402 },
    );
  }

  const remainingBalance = await updateUserBalanceIfNeeded(
    user.id,
    -monetization.total_deducted,
    currentBalance,
  );
  monetization.remaining_balance = remainingBalance;

  return NextResponse.json({
    output,
    featureId,
    userEmail: email,
    monetization,
    source,
    usedKran,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featureId = String(searchParams.get("featureId") || "").trim();
    const userInput = String(searchParams.get("userInput") || "").trim();
    const userEmail = String(searchParams.get("userEmail") || "").trim();

    if (!featureId || !userInput) {
      return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    const email = userEmail || user.email || "anon@ai-nusantara.local";
    const systemPrompt = buildSystemPrompt(featureId, userInput, email);

    // 🔴 BACA SALDO REAL dari DB (bukan cache) — agar cek & deduksi konsisten.
    const userRecord = await supabase
      .from("users")
      .select("character_balance")
      .eq("id", user.id)
      .single();
    const userData = userRecord.data as { character_balance?: number } | null;
    const currentBalance = Number(userData?.character_balance ?? 0) || 0;

    // Emergency gate: jika input saja sudah melebihi saldo → tolak sebelum AI.
    if (userInput.length > currentBalance) {
      return NextResponse.json(
        {
          error: "Saldo karakter Anda tidak mencukupi untuk memproses permintaan ini.",
          current_balance: currentBalance,
          required_input_characters: userInput.length,
        },
        { status: 402 },
      );
    }

    const apiKeyData = await findBestApiKey();

    let output = "";
    if (apiKeyData) {
      try {
        output = await callAIApiWithFailover(
          systemPrompt,
          apiKeyData.provider,
          apiKeyData.key,
          apiKeyData.isPaid || false
        );
      } catch {
        output = "";
      }
    }

    if (!output) {
      output = `Fitur (${featureId}) diproses dalam mode fallback.\n\n${systemPrompt}`;
    }

    // 🔴 Deduksi saldo REAL setelah AI selesai: input + output.
    const inputCharacters = userInput.length;
    const outputCharacters = (output || "").length;
    const totalDeducted = inputCharacters + outputCharacters;

    if (totalDeducted > currentBalance) {
      return NextResponse.json(
        {
          error: "Saldo karakter Anda tidak mencukupi untuk memproses permintaan ini.",
          current_balance: currentBalance,
          required_characters: totalDeducted,
        },
        { status: 402 },
      );
    }

    const remainingBalance = await updateUserBalanceIfNeeded(
      user.id,
      -totalDeducted,
      currentBalance,
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // Saldo sudah didebit di DB di atas (remainingBalance). Stream tetap
        // teks murni agar tidak tampil aneh di UI chat mobile/tablet/PC.
        const words = (output || "").split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? " " : "");
          controller.enqueue(encoder.encode(chunk));
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        // 🔴 Header saldo real pasca-generasi — dibaca frontend untuk refresh.
        "X-Ai-Balance": String(remainingBalance),
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal memproses streaming." }, { status: 500 });
  }
}

// ==================== API UNTUK FITUR FOUNDER: KELOLA KRAN 1 ====================
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any;
    
    const userCheck = await adminAny
      .from("users")
      .select("role,email")
      .eq("id", user.id)
      .single();

    const userRole = userCheck.data?.role || "user";
    if (userRole !== "founder" && userRole !== "admin") {
      return NextResponse.json({ error: "Hanya Founder yang bisa mengelola kran." }, { status: 403 });
    }

    const body = await request.json();
    const { action, keys } = body;

    if (action === "add_keys" && Array.isArray(keys)) {
            const validKeys = keys.filter((k: string) => {
        const trimmed = (k ?? "").trim();
        return trimmed.length > 0 && /^(AIza|AQ\.)/.test(trimmed);
      });
      
      const existingRaw = await getFounderConfig("gemini_api_keys_free");
      let existing: string[] = [];
      try {
        existing = JSON.parse(existingRaw) as string[];
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }

      const merged = Array.from(new Set([...existing, ...validKeys.map((k: string) => k.trim())]));
      
      await adminAny.from("founder_config").upsert(
        { key_name: "gemini_api_keys_free", key_value: JSON.stringify(merged) },
        { onConflict: "key_name" }
      );

            // Reset cache (Vault + legacy free keys)
      kran1Keys = await loadKran1Keys();
      kran1RotationIndex = 0;

      return NextResponse.json({ 
        success: true, 
        message: `${validKeys.length} kunci gratuitan berhasil ditambahkan. Total: ${merged.length} kunci.`,
        totalKeys: merged.length 
      });
    }

    if (action === "clear_all") {
      await adminAny.from("founder_config").upsert(
        { key_name: "gemini_api_keys_free", key_value: JSON.stringify([]) },
        { onConflict: "key_name" }
      );
      kran1Keys = [];
      kran1RotationIndex = 0;

      return NextResponse.json({ success: true, message: "Semua kunci Kran 1 telah dibersihkan." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Gagal memproses permintaan Founder." }, { status: 500 });
  }
}

async function getFounderKeys(_request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any;
    
    const userCheck = await adminAny
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = userCheck.data?.role || "user";
    if (userRole !== "founder" && userRole !== "admin") {
      return NextResponse.json({ error: "Hanya Founder yang bisa melihat kunci." }, { status: 403 });
    }

    const rawKeys = await getFounderConfig("gemini_api_keys_free");
    let keys: string[] = [];
    try {
      const parsed = JSON.parse(rawKeys) as string[];
      keys = Array.isArray(parsed) ? parsed : [];
    } catch {
      keys = [];
    }

    const hasKran2 = !!(process.env.NEXT_PUBLIC_GEMINI_PAID_KEY || await getFounderConfig("gemini_api_key_paid"));

    return NextResponse.json({
      kran1_keys: keys,
      kran1_count: keys.length,
      kran2_available: hasKran2,
      rotation_index: kran1RotationIndex % Math.max(1, keys.length),
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data kunci." }, { status: 500 });
  }
}
