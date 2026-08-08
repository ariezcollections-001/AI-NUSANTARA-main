import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import modelConfig from "@/chatLanguageModels.json";

const DEFAULT_MODEL_CONFIG = [modelConfig];

async function getMaintenanceMode() {
  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_value")
      .eq("key_name", "global_maintenance_mode")
      .single<{ key_value: string }>();

    return response.data?.key_value === "true";
  } catch {
    return false;
  }
}

async function getBannedUsers() {
  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_value")
      .eq("key_name", "banned_users")
      .single<{ key_value: string }>();

    const value = response.data?.key_value ?? "[]";
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [] as string[];
  }
}

async function calculateDeduction(prompt: string, output: string) {
  const inputCharacters = prompt.length;
  const outputCharacters = output.length;
  const total = inputCharacters + outputCharacters;
  return {
    input_characters: inputCharacters,
    output_characters: outputCharacters,
    total_deducted: total,
  };
}

async function chooseProvider() {
  if (!Array.isArray(DEFAULT_MODEL_CONFIG) || DEFAULT_MODEL_CONFIG.length === 0) {
    return null;
  }
  const supportedProviders = DEFAULT_MODEL_CONFIG.filter(
    (p) => p.vendor === "gemini" || p.vendor === "openrouter"
  );
  if (supportedProviders.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * supportedProviders.length);
  return supportedProviders[index];
}

async function callProvider(provider: { apiKey: string; models: { id: string; url: string }[] }, prompt: string, promptSummary: string) {
  // Resolve API key: if placeholder is detected, read from env var instead
  let providerKey = provider.apiKey;
  if (providerKey && providerKey.startsWith('__') && providerKey.endsWith('__')) {
    const envVarName = providerKey.replace(/^__/, '').replace(/__$/, '');
    providerKey = process.env[envVarName] || '';
  }

  const model = provider.models?.[0]?.id;
  const url = provider.models?.[0]?.url?.replace(/\/+$/, "") || "";
  const endpoint = url ? (url.includes("/v1/chat/completions") ? url : `${url}/v1/chat/completions`) : null;

  if (!providerKey || !model || !endpoint) {
    return null;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Anda adalah AI-NUSANTARA, validasi informasi di Indonesia, jangan mengarang data, output harus jujur jika informasi tidak lengkap.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      throw new Error(`External model failed with ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? `AI-NUSANTARA siap memproses prompt: ${promptSummary}`;
  } catch {
    return null;
  }
}

async function generateSafeOutput(prompt: string) {
  const promptSummary = prompt.slice(0, 320);
  const selectedProvider = await chooseProvider();

  if (selectedProvider) {
    const result = await callProvider(selectedProvider, prompt, promptSummary);
    if (result) {
      return result;
    }
  }

  const modelConfigProvider = modelConfig;
  if (modelConfigProvider && typeof modelConfigProvider === "object") {
    const result = await callProvider(modelConfigProvider, prompt, promptSummary);
    if (result) {
      return result;
    }
  }

  return `AI-NUSANTARA (tidak dapat memproses melalui provider eksternal). Gunakan kembali dengan kondisi jaringan lebih baik atau konfigurasi API yang valid.`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt AI wajib diisi." }, { status: 400 });
  }

  const maintenanceMode = await getMaintenanceMode();
  if (maintenanceMode) {
    return NextResponse.json(
      { error: "Global maintenance mode aktif. Coba lagi nanti." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Autentikasi diperlukan untuk mengakses AI." }, { status: 401 });
  }

  const userId = authData.user.id;
  const bannedUsers = await getBannedUsers();
  if (bannedUsers.includes(userId)) {
    return NextResponse.json(
      {
        error: "Akun Anda telah diblokir oleh Founder. Hubungi admin jika ini keliru.",
      },
      { status: 403 },
    );
  }

  const userResponse = await supabase
    .from("users")
    .select("character_balance")
    .eq("id", userId)
    .single<{ character_balance: number }>();

  if (userResponse.error || !userResponse.data) {
    return NextResponse.json({ error: "Profil pengguna tidak ditemukan." }, { status: 401 });
  }

  const currentBalance = userResponse.data.character_balance;
  const simulatedOutput = await generateSafeOutput(prompt);
  const monetization = await calculateDeduction(prompt, simulatedOutput);

  if (monetization.total_deducted > currentBalance) {
    return NextResponse.json(
      {
        error: "Saldo karakter tidak cukup. Silakan top-up atau kurangi panjang prompt.",
        current_balance: currentBalance,
      },
      { status: 402 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateResponse = (await (supabase.from("users") as any)
    .update({ character_balance: currentBalance - monetization.total_deducted })
    .eq("id", userId)
    .select("character_balance")
    .single()) as { error: unknown; data: { character_balance: number } | null };

  if (updateResponse.error || !updateResponse.data) {
    return NextResponse.json({ error: "Gagal memperbarui saldo karakter." }, { status: 500 });
  }

  return NextResponse.json({
    output: simulatedOutput,
    monetization: {
      ...monetization,
      previous_balance: currentBalance,
      remaining_balance: updateResponse.data.character_balance,
    },
  });
}