import { createAdminClient } from "@/lib/supabase/admin";

export interface VaultKeys {
  gemini: string[];
  openrouter: string[];
  /** Kunci berbayar TIDAK tercampur ke pool gratis — disimpan terpisah. */
  paidGemini: string[];
  paidOpenrouter: string[];
}

const EMPTY: VaultKeys = { gemini: [], openrouter: [], paidGemini: [], paidOpenrouter: [] };

function toArr(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((k) => String(k).trim()).filter((k) => k.length > 0);
}

/**
 * 🔴 Sumber kebenaran tunggal API key AI (KOLAM TOKEN GLOBAL + Kunci Rahasia).
 *
 * Mengumpulkan SEMUA lokasi penyimpanan kunci AI di tabel `founder_config`
 * sehingga apa pun yang Founder simpan di dashboard (Vault multi-key maupun
 * kolom "Kunci Rahasia" single-key) otomatis dipakai untuk output user:
 *   - `vault_keys`             : JSON `{ gemini: [], openrouter: [] }`
 *   - `gemini_api_keys_free`   : JSON array kunci Gemini (rotator gratisan)
 *   - `gemini_api_key`         : single kunci Gemini
 *   - `gemini_api_key_paid`    : single kunci Gemini berbayar (Kran 2)
 *   - `openrouter_api_key`     : single kunci OpenRouter
 *
 * Memakai service_role (admin) → bebas RLS, aman di API/Edge, identik antara
 * localhost dan Vercel.
 */
/**
 * 🔁 ROTATOR TOKEN — kolam gratis + cadangan berbayar (transparan, tanpa
 * gangguan ke user).
 *
 * Prinsip:
 *   1. Pool GRATIS = semua key Gemini free + semua key OpenRouter free.
 *   2. Digilir round-robin; key yang kena 401/429 masuk cooldown 60 detik.
 *   3. PAID (berbayar) TIDAK pernah masuk pool gratis — hanya dijadikan
 *      cadangan bila SELURUH key gratis exhausted. Begitu free pulih, otomatis
 *      balik ke free agar tidak memicu tagihan.
 */

export type KeyProvider = "gemini" | "openrouter";

export interface RotatingKey {
  provider: KeyProvider;
  key: string;
}

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const blocked = new Map<string, number>();

export function blockKey(provider: KeyProvider, key: string, untilMs = RATE_LIMIT_COOLDOWN_MS) {
  blocked.set(`${provider}::${key}`, Date.now() + untilMs);
}

export function unblockKey(provider: KeyProvider, key: string) {
  blocked.delete(`${provider}::${key}`);
}

function isBlocked(provider: KeyProvider, key: string): boolean {
  const until = blocked.get(`${provider}::${key}`);
  if (!until) return false;
  if (Date.now() >= until) {
    blocked.delete(`${provider}::${key}`);
    return false;
  }
  return true;
}

/**
 * 🔴 VALIDASI FORMAT kunci Gemini — memastikan hanya kunci valid (`AIza…`)
 * yang dipakai. Menolak placeholder/stub `AQ.` (dev) & `AQ_FALLBACK_` agar
 * server tak pernah mengirim key yang ditolak Google ke provider.
 *
 * Perbaikan akarnya: environment produksi (Vercel) tidak memiliki env var
 * key, sehingga guard route legacy mengembalikan 503 berulang. Dengan
 * validator ini, kunci produksi asli yang tersimpan di vault founder_config
 * (kolom `gemini_api_key` / `gemini_api_keys_free`) menjadi sumber utama,
 * dan env hanya dipakai bila benar-benar valid.
 */
export function isValidGeminiKey(k: unknown): boolean {
  if (typeof k !== "string") return false;
  const t = k.trim();
  if (!t) return false;
  // Kunci Gemini produksi Google selalu diawali "AIza" (panjang 39).
  if (/^AQ(_FALLBACK_)?\./i.test(t)) return false;   // tolak stub dev
  return /^AIza[A-Za-z0-9_-]{20,}$/i.test(t);
}

/**
 * Sumber kunci Gemini tunggal — vault-first, fallback env hanya bila valid.
 * Dipakai route legacy (`/api/generate`, `/api/v1`, `/api/v2`) agar 503
 * "Kunci API Gemini belum dikonfigurasi" tidak lagi salah tembak saat key
 * produksi memang ada di vault (tapi env prod belum di-set).
 */
export async function resolveGeminiKey(getter: () => Promise<VaultKeys> = getVaultKeys): Promise<string> {
  try {
    const vault = await getter();
    const fromVault = vault.gemini.find(isValidGeminiKey);
    if (fromVault) return fromVault.trim();
  } catch {
    /* jika vault tidak bisa dibaca, lanjut ke fallback env */
  }
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    "";
  return isValidGeminiKey(envKey) ? envKey.trim() : "";
}


