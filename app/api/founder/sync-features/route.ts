import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";

/**
 * Prompt LAMA dari seed awal (11 fitur) — dipakai untuk MIGRASI otomatis:
 * baris ai_settings yang MASIH memakai teks lama ini (artinya belum pernah
 * diedit Founder) langsung di-upgrade ke persona katalog + suhu baru.
 * Baris yang teksnya sudah BEDA (sudah diedit Founder) TIDAK disentuh.
 */
const OLD_SEED_PROMPTS: Record<string, string> = {
  "gen-rpp":
    "Bertindaklah sebagai Konsultan Kurikulum Merdeka Kemendikbud Ristek. Buat dokumen RPP/Modul Ajar yang super lengkap, sistematis, mencakup Tujuan Pembelajaran, Langkah Kegiatan Alur MERDEKA, dan Rubrik Asesmen.",
  "buat-soal":
    "Buat soal ujian pilihan ganda dan esai yang berkualitas tinggi, HOTS (Higher Order Thinking Skills), lengkap dengan kunci jawaban dan pembahasan.",
  "koreksi-tugas": "Analisis tugas siswa dan berikan umpan balik yang konstruktif, nilai objektif, serta saran perbaikan.",
  "bahan-ajar": "Buat materi bahan ajar infografis/teks yang menarik, edukatif, dan mudah dipahami siswa.",
  "tiktok-viral":
    "Bertindaklah sebagai Scriptwriter TikTok & Reels handal Indonesia. Buat skrip video durasi 30-60 detik yang memiliki Hook mematikan di 3 detik pertama, Storytelling persuasif, dan Call to Action (CTA) jualan yang melipatgandakan konversi.",
  "caption-ig":
    "Buat caption Instagram jualan yang estetik, persuasif, menggunakan teknik copywriting AIDA, dan dilengkapi hashtag relevan.",
  "ide-bisnis":
    "Analisis tren pasar lokal Indonesia dan berikan ide bisnis UMKM modal kecil untung besar lengkap dengan analisis SWOT singkat.",
  "bahasa-formal":
    "Ubah gaya bahasa teks draf kasar bisnis menjadi bahasa formal korporat/surat resmi yang profesional.",
  "bedah-jurnal":
    "Bertindaklah sebagai Profesor Akademis. Bedah dan rangkum jurnal ilmiah ini menjadi ringkasan metodologi, temuan kunci, dan celah penelitian (research gap).",
  "rangkum-buku": "Buat rangkuman bab buku secara padat, komprehensif, dan mudah dipahami untuk bahan belajar.",
  "kerangka-skripsi":
    "Buat struktur outline kerangka skripsi bab 1 sampai bab 5 lengkap dengan saran judul berdasarkan topik yang diinput.",
};

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

    const existingRes = await (db as any).from("ai_settings").select("feature_slug,system_prompt,temperature");
    if (existingRes.error) throw existingRes.error;

    const rows = (existingRes.data ?? []) as Array<{
      feature_slug?: unknown;
      system_prompt?: unknown;
      temperature?: unknown;
    }>;
    const existing = new Set(rows.map((r) => String(r?.feature_slug ?? "")));

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

    // 🧭 MIGRASI BERAWAL: baris lama yang MASIH memakai prompt seed (belum diedit
    // Founder) di-upgrade ke persona + suhu katalog. Baris yang teksnya beda
    // (sudah dikustomisasi Founder) dibiarkan apa adanya.
    const upgrades = FEATURE_CATALOG.filter((f) => {
      const row = rows.find((r) => String(r?.feature_slug ?? "") === f.feature_slug);
      if (!row || typeof row.system_prompt !== "string") return false;
      const oldTpl = OLD_SEED_PROMPTS[f.feature_slug];
      return typeof oldTpl === "string" && row.system_prompt.trim() === oldTpl;
    }).map((f) => ({
      feature_slug: f.feature_slug,
      feature_name: f.feature_name,
      system_prompt: f.system_prompt,
      temperature: f.temperature,
      is_active: true,
      seo_title: f.seo_title,
      seo_description: f.seo_description,
    }));

    let upgraded = 0;
    if (upgrades.length > 0) {
      const upRes = await (db as any).from("ai_settings").upsert(upgrades, { onConflict: "feature_slug" });
      if (upRes.error) throw upRes.error;
      upgraded = upgrades.length;
    }

    return NextResponse.json({
      success: true,
      added,
      upgraded,
      total: FEATURE_CATALOG.length,
      missing: missing.map((f) => f.feature_slug),
      upgradedSlugs: upgrades.map((u) => u.feature_slug),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal sinkron fitur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}