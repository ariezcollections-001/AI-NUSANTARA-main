"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Send,
  Copy,
  FileText,
  Lock,
  Unlock,
  Type,
  Loader2,
  Sparkles,
  History,
  Trash2,
  ClipboardPaste,
} from "lucide-react";

/* =====================================================================
   AIWorkbench — Editor Dua Sekat yang Ditanam ke Dalam Setiap Fitur.
   Sekat kiri : ruang diskusi user & AI (balon chat + GENERATE streaming
                ke /api/v3/generate, auto-clear & auto-scroll).
   Sekat kanan: kertas dokumen murni (contenteditable) + zoom engine +
                8 tombol kontrol hidup.
   Props menentukan fitur yang sedang dibuka, sehingga alur kerja AI
   mengikuti judul/peran fitur (backend memakai id fitur sebagai system
   prompt khas tiap fitur).
   ===================================================================== */

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  ts?: number;
}

interface ChatSession {
  date: string; // YYYY-MM-DD
  messages: ChatMessage[];
}

interface SseFrame {
  text?: string;
  type?: "done" | "error";
  error?: string;
  monetization?: {
    remaining_balance?: number;
    balance_updated?: boolean;
  };
}

interface DocTemplate {
  id: string;
  label: string;
  title: string;
  body: string;
}

interface AIWorkbenchProps {
  featureId: string;
  featureTitle: string;
  featureDesc?: string;
  examplePrompt?: string;
  maxInputChars?: number;
}

const makeId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Tanggal lokal YYYY-MM-DD
const todayStr = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

// Format tanggal menjadi "Senin, 14 Agustus 2026"
const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const FALLBACK_TEMPLATES: DocTemplate[] = [
  {
    id: "tmp-fallback",
    label: "Template",
    title: "LEMBAR KERJA",
    body:
      "LEMBAR KERJA\n\nJudul        : ______________________________\nTanggal      : __/__/2026\nLampiran     : ______________________________\n\nPendahuluan\n______________________________________________\n\nTujuan\n1. ______________________________\n2. ______________________________\n\nIsi / Rincian\n______________________________________________\n\nKesimpulan\n______________________________________________\n\nMengetahui,\n\n(_____________________________)",
  },
];

/* -------------------------------------------------------------------
   Template KHAS untuk setiap fitur — teks PENUH & siap pakai. User
   tinggal melengkapi bagian yang berisi garis bawah / kolom penting.
   ------------------------------------------------------------------- */
const FEATURE_TEMPLATES: Record<string, DocTemplate[]> = {
  "gen-rpp": [
    {
      id: "rpp1",
      label: "Template RPP",
      title: "RENCANA PELAKSANAAN PEMBELAJARAN (RPP)",
      body:
        "RENCANA PELAKSANAAN PEMBELAJARAN (RPP)\n\nSekolah        : ______________________________\nMata Pelajaran : ______________________________\nKelas/Semester : ______________________________\nMateri Pokok   : ______________________________\nAlokasi Waktu  : ______________________________ (___ JP)\n\nA. Tujuan Pembelajaran\n1. Melalui diskusi, peserta didik mampu ______________________\n2. Melalui praktik, peserta didik mampu ______________________\n\nB. Kegiatan Pembelajaran (Model: PBL)\nPendahuluan\n- Guru membuka pembelajaran, apersepsi, dan memotivasi peserta didik.\nInti\n- Orientasi masalah: peserta didik mengamati permasalahan ____________\n- Mengorganisasikan belajar: peserta dibagi dalam kelompok kecil.\n- Membimbing penyelidikan: guru mendampingi penyelidikan data ____________\n- Mengembangkan dan menyajikan hasil karya.\n- Menganalisis dan mengevaluasi proses pemecahan masalah.\nPenutup\n- Simpulan, refleksi, dan tindak lanjut pembelajaran.\n\nC. Asesmen\n- Sikap      : lembar observasi (gotong royong, bernalar kritis).\n- Pengetahuan: tes tulis uraian singkat.\n- Keterampilan: unjuk kerja / proyek dengan rubrik.\n\nD. Profil Pelajar Pancasila\nBernalar kritis, bergotong royong, dan mandiri.\n\nMengetahui,\nKepala Sekolah\n\n(_____________________________)\n\nGuru Mata Pelajaran\n\n(_____________________________)",
    },
    {
      id: "rpp2",
      label: "Template Asesmen",
      title: "ASESMEN PEMBELAJARAN",
      body:
        "ASESMEN PEMBELAJARAN\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\n\nA. Asesmen Diagnostik\n1. Pertanyaan: ______________________________\n   Jawaban kunci: ______________________________\n\nB. Asesmen Formatif\n1. Soal: ______________________________\n2. Soal: ______________________________\n\nC. Asesmen Sumatif\n1. Pilihan ganda (5 butir).\n2. Uraian singkat (3 butir).\n\nD. Rubrik Penilaian Keterampilan\nKriteria            | Skor 4 | Skor 3 | Skor 2 | Skor 1\nKetepatan jawaban: (______________________________)\nKerja sama        : (______________________________)\n\nE. Nilai Akhir = (Jumlah skor / skor maksimal) x 100\n\nGuru Mata Pelajaran\n\n(_____________________________)",
    },
  ],
  "buat-soal": [
    {
      id: "soal1",
      label: "Template Soal PG",
      title: "BANK SOAL PILIHAN GANDA",
      body:
        "BANK SOAL PILIHAN GANDA\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\nKompetensi     : ______________________________\n\nPETUNJUK: Pilih satu jawaban yang paling tepat.\n\n1. Perhatikan pernyataan berikut!\n   ______________________________\n   Pernyataan yang benar ditunjukkan oleh nomor ....\n   A. (1) dan (2)      D. (2) dan (4)\n   B. (1) dan (3)      E. (3) dan (4)\n   C. (2) dan (3)\n   Kunci : ____\n   Pembahasan: ______________________________\n\n2. ______________________________\n   A. ____   B. ____   C. ____   D. ____   E. ____\n   Kunci : ____\n   Pembahasan: ______________________________\n\n3. ______________________________\n   A. ____   B. ____   C. ____   D. ____   E. ____\n   Kunci : ____\n\n4. ______________________________\n   A. ____   B. ____   C. ____   D. ____   E. ____\n   Kunci : ____\n\n5. ______________________________\n   A. ____   B. ____   C. ____   D. ____   E. ____\n   Kunci : ____\n\nTabel Kunci Jawaban: 1-____  2-____  3-____  4-____  5-____\n\nNilai = (Jumlah benar / total) x 100",
    },
    {
      id: "soal2",
      label: "Template Soal Esai",
      title: "BANK SOAL ESAI & RUBRIK",
      body:
        "BANK SOAL ESAI BESERTA RUBRIK PENILAIAN\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\n\n1. Jelaskan dengan bahasamu sendiri konsep ____________\n   Rubrik: (3) benar & disertai contoh; (2) benar tanpa contoh;\n   (1) kurang tepat; (0) tidak menjawab.\n\n2. Buatlah langkah penyelesaian untuk ____________\n   Rubrik: kelengkapan langkah, ketepatan hasil, keruntutan.\n\n3. Analisislah faktor penyebab ____________ dan beri solusi.\n   Rubrik: kerincian analisis (0-4), kesesuaian solusi (0-4).\n\n4. Bandingkan ____________ dengan ____________.\n   Rubrik: kesesuaian, kedalaman, kebahasaan.\n\n5. Simpulkan materi ____________ dalam satu paragraf padat.\n   Rubrik: ketepatan isi (0-4), kejelasan kalimat (0-2).\n\nPedoman: Nilai = (total skor / skor maksimal) x 100",
    },
  ],
  "koreksi-tugas": [
    {
      id: "kor1",
      label: "Template Lembar Koreksi",
      title: "LEMBAR KOREKSI TUGAS SISWA",
      body:
        "LEMBAR KOREKSI TUGAS SISWA\n\nIdentitas Siswa\nNama          : ______________________________\nKelas         : ______________________________\nMata Pelajaran: ______________________________\nJudul Tugas   : ______________________________\nTanggal       : __/__/2026\n\nASPEK KOREKSI & NILAI\n\n1. Kelengkapan isi (0-25)\n   Catatan: ______________________________\n   Skor  : ____\n\n2. Ketepatan konsep/jawaban (0-25)\n   Catatan: ______________________________\n   Skor  : ____\n\n3. Kesesuaian dengan instruksi (0-20)\n   Catatan: ______________________________\n   Skor  : ____\n\n4. Kerapian & kebahasaan (0-15)\n   Catatan: ______________________________\n   Skor  : ____\n\n5. Ketepatan waktu (0-15)\n   Catatan: ______________________________\n   Skor  : ____\n\nTotal Skor       : ____\nNilai (x 100)    : ____\n\nKOMENTAR PENGOREKSI\nKelebihan : ______________________________\nPerbaikan : ______________________________\n\nPengoreksi,\n\n(_____________________________)",
    },
    {
      id: "kor2",
      label: "Template Feedback",
      title: "LEMBAR UMPAN BALIK PENGOREKSI",
      body:
        "LEMBAR UMPAN BALIK PENGOREKSI\n\nNama Siswa     : ______________________________\nJudul Tugas    : ______________________________\nNilai Akhir    : ____ / 100\nPredikat       : (A/B/C/D)\n\nKritik / Observasi (objektif)\n1. ______________________________________________\n2. ______________________________________________\n3. ______________________________________________\n\nSaran Perbaikan\n1. ______________________________________________\n2. ______________________________________________\n3. ______________________________________________\n\nApresiasi (hal yang sudah baik)\n- ______________________________________________\n\nRekomendasi Tindak Lanjut\n- ______________________________________________\n\nPengoreksi,\n\n(_____________________________)",
    },
  ],
  "bahan-ajar": [
    {
      id: "ba1",
      label: "Template Bahan Ajar",
      title: "MODUL BAHAN AJAR",
      body:
        "MODUL BAHAN AJAR\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nJudul Materi   : ______________________________\nAlokasi Waktu  : ______________________________\n\n1. Kompetensi Dasar\n   ______________________________\n\n2. Tujuan Pembelajaran\n   - ______________________________\n   - ______________________________\n\n3. Peta Konsep\n   ______________________________\n\n4. Uraian Materi\n   A. ______________________________\n   B. ______________________________\n\n5. Contoh Penerapan / Ilustrasi\n   ______________________________\n\n6. Rangkuman (poin penting)\n   - ______________________________\n   - ______________________________\n\n7. Latihan Soal\n   1) ______________________________\n   2) ______________________________\n\n8. Umpan Balik & Tindak Lanjut\n   ______________________________\n\nDaftar Pustaka\n- ______________________________\n\nPenyusun,\n\n(_____________________________)",
    },
    {
      id: "ba2",
      label: "Template LKPD",
      title: "LEMBAR KERJA PESERTA DIDIK (LKPD)",
      body:
        "LEMBAR KERJA PESERTA DIDIK (LKPD)\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nNama Kelompok  : ______________________________\nAnggota        : 1. ______________  3. ______________\n                  2. ______________  4. ______________\n\nTujuan:\n______________________________\n\nPetunjuk Kerja:\n1. Amati ______________________________\n2. Diskusikan ______________________________\n3. Tuliskan hasil pada tabel berikut:\n\n| No | Aspek yang Diamati | Hasil Pengamatan |\n|----|--------------------|------------------|\n| 1  | __________________ | ________________ |\n| 2  | __________________ | ________________ |\n| 3  | __________________ | ________________ |\n\nKesimpulan\n______________________________\n\nNilai Kelompok: ____\n\n(_____________________________)",
    },
  ],
  "bedah-jurnal": [
    {
      id: "bj1",
      label: "Template Ringkasan",
      title: "RINGKASAN BEDAH JURNAL",
      body:
        "RINGKASAN BEDAH JURNAL\n\nJudul Jurnal  : ______________________________\nPenulis       : ______________________________\nTahun         : ______________________________\nJurnal        : ______________________________\nDOI/Link      : ______________________________\n\n1. LATAR BELAKANG & MASALAH (1-2 paragraf)\n   ______________________________\n\n2. TUJUAN PENELITIAN\n   - ______________________________\n\n3. METODE PENELITIAN\n   - Desain    : ______________________________\n   - Subjek    : ______________________________\n   - Instrumen : ______________________________\n   - Analisis  : ______________________________\n\n4. HASIL UTAMA\n   1) ______________________________\n   2) ______________________________\n\n5. KESIMPULAN PENULIS\n   ______________________________\n\n6. KELEBIHAN\n   - ______________________________\n\n7. KELEMAHAN / CATATAN KRITIS\n   - ______________________________\n\n8. IMPLIKASI / RELEVANSI\n   ______________________________\n\nTanggal Bedah : __/__/2026\nPembuat : ______________________________\n\n(_____________________________)",
    },
    {
      id: "bj2",
      label: "Template Catatan Kritis",
      title: "CATATAN KRITIS JURNAL",
      body:
        "CATATAN KRITIS JURNAL\n\nJudul Jurnal    : ______________________________\nKonteks Bidang  : ______________________________\n\n1. Kelayakan Metode\n   - Kekuatan  : ______________________________\n   - Kelemahan : ______________________________\n\n2. Kesesuaian Data & Pembahasan\n   - Kesesuaian sampel: ______________________________\n   - Pembahasan hasil : ______________________________\n\n3. Kekuatan Bukti (evidens)\n   - ______________________________\n\n4. Celah yang Bisa Diteliti Lanjut\n   - ______________________________\n\n5. Rekomendasi Pemanfaatan untuk ____________\n   - ______________________________\n\nPenelaah,\n\n(_____________________________)",
    },
  ],
  "rangkum-buku": [
    {
      id: "rb1",
      label: "Template Ringkasan",
      title: "RINGKASAN BAB BUKU",
      body:
        "RINGKASAN BAB BUKU\n\nJudul Buku : ______________________________\nPengarang  : ______________________________\nBab yang Dirangkum : Bab ___ : ________________\nHalaman    : __________\n\n1. GAGASAN UTAMA BAB\n   ______________________________\n\n2. POIN-POIN PENTING\n   - ______________________________\n   - ______________________________\n   - ______________________________\n\n3. KONSEP / ISTILAH KUNCI\n   - ______________________________\n\n4. TEMUAN / ARGUMEN PENULIS\n   ______________________________\n\n5. CONTOH / ILUSTRASI DALAM BUKU\n   ______________________________\n\n6. KESIMPULAN RINGKAS\n   ______________________________\n\n7. HAL YANG BISA DIPELAJARI PEMBACA\n   - ______________________________\n\nTanggal Dirangkum : __/__/2026\nPerangkum : ______________________________\n\n(_____________________________)",
    },
    {
      id: "rb2",
      label: "Template Peta Pikiran",
      title: "PETA PIKIRAN BUKU (MIND MAP)",
      body:
        "PETA PIKIRAN BAB BUKU\n\nJudul Buku : ______________________________\nBab        : ______________________________\n\nGagasan Utama\n______________________________\n\nCabang 1: ______________________________\n- Sub: ________________\n- Sub: ________________\n\nCabang 2: ______________________________\n- Sub: ________________\n- Sub: ________________\n\nCabang 3: ______________________________\n- Sub: ________________\n- Sub: ________________\n\nHubungan Antar Cabang\n______________________________\n\nKesimpulan Visual\n______________________________\n\n(_____________________________)",
    },
  ],
  "kerangka-skripsi": [
    {
      id: "ks1",
      label: "Template Bab 1-5",
      title: "KERANGKA SKRIPSI (BAB 1-5)",
      body:
        "KERANGKA SKRIPSI (BAB 1 - BAB 5)\n\nJudul Usulan : ______________________________\nNama/NIM     : ______________________________\nProgram Studi: ______________________________\n\nBAB I  PENDAHULUAN\n1.1 Latar Belakang      : ______________________________\n1.2 Rumusan Masalah    : 1. ___________\n2. ___________\n1.3 Tujuan Penelitian   : ______________________________\n1.4 Manfaat            : ______________________________\n\nBAB II  TINJAUAN PUSTAKA\n2.1 Kajian Teori       : ______________________________\n2.2 Penelitian Relevan : ______________________________\n2.3 Kerangka Pikir     : ______________________________\n2.4 Hipotesis          : ______________________________\n\nBAB III  METODE PENELITIAN\n3.1 Jenis & Desain     : ______________________________\n3.2 Populasi/Sampel    : ______________________________\n3.3 Instrumen          : ______________________________\n3.4 Teknik Analisis    : ______________________________\n\nBAB IV  HASIL & PEMBAHASAN\n4.1 Deskripsi Hasil    : ______________________________\n4.2 Uji Hipotesis      : ______________________________\n4.3 Pembahasan         : ______________________________\n\nBAB V  PENUTUP\n5.1 Kesimpulan         : ______________________________\n5.2 Saran              : ______________________________\n\nDaftar Pustaka\n- ______________________________\n\n(_____________________________)",
    },
    {
      id: "ks2",
      label: "Template ABSTRAK",
      title: "ABSTRAK SKRIPSI",
      body:
        "ABSTRAK SKRIPSI\n\nJudul    : ______________________________\nPenulis  : ______________________________\nPembimbing: 1. ______________ 2. ______________\n\nABSTRAK\n\nLatar belakang: ______________________________\nTujuan        : ______________________________\nMetode        : ______________________________\nHasil         : ______________________________\nKesimpulan    : ______________________________\n\nKata Kunci : ____________; ____________; ____________\n\n(Maksimal 250 kata, satu alinea percakapan akademik.)\n\n(_____________________________)",
    },
  ],
  "tiktok-viral": [
    {
      id: "tt1",
      label: "Template Skrip 30 detik",
      title: "SKRIP VIDEO TIKTOK 30 DETIK",
      body:
        "SKRIP VIDEO TIKTOK (30 DETIK) — JUALAN VIRAL\n\nProduk yang diiklankan : ______________________________\nHarga / promo          : ______________________________\nTarget audiens         : ______________________________\n\n00:00-00:03  HOOK (pancing perhatian)\n[VISUAL] ______________________________\n[TEXT]   \"________________________\"\n\n00:03-00:12  MASALAH & EMPATI\n[VISUAL] ______________________________\n[UCAPAN] \"Apakah kamu juga pernah...?\"\n\n00:12-00:22  SOLUSI / FITUR PRODUK\n[VISUAL] ______________________________\n[UCAPAN] \"Nah, sekarang ada...\"\n\n00:22-00:27  CALL TO ACTION + URGENSI\n[TEXT]   \"Hanya hari ini, harga...\"\n[UCAPAN] \"Klik link di bio sekarang!\"\n\n00:27-00:30  TUTUP MEREK\n[TEXT]   @______________\n\nCatatan:\n- Kalimat pendek, ganti potongan cepat.\n- Tambahkan musik trending / sound viral.\n- Jangan lupa caption + hashtag.\n\n(_____________________________)",
    },
    {
      id: "tt2",
      label: "Template Skrip 60 detik",
      title: "SKRIP VIDEO TIKTOK 60 DETIK",
      body:
        "SKRIP VIDEO TIKTOK (60 DETIK)\n\nProduk / Jasa : ______________________________\nTokoh        : ______________________________\nNaskah narasi utama:\n\nBUKA (0-10 dtk)  . Hook: \"Masalah ________ + solusinya ini.\"\nISI PERTAMA (10-30 dtk) . Penjelasan manfaat utama: ____________\nISI KEDUA (30-50 dtk)  . Tunjukkan cara pakai / bukti hasil: ____________\nPENAWARAN (50-57 dtk)  . Promo/harga: ____________\nTUTUP (57-60 dtk)      . Ajakan & merek: @____________\n\nTeknik Editing yang Disarankan\n- Cross-cutting cepat tiap 2-3 detik.\n- Tulisan besar (min. 2 kata) muncul di layar.\n- Gunakan auto-captions.\n\n(_____________________________)",
    },
  ],
  "caption-ig": [
    {
      id: "ig1",
      label: "Template Caption Jualan",
      title: "CAPTION INSTAGRAM JUALAN",
      body:
        "CAPTION INSTAGRAM JUALAN\n\nProduk / Promo : ______________________________\nHarga / Deal   : ______________________________\nCTR/Mention    : @______________\n\nHOOK (baris pertama, menarik & menghentikan scroll)\n\"________________________________\"\n\nISI / MANFAAT (2-4 poin singkat)\n- ______________\n- ______________\n- ______________\n\nPROOF / SOSIAL EVIDENCE (hasil/cara pakai)\n\"________________\"\n\nCALL TO ACTION (ajakan jelas & urgent)\n\"Klik link di bio / inbox sekarang!\"\n\nHASHTAG\n#____________ #____________ #____________ #____________\n#____________ #____________ #____________ #____________\n\nCATATAN UNTUK FEED/GGOLIAT\n- Gambar tajam & idealnya angka/CTA terlihat.\n- Balas DM cepat agar konversi meningkat.\n\n(_____________________________)",
    },
    {
      id: "ig2",
      label: "Template Caption Branding",
      title: "CAPTION INSTAGRAM BRANDING",
      body:
        "CAPTION INSTAGRAM BRANDING (STORYTELLING)\n\nNilai / Cerita Merek : ______________________________\nTarget Pembaca      : ______________________________\n\nPEMBUKA (cerita/pertanyaan relatable)\n\"________________________________\"\n\nPERKEMBANGAN (perjalanan/kisah)\n\"________________________________\"\n\nNILAI & MAKNA (kenapa penting)\n\"________________________________\"\n\nAJAKAN INTERAKSI\n\"Tulis komentarmu di bawah, yuk!\"\n\nHASHTAG\n#____________ #____________ #____________\n\n(_____________________________)",
    },
  ],
  "ide-bisnis": [
    {
      id: "ib1",
      label: "Template Analisis Ide",
      title: "ANALISIS IDE BISNIS",
      body:
        "ANALISIS IDE BISNIS\n\nNama Ide Bisnis       : ______________________________\nModal Awal Estimasi   : Rp ____________\nLokasi / Pasar Target : ______________________________\n\n1. TREN PASAR LOKAL\n   - ______________________________\n   - ______________________________\n\n2. SEGMEN PELANGGAN (siapa yang paling butuh)\n   - Usia/kelas : ______________________________\n   - Kebutuhan  : ______________________________\n\n3. KEUNGGULAN vs PESAING\n   - ______________________________\n\n4. RENCANA PRODUK MULAI\n   - Produk inti: ______________________________\n   - Harga      : Rp ________________\n\n5. SALURAN PENJUALAN\n   - ______________   - ______________\n\n6. PROYEKSI MODAL & BEP\n   - Biaya mulai : Rp ____________\n   - BEP bulan  : ________________\n\n7. RISIKO & MITIGASI\n   - Risiko: ____________ | Mitigasi: ____________\n\n(_____________________________)",
    },
    {
      id: "ib2",
      label: "Template Rencana 90 hari",
      title: "RENCANA BISNIS 90 HARI",
      body:
        "RENCANA BISNIS 90 HARI\n\nNama Bisnis  : ______________________________\nModal Awal   : Rp ____________\n\nMINGGU 1-4 (Fondasi)\n- Riset pasar: ____________\n- Siapkan produk/sistem: ____________\n- Bangun kehadiran online: ____________\n\nMINGGU 5-8 (Peluncuran & Uji)\n- Soft launching: ____________\n- Kumpulkan feedback: ____________\n- Perbaiki produk: ____________\n\nMINGGU 9-12 (Skalasi)\n- Promosi berbayar/kolaborasi: ____________\n- Perluas jangkauan: ____________\n- Evaluasi & catat KPI: ____________\n\nTarget Pendapatan Bulan 3 : Rp ____________\n\n(_____________________________)",
    },
  ],
  "bahasa-formal": [
    {
      id: "bf1",
      label: "Template Surat Formal",
      title: "SURAT DINAS / KORPORAT FORMAL",
      body:
        "SURAT DINAS / KORPORAT\n\nNomor      : ____________/____________/2026\nLampiran   : ____________\nPerihal    : ____________\n\nKepada Yth.\n____________\nDi ____________\n\nDengan hormat,\n\nSehubungan dengan ____________, bersama ini kami sampaikan bahwa ____________.\nAdapun rincian yang perlu diperhatikan adalah sebagai berikut:\n\n1. ____________\n2. ____________\n3. ____________\n\nDemikian surat ini kami sampaikan. Atas perhatian dan kerja sama\nBapak/Ibu, kami mengucapkan terima kasih.\n\nHormat kami,\n\n(_____________________________)\n\nCatatan: hindari istilah santai, gunakan kalimat baku dan sopan.",
    },
    {
      id: "bf2",
      label: "Template Email Profesional",
      title: "EMAIL PROFESIONAL",
      body:
        "EMAIL PROFESIONAL\n\nSubjek: ____________\n\nKepada Yth. ____________,\n\nDengan hormat,\n\nSaya ____________ selaku ____________ ingin mengajukan ____________.\nSebagai pertimbangan, saya sampaikan beberapa hal berikut:\n\n1. ____________\n2. ____________\n\nSaya mohon ____________. Jika berkenan, saya dapat dihubungi di\n____________ atau ____________ untuk tindak lanjut.\n\nDemikian surat elektronik ini saya sampaikan. Atas perhatian Bapak/Ibu,\nsaya mengucapkan terima kasih.\n\nHormat saya,\n\n(_____________________________)\n\nJabatan: ____________\nKontak : ____________",
    },
  ],
  "audio-mp3": [
    {
      id: "am1",
      label: "Template Narasi 60 detik",
      title: "NASKAH NARASI AUDIO (60 DETIK)",
      body:
        "NASKAH NARASI AUDIO (60 DETIK)\n\nJudul Narasi : ______________________________\nTujuan       : (promosi / edukasi / perkenalan)\nNada Bicara  : (hangat / bersemangat / tenang)\n\n[INTRO 0-5 dtk]\n\"Halo, ________________...\"\n\n[ISI 5-35 dtk]\n\"Tahukah kamu, ________________...\"\n\"Bayangkan jika ________________...\"\n\"Nah, di sinilah peran ________________...\"\n\n[KEPUTUSAN 35-45 dtk]\n\"Mulai hari ini, coba ________________...\"\n\n[CLOSING 45-60 dtk]\n\"Terima kasih sudah mendengarkan. Sampai jumpa di ________________!\"\n\nPetunjuk Suara\n- Bicara perlahan, tarik napas di titik koma.\n- Tekankan kata kunci dengan nada naik-turun.\n- Gunakan jeda alami antar kalimat.",
    },
    {
      id: "am2",
      label: "Template Narasi Panjang",
      title: "NASKAH NARASI AUDIO (120 DETIK)",
      body:
        "NASKAH NARASI AUDIO (120 DETIK)\n\nTema / Produk : ______________________________\nTarget Audiens: ______________________________\n\n[PEMBUKA 0-15 dtk]\nSentuhan emosi/pertanyaan: \"____________________________\"\n\n[KONTEKS 15-45 dtk]\nCeritakan latar & masalah: \"____________________________\"\n\n[JALINAN 45-90 dtk]\nPerkenalkan solusi & manfaat: \"____________________________\"\n\"Sehingga ______ dapat ______...\"\n\n[AJAKAN 90-110 dtk]\nTindakan yang diharapkan: \"____________________________\"\n\n[PENUTUP 110-120 dtk]\nRingkas & tanda tangan suara: \"____________________________\"\n\nCatatan Produksi\n- Direkam di ruang senyap, jarak mic 15-20 cm.\n- Tambahkan musik latar volume rendah.\n",
    },
  ],
  "generator-propaganda": [
    {
      id: "gp1",
      label: "Template 3 Variant Konten",
      title: "RANCANG KONTEN PERSUASIF (3 VARIAN)",
      body:
        "RANCANG KONTEN PERSUASIF (PROPAGANDA POSITIF)\n\nIsu / Pesan Utama : ______________________________\nTarget Audiens    : ______________________________\nDampak yang Diharapkan : ______________________________\n\nVARIAN A — Emosional & Motivasi\nHook   : \"________________________\"\nIsi    : cerita, ajakan refleksi, bukti sederhana.\nTutup  : ajakan aksi nyata.\n\nVARIAN B — Logika & Data\nHook   : \"Tahukah kamu, ____________...\"\nIsi    : fakta/angka pendukung, perbandingan.\nTutup  : kesimpulan menguatkan pesan utama.\n\nVARIAN C — Kreatif / Simbolik\nHook   : kalimat ikonik pendek.\nIsi    : analogi & metafora yang mudah diingat.\nTutup  : tagline yang dapat diulang.\n\nEtika Penyampaian\n- Hindari informasi menyesatkan.\n- Sertakan sumber bila memakai data.\n- Sampaikan dengan bahasa yang menyatukan.",
    },
    {
      id: "gp2",
      label: "Template Tagline & Kutipan",
      title: "TAGLINE & AJAKAN KAMPANYE",
      body:
        "TAGLINE & AJAKAN KAMPANYE\n\nTema Kampanye : ______________________________\nSasaran       : ______________________________\n\nTAGLINE UTAMA\n\"________________________\"\n\n3 TAGLINE ALTERNATIF\n1. \"________________________\"\n2. \"________________________\"\n3. \"________________________\"\n\nKALIMAT AJAKAN (CTA)\n\"Marilah ________________...\"\n\nKALIMAT PENUTUP PRESENTASI/POSTER\n\"Karena <nilai>, kita bisa ________________...\"\n\nPesan Singkat untuk Media Sosial (1-2 kalimat)\n____________________________\n\n(_____________________________)",
    },
  ],
};

