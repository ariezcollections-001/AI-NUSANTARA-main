import { createAdminClient } from "@/lib/supabase/admin";

export interface VaultKeys {
  gemini: string[];
  openrouter: string[];
}

const EMPTY: VaultKeys = { gemini: [], openrouter: [] };

/**
 * 🔴 Sumber kebenaran tunggal API key Vault ("KOLAM TOKEN GLOBAL").
 *
 * Membaca key_name `vault_keys` (JSON `{ gemini: [], openrouter: [] }`) dari tabel
 * `founder_config`. Karena memakai service_role (admin), aman dijalankan di API
 * route maupun Edge runtime tanpa terpengaruh RLS — hasilnya identik antar
 * instance (localhost maupun Vercel), sehingga:
 *   - Founder menyimpan Vault → persisten di DB, tersimpan saat refresh/logout.
 *   - User tidak pernah lagi membaca `process.env.*`/`localStorage`, hanya Vault
 *     yang otomatis tersambung ke server & Vercel.
 */
export async function getVaultKeys(): Promise<VaultKeys> {
  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_value")
      .eq("key_name", "vault_keys")
      .maybeSingle<{ key_value: string }>();

    if (response.error || !response.data || !response.data.key_value) {
      return EMPTY;
    }

    const parsed = JSON.parse(response.data.key_value) as {
      gemini?: unknown;
      openrouter?: unknown;
    };

    const gemini = Array.isArray(parsed?.gemini)
      ? parsed.gemini.map((k) => String(k).trim()).filter(Boolean)
      : [];
    const openrouter = Array.isArray(parsed?.openrouter)
      ? parsed.openrouter.map((k) => String(k).trim()).filter(Boolean)
      : [];

    return { gemini, openrouter };
  } catch {
    return EMPTY;
  }
}
