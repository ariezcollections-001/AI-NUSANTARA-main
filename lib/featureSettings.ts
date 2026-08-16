import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FEATURE SETTINGS — Pembaca lapisan Founder dari tabel `ai_settings`.
 * -----------------------------------------------------------------
 * Sumber kebenaran runtime untuk prompt/suhu/status per fitur yang dikelola
 * FOUNDER di dashboard-nya. Bila baris tidak ada atau non-aktif, caller wajib
 * memakai fallback (katalog / kode). Cache sederhana 30 detik agar request
 * AI tidak membebani Supabase di setiap generasi.
 */

export interface FeatureLayer {
  /** LAPISAN PERSONA FITUR (dari halaman Founder). null = gunakan default. */
  prompt: string | null;
  /** Suhu per fitur dari halaman Founder. null = gunakan default. */
  temperature: number | null;
  /** Aktif/tidaknya fitur ini (is_active). */
  active: boolean;
}

type SettingsMap = Record<string, FeatureLayer>;

let cache: { at: number; data: SettingsMap } | null = null;
const TTL_MS = 30_000;

/** Ambil seluruh baris ai_settings sekali per 30 detik (cache). */
export async function getFeatureSettingsMap(): Promise<SettingsMap> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const map: SettingsMap = {};
  try {
    const admin = createAdminClient();
    const res = await admin
      .from("ai_settings")
      .select("feature_slug,system_prompt,temperature,is_active")
      .order("id", { ascending: true });
    if (!res.error && Array.isArray(res.data)) {
      for (const row of res.data as Array<{
        feature_slug: string | null;
        system_prompt: string | null;
        temperature: number | null;
        is_active: boolean | null;
      }>) {
        const slug = (row?.feature_slug ?? "").trim();
        if (!slug) continue;
        map[slug] = {
          prompt: typeof row.system_prompt === "string" && row.system_prompt.trim() ? row.system_prompt.trim() : null,
          temperature:
            typeof row.temperature === "number" && !Number.isNaN(row.temperature) ? row.temperature : null,
          active: row.is_active !== false,
        };
      }
    }
  } catch {
    /* SQLite Sentinel: bila gagal, biarkan map kosong → caller jatuh ke default */
  }
  cache = { at: now, data: map };
  return map;
}

/** Ambil satu fitur (dengan cache). null bila tidak ada baris di ai_settings. */
export async function getFeatureSettings(featureSlug: string): Promise<FeatureLayer | null> {
  const slug = (featureSlug ?? "").trim();
  if (!slug) return null;
  const map = await getFeatureSettingsMap();
  return map[slug] ?? null;
}

/** Bersihkan cache (opsional, dipakai pengujian). */
export function clearFeatureSettingsCache(): void {
  cache = null;
}