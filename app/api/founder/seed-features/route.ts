import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

type SeedFeature = {
  feature_slug: string;
  feature_name: string;
  system_prompt: string;
  temperature: number;
  is_active: boolean;
  seo_title: string;
  seo_description: string;
};

const seedFeatures: SeedFeature[] = [
  { feature_slug: "gen-rpp", feature_name: "Gen RPP", system_prompt: "Bertindaklah sebagai Konsultan Kurikulum Merdeka Kemendikbud Ristek. Buat dokumen RPP/Modul Ajar yang super lengkap, sistematis, mencakup Tujuan Pembelajaran, Langkah Kegiatan Alur MERDEKA, dan Rubrik Asesmen.", temperature: 0.0, is_active: true, seo_title: "Gen RPP", seo_description: "Generator RPP" },
  { feature_slug: "buat-soal", feature_name: "Buat Soal", system_prompt: "Buat soal ujian pilihan ganda dan esai yang berkualitas tinggi, HOTS (Higher Order Thinking Skills), lengkap dengan kunci jawaban dan pembahasan.", temperature: 0.0, is_active: true, seo_title: "Buat Soal", seo_description: "Generator Soal" },
  { feature_slug: "koreksi-tugas", feature_name: "Koreksi Tugas", system_prompt: "Analisis tugas siswa dan berikan umpan balik yang konstruktif, nilai objektif, serta saran perbaikan.", temperature: 0.0, is_active: true, seo_title: "Koreksi Tugas", seo_description: "Koreksi & Feedback" },
  { feature_slug: "bahan-ajar", feature_name: "Bahan Ajar", system_prompt: "Buat materi bahan ajar infografis/teks yang menarik, edukatif, dan mudah dipahami siswa.", temperature: 0.0, is_active: true, seo_title: "Bahan Ajar", seo_description: "Materi Ajar" },
  { feature_slug: "tiktok-viral", feature_name: "TikTok Viral", system_prompt: "Bertindaklah sebagai Scriptwriter TikTok & Reels handal Indonesia. Buat skrip video durasi 30-60 detik yang memiliki Hook mematikan di 3 detik pertama, Storytelling persuasif, dan Call to Action (CTA) jualan yang melipatgandakan konversi.", temperature: 0.0, is_active: true, seo_title: "TikTok Viral", seo_description: "Skrip Video" },
  { feature_slug: "caption-ig", feature_name: "Caption IG", system_prompt: "Buat caption Instagram jualan yang estetik, persuasif, menggunakan teknik copywriting AIDA, dan dilengkapi hashtag relevan.", temperature: 0.0, is_active: true, seo_title: "Caption IG", seo_description: "Caption" },
  { feature_slug: "ide-bisnis", feature_name: "Ide Bisnis", system_prompt: "Analisis tren pasar lokal Indonesia dan berikan ide bisnis UMKM modal kecil untung besar lengkap dengan analisis SWOT singkat.", temperature: 0.0, is_active: true, seo_title: "Ide Bisnis", seo_description: "Ide UMKM" },
  { feature_slug: "bahasa-formal", feature_name: "Bahasa Formal", system_prompt: "Ubah gaya bahasa teks draf kasar bisnis menjadi bahasa formal korporat/surat resmi yang profesional.", temperature: 0.0, is_active: true, seo_title: "Bahasa Formal", seo_description: "Rewriting" },
  { feature_slug: "bedah-jurnal", feature_name: "Bedah Jurnal", system_prompt: "Bertindaklah sebagai Profesor Akademis. Bedah dan rangkum jurnal ilmiah ini menjadi ringkasan metodologi, temuan kunci, dan celah penelitian (research gap).", temperature: 0.0, is_active: true, seo_title: "Bedah Jurnal", seo_description: "Jurnal" },
  { feature_slug: "rangkum-buku", feature_name: "Rangkum Buku", system_prompt: "Buat rangkuman bab buku secara padat, komprehensif, dan mudah dipahami untuk bahan belajar.", temperature: 0.0, is_active: true, seo_title: "Rangkum Buku", seo_description: "Rangkuman" },
  { feature_slug: "kerangka-skripsi", feature_name: "Kerangka Skripsi", system_prompt: "Buat struktur outline kerangka skripsi bab 1 sampai bab 5 lengkap dengan saran judul berdasarkan topik yang diinput.", temperature: 0.0, is_active: true, seo_title: "Kerangka Skripsi", seo_description: "Skripsi" },
];

export async function POST(_request: Request) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  try {
    const db = (process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : verify.supabase) as ReturnType<typeof createAdminClient>;
    const upsertPayload = seedFeatures.map((f, idx) => ({ id: idx + 1, ...f }));

    const dbClient = db as unknown as {
      from(table: string): {
        upsert(payload: SeedFeature[] | SeedFeature, options?: { onConflict?: string[] }): Promise<{ error: { message?: string } | null }>;
      };
    };

    const response = await dbClient.from("ai_settings").upsert(upsertPayload, { onConflict: ["feature_slug"] });

    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({ success: true, source: "supabase", count: upsertPayload.length });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Gagal melakukan seed feature";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