const FONTS = {
  sans: "'Segoe UI', system-ui, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Consolas, monospace",
} as const;

type DocFont = keyof typeof FONTS;

export default function AIWorkbench({
  featureId,
  featureTitle,
  featureDesc,
  examplePrompt,
  maxInputChars = 4000,
}: AIWorkbenchProps) {
  // --- SEKAT 1 : RUANG DISKUSI USER & AI ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeDate, setActiveDate] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [checkedDates, setCheckedDates] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<"delete-checked" | "delete-all" | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- SEKAT 2 : KERTAS DOKUMEN MURNI ---
  const [docText, setDocText] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [docFont, setDocFont] = useState<DocFont>("sans");
  const [fontSize, setFontSize] = useState(16);
  const [docZoom, setDocZoom] = useState(1);
  const [chatZoom, setChatZoom] = useState(1);
  const [chatFontSize, setChatFontSize] = useState(11);
  const docZoomed = docZoom > 1.02;
  const chatZoomed = chatZoom > 1.02;
  const activeTemplates = FEATURE_TEMPLATES[featureId] ?? FALLBACK_TEMPLATES;
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = paperRef.current;
    if (el && el.innerText !== docText) el.innerText = docText;
  }, [docText]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ---- Muat riwayat (sessions per tanggal) SETELAH mount (hindari hydration mismatch) ----
  useEffect(() => {
    let sessions: ChatSession[] = [];
    try {
      const raw = localStorage.getItem("bikinAI_chat_history_" + featureId);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(parsed)) sessions = parsed.filter((s) => s && s.date && Array.isArray(s.messages));
      }
    } catch {
      sessions = [];
    }
    const today = todayStr();
    // Migrasi riwayat lama (bikinAI_chat_<id>) menjadi sesi hari ini
    if (sessions.length === 0) {
      try {
        const oldRaw = localStorage.getItem("bikinAI_chat_" + featureId);
        if (oldRaw) {
          const oldArr = JSON.parse(oldRaw) as ChatMessage[];
          if (Array.isArray(oldArr) && oldArr.length) {
            sessions.push({ date: today, messages: oldArr });
          }
        }
      } catch { /* abaikan */ }
    }
    setHistory(sessions);
    const todaySess = sessions.find((s) => s.date === today);
    if (todaySess) {
      setMessages(todaySess.messages);
      setActiveDate(today);
    } else if (sessions.length) {
      const latest = sessions[sessions.length - 1];
      setMessages(latest.messages);
      setActiveDate(latest.date);
    } else {
      setActiveDate(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan pesan aktif ke dalam sesi pada tanggal aktif
  useEffect(() => {
    if (!activeDate) return;
    setHistory((prev) => {
      const rest = prev.filter((s) => s.date !== activeDate);
      return messages.length ? [...rest, { date: activeDate, messages }] : rest;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeDate]);

  // Simpan riwayat ke localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (history.length) {
        localStorage.setItem("bikinAI_chat_history_" + featureId, JSON.stringify(history));
      } else {
        localStorage.removeItem("bikinAI_chat_history_" + featureId);
      }
    } catch { /* abaikan */ }
  }, [history, featureId]);

  const handleClearHistory = () => {
    // Kosongkan ruang obrolan AKTIF saja (bukan menghapus seluruh riwayat)
    setMessages([]);
    setShowHistory(false);
  };

  const loadSession = (date: string) => {
    const sess = history.find((s) => s.date === date);
    setActiveDate(date);
    setMessages(sess ? sess.messages : []);
    setShowHistory(false);
  };

  const toggleChecked = (date: string) => {
    setCheckedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleDeleteChecked = () => {
    const rem = new Set(checkedDates);
    const next = history.filter((s) => !rem.has(s.date));
    setHistory(next);
    if (rem.has(activeDate)) {
      // Tanggal aktif ikut terhapus -> pindah ke sesi terbaru yang tersisa
      // (jangan reset ke hari ini + kosong, agar sesi lain tidak tertimpa)
      const nextActive = next.length ? next[next.length - 1].date : todayStr();
      const sess = next.find((s) => s.date === nextActive);
      setActiveDate(nextActive);
      setMessages(sess ? sess.messages : []);
    }
    setCheckedDates([]);
    setConfirmModal(null);
    setShowHistory(false);
  };

  const handleDeleteAll = () => {
    setHistory([]);
    setMessages([]);
    setActiveDate(todayStr());
    setCheckedDates([]);
    setConfirmModal(null);
    setShowHistory(false);
  };

  const finish = () => {
    setIsLoading(false);
    abortRef.current = null;
  };

  /* ====== Streaming ke backend fitur khas sesuai id fitur ====== */
  const handleGenerate = async (raw = inputText) => {
    const trimmed = raw.trim();
    if (!trimmed || isLoading) return;

    setInputText(""); // AUTO-CLEAR kotak input.
    setChatError(null);

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: trimmed, ts: Date.now() };
    const aiMsg: ChatMessage = { id: makeId(), role: "ai", content: "", ts: Date.now() };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsLoading(true);

    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/v3/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, feature: featureId }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error("Server responded with " + response.status + ": " + errBody);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming reader unavailable.");

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const t = frame.trim();
          if (!t.startsWith("data:")) continue;
          const dataStr = t.slice(5).trim();
          if (dataStr === "[DONE]") {
            finish();
            return;
          }
          try {
            const p = JSON.parse(dataStr) as SseFrame;
            if (p.type === "error") {
              setChatError(p.error ?? "Unknown streaming error.");
              finish();
              return;
            }
            if (p.type === "done") {
              if (p.monetization && p.monetization.balance_updated) {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ai-balance-updated", {
                      detail: Number(p.monetization.remaining_balance) || 0,
                    }),
                  );
                } catch { /* nonaktif di SSR */ }
              }
              finish();
              return;
            }
            const token = p.text;
            if (typeof token === "string" && token) {
              const aiId = aiMsg.id;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, content: m.content + token } : m,
                ),
              );
            }
          } catch {
            /* abaikan frame SSE rusak */
          }
        }
      }
      finish();
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) setChatError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  /* ====== Tombol-tombol kontrol kertas dokumen ====== */
  const handleBlank = () => setDocText("");
  const handleTemplate = (tpl: DocTemplate) =>
    setDocText(tpl.title + "\n" + "=".repeat(26) + "\n\n" + tpl.body);
  const toggleLock = () => setIsLocked((p) => !p);
  const cycleFont = () =>
    setDocFont((p) => (p === "sans" ? "serif" : p === "serif" ? "mono" : "sans"));
  const bumpFont = (delta: number) =>
    setFontSize((p) => Math.min(44, Math.max(9, p + delta)));
  const bumpChatFont = (delta: number) =>
    setChatFontSize((p) => Math.min(22, Math.max(9, p + delta)));
  const docZoomIn = () => {
    setChatZoom(1);
    setDocZoom((p) => Math.min(1.8, Number((p + 0.2).toFixed(2))));
  };
  const docZoomOut = () =>
    setDocZoom((p) => Math.max(1, Number((p - 0.2).toFixed(2))));
  const chatZoomIn = () => {
    setDocZoom(1);
    setChatZoom((p) => Math.min(1.8, Number((p + 0.2).toFixed(2))));
  };
  const chatZoomOut = () =>
    setChatZoom((p) => Math.max(1, Number((p - 0.2).toFixed(2))));
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(docText);
      alert("✅ Dokumen teks murni berhasil disalin ke clipboard!");
    } catch {
      alert("❌ Gagal menyalin teks. Silakan salin manual.");
    }
  };
  const handleExportWord = () => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${featureTitle || "Dokumen AI Nusantara"}</title>
          <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
            p { margin-bottom: 14px; }
          </style>
        </head>
        <body>
          <p>${docText.replace(/\n/g, "<br/>")}</p>
          <hr/>
          <p style="font-size: 11px; color: #888;">Dihasilkan oleh BIKIN AI Nusantara — ${featureTitle} pada ${new Date().toLocaleString("id-ID")}</p>
        </body>
      </html>
    `;
    const blob = new Blob(["\ufeff", htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${featureId || "dokumen"}-ai-nusantara-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-full max-h-full overflow-hidden">
      <div className="w-full h-full bg-transparent p-3 flex flex-col gap-2">
      {(docZoomed || chatZoomed) && (
        <div
          className="fixed inset-0 z-40 bg-black/70"
          onClick={() => {
            setDocZoom(1);
            setChatZoom(1);
          }}
        />
      )}
            {/* (Header fitur dihilangkan — cukup 1 header di parent dengan tombol Kembali & saldo token) */}

      {/* Formasi 2 SEKAT SEJAJAR HORIZONTAL */}
      <div className="flex-1 min-h-0 flex flex-row gap-2">
        {/* ===== SEKAT 1 (45%) : RUANG DISKUSI USER & AI ===== */}
        <section
          className={
            chatZoomed
              ? "fixed inset-0 z-50 m-auto w-[86vw] h-[86vh] overflow-auto flex flex-col bg-[#030712] p-3 rounded-2xl border border-slate-700/70 shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
              : "w-[45%] min-w-0 h-full flex flex-col rounded-2xl border border-yellow-400/30 bg-black/40 overflow-hidden backdrop-blur-xl"
          }
          style={chatZoomed ? { width: "86vw" } : undefined}
        >
          <div className="shrink-0 px-3 py-2 border-b border-yellow-400/30 bg-black/40 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              💬 Ruang Diskusi
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title="Lihat riwayat chat (per tanggal / pilih tanggal)"
              >
                <History className="w-3 h-3" /> Riwayat
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/40 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-red-300 transition-all active:scale-95"
                title="Kosongkan ruang obrolan aktif"
              >
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
              <span className="w-px h-4 bg-yellow-400/30" />
              <button
                type="button"
                onClick={chatZoomIn}
                className="px-2 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase text-emerald-300 transition-all active:scale-95"
                title="Zoom In kolom chat (isi satu layar)"
              >
                🔍 Zoom +
              </button>
              <button
                type="button"
                onClick={chatZoomOut}
                className="px-2 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase text-white transition-all active:scale-95"
                title="Zoom Out kolom chat (kembali ke posisi semula)"
              >
                🔍 Zoom −
              </button>
              <span className="w-px h-4 bg-yellow-400/30" />
              <button
                type="button"
                onClick={() => bumpChatFont(-1)}
                className="px-2 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black text-white transition-all active:scale-95"
                title="Perkecil ukuran huruf chat"
              >
                A−
              </button>
              <button
                type="button"
                onClick={() => bumpChatFont(1)}
                className="px-2 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black text-white transition-all active:scale-95"
                title="Perbesar ukuran huruf chat"
              >
                A+
              </button>
            </div>
          </div>

          

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto flex flex-col gap-2 p-3 min-h-0">
            {messages.length === 0 && (
              <div className="m-auto text-center max-w-xs">
                <div className="text-3xl">🤖</div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Ketik perintah di bawah, AI Nusantara akan menjawab sesuai
                  peran fitur <b className="text-amber-400">{featureTitle}</b>{" "}
                  dan hasilnya bisa dipotong/disalin dari kertas dokumen kanan.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-end gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  style={{ fontSize: chatFontSize }}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "rounded-br-sm border border-yellow-400/30 bg-black/40 text-white backdrop-blur"
                      : "rounded-bl-sm border border-yellow-400/30 bg-black/40 text-white backdrop-blur"
                  }`}
                >
                  {m.role === "ai" && m.content === "" ? (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI sedang menulis…
                    </span>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "ai" && m.content !== "" && (
                  <button
                    type="button"
                    onClick={() => setDocText(m.content)}
                    className="shrink-0 mb-0.5 p-1 rounded-xl border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-white hover:border-yellow-400/50 backdrop-blur transition-all active:scale-95"
                    title="Salin balasan AI ini ke kertas dokumen kanan untuk diedit"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {chatError && (
            <div className="shrink-0 mx-3 mb-1 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-950/40 text-[10px] text-red-300">
              ⚠️ {chatError}
            </div>
          )}

          {/* Kotak input + tombol GENERATE emas (auto-clear) */}
          <div className="shrink-0 border-t border-yellow-400/30 bg-black/40 p-2">
            {examplePrompt && (
              <button
                type="button"
                onClick={() => {
                  setInputText(examplePrompt);
                }}
                className="w-full mb-1.5 flex items-start gap-2 px-2.5 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-left text-[9px] text-white transition-colors"
                title="Isi kotak input dengan contoh prompt khas fitur ini"
              >
                <Sparkles className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                <span className="line-clamp-2 leading-snug">
                  Contoh: {examplePrompt}
                </span>
              </button>
            )}
            <textarea
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value.slice(0, maxInputChars))
              }
              placeholder={
                examplePrompt ? "Atau ketik prompt sendiri di sini…" : "Ketik prompt / revisi dokumen di sini…"
              }
              maxLength={maxInputChars}
              className="w-full h-16 resize-none rounded-xl border border-yellow-400/30 bg-black/40 p-2 text-xs text-white placeholder:text-slate-500/60 outline-none focus:border-yellow-400/60"
            />
            <div className="mt-1.5 flex flex-row items-center justify-between gap-2">
              <span className="text-[9px] font-mono text-slate-500">
                {inputText.length} / {maxInputChars}
              </span>
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={!inputText.trim() || isLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl border border-yellow-400/40 bg-black/40 hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black uppercase tracking-wider text-amber-300 shadow-lg shadow-yellow-400/20 transition-all active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ===== SEKAT 2 (55%) : KERTAS DOKUMEN MURNI + PANEL TOMBOL ===== */}
        <section
          className={
            docZoomed
              ? "fixed inset-0 z-50 m-auto w-[86vw] h-[86vh] overflow-auto flex flex-col bg-[#030712] p-3 rounded-2xl border border-slate-700/70 shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
              : "w-[55%] min-w-0 h-full flex flex-col rounded-2xl border border-yellow-400/30 bg-black/40 overflow-hidden backdrop-blur-xl"
          }
          style={docZoomed ? { width: "86vw" } : undefined}
        >
          {/* Panel tombol kontrol kertas */}
          <div className="shrink-0 border-b border-yellow-400/30 bg-black/40 p-1.5 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleBlank}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
              title="Kosongkan kertas dokumen"
            >
              📄 Blank
            </button>
            {activeTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplate(t)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title={`Isi kertas dengan ${t.title}`}
              >
                📁 {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleLock}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all active:scale-95 text-[9px] font-black uppercase tracking-wider ${
                isLocked
                  ? "border-red-500/50 bg-red-950/40 text-red-300 hover:bg-red-900/40"
                  : "border-yellow-400/30 bg-black/40 text-white hover:bg-black/60"
              }`}
              title="Kunci atau buka izin edit keyboard pada kertas"
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {isLocked ? "Gembok" : "Edit"}
            </button>
            <button
              type="button"
              onClick={cycleFont}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
              title="Ubah gaya font kertas (Sans / Serif / Monospace)"
            >
              <Type className="w-3 h-3" /> {docFont}
            </button>
            <button
              type="button"
              onClick={() => bumpFont(1)}
              className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-black text-white transition-all active:scale-95"
              title="Perbesar ukuran huruf"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => bumpFont(-1)}
              className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-black text-white transition-all active:scale-95"
              title="Perkecil ukuran huruf"
            >
              A−
            </button>
            <button
              type="button"
              onClick={docZoomIn}
              className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase text-emerald-300 transition-all active:scale-95"
              title="Zoom In kolom dokumen (isi satu layar)"
            >
              🔍 Zoom +
            </button>
            <button
              type="button"
              onClick={docZoomOut}
              className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase text-white transition-all active:scale-95"
              title="Zoom Out kolom dokumen (kembali ke posisi semula)"
            >
              🔍 Zoom −
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
              title="Salin 100% teks dokumen ke clipboard"
            >
              <Copy className="w-3 h-3" /> Salin
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-amber-300 transition-all active:scale-95"
              title="Unduh teks dokumen sebagai file Word .doc"
            >
              <FileText className="w-3 h-3" /> Word
            </button>
            <span className="ml-auto text-[9px] font-mono text-slate-500">
              {Math.round(docZoom * 100)}% · {fontSize}px
            </span>
          </div>

          {/* Kontainer kertas — tinggi terkunci kaku, gulung hanya di dalam sekat kanan */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="px-1 pt-2 pb-6">
              <div
                ref={paperRef}
                contentEditable={!isLocked}
                suppressContentEditableWarning
                onInput={(e) => {
                  const el = e.currentTarget;
                  setDocText(el.innerText);
                }}
                spellCheck={false}
                style={{
                  fontSize,
                  fontFamily: FONTS[docFont],
                }}
                className="mx-auto min-h-[520px] max-w-[820px] rounded-lg bg-white text-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.55)] p-8 outline-none whitespace-pre-wrap leading-relaxed"
              />
            </div>
          </div>
        </section>
      </div>
      </div>

      {/* Modal Riwayat Chat (ukuran besar seperti zoom-in) */}
      {showHistory && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[82vh] rounded-2xl border border-yellow-400/30 bg-black/40 shadow-[0_8px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 py-3 border-b border-yellow-400/30 flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">📜 Riwayat Chat</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="px-2.5 py-1 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-bold text-white transition-all"
              >
                ✕ Tutup
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
              {history.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-10">Belum ada riwayat chat untuk fitur ini.</p>
              ) : (
                [...history]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((s) => (
                    <div
                      key={s.date}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                        activeDate === s.date
                          ? "border-yellow-400/40 bg-black/40"
                          : "border-yellow-400/30 bg-black/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedDates.includes(s.date)}
                        onChange={() => toggleChecked(s.date)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        title="Tandai untuk dihapus"
                      />
                      <button
                        type="button"
                        onClick={() => loadSession(s.date)}
                        className="flex-1 text-left"
                        title="Klik untuk menampilkan kembali pembahasan"
                      >
                        <span className="text-[11px] font-bold text-white">{fmtDate(s.date)}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">{s.messages.length} pesan</span>
                      </button>
                    </div>
                  ))
              )}
            </div>
            {history.length > 0 && (
              <div className="shrink-0 px-4 py-3 border-t border-yellow-400/30 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal("delete-all")}
                  className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/40 text-red-300 text-[10px] font-black uppercase hover:bg-red-950/60 transition-all"
                >
                  Hapus Semua
                </button>
                <button
                  type="button"
                  disabled={checkedDates.length === 0}
                  onClick={() => setConfirmModal("delete-checked")}
                  className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/40 text-red-300 text-[10px] font-black uppercase hover:bg-red-950/60 disabled:opacity-40 transition-all"
                >
                  Hapus ({checkedDates.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-yellow-400/30 bg-black/40 shadow-[0_8px_40px_rgba(0,0,0,0.8)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold text-white">
              {confirmModal === "delete-all"
                ? "Yakin ingin menghapus SEMUA riwayat chat fitur ini?"
                : `Yakin ingin menghapus ${checkedDates.length} riwayat yang dicentang?`}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-lg border border-yellow-400/30 text-white text-[10px] font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => (confirmModal === "delete-all" ? handleDeleteAll() : handleDeleteChecked())}
                className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-500/40 text-white text-[10px] font-bold transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}