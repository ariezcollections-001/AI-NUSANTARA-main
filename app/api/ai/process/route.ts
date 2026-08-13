import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVaultKeys } from "@/lib/aiVault";

const requestHistory: Record<string, number[]> = {};

const featureInstructions: Record<string, string> = {
  "gen-rpp":
    "Bertindaklah sebagai Konsultan Kurikulum Merdeka Kemendikbud Ristek. Buat dokumen RPP/Modul Ajar yang super lengkap, sistematis, mencakup Tujuan Pembelajaran, Langkah Kegiatan Alur MERDEKA, dan Rubrik Asesmen.",
  "buat-soal":
    "Buat soal ujian pilihan ganda dan esai yang berkualitas tinggi, HOTS (Higher Order Thinking Skills), lengkap dengan kunci jawaban dan pembahasan.",
  "koreksi-tugas":
    "Analisis tugas siswa dan berikan umpan balik yang konstruktif, nilai objektif, serta saran perbaikan.",
  "bahan-ajar":
    "Buat materi bahan ajar teks yang menarik, edukatif, dan mudah dipahami siswa.",
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
  const instruction = featureInstructions[featureId] || "Buat respons profesional berdasarkan instruksi pengguna.";
  return `${instruction}\n\nEmail User: ${userEmail || "anon@ai-nusantara.local"}\n\nPetunjuk tambahan: Jawab dalam bahasa Indonesia, ringkas tetapi komprehensif, hindari halusinasi, dan berikan langkah praktis jika diperlukan. Jangan membuat informasi fiktif.\n\nInput pengguna:\n${userInput}`;
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
            temperature: 0,
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
        temperature: 0,
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