/* Key berbayar hanya dari tempat eksplisit — TIDAK dari pool gratis. */
function getPaidGeminiKeys(vault: VaultKeys): string[] {
  const paidEnv = (process.env.GEMINI_API_KEY_PAID || "").trim();
  const fromVault = vault.paidGemini || [];
  return Array.from(new Set([...(paidEnv ? [paidEnv] : []), ...fromVault])).filter((k) => k.length > 0);
}

function getPaidOpenRouterKeys(vault: VaultKeys): string[] {
  const paidEnv = (process.env.OPENROUTER_API_KEY_PAID || "").trim();
  const fromVault = vault.paidOpenrouter || [];
  return Array.from(new Set([...(paidEnv ? [paidEnv] : []), ...fromVault])).filter((k) => k.length > 0);
}

/**
 * Ambil kolam key GRATIS (Gemini + OpenRouter) yang belum diblokir, urut
 * round-robin. Paid tidak pernah tercampur di sini.
 */
export async function getFreeKeyPool(getter: () => Promise<VaultKeys> = getVaultKeys): Promise<RotatingKey[]> {
  const vault = await getter();
  const paidG = getPaidGeminiKeys(vault);
  const paidO = getPaidOpenRouterKeys(vault);

  const pool: RotatingKey[] = [
    ...vault.gemini
      .filter((k) => k && !paidG.includes(k))
      .map((key) => ({ provider: "gemini" as KeyProvider, key })),
    ...vault.openrouter
      .filter((k) => k && !paidO.includes(k))
      .map((key) => ({ provider: "openrouter" as KeyProvider, key })),
  ];

  return pool.filter((e) => e.key && !isBlocked(e.provider, e.key));
}

/**
 * Kolam key BERBAYAR (cadangan). Kalau kosong, jatuh ke pool gratis terakhir
 * agar sistem tidak mati total saat free habis.
 */
export async function getPaidKeyPool(getter: () => Promise<VaultKeys> = getVaultKeys): Promise<RotatingKey[]> {
  const vault = await getter();
  const paid: RotatingKey[] = [
    ...getPaidGeminiKeys(vault).map((key) => ({ provider: "gemini" as KeyProvider, key })),
    ...getPaidOpenRouterKeys(vault).map((key) => ({ provider: "openrouter" as KeyProvider, key })),
  ].filter((e) => e.key);
  if (paid.length > 0) return paid;
  // Fallback murni: tidak ada key paid dikonfigurasi → balik ke free terakhir
  // sebagai jaring pengaman (tanpa menandai paid).
  return (await getFreeKeyPool(getter)).slice(-1);
}

export async function getVaultKeys(): Promise<VaultKeys> {
  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_name,key_value")
      .in("key_name", [
        "vault_keys",
        "gemini_api_keys_free",
        "gemini_api_key",
        "gemini_api_key_paid",
        "openrouter_api_key",
      ]);

    if (response.error || !Array.isArray(response.data)) return EMPTY;

    const map: Record<string, string> = {};
    (response.data as Array<{ key_name: string; key_value: string | null }>).forEach((row) => {
      if (row?.key_name && typeof row.key_value === "string") map[row.key_name] = row.key_value;
    });

    // 1) Vault multi-key JSON
    let vaultGemini: string[] = [];
    let vaultOpenrouter: string[] = [];
    try {
      const parsed = map.vault_keys ? JSON.parse(map.vault_keys) : null;
      if (parsed && typeof parsed === "object") {
        vaultGemini = toArr(parsed.gemini);
        vaultOpenrouter = toArr(parsed.openrouter);
      }
    } catch { /* ignore malformed */ }

    // 2) Rotator gratisan (JSON array)
    let freeKeys: string[] = [];
    try {
      freeKeys = map.gemini_api_keys_free ? JSON.parse(map.gemini_api_keys_free) : [];
      if (!Array.isArray(freeKeys)) freeKeys = [];
    } catch { freeKeys = []; }

    // 3-4) Single-key Gemini
    const singleGemini = map.gemini_api_key?.trim() || "";
    const paidGemini = map.gemini_api_key_paid?.trim() || "";

    // 5) OpenRouter single-key
    const singleOpenRouter = map.openrouter_api_key?.trim() || "";

        const gemini = Array.from(
      new Set(
        [
          ...vaultGemini,
          ...freeKeys.map((k) => String(k).trim()),
          singleGemini,
        ]
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      ),
    );

    const openrouter = Array.from(
      new Set(
        [...vaultOpenrouter, singleOpenRouter]
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      ),
    );

    // 🔴 Kunci berbayar DISIMPAN TERPISAH — tidak pernah tercampur ke pool
    // gratis di atas. Kran 1 (gratis) tidak akan pernah memakainya.
    const paidArray = Array.from(
      new Set([paidGemini].map((k) => (k || "").trim()).filter((k) => k.length > 0)),
    );

    return {
      gemini: gemini.length
        ? gemini
        : // Fallback akhir: env global (covers Edge runtime tanpa secret service_role)
          [process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? ""]
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
      openrouter,
      paidGemini: paidArray,
      paidOpenrouter: [],
    };
  } catch {
    return EMPTY;
  }
}

