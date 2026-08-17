/**
 * SUMBER VALID — basis pengetahuan ringkas per fitur (acuan isi dokumen).
 * Murni (tanpa impor), Edge-safe, deterministik. Berisi struktur/kaidah UMUM
 * yang memang sah & dapat diverifikasi — BUKAN klaim spesifik yang bisa keliru.
 * `retrieveSumber(feature, query)` memilih cuplikan relevan via kata kunci.
 */

export interface SumberEntry {
  id: string;
  label: string;
  k: string[]; // kata kunci pemicu
  t: string; // teks acuan
}

const KB: Record<string, SumberEntry[]> = {
  "gen-rpp": [
    {
      id: "rpp-struktur",
      label: "Struktur umum Modul Ajar / RPP Kurikulum Merdeka (pedoman publik Kemendikbudristek)",
      k: ["rpp", "modul ajar", "kurikulum merdeka", "pembelajaran", "asesmen", "tujuan"],
      t: "Komponen: Informasi Umum (identitas, alokasi waktu, profil pelajar Pancasila, sarana-prasarana), tujuan pembelajaran dengan kata kerja operasional yang terukur, pemahaman bermakna dan pertanyaan pemantik, kegiatan pembelajaran (pendahuluan, inti dengan alur MERDEKA, penutup), asesmen (diagnostik, formatif, sumatif) dan rubrik, serta refleksi pendidik dan murid.",
    },
    {
      id: "rpp-prinsip",
      label: "Prinsip penyusunan RPP (umum)",
      k: ["indikator", "kompetensi", "metode", "media", "sintaks"],
      t: "Pembelajaran sistematis: tujuan terukur, materi runtut, model aktif (ceramah, diskusi, PBL, PJBL), media sesuai karakteristik siswa, dan penilaian selaras dengan tujuan.",
    },
  ],
  "buat-soal": [
    {
      id: "soal-bloom",
      label: "Taksonomi Bloom revisi (Anderson & Krathwohl) — kaidah umum soal HOTS",
      k: ["hots", "bloom", "kognitif", "soal", "penilaian", "berpikir"],
      t: "Level C1-C6: mengingat, memahami, menerapkan, menganalisis, mengevaluasi, mencipta. Soal HOTS umumnya C4-C6, berbasis stimulus, menuntut penalaran, tidak dapat dijawab hanya dengan hafalan.",
    },
    {
      id: "soal-kaidah",
      label: "Kaidah butir soal yang baik (umum)",
      k: ["pilihan ganda", "pengecoh", "kunci", "valid", "ambigu", "esai"],
      t: "Butir yang baik: sesuai indikator, bahasa jelas, pengecoh berfungsi, kunci pasti tanpa ambiguitas, tingkat kesukaran berimbang, disertai kunci jawaban, pembahasan, dan pedoman penskoran untuk uraian.",
    },
  ],
  "koreksi-tugas": [
    {
      id: "kor-umpan",
      label: "Prinsip umpan balik efektif (umum)",
      k: ["koreksi", "nilai", "umpan balik", "tugas", "kesalahan", "skor"],
      t: "Umpan balik yang baik: spesifik (menunjuk letak kesalahan), segera, membangun, seimbang antara apresiasi dan saran perbaikan, diakhiri langkah konkret agar siswa tahu cara maju.",
    },
    {
      id: "kor-rubrik",
      label: "Penskoran objektif (umum)",
      k: ["rubrik", "skor", "poin", "kriteria"],
      t: "Gunakan kriteria penskoran jelas: tiap aspek diberi bobot, nilai akhir 1-100 konsisten, penjelasan tiap butir dirinci agar transparan.",
    },
  ],
  "bahan-ajar": [
    {
      id: "bahan-desain",
      label: "Prinsip desain bahan ajar (umum)",
      k: ["bahan ajar", "modul", "materi", "tujuan", "latihan"],
      t: "Bahan ajar yang baik: dibuka dengan tujuan pembelajaran, materi bertahap dari mudah ke sulit dengan contoh, bahasa sederhana sesuai jenjang, diakhiri latihan/evaluasi dan rangkuman.",
    },
  ],
"bedah-jurnal": [
    {
      id: "jurnal-imrad",
      label: "Struktur artikel ilmiah (IMRaD) & teknik bedah kritis (umum)",
      k: ["jurnal", "abstrak", "metode", "hasil", "pembahasan", "riset", "artikel"],
      t: "Bedah sistematis: identitas dan ringkasan, latar belakang/rumusan, metode (desain, sampel, instrumen, analisis), hasil dan pembahasan, keterbatasan, kesimpulan, serta research gap — hanya berdasarkan teks yang diberikan, tanpa mengarang data.",
    },
  ],
  "rangkum-buku": [
    {
      id: "rangkum-teknik",
      label: "Teknik merangkum (umum)",
      k: ["rangkum", "ringkas", "buku", "bab", "ide pokok"],
      t: "Rangkuman yang baik: identitas buku, ide pokok tiap bab/sub-bab, konsep kunci dan istilah penting, kutipan penting yang aman, lalu 3-5 kesimpulan — setia pada isi tanpa mengada-ada.",
    },
  ],
  "kerangka-skripsi": [
    {
      id: "skripsi-struktur",
      label: "Struktur umum skripsi bab 1-5 (konvensi akademik)",
      k: ["skripsi", "latar belakang", "rumusan", "metode", "kerangka"],
      t: "Kerangka: sampul dan saran judul; BAB 1 (latar belakang, rumusan masalah, tujuan, manfaat); BAB 2 kajian teori; BAB 3 metode (desain, populasi/sampel, instrumen, analisis); BAB 4 hasil dan pembahasan; BAB 5 penutup; referensi dan tahapan waktu kerja.",
    },
  ],
  "tiktok-viral": [
    {
      id: "tt-hook",
      label: "Pola hook & retensi video pendek (umum)",
      k: ["tiktok", "reels", "hook", "video", "fyp", "skrip"],
      t: "3 detik pertama menentukan retensi: buka dengan angka aneh, pertanyaan, atau pernyataan kontroversial; jaga storytelling naik, akhiri CTA yang menggugah; sertakan panduan visual (arah kamera, teks overlay, musik) dan hook alternatif.",
    },
  ],
  "caption-ig": [
    {
      id: "ig-aida",
      label: "Struktur caption persuasif AIDA (umum)",
      k: ["caption", "instagram", "aida", "hashtag", "jualan", "copywriting"],
      t: "AIDA: Attention (pembuka memikat), Interest (detail menarik), Desire (manfaat/rasa ingin), Action (ajakan beli/klik). Penyajian patah-patah dengan emoji relevan, 8-12 hashtag tepat sasaran, dan CTA jelas.",
    },
  ],
"ide-bisnis": [
    {
      id: "bisnis-analisis",
      label: "Kerangka menilai ide usaha kecil (umum)",
      k: ["bisnis", "usaha", "modal", "pasar", "swot", "margin"],
      t: "Lengkapi: deskripsi ide, target pasar dan lokasi, estimasi modal awal, potensi margin kasar, langkah realistis minggu pertama, analisis SWOT, dan risiko — tanpa menjanjikan angka yang dibuat-buat.",
    },
  ],
  "bahasa-formal": [
    {
      id: "formal-puebi",
      label: "Kaidah bahasa baku (KBBI/PUEBI — umum)",
      k: ["formal", "baku", "kbji", "puebi", "surat", "resmi", "kalimat efektif"],
      t: "Tulisan formal: memakai kata baku, ejaan sesuai PUEBI, kalimat efektif (hemat, lugas, padu), nada sopan dan netral, serta struktur surat/email resmi (pembuka, isi, penutup). Pertahankan makna dan fakta asli.",
    },
  ],
  "audio-mp3": [
    {
      id: "audio-naskah",
      label: "Teknik menulis naskah audio yang manusiawi (umum)",
      k: ["audio", "naskah", "narasi", "voice", "podcast", "suara"],
      t: "Naskah audio yang enak didengar: kalimat pendek bercakap, satu ide per kalimat, nada hangat, penanda jeda/penekanan dalam kurung, dan emosi tersirat — siap dibacakan untuk podcast, iklan, atau pengantar produk.",
    },
  ],
  "generator-propaganda": [
    {
      id: "prop-etika",
      label: "Kerangka pesan persuasif yang etis (umum)",
      k: ["propaganda", "kampanye", "persuasi", "pesan", "poster", "etis"],
      t: "Rancang persuasi bertanggung jawab: tujuan dan target audiens, inti pesan, sudut emosi yang jujur, lalu 2-3 varian konten (poster/quotes, skrip pendek, caption) tanpa menyesatkan atau menghasut.",
    },
  ],
};

const FEATURE_LIST_HINT =
  "Gunakan pengetahuan umum yang valid dan sesuai kaidah; tandai hal yang belum pasti dengan '(sesuaikan)'.";

/** Pilih 1-2 cuplikan paling relevan untuk fitur & teks tertentu. */
export function retrieveSumber(feature: string, queryText: string, docText = ""): string {
  const entries = KB[feature];
  if (!entries || entries.length === 0) return "";
  const q = `${queryText} ${docText}`.toLowerCase();
  const scored = entries
    .map((e) => ({ e, s: e.k.reduce((n, kw) => (q.includes(kw) ? n + 1 : n), 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2);
  if (scored.length === 0) return FEATURE_LIST_HINT;
  return scored.map((x) => `• ${x.e.label}.\n  ${x.e.t}`).join("\n");
}

export const SUMBER_FEATURES = Object.keys(KB).length;