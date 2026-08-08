import { NextResponse } from "next/server";

const features = [
  {
    title: "📝 Generator RPP & Modul Ajar",
    description: "Buat draf RPP Kurikulum Merdeka instan lengkap CP, TP, ATP, P3, dan Asesmen.",
    category: "guru",
  },
  {
    title: "🎯 Pembuat Soal Ujian AKM/HOTS",
    description: "Susun soal pilihan ganda/esai berbasis studi kasus nyata lengkap kunci jawaban.",
    category: "guru",
  },
  {
    title: "📊 Pembuat Narasi e-Rapor Otomatis",
    description: "Ubah angka nilai dan catatan perilaku menjadi paragraf deskripsi formal rapor.",
    category: "guru",
  },
  {
    title: "📚 Generator Lembar Kerja Siswa (LKPD)",
    description: "Buat lembar tugas interaktif dan sistematis berdasarkan tema pelajaran.",
    category: "guru",
  },
  {
    title: "🔍 Perangkum Jurnal & PDF Ilmiah",
    description: "Rangkum latar belakang, metode, dan hasil file PDF jurnal menjadi struktur tajam.",
    category: "guru",
  },
  {
    title: "✍️ Parafrase Akademis Anti-Plagiarisme",
    description: "Sempurnakan kalimat berantakan jadi format ilmiah standar EYD V agar lolos Turnitin.",
    category: "guru",
  },
  {
    title: "🎬 Pembuat Skrip Video Jualan Viral",
    description: "Naskah video pendek 30-60 detik lengkap Hook 3 detik. Gaya: Gaul TikTok / Anak Jaksel.",
    category: "umkm",
  },
  {
    title: "🚀 Generator Deskripsi Produk SEO",
    description: "Teks jualan ramah algoritma SEO Shopee, Tokopedia, TikTok Shop bertabur emoji persuasif.",
    category: "umkm",
  },
  {
    title: "🤝 Asisten CS Pembalas Chat Komplain",
    description: "Deteksi emosi pembeli marah, balas otomatis super ramah gaya CS Shopee Mall/Tokopedia Care.",
    category: "umkm",
  },
  {
    title: "💡 Generator Ide Bisnis Modal Kecil",
    description: "Rekomendasi bisnis franchise/kuliner modal rupiah terkecil lengkap analisis SWOT kilat.",
    category: "umkm",
  },
  {
    title: "📣 Pembuat Teks Penulisan Iklan Konten Konten",
    description: "Susun kalimat promosi pendek konversi tinggi untuk FB, Google, dan TikTok Ads.",
    category: "umkm",
  },
];

export async function GET() {
  return NextResponse.json({ features });
}
