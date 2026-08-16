import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";

/**
 * 🔄 SINKRON FITUR OTOMATIS — memastikan tabel `ai_settings` selalu punya
 * "kolom" (baris) untuk SETIAP fitur yang tampil di sisi user.
 *
 * Bila ada fitur baru ditambahkan di katalog (atau di menu pengguna), Founder
 * tidak perlu repot: panggil endpoint ini (otomatis saat halaman Founder
 * dibuka, plus tombol manual) → baris baru dengan prompt & suhu default
 * langsung dibuat di `ai_settings`.
 */
export async function POST() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  try {
    const db = (process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : verify.supabase) as ReturnType<typeof createAdminClient>;

    const existingRes = await (db as any).from("ai_settings").select("feature_slug");
    if (existingRes.error) throw existingRes.error;

    const existing = new Set(
      (existingRes.data ?? []).map((r: { feature_slug?: unknown }) => String(r?.feature_slug ?? "")),
    );

    const missing = FEATURE_CATALOG.filter((f) => !existing.has(f.feature_slug));

    let added = 0;
    if (missing.length > 0) {
      const insertRes = await (db as any).from("ai_settings").insert(
        missing.map((f) => ({
          feature_slug: f.feature_slug,
          feature_name: f.feature_name,
          system_prompt: f.system_prompt,
          temperature: f.temperature,
          is_active: true,
          seo_title: f.seo_title,
          seo_description: f.seo_description,
        })),
      );
      if (insertRes.error) throw insertRes.error;
      added = missing.length;
    }

    return NextResponse.json({
      success: true,
      added,
      total: FEATURE_CATALOG.length,
      missing: missing.map((f) => f.feature_slug),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal sinkron fitur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}