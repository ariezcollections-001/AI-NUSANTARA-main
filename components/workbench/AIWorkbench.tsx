"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Send,
  Copy,
  ChevronDown,
  FileText,
  Lock,
  Unlock,
  Type,
  Loader2,
  Sparkles,
  History,
  Trash2,
  ClipboardPaste,
  Check,
  Play,
  Square,
  Download,
  Volume2,
  X,
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

const FALLBACK_TEMPLATES: DocTemplate[] = [];


const UMUM_CHAT_TEMPLATES: DocTemplate[] = [
    {
      id: "cb1",
      label: "1. Blank Layout (Kertas Kosong Bersih)",
      title: "",
      body:
        "",
    },
    {
      id: "cb2",
      label: "2. Format Buku Catatan & Brainstorming",
      title: "LEMBAR CATATAN & HASIL BRAINSTORMING BEBAS",
      body:
        "LEMBAR CATATAN & HASIL BRAINSTORMING BEBAS\nTopik Diskusi Utama: __________________\nTanggal/Sesi      : __________________\n\nA. KESIMPULAN INTI HASIL DISKUSI\n- Poin Utama Pembahasan: __________________\n- Ide/Gagasan Terbaik   : __________________\n\nB. DAFTAR TINDAKAN TINDAK LANJUT (ACTION PLAN)\n1. Langkah Kerja 1 : __________________\n2. Langkah Kerja 2 : __________________\n\nC. CATATAN TAMBAHAN (SCRATCHPAD)\n____________________________________________________",
    },
    {
      id: "cb3",
      label: "3. Format Outline Artikel / Tulisan Bebas",
      title: "STRUKTUR KERANGKA ARTIKEL / KARANGAN BEBAS",
      body:
        "STRUKTUR KERANGKA ARTIKEL / KARANGAN BEBAS\nRencana Judul  : __________________\nTema Utama     : __________________\n\n[BAGIAN 1: PARAGRAF PEMBUKA / INTRO]\n- Gagasan Utama Menarik: __________________\n\n[BAGIAN 2: ISI PEMBAHASAN / BODY]\n- Poin Argumen 1: __________________\n- Poin Argumen 2: __________________\n\n[BAGIAN 3: KESIMPULAN / PENUTUP]\n- Ringkasan Akhir Tulisan: __________________",
    },
];

const UMUM_AUDIO_TEMPLATES: DocTemplate[] = [
    {
      id: "am1",
      label: "1. Naskah Iklan Komersial (VO Script)",
      title: "SKRIP AUDIO VOICE OVER (VO) - IKLAN PRODUK KOMERSIAL",
      body:
        "SKRIP AUDIO VOICE OVER (VO) - IKLAN PRODUK KOMERSIAL\nNama Produk: __________________\nDurasi Target: 30 Detik / 60 Kata\nGaya Suara : [Intonasi Ceria, Manja, Luwes, dan Menggoda]\n\n[DRAF NASKAH PEMBACAAN SUARA]:\n\"[Jeda Singkat] Halo Sahabat Nusantara! [Intonasi Naik] Pernah gak sih ngerasa pusing karena kerjaan menumpuk? [Jeda Dua Detik] Jangan khawatir! [Intonasi Mantap] Sekarang ada solusi instan dari __________________. [Jeda] Yuk, coba sekarang juga dan dapatkan diskon khusus hari ini! [Intonasi Turun] Klik link di bawah ya!\"",
    },
    {
      id: "am2",
      label: "2. Naskah Narasi Dongeng (Storytelling VO)",
      title: "NASKAH NARASI DONGENG (STORYTELLING VO)",
      body:
        "NASKAH NARASI DONGENG (STORYTELLING VO)\nJudul Dongeng: __________________\nKarakter Utama: __________________\n\n1. PEMBUKA (Perkenalan Tokoh)      : __________________\n2. KONFLIK / MASALAH               : __________________\n3. KLIMAKS                         : __________________\n4. PENYELESAIAN (Resolusi)         : __________________\n5. PESAN MORAL                     : __________________\n\n* Tulis tanda intonasi eksplisit: [Jeda Sejenak], [Intonasi Turun], [Antusias], [Berbisik].",
    },
    {
      id: "am3",
      label: "3. Teks Sambutan / Pembuka Podcast Resmi",
      title: "TEKS SAMBUTAN / PEMBUKA PODCAST RESMI",
      body:
        "TEKS SAMBUTAN / PEMBUKA PODCAST RESMI\nNama Podcast    : __________________\nNama Host       : __________________\nTopik Episode   : __________________\n\n[OPENING PODCAST]:\nHalo dan selamat datang di __________________! [Antusias] Episode kali ini kita akan membahas topik yang paling dinanti, yaitu __________________. Sebelum mulai, jangan lupa subscribe dan nyalakan lonceng notifikasi ya! [Jeda Sejenak] Tanpa berlama-lama lagi, kita mulai! [Intonasi Naik]",
    },
];

const UMUM_PROPAGANDA_TEMPLATES: DocTemplate[] = [
    {
      id: "gp1",
      label: "1. Narasi Gempur Pasar (Memicu FOMO Massal)",
      title: "KAMPANYE PROPAGANDA PEMBAKARAN PASAR DIGITAL (FOMO)",
      body:
        "KAMPANYE PROPAGANDA PEMBAKARAN PASAR DIGITAL (FOMO)\nNama Produk/Jasa: __________________\nTarget Kompetitor: __________________\n\n[NARASI PROPAGANDA UTAMA]:\n\"PERINGATAN KERAS! Jangan sampai Anda menjadi orang terakhir yang tertinggal dalam kebodohan teknologi! [Urgensi] Detik ini, ribuan kompetitor Anda sudah bergerak maju menggunakan __________________ untuk melipatgandakan keuntungan mereka! [Gempuran] Apakah Anda akan tetap diam menonton kesuksesan orang lain? [Aksi] Amankan slot paket koin Anda sekarang, sebelum harga naik menjadi dua kali lipat malam ini! Kuota tersisa tinggal sedikit!\"",
    },
    {
      id: "gp2",
      label: "2. Teks Slogan Pendek Pembakar Semangat",
      title: "SLOGAN PENDEK PEMBAKAR SEMANGAT",
      body:
        "SLOGAN PENDEK PEMBAKAR SEMANGAT\nNama Brand/Produk: __________________\n\n5 VARIAN SLOGAN (max 6 kata):\n1. ____________\n2. ____________\n3. ____________\n4. ____________\n5. ____________\n\nCatatan: bombastis, emosional, mudah diingat, dan memicu rasa takut ketinggalan (FOMO).",
    },
    {
      id: "gp3",
      label: "3. Teks Manifesto Visi Misi Brand Ekstrem",
      title: "MANIFESTO VISI MISI BRAND EKSTREM",
      body:
        "MANIFESTO VISI MISI BRAND EKSTREM\nNama Brand: __________________\n\n[PRINSIP KAMI]:\n1. Kami percaya bahwa __________________\n2. Kami menolak __________________\n3. Kami berjuang untuk __________________\n\n[VISI EKSTREM]: __________________\n[MISI 12 BULAN]: __________________\n[JANJI KEPADA PENDUKUNG]: __________________",
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
    {
      id: "rpp3",
      label: "Template Silabus & KD",
      title: "SILABUS & KOMPETENSI DASAR",
      body:
        "SILABUS & KOMPETENSI DASAR (KI-KD)\n\nMata Pelajaran  : ______________________________\nKelas/Semester   : ______________________________\nAlokasi Waktu    : ______________________________ (___ JP)\n\nKI-1 Pengetahuan  : ______________________________\nKI-2 Penggunaan   : ______________________________\nKI-3 Keterampilan  : ______________________________\nKI-4 Sikap        : ______________________________\n\nKD per bab/unit:\nKD _____ : ______________________________\nKD _____ : ______________________________\nKD _____ : ______________________________\n\nSumber / Bahan Bacaan:\n- ______________________________\n\nMengetahui,\n(_____________________________)",
    },
    {
      id: "rpp4",
      label: "Template Praktikum / Lab",
      title: "RPP PRAKTIKUM / LABORATORIUM",
      body:
        "RPP PRAKTIKUM / LABORATORIUM (MODEL Eksperimental)\n\nAlokasi Waktu    : ______________________________\nMata Pelajaran   : ______________________________\nTopik Eksperimen : ______________________________\n\nHipotesis: ______________________________\n\nVariabel Bebas      : ______________________________\nVariabel Terikat    : ______________________________\nVariabel Kontrol    : ______________________________\n\nPerlengkapan: ______________________________\n\nProsedur Praktikum:\n1. ________________________________________________\n2. ________________________________________________\n3. ________________________________________________\n4. ________________________________________________\n\nTabel Pengamatan:\n| No | Perlakuan | Hasil | Catatan |\n|----|-----------|-------|---------|\n| 1  | _________ | _____ | _______ |\n| 2  | _________ | _____ | _______ |\n\nAnalisis Data & Kesimpulan:\n________________________________________________\n\nCatatan Keamanan:\n________________________________________________\n\n(_____________________________)",
    },
    {
      id: "rpp5",
      label: "Template Observasi Kelas",
      title: "FORMAT OBSERVASI KELAS",
      body:
        "FORMAT OBSERVASI KELAS\n\nGuru       : ______________________________\nKelas      : ______________________________\nPertemuan  : _____ (ke-)   Tanggal : __/__/2026\nAspek      : (Pembukaan / Inti / Penutup)\n\nSkor 1 (Tidak Pernah) - 5 (Selalu)\n\n1. Guru mengaitkan pelajaran dengan kehidupan sehari-hari\n   Skor: 1 2 3 4 5  | Catatan: __________________\n2. Siswa bertanya / mengajukan pendapat\n   Skor: 1 2 3 4 5  | Catatan: __________________\n3. Penggunaan Media / Sumber Belajar\n   Skor: 1 2 3 4 5  | Catatan: __________________\n4. Interaksi Guru-Siswa\n   Skor: 1 2 3 4 5  | Catatan: __________________\n5. Umpan Balik / Penilaian Formatif\n   Skor: 1 2 3 4 5  | Catatan: __________________\n\nKesimpulan singkat:\n________________________________________________\n\n(_____________________________)",
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
    {
      id: "soal3",
      label: "Template Isian Singkat",
      title: "BANK SOAL ISIAN SINGKAT",
      body:
        "BANK SOAL ISIAN SINGKAT\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\n\nInstruksi: Tuliskan jawaban singkat pada ruang yang tersedia.\n\n1. Definisi __________ adalah ______________________________\n\n2. Tahap __________ terjadi ketika __________________________\n\n3. Faktor utama __________ dapat dikelompokkan menjadi __________\n\n4. Contoh penerapan __________ dalam kehidupan sehari-hari: __________\n\n5. Rumus __________ dipakai untuk ____________________________\n\nKunci Jawaban:\n1. __________  2. __________  3. __________  4. __________  5. __________\n\n(_____________________________)",
    },
    {
      id: "soal4",
      label: "Template Soal Esai",
      title: "BANK SOAL ESAI / URAIAN",
      body:
        "BANK SOAL ESAI / URAIAN\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\n\n1. Jelaskan perbedaan antara __________ dan __________\n   __________________________________________________________________\n   __________________________________________________________________\n\n2. Gambarkan proses __________ dengan diagram alur.\n   __________________________________________________________________\n\n3. Analisis faktor __________ dan beri solusi yang relevan.\n   __________________________________________________________________\n\n4. Evaluasi pernyataan berikut:\n   ________________________________________________\n   Jawabanmu: __________________________________________________________________\n\n5. Buat kesimpulan tentang __________.\n   __________________________________________________________________\n   __________________________________________________________________\n\nRubrik: Kebenaran konsep(0-3) | Kelengkapan(0-3) | Kejelasan(0-2) | Keterkaitan(0-2)\n\nNilai: ____ / 10\n\n(_____________________________)",
    },
    {
      id: "soal5",
      label: "Template Kunci & Pembahasan",
      title: "KUNCI & PEMBAHASAN",
      body:
        "KUNCI & PEMBAHASAN SOAL\n\nMata Pelajaran : ______________________________\nKelas          : ______________________________\nMateri         : ______________________________\n\nNo | Butir Soal          | Kunci | Pembahasan Singkat\n---|---------------------|-------|-----------------\n1  | Isian/PG/Esai       | _____ | __________________\n2  | Isian/PG/Esai       | _____ | __________________\n3  | Isian/PG/Esai       | _____ | __________________\n4  | Isian/PG/Esai       | _____ | __________________\n5  | Isian/PG/Esai       | _____ | __________________\n\nSkor per butir: ___, ___, ___, ___, ___\nKesalahan konsep yang sering muncul:\n________________________________________________\n\nStrategi perbaikan:\n1. ________________________________________________\n2. ________________________________________________\n\n(_____________________________)",
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
    {
      id: "kor3",
      label: "Template Analisis Kesalahan",
      title: "ANALISIS KESALAHAN",
      body:
        "ANALISIS KESALAHAN\n\nNama Siswa       : ______________________________\nKelas            : ______________________________\nMata Pelajaran   : ______________________________\nNo Soal          : ______________________________\n\nJenis Kesalahan (centang):\n[ ] Kesalahan fakta / data\n[ ] Kesalahan konsep / prinsip\n[ ] Kesalahan prosedur / langkah\n[ ] Kesalahan hitung\n[ ] Kesalahan penulisan / ejaan\n\nDeskripsi Kesalahan:\n________________________________________________\n________________________________________________\n\nPenyebab:\n________________________________________________\n\nStrategi Remedial / Intervensi:\n1. ________________________________________________\n2. ________________________________________________\n3. ________________________________________________\n\nFollow-up: ______________________________\n\n(_____________________________)",
    },
    {
      id: "kor4",
      label: "Template Rubrik Penilaian",
      title: "RUBRIK PENILAIAN",
      body:
        "RUBRIK PENILAIAN (Holistik)\n\nAspek Penilaian         | Sangat Baik(4) | Baik(3) | Cukup(2) | Kurang(1)\n1. Kelengkapan isi     | 4:____ | 3:____ | 2:____ | 1:____\n2. Ketepatan konsep    | 4:____ | 3:____ | 2:____ | 1:____\n3. Logika / argumen    | 4:____ | 3:____ | 2:____ | 1:____\n4. Bahasa & ejaan      | 4:____ | 3:____ | 2:____ | 1:____\n5. Penyajian hasil     | 4:____ | 3:____ | 2:____ | 1:____\n\nSkor: _____ / 20\n\nDeskripsi singkat penilaian:\n________________________________________________\n\nSaran pengembangan:\n________________________________________________\n\n(_____________________________)",
    },
    {
      id: "kor5",
      label: "Template Nilai & Deskripsi Rapor",
      title: "NILAI & DESKRIPSI RAPOR",
      body:
        "NILAI & DESKRIPSI RAPOR\n\nNama Siswa     : ______________________________\nNIS/NISN       : ______________________________\nKelas          : ______________________________\nMata Pelajaran : ______________________________\nSemester       : _____\n\nKomponen       | Bobot | Nilai | Deskripsi Singkat\n----------------|-------|-------|------------------\nPengetahuan    | ___%  | ____  | __________________\nKeterampilan   | ___%  | ____  | __________________\nSikap          | ___%  | ____  | __________________\nPartisipasi    | ___%  | ____  | __________________\n\nNilai Akhir: ____ -> (A/B/C/D/E)\n\nDeskripsi Perilaku:\nSikap fokus belajar: ______________________________\nGotong royong    : ______________________________\n\nPengusul: ______________________________\nTanggal: __/__/2026\n\n(_____________________________)",
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
    {
      id: "ba3",
      label: "Template Presentasi Slide",
      title: "SLIDES PERPRESENTASIAN",
      body:
        "SLIDES PERPRESENTASIAN - STRUKTUR 5 SLIDE\n\nSlide 1 : ______________________________ (Judul Presentasi)\nSlide 2 : ______________________________ (Apa Masalah / Hook)\nSlide 3 : ______________________________ (Apa Solusi / Data)\nSlide 4 : ______________________________ (Apa Manfaat / Bukti)\nSlide 5 : ______________________________ (Penutup / Ajukan)\n\nSetiap slide:\n- Hook (kalimat pembuka kuat)      : __________________\n- Visual utama (gambar/ikon)      : __________________\n- CTA (ajakan jelas & urgen)      : __________________\n\nCatatan:\n- Max 6 poin per slide, font minimal 24pt.\n- Hindari tabel penuh, pakai angka/bullet.\n- Warna dominan: ________ | aksen: ________.\n\nDurasi: ____ menit | Target: __________________\n\n(_____________________________)",
    },
    {
      id: "ba4",
      label: "Template Infografis",
      title: "INFOGRAFIS",
      body:
        "INFOGRAFIS - 5 BAGIAN\n\nJudul utama  : ______________________________\nSubjudul     : ______________________________\nFakta 1      : ______________________________ [ikon: _______]\nFakta 2      : ______________________________ [ikon: _______]\nFakta 3      : ______________________________ [ikon: _______]\nSumber data  : ______________________________\nCTA akhir    : ______________________________\n\nLayout:\n- 3 kolom vertikal / grid.\n- Ikon tema: _____ | Warna: primer ______ aksen ______.\n- Font judul: ____ | isi: ____\n\nDimensi: ____ x ____ px | Resolusi: ____ dpi\n\n(_____________________________)",
    },
    {
      id: "ba5",
      label: "Template Diagnostik",
      title: "LEMBAR DIAGNOSTIK",
      body:
        "LEMBAR DIAGNOSTIK\n\nTopik  : ______________________________\nKelas/SK : ______________________________\n\nInstruksi: beri tanda [V] jika pernah / paham, beri alasan singkat bila belum.\n\nNo | Butir / Konsep                                    | Ya | Tidak | Alasan\n---|--------------------------------------------------|----|-------|--------\n1  | Saya pahami ____________________________________ |    |       | ________\n2  | Saya bisa ______________________________________ |    |       | ________\n3  | Saya menerapkan _______________________________ |    |       | ________\n4  | Saya menghubungkan ____________________________ |    |       | ________\n5  | Saya menyimpulkan ____________________________ |    |       | ________\n\nSkor Ya: ____ / 5\nPersiapan: ____% -> (Naik / Ulang / Tambahan)\n\nSaran pengayaan:\n________________________________________________\n\n(_____________________________)",
    },
  ],
  "bedah-jurnal": [
    {
      id: "bj1",
      label: "1. Resume Jurnal Internasional (Scopus/Sinta)",
      title: "LAPORAN BEDAH JURNAL ILMIAH (RESUME)",
      body:
        "LAPORAN BEDAH JURNAL ILMIAH (RESUME)\nJudul Jurnal    : __________________\nPenulis / Tahun : __________________\nNama Jurnal/Vol : __________________\nAkreditasi/Index: __________________ (Scopus Q1-Q4 / Sinta 1-6)\n\nA. ABSTRAK & MASALAH UTAMA\n- Latar Belakang Masalah: __________________\n- Pertanyaan Penelitian : __________________\n\nB. METODOLOGI PENELITIAN\n- Desain Riset / Pendekatan: __________________\n- Populasi & Sampel Terapkan: __________________\n- Teknik Pengumpulan Data  : __________________\n- Teknik Analisis Data     : __________________\n\nC. TEMUAN KUNCI (KEY FINDINGS)\n1. Hasil Analisis Data Utama: __________________\n2. Hubungan Antar Variabel  : __________________\n\nD. FORENSIK JURNAL (CRITICAL REVIEW)\n- Kelebihan Jurnal / Novelty: __________________\n- Kelemahan Riset / Keterbatasan: __________________\n\nE. REKOMENDASI MASA DEPAN & KESIMPULAN\n- Kesimpulan Akhir: __________________\n- Saran Riset Selanjutnya: __________________",
    },
    {
      id: "bj2",
      label: "2. Matriks Sintesis Literatur",
      title: "MATRIKS SINTESIS LITERATUR",
      body:
        "MATRIKS SINTESIS LITERATUR\n\nNo | Sumber (Penulis/Tahun) | Fokus Variabel | Metode | Temuan Utama | Keterbatasan | Relevansi\n---|----------------------|---------------|--------|--------------|--------------|----------\n1  | _____________________ | ____________ | ____________ | ____________ | ____________ | ____________\n2  | _____________________ | ____________ | ____________ | ____________ | ____________ | ____________\n3  | _____________________ | ____________ | ____________ | ____________ | ____________ | ____________\n4  | _____________________ | ____________ | ____________ | ____________ | ____________ | ____________\n5  | _____________________ | ____________ | ____________ | ____________ | ____________ | ____________\n\nGap yang teridentifikasi: ______________________________\n\n(_____________________________)",
    },
    {
      id: "bj3",
      label: "3. Analisis Metodologi Riset",
      title: "ANALISIS METODOLOGI RISET",
      body:
        "ANALISIS METODOLOGI RISET\n\nNama Jurnal : __________________\nTahun / Vol  : __________________\nMetode       : (Eksperimental / Survey / Kualitatif / Kuantitatif / Campuran)\n\n1. Populasi / Sampel: __________________ (Ukuran: ____)\n2. Teknik Sampling  : __________________ (Probabilistik / Non-prob)\n3. Instrumen / Ukuran: __________________\n4. Teknik Analisis Data: __________________\n5. Asumsi / Validitas: __________________\n\nKelemahan Metodologi:\n________________________________________________\n\nSaran Perbaikan Metodologi:\n________________________________________________\n\n(_____________________________)",
    },
    {
      id: "bj4",
      label: "4. Catatan Kritis Kelemahan Jurnal",
      title: "CATATAN KRITIS: KELEMAHAN JURNAL",
      body:
        "CATATAN KRITIS: KELEMAHAN JURNAL\n\nJudul Jurnal : __________________\n1. Sample / Generalisabilitas: __________________\n2. Instrumen / Validitas      : __________________\n3. Desain / Temporal          : __________________\n4. Analisis / Statistik       : __________________\n5. Bias / Konflik Kompetensi  : __________________\n6. Etika Publikasi            : __________________\n\nDampak Kritis: ______________________________\n\n(_____________________________)",
    },
    {
      id: "bj5",
      label: "5. Draft Sitasi & Daftar Pustaka",
      title: "DAFTAR PUSTAKA (SITASI)",
      body:
        "DAFTAR PUSTAKA (SITASI)\n\n1. __________________ (__________________), tahun ____, vol __, hlm ____.\n2. __________________ (__________________), tahun ____, vol __, hlm ____.\n3. __________________ (__________________), tahun ____, vol __, hlm ____.\n4. __________________ (__________________), tahun ____, vol __, hlm ____.\n5. __________________ (__________________), tahun ____, vol __, hlm ____.\n\nFormat: __________________ (APA / MLA / Chicago / Harvard)\nDOI / URL: __________________\nAkses: __ / __ / ____\n\n(_____________________________)",
    },
  ],
  "rangkum-buku": [
    {
      id: "rb1",
      label: "1. Ringkasan Bab Buku Eksklusif",
      title: "RINGKASAN EKSEKUTIF BAB BUKU BACAAN",
      body:
        "RINGKASAN EKSEKUTIF BAB BUKU BACAAN\nJudul Buku    : __________________\nPenulis Buku  : __________________\nPenerbit/Tahun: __________________\nBab / Sub-Bab : __________________ (Judul Bab: __________________)\n\nA. IDENTIFIKASI KONSEP UTAMA\n- Inti Sari Gagasan Penulis: __________________\n- Latar Belakang Teori Bab : __________________\n\nB. POIN PEMBAHASAN SUBSTANSIAL (BULLET POINTS)\n* Poin Utama 1 (__________________): __________________\n* Poin Utama 2 (__________________): __________________\n* Poin Utama 3 (__________________): __________________\n\nC. DAFTAR TOKOH PURBA & TOKOH UTAMA YANG DIKUTIP\n1. Nama Tokoh/Teoretikus: __________________ -> Teori: __________________\n2. Nama Tokoh/Teoretikus: __________________ -> Teori: __________________\n\nD. KESIMPULAN & BENANG MERAH TEORI\n- Kesimpulan Isi Bab Buku: __________________\n- Catatan Kritis Pembaca : __________________",
    },
    {
      id: "rb2",
      label: "2. Peta Konsep Teori Buku",
      title: "PETA KONSEP TEORI BUKU",
      body:
        "PETA KONSEP TEORI BUKU\n\nJudul Buku   : __________________\nTeori Pokok  : __________________\n\nKonsep Utama A: __________________\n- Subkonsep 1: __________________\n- Subkonsep 2: __________________\n\nKonsep Utama B: __________________\n- Subkonsep 1: __________________\n- Subkonsep 2: __________________\n\nKonsep Utama C: __________________\n- Subkonsep 1: __________________\n\nRelasi Antar Konsep: ______________________________\n\nReferensi: ______________________________\n\n(_____________________________)",
    },
    {
      id: "rb3",
      label: "3. Daftar Istilah Penting (Glosarium)",
      title: "GLOSSARIUM / DAFTAR ISTILAH PENTING",
      body:
        "GLOSSARIUM / DAFTAR ISTILAH PENTING\n\nIstilah 1 : ______________________ -> Definisi: ______________________________\nIstilah 2 : ______________________ -> Definisi: ______________________________\nIstilah 3 : ______________________ -> Definisi: ______________________________\nIstilah 4 : ______________________ -> Definisi: ______________________________\nIstilah 5 : ______________________ -> Definisi: ______________________________\nIstilah 6 : ______________________ -> Definisi: ______________________________\n\nSumber istilah: ______________________________\n\n(_____________________________)",
    },
    {
      id: "rb4",
      label: "4. Kutipan Emas & Kutipan Langsung",
      title: "KUTIPAN EMAS & KUTIPAN LANGSUNG",
      body:
        "KUTIPAN EMAS & KUTIPAN LANGSUNG\n\nHalaman : __________________\nTeks penuh: ________________________________________________\nParafraase: ________________________________________________\nRelevansi: ________________________________________________\n\nKutipan 2 (hlm.____): ________________________________________\nParafraase: ________________________________________________\n\nCatatan etika sitasi: ______________________________\n\n(_____________________________)",
    },
    {
      id: "rb5",
      label: "5. Lembar Resume Ringkas Komparasi",
      title: "RESUME KOMPARASI BUKU",
      body:
        "RESUME KOMPARASI (Buku sumber vs Tokoh)\n\nBuku A : __________________ (____ hal)\nBuku B : __________________ (____ hal)\n\nPoin Kesamaan:\n________________________________________________\nPoin Perbedaan:\n________________________________________________\n\nImplikasi Teoritis: ______________________________\n\n(_____________________________)",
    },
  ],
  "kerangka-skripsi": [
    {
      id: "ks1",
      label: "1. Outline Proposal Skripsi Komplit",
      title: "OUTLINE PROPOSAL SKRIPSI MAHASISWA",
      body:
        "OUTLINE PROPOSAL SKRIPSI MAHASISWA\nRencana Judul Skripsi: __________________\nNama / NIM Mahasiswa : __________________\nProgram Studi / Kampus: __________________\nJenis Penelitian     : __________________ (Kuantitatif / Kualitatif / R&D)\n\nBAB I: PENDAHULUAN\n- 1.1 Latar Belakang Masalah: __________________\n- 1.2 Rumusan Masalah Riset: __________________\n- 1.3 Tujuan & Manfaat Riset: __________________\n\nBAB II: TINJAUAN PUSTAKA\n- 2.1 Landasan Teori Utama  : __________________\n- 2.2 Penelitian Terdahulu  : __________________\n- 2.3 Kerangka Berpikir/Hipotesis: __________________\n\nBAB III: METODE PENELITIAN\n- 3.1 Pendekatan & Lokasi   : __________________\n- 3.2 Sumber Data / Sampel  : __________________\n- 3.3 Variabel / Instrumen  : __________________\n- 3.4 Teknik Analisis Data  : __________________\n\nBAB IV & V: RENCANA PEMBAHASAN & KESIMPULAN\n- 4.1 Rencana Fokus Temuan  : __________________\n- 5.1 Target Kesimpulan Akhir: __________________\n\nMengetahui,\nDosen Pembimbing Utama\n\n(_____________________________)",
    },
    {
      id: "ks2",
      label: "2. Struktur Bab II: Landasan Teori",
      title: "BAB II: LANDASAN TEORI",
      body:
        "BAB II: LANDASAN TEORI\n\n1. Landasan Teori Utama: __________________\n   - Konsep Kunci 1: __________________\n   - Konsep Kunci 2: __________________\n\n2. Teori Pendukung: __________________\n   - Prinsip: __________________\n   - Model: __________________\n\n3. Hipotesis / Kerangka Berpikir:\n   - Variabel X (____) <-> Variabel Y (____): __________________\n\nReferensi Teori (min. 3):\n1. __________________\n2. __________________\n3. __________________\n\nKeterkaitan dengan Masalah: __________________\n\n(_____________________________)",
    },
    {
      id: "ks3",
      label: "3. Struktur Bab III: Metode Penelitian",
      title: "BAB III: METODE PENELITIAN",
      body:
        "BAB III: METODE PENELITIAN\n\n1. Jenis Penelitian & Pendekatan: __________________\n2. Lokasi & Populasi/Sampel: __________________ (n=____)\n3. Teknik Pengambilan Sampel: __________________\n4. Instrumen: __________________\n5. Prosedur Pengumpulan Data: __________________\n6. Teknik Analisis Data: __________________\n7. Aspek Keabsahan / Reliabilitas: __________________\n\nJadwal Kegiatan:\nMinggu 1-__: __________________\nMinggu __-__: __________________\n\n(_____________________________)",
    },
    {
      id: "ks4",
      label: "4. Daftar Pertanyaan Wawancara / Kuesioner",
      title: "DRAFT INSTRUMEN: WAWANCARA / KUESIONER",
      body:
        "DRAFT INSTRUMEN: WAWANCARA / KUESIONER\n\nNomor | Pertanyaan / Topik                        | Jenis       | Skor\n------|-------------------------------------------|-------------|---------\n1     | ________________________________________ | Terbuka     | _____\n2     | ________________________________________ | Likert 1-5 | _____\n3     | ________________________________________ | Pilihan G   | _____\n4     | ________________________________________ | Interval    | _____\n5     | ________________________________________ | Checklist   | _____\n\nFokus Kelompok: ________________________________________\nEtika Peneliti: ________________________________________\n\n(_____________________________)",
    },
    {
      id: "ks5",
      label: "5. Matriks Rencana Jadwal Riset (Gantt Chart)",
      title: "MATRIKS JADWAL RISET (Gantt Chart)",
      body:
        "MATRIKS JADWAL RISET (Gantt Chart)\n\nBulan:   1  2  3  4  5  6  7  8  9  10 11 12\n1. Riset pustaka     |__|__|__|__|  |  |  |  |  |  |  |\n2. Pengajuan proposal|__|__|      |  |  |  |  |  |  |  |\n3. Pengumpulan data  |  |  |  |__|__|__|__|  |  |  |  |\n4. Analisis data     |  |  |  |  |  |__|__|__|__|  |  |\n5. Penulisan laporan |  |  |  |  |  |  |  |__|__|__|__\n\nKeterangan: [|] = aktif, [ ] = belum mulai.\n\nMilestone:\n1. __________________ (Bulan ____)\n2. __________________ (Bulan ____)\n3. __________________ (Bulan ____)\n\n(_____________________________)",
    },
  ],
  "tiktok-viral": [
    {
      id: "tv1",
      label: "1. Naskah Konten Jualan Video Pendek",
      title: "DRAF NASKAH KONTEN VIDEO PENDEK (TIKTOK/REELS)",
      body:
        "DRAF NASKAH KONTEN VIDEO PENDEK (TIKTOK/REELS)\nNama Produk/Jasa: __________________\nTarget Audiens   : __________________\nTema / Konsep    : __________________\n\nA. HOOK 3 DETIK PERTAMA (Penarik Perhatikan)\n- Visual Awal Konten : __________________\n- Kalimat Utama (Teks) : __________________\n\nB. STORYLINE / INTI KONTEN (Edukasi / Masalah)\n- Menyoroti Masalah User: __________________\n- Solusi dari Produk Kita: __________________\n- Fitur Unggulan Produk  : __________________\n\nC. CALL TO ACTION (CTA / Ajikan Membeli)\n- Penawaran Spesial (Diskon): __________________\n- Kalimat Paksaan Membeli   : __________________\n\nD. TAGAR & RUMUS VIRAL (HASHTAG ARRAYS)\n#__________________ #__________________ #__________________ #fyp",
    },
    {
      id: "tv2",
      label: "2. Script Video Edukasi Produk (Soft Sell)",
      title: "DRAF SCRIPT VIDEO EDUKASI PRODUK (SOFT SELL)",
      body:
        "DRAF SCRIPT VIDEO EDUKASI PRODUK (SOFT SELL)\nNama Produk: __________________\n\n1. Hook Pembuka : __________________\n2. Isi Inti    : __________________\n   - Fakta/Masalah    : __________________\n   - Solusi Produk    : __________________\n3. Skenario    : __________________\n4. CTA Akhir   : __________________\n\n#__________________ #__________________ #fyp",
    },
    {
      id: "tv3",
      label: "3. Ide Konten Bulanan (Content Calendar)",
      title: "IDE KONTEN BULANAN (CONTENT CALENDAR)",
      body:
        "IDE KONTEN BULANAN (CONTENT CALENDAR)\n\nHari | Tema Konten | Hook Utama | Produk/Fitur | CTA |\n-----|----------------------|------------|---------------|-----|\nSenin | ____________ | ____________ | ____________ | ____________ |\nSelasa | ____________ | ____________ | ____________ | ____________ |\nRabu | ____________ | ____________ | ____________ | ____________ |\nKamis | ____________ | ____________ | ____________ | ____________ |\nJumat | ____________ | ____________ | ____________ | ____________ |\nSabtu | ____________ | ____________ | ____________ | ____________ |\nMinggu | ____________ | ____________ | ____________ | ____________ |\n\nTotal Video: ____  |  Estimasi Views: ____",
    },
    {
      id: "tv4",
      label: "4. Naskah Video Unboxing / Review Real",
      title: "DRAF VIDEO UNBOXING / REVIEW PRODUK",
      body:
        "DRAF VIDEO UNBOXING / REVIEW PRODUK\nProduk: __________________\nHarga: __________________\nRating: ____ / 5\n\n1. Unboxing - Isi paket apa saja: __________________\n2. Kualitas / Bahan: __________________\n3. Fitur unggulan pertama kali pakai: __________________\n4. Plusminus (kelebihan & kekurangan): __________________\n5. Kesimpulan - Worth buy? CTA: __________________\n\n#unboxing #review #__________________ #fyp",
    },
    {
      id: "tv5",
      label: "5. Skrip Balasan Komentar Menjadi Video",
      title: "SKRIP BALASAN KOMENTAR MENJADI VIDEO",
      body:
        "SKRIP BALASAN KOMENTAR MENJADI VIDEO\nKomentar Problematik: __________________\n\n1. Hook (baca ulang komentar): __________________\n2. Empati (akui perasaan komentar): __________________\n3. Solusi (tunjukkan produk): __________________\n4. Sosialisasi keuntungan: __________________\n5. CTA Akhir: __________________\n\n#reply #comment #__________________ #fyp",
    },
  ],
  "caption-ig": [
    {
      id: "ig1",
      label: "1. Caption Jualan Model AIDA (Attention-Interest-Desire-Action)",
      title: "DRAF COPYWRITING CAPTION MEDIA SOSIAL (INSTAGRAM)",
      body:
        "DRAF COPYWRITING CAPTION MEDIA SOSIAL (INSTAGRAM)\nNama Produk : __________________\nFitur Utama : __________________\nHarga Paket : __________________\n\n[ATTENTION - Ambil Perhatian]\n👉 Kalimat Pembuka: __________________\n\n[INTEREST - Bangun Ketertarikan]\n👉 Detail Keunggulan: __________________\n\n[DESIRE - Pancing Keinginan Memiliki]\n👉 Testimoni/Manfaat Gaib: __________________\n\n[ACTION - Ambil Tindakan Klik Beli]\n👉 Link Pembelian / WA: __________________\n\n[HASHTAGS SELEKTIF]\n#__________________ #__________________ #__________________",
    },
    {
      id: "ig2",
      label: "2. Caption Ringkas Model Storytelling",
      title: "CAPTION RINGKAS MODEL STORYTELLING",
      body:
        "CAPTION RINGKAS MODEL STORYTELLING\nNama Produk: __________________\n\n1. Situasi / Awal Cerita: __________________\n2. Konflik / Masalah    : __________________\n3. Solusi / Produk      : __________________\n4. Resolusi / Testimoni : __________________\n5. CTA                  : __________________\n\n#__________________ #__________________ #storytelling #fyp",
    },
    {
      id: "ig3",
      label: "3. Teks Kuis / Giveaway Peningkat Interaksi",
      title: "TEKS KUIS / GIVEAWAY PENINGKAT INTERAKSI",
      body:
        "TEKS KUIS / GIVEAWAY PENINGKAT INTERAKSI\nNama Brand  : __________________\nHadiah       : __________________\nSyarat Ikut  : __________________\n\n1. Ikuti akun ini: __________________\n2. Like post ini    : __________________\n3. Tag 2 teman      : __________________\n4. Share ke story   : __________________\n\n🎉 Bonus: __________________\n\nJadwal: Mulai ____ / ____ / ____  |  Akhir ____ / ____ / ____\nPemenang akan diumumkan: __________________",
    },
    {
      id: "ig4",
      label: "4. Teks Pengumuman Promo Hari Raya / Event",
      title: "TEKS PROMO HARI RAYA / EVENT",
      body:
        "TEKS PROMO HARI RAYA / EVENT\nNama Brand : __________________\nProduk Utama: __________________\nDiskon / Promo: __________________\n\n🎊 PROMO [NAMA EVENT] 🎊\n\n1. Durasi: ____ / ____ / ____ s/d ____ / ____ / ____\n2. Syarat: __________________\n3. CTA: __________________\n\n#__________________ #__________________ #[NAMA_EVENT]",
    },
    {
      id: "ig5",
      label: "5. Mikro-Copywriting Teks Katalog Produk",
      title: "MIKRO-COPYWRITING TEKS KATALOG PRODUK",
      body:
        "MIKRO-COPYWRITING TEKS KATALOG PRODUK\nNama Produk: __________________\nKategori    : __________________\nHarga       : __________________\n\n1. Headline (max 6 kata): __________________\n2. FSA (Feature-Spesial-Argument): __________________\n3. Bukti Sosial: __________________\n4. Penawaran Spesial: __________________\n5. CTA Mikro: __________________",
    },
  ],
  "ide-bisnis": [
    {
      id: "ib1",
      label: "1. Analisis SWOT & Taktik Gerilya",
      title: "CETAK BIRU STRATEGI BISNIS UMKM",
      body:
        "CETAK BIRU STRATEGI BISNIS UMKM\nNama Usaha  : __________________\nJenis Produk: __________________\nSkala Pasar : __________________\n\nA. ANALISIS SWOT MINI\n- Strengths (Kekuatan Internal): __________________\n- Weaknesses (Kelemahan Internal): __________________\n- Opportunities (Peluang Pasar): __________________\n- Threats (Ancaman Pesaing)   : __________________\n\nB. TARGET DEMOGRAFI KONSUMEN\n- Profil Pembeli Ideal: __________________\n\nC. 3 TAKTIK GERILYA LOKAL (LOW BUDGET HIGH IMPACT)\n1. Taktik 1: __________________\n2. Taktik 2: __________________\n3. Taktik 3: __________________\n\nD. PROYEKSI HARGA & VALUE PROPOSITION\n- Alasan Konsumen Wajib Memilih Produk Ini: __________________",
    },
    {
      id: "ib2",
      label: "2. Strategi Menghancurkan Harga Pesaing",
      title: "STRATEGI MENGHANCURKAN HARGA PESAING",
      body:
        "STRATEGI MENGHANCURKAN HARGA PESAING\nNama Produk Kita : __________________\nHarga Kita       : __________________\nHarga Pesaing    : __________________\n\n1. Analisis Harga Pesaing: __________________\n2. Biaya Kami: __________________\n3. Strategi (diskon gila / bundling / gratis ongkir): __________________\n4. Value Perception Boost: __________________\n5. Break-even safety margin: __________________",
    },
    {
      id: "ib3",
      label: "3. Ide Inovasi Varian Produk Baru",
      title: "IDE INOVASI VARIAN PRODUK BARU",
      body:
        "IDE INOVASI VARIAN PRODUK BARU\nProduk Asal : __________________\nMarket Gap  : __________________\n\n1. Varian Baru #1: __________________\n   - Bahan/Desain : __________________\n   - Harga Jual   : __________________\n2. Varian Baru #2: __________________\n   - Bahan/Desain : __________________\n   - Harga Jual   : __________________\n3. Varian Baru #3: __________________\n   - Bahan/Desain : __________________\n   - Harga Jual   : __________________\n\nEstimasi ROI: __________________",
    },
    {
      id: "ib4",
      label: "4. Taktik Optimasi Toko Online / Shopee",
      title: "OPTIMASI TOKO ONLINE / SHOP",
      body:
        "OPTIMASI TOKO ONLINE / SHOP\nLink Toko: __________________\nProduk Unggulan: __________________\n\n1. Judul Produk (SEO): __________________\n2. Deskripsi Produk (keyword): __________________\n3. Foto Produk (9:1, 5 foto): __________________\n4. Varian & Stok: __________________\n5. Diskon / Voucher: __________________\n\nTarget CTR: ____% | Target CR: ____%",
    },
    {
      id: "ib5",
      label: "5. Rencana Kemitraan / Reseller System",
      title: "RENCANA KEMITRAAN / RESELLER",
      body:
        "RENCANA KEMITRAAN / RESELLER\nNama Brand  : __________________\nProduk      : __________________\n\n1. Model Kemitraan: __________________\n2. Syarat Ikut    : __________________\n3. Komisi Reseller: __________________\n4. Support Marketing: __________________\n5. AHP / SOP       : __________________\n\nTarget Reseller: ____ orang | Proyeksi Penjualan: __________________",
    },
  ],
  "bahasa-formal": [
    {
      id: "bf1",
      label: "1. Surat Penawaran Kerjasama Bisnis Resmi",
      title: "SURAT PENAWARAN KERJASAMA BISNIS (B2B)",
      body:
        "SURAT PENAWARAN KERJASAMA BISNIS (B2B)\nNomor Surat: __________________\nHal        : Penawaran Kerjasama Produk __________________\nLampiran   : __________________\n\nKepada Yth.\n__________________\ndi Tempat\n\nDengan hormat,\nPerkenalkan kami dari __________________ yang bergerak di bidang __________________. Melalui surat ini, kami bermaksud menawarkan produk unggulan kami yaitu __________________ untuk menjadi mitra strategis di perusahaan Bapak/Ibu.\n\nAdapun keunggulan produk kami mencakup:\n1. __________________\n2. __________________\n\nBesar harapan kami untuk dapat berdiskusi lebih lanjut dalam sesi presentasi. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat Kami,\n\n\n(_____________________________)\nJabatan: __________________",
    },
    {
      id: "bf2",
      label: "2. Email Resmi Negosiasi Kontrak Kerja",
      title: "EMAIL RESMI NEGOSIASI KONTRAK KERJA",
      body:
        "EMAIL RESMI NEGOSIASI KONTRAK KERJA\n\nKepada Yth. __________________\nPerusahaan: __________________\n\nKami menghargai kerja sama selama ini. Berkenaan dengan pembaharuan kontrak kerja yang akan datang, kami ingin menegaskan secara tertulis hal-hal sebagai berikut:\n\n1. Jangka Waktu  : __________________\n2. Gaji/Upah     : __________________\n3. Tunjangan     : __________________\n4. Tugas & Tanggung Jawab: __________________\n5. Kebijakan     : __________________\n\nKami mengharapkan kesepakatan dapat ditegaskan dalam Kontrak Kerja Tertulis (PKT) yang akan kami tanda tangani paling lambat pada __________________.\n\nHormat kami,\n\n(_____________________________)",
    },
    {
      id: "bf3",
      label: "3. Teks Surat Pengunduran Diri Profesional",
      title: "SURAT PENGUNDURAN DIRI PROFESIONAL",
      body:
        "SURAT PENGUNDURAN DIRI PROFESIONAL\nNomor Surat: __________________\nHal        : Pengunduran Diri\n\nKepada Yth.\n__________________\ndi Tempat\n\nSehubungan dengan keputusan saya untuk beralih ke perusahaan lain / kembali ke pekerjaan akademisi, saya dengan hormat mengajukan pengunduran diri saya dari posisi sebagai __________________ dengan tanggal __________________.\n\nSaya menyampaikan:\n1. Peran terakhir yang saya pegang: __________________\n2. Proyek yang sedang dikelola: __________________\n3. Penanggung jawab lanjutan: __________________\n\nSaya berterima kasih atas kesempatan dan pengalaman belajar yang diberikan. Saya akan membantu proses penyelesaian sampai akhir kontrak / masa transisi selama __________________.\n\nHormat kami,\n\n(_____________________________)",
    },
    {
      id: "bf4",
      label: "4. Teks Surat Teguran / Somasi Formal",
      title: "SURAT TEGURAN / SOMASI FORMAL",
      body:
        "SURAT TEGURAN / SOMASI FORMAL\nNomor Surat: __________________\nHal        : Teguran / Somasi\n\nKepada Yth.\n__________________\ndi Tempat\n\nDengan hormat,\nSehubungan dengan pelanggaran yang terjadi pada __________________ terhadap __________________, kami sebagai wakil hukum / pengelola kami mengirimkan surat teguran / somasi formal ini untuk:\n\n1. Pelanggaran yang terjadi : __________________\n2. Bukti Pendukung          : __________________\n3. Dampak Pelanggaran       : __________________\n\nKami memberikan kesempatan untuk memberikan tanggapan tertulis dalam waktu _____ (_____ ) hari terhitung sejak penerimaan surat ini. Apabila tidak ada tanggapan yang memuaskan, kami berhak mengambil langkah lanjutan sesuai hukum yang berlaku.\n\nHormat kami,\n\n(_____________________________)",
    },
    {
      id: "bf5",
      label: "5. Proposal Singkat Pengajuan Dana Investor",
      title: "PROPOSAL PENGAJUAN DANA INVESTOR",
      body:
        "PROPOSAL PENGAJUAN DANA INVESTOR\n\nNama Startup    : __________________\nBidang Usaha    : __________________\nPermintaan Dana : __________________\n\n1. Problem / Market Gap : __________________\n2. Solusi Produk/Kami   : __________________\n3. Model Bisnis / Revenue : __________________\n4. Target Pasar / TAM    : __________________\n5. Proyeksi Keuntungan (ROI) 12 bulan: __________________\n\nKami mengajukan investasi sebesar __________________ dengan porsi __________________%.\n\nHormat kami,\n\n(_____________________________)",
    },
  ],
  "chat-ai": UMUM_CHAT_TEMPLATES,
  "obrolan-bebas": UMUM_CHAT_TEMPLATES,
  "audio-mp3": UMUM_AUDIO_TEMPLATES,
  "audio-mp3-manusia": UMUM_AUDIO_TEMPLATES,
  "generator-propaganda": UMUM_PROPAGANDA_TEMPLATES,
};

const FONTS = {
  sans: "'Segoe UI', system-ui, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Consolas, monospace",
} as const;

type DocFont = keyof typeof FONTS;

/* ===== 14 WATAK SUARA PREMIUM =====
   id wajib sinkron dengan whitelist & voiceConfig di app/api/ai/tts/route.ts */
type AudioCategory = "laki" | "perempuan";

interface AudioVoiceOption {
  id: string;
  cat: AudioCategory;
  emoji: string;
  label: string;
  desc: string;
}

const AUDIO_VOICES: AudioVoiceOption[] = [
  // ===== KATEGORI LAKI-LAKI (SEKAT KIRI) =====
  { id: "pria-formal-wibawa", cat: "laki", emoji: "👔", label: "1. Formal, Berat & Berwibawa", desc: "Tegas, berat, penuh wibawa — untuk sambutan resmi" },
  { id: "pria-santai-gaul", cat: "laki", emoji: "😎", label: "2. Santai, Akrab & Gaul", desc: "Bersahabat dan santai, gaya anak muda kekinian" },
  { id: "pria-energik-iklan", cat: "laki", emoji: "🔥", label: "3. Energetik, Teriak Hype & IKLAN", desc: "Ledakan semangat penuh hype, sakti untuk iklan" },
  { id: "pria-karismatik-sepuh", cat: "laki", emoji: "🧔", label: "4. Karismatik, Sepuh & Berwawasan", desc: "Dewasa, bijaksana, kharismatik — khas motivator" },
  { id: "pria-naratif-dokumenter", cat: "laki", emoji: "🎬", label: "5. Naratif, Mengalir & Dokumenter", desc: "Alur tutur halus dan dramatis, khas dokumenter" },
  { id: "pria-anak-cowok", cat: "laki", emoji: "🧒", label: "6. Polos, Lucu & Anak-Anak (Cowok)", desc: "Ceria, polos, menggemaskan, gaya anak laki-laki" },
  { id: "pria-seram-film", cat: "laki", emoji: "🎃", label: "7. Seram, Berat & Kharismatik Film", desc: "Dalam, mencekam, tegas — khas trailer horor" },
  // ===== KATEGORI PEREMPUAN (SEKAT KANAN) =====
  { id: "wanita-luwes-manja", cat: "perempuan", emoji: "💗", label: "8. Luwes, Lembut & Manja", desc: "Lembut, manja, akrab — hangat dan menyentuh" },
  { id: "wanita-ceria-antusias", cat: "perempuan", emoji: "✨", label: "9. Ceria, Cepat & Antusias", desc: "Energik, ringan, cerah — khas host konten viral" },
  { id: "wanita-dewasa-bijak", cat: "perempuan", emoji: "🤱", label: "10. Dewasa, Keibuan & Bijak", desc: "Tenang, hangat, menyejukkan — khas ibu bijak" },
  { id: "wanita-formal-korporat", cat: "perempuan", emoji: "💼", label: "11. Formal, Tegas & Korporat", desc: "Profesional, jelas, berwibawa — gaya korporat" },
  { id: "wanita-bisik-asmr", cat: "perempuan", emoji: "🎧", label: "12. Bisik-Bisik, Lembut ASMR", desc: "Berbisik halus dan menenangkan, lembut di telinga" },
  { id: "wanita-anak-cewek", cat: "perempuan", emoji: "👧", label: "13. Polos, Lucu & Anak-Anak (Cewek)", desc: "Imut, ceria, polos — khas dongeng anak" },
  { id: "wanita-seksi-elegan", cat: "perempuan", emoji: "🌹", label: "14. Seksi, Elegan & Premium Luxury", desc: "Mewah, anggun, berkelas — untuk produk premium" },
];

/* Satu baris pilihan gaya suara — hover menyala, klik set/hilang centang */
function VoiceStyleItem({ v, selected, onToggle }: { v: AudioVoiceOption; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(v.id)}
      title={v.desc}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all active:scale-[0.98] ${
        selected
          ? "border-amber-400/80 bg-amber-400/15 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
          : "border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:border-amber-400/50 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(251,191,36,0.2)]"
      }`}
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-md border shrink-0 transition-all ${
          selected ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-600 bg-slate-950 text-transparent"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5" />}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[10px] font-bold leading-tight">{v.label}</span>
        <span className="text-[8px] text-slate-400 leading-tight truncate">{v.desc}</span>
      </span>
    </button>
  );
}

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
  const [confirmModal, setConfirmModal] = useState<"delete-checked" | "delete-all" | "delete-chat" | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // --- SEKAT 3 : GENERATE AUDIO (khusus fitur audio-mp3) ---
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioVoice, setAudioVoice] = useState<string>("");
  const [audioStatus, setAudioStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- SEKAT 2 : KERTAS DOKUMEN MURNI ---
  const [docText, setDocText] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const templatePickerRef = useRef<HTMLDivElement>(null);
  // Tutup dropdown TEMPLATE saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!showTemplatePicker) return;
    const onDown = (e: MouseEvent) => {
      if (
        templatePickerRef.current &&
        !templatePickerRef.current.contains(e.target as Node)
      ) {
        setShowTemplatePicker(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTemplatePicker(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showTemplatePicker]);
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
  // 🔍 Zoom lembar kertas (skala kertas, BUKAN ukuran kolom) — agar user bisa lihat 1 lembar penuh atau memperbesar tampilan.
  const [paperScale, setPaperScale] = useState(100);
  const bumpPaperScale = (d: number) => setPaperScale((s) => Math.min(220, Math.max(40, s + d)));

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
    setConfirmModal(null);
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
    setDocText(tpl.body ? tpl.title + "\n" + "=".repeat(26) + "\n\n" + tpl.body : "");
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
  // RAPIKAN TEKS — normalisasi seluruh teks di kolom dokumen (hasil AI,
  // hasil diskusi AI, maupun isi template yang sudah diedit oleh user) agar
  // rapi & siap diekspor ke MS Word. Hapus spasi/jarak berulang & baris kosong.
  const handleRapikan = () => {
    const clean = (docText ?? "")
      .replace(/\r\n/g, "\n") // CRLF -> LF
      .replace(/[ \t]+$/gm, "") // buang trailing whitespace per baris
      .replace(/^\s+/gm, "") // buang leading whitespace per baris
      .replace(/[ ]{2,}/g, " ") // run spasi ganda -> 1 spasi
      .replace(/\n{3,}/g, "\n\n") // 3+ baris kosong berturut-turut -> 1 baris kosong
      .trim();
    setDocText(clean);
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

  /* ====== GENERATE AUDIO — ubah teks kolom dokumen menjadi MP3 (khusus audio-mp3) ====== */
  const handleGenerateAudio = async () => {
    if (audioStatus === "processing") return;
    if (!docText.trim()) {
      setAudioStatus("error");
      setAudioErr("Kolom dokumen masih kosong. Silakan tulis / isi teks dulu di kertas dokumen kanan.");
      return;
    }
    if (!audioVoice) {
      setAudioStatus("error");
      setAudioErr("Silakan pilih salah satu dari 14 gaya bahasa suara terlebih dahulu.");
      return;
    }
    setAudioStatus("processing");
    setAudioErr(null);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: docText.slice(0, 5000), voice: audioVoice }),
      });
      if (!res.ok) {
        let msg = "Gagal membuat audio. Silakan coba lagi.";
        try {
          const data = (await res.json()) as { error?: string } | null;
          if (data && data.error) msg = String(data.error);
        } catch {
          /* body bukan JSON */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Audio kosong. Silakan coba lagi.");
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioStatus("done");
    } catch (e) {
      setAudioStatus("error");
      setAudioErr(e instanceof Error ? e.message : "Gagal membuat audio. Silakan coba lagi.");
    }
  };

  const handlePlayAudio = () => {
    audioRef.current?.play().catch(() => {
      /* pemutar butuh interaksi langsung user */
    });
  };
  const handleStopAudio = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  };
  const handleDownloadAudio = () => {
    if (!audioUrl || audioStatus !== "done") return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `ai-nusantara-audio-${audioVoice}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="aiw-root" className="relative w-full h-full max-h-full overflow-hidden">
      {/* Cetak A4 — hanya lembar kertas yang dicetak (chrome aplikasi disembunyikan, zoom 100%). */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #aiw-doc-paper, #aiw-doc-paper * { visibility: visible !important; }
          #aiw-doc-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            max-width: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            zoom: 1 !important;
          }
          #aiw-root, #aiw-pane, #aiw-scroll, #aiw-paper-wrap {
            overflow: visible !important;
            position: static !important;
            height: auto !important;
          }
        }
      `}</style>
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
                onClick={() => setConfirmModal("delete-chat")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/40 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-red-300 transition-all active:scale-95"
                title="Kosongkan ruang obrolan aktif (butuh konfirmasi dulu)"
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
                        <p
              id="ai-disclaimer"
              className="text-center text-[9px] leading-snug text-amber-400/90 mt-1.5 px-1"
            >
              ⚠️ Disclaimer : AI dapat menghasilkan informasi yang tidak akurat. Mohon verifikasi kembali informasi dan dokumen yang dihasilkan.
            </p>
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
          id="aiw-pane"
          className={
            docZoomed
              ? "fixed inset-0 z-50 m-auto w-[86vw] h-[86vh] overflow-auto flex flex-col bg-[var(--paper-bg)] p-3 rounded-2xl border border-slate-700/70 shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
              : "w-[55%] min-w-0 h-full flex flex-col rounded-2xl border border-yellow-400/30 bg-black/40 overflow-hidden backdrop-blur-xl"
          }
          style={docZoomed ? { width: "86vw" } : undefined}
        >
          {/* Panel tombol kontrol kertas — 2 BARIS
            B1: Blank | Template | Rapikan | Salin | Word
            B2: Edit | Font | A+ | A- | Zoom+ | Zoom- */}
          <div className="shrink-0 border-b border-yellow-400/30 bg-black/40 p-1.5 flex flex-col gap-1.5">
            {/* Baris 1: BLANK | TEMPLATE | RAPIKAN TEKS | SALIN | EKSPOR MS.WORD */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={handleBlank}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title="Kosongkan kertas dokumen"
              >
                📄 DUKOMEN (Blank)
              </button>

              {/* Tombol TEMPLATE tunggal — saat ditekan menyembul kolom pilihan template */}
              <div ref={templatePickerRef} className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-amber-300 transition-all active:scale-95 ${showTemplatePicker ? "ring-2 ring-amber-400" : ""}`}
                  title="Pilih template resmi untuk mengisi kertas dokumen"
                >
                  {showTemplatePicker ? "📂" : "📁"} PILIHAN TEMPLATE{" "}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTemplatePicker ? "rotate-180" : ""}`} />
                </button>

                {/* Kolom pilihan template menyembul — diisi dari activeTemplates / FEATURE_TEMPLATES */}
                                {showTemplatePicker && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] max-h-72 overflow-y-auto rounded-xl border border-yellow-400/30 bg-[var(--template-dropdown-bg)] shadow-[0_8px_30px_rgba(0,0,0,0.8)]">
                    {activeTemplates.length === 0 ? (
                      <div className="px-3 py-2 text-[10px] text-slate-500">
                        (belum ada template — akan diisi nanti)
                      </div>
                    ) : (
                      activeTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            handleTemplate(t);
                            setShowTemplatePicker(false);
                          }}
                          className="flex flex-col w-full text-left px-3 py-2 border-b border-transparent last:border-0 hover:bg-black/40 hover:border-yellow-400/30 text-[10px] text-slate-200 transition-all"
                          title={`Isi kertas dengan: ${t.title}`}
                        >
                          <span className="font-black text-amber-300">{t.label}</span>
                          <span className="text-slate-400">{t.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* RAPIKAN TEKS — bersihkan seluruh teks kolom dokumen, siap export Word */}
              <button
                type="button"
                onClick={handleRapikan}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title="Rapikan seluruh teks di kertas dokumen (hasil AI + diskusi + template) — siap export Word"
              >
                🧹 RAPIKAN TEKS
              </button>

              {/* SALIN */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title="Salin 100% teks dokumen ke clipboard"
              >
                <Copy className="w-3 h-3" /> Salin
              </button>

              {/* EKSPOR MS.WORD */}
              <button
                type="button"
                onClick={handleExportWord}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[9px] font-black uppercase tracking-wider text-amber-300 transition-all active:scale-95"
                title="Unduh teks dokumen sebagai file Word .doc"
              >
                <FileText className="w-3 h-3" /> Ekspor MS.Word
              </button>
            </div>
            {/* Baris 2: EDIT | FONT | A+ | A- | ZOOM+ | ZOOM- */}
            <div className="flex flex-wrap items-center gap-1">
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
                {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}{isLocked ? "Gembok" : "Edit"}
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
                onClick={() => bumpPaperScale(-10)}
                className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-black text-white transition-all active:scale-95"
                title="Perkecil lembar dokumen — lihat satu halaman penuh"
              >
                📄 −
              </button>
              <button
                type="button"
                onClick={() => bumpPaperScale(10)}
                className="px-2 py-1.5 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-black text-white transition-all active:scale-95"
                title="Perbesar lembar dokumen — tampilan lebih dekat"
              >
                📄 +
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
              {featureId === "audio-mp3" && (
                <button
                  type="button"
                  onClick={() => setShowAudioModal(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-amber-400/50 bg-amber-400/15 hover:bg-amber-400/25 text-[9px] font-black uppercase tracking-wider text-amber-300 transition-all active:scale-95"
                  title="Ubah teks dokumen menjadi audio MP3 (pilih gaya suara)"
                >
                  🔊 Generate Audio
                </button>
              )}
              <span className="ml-auto text-[9px] font-mono text-slate-500">
                📄 {paperScale}% · {fontSize}px
              </span>
            </div>
          </div>

          {/* Kontainer kertas — tinggi terkunci kaku, gulung hanya di dalam sekat kanan */}
          <div id="aiw-scroll" className="flex-1 overflow-auto pr-1">
            <div id="aiw-paper-wrap" className="px-1 pt-2 pb-6">
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
                  zoom: paperScale / 100,
                }}
                id="aiw-doc-paper"
                className="mx-auto w-[210mm] min-h-[297mm] rounded-lg bg-white text-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.55)] p-8 outline-none whitespace-pre-wrap leading-relaxed"
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
                : confirmModal === "delete-chat"
                  ? "Apakah Anda yakin ingin menghapus obrolan ini?"
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
                onClick={() => {
                  if (confirmModal === "delete-all") handleDeleteAll();
                  else if (confirmModal === "delete-chat") handleClearHistory();
                  else handleDeleteChecked();
                }}
                className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-500/40 text-white text-[10px] font-bold transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL GENERATE AUDIO — khusus fitur audio-mp3 ===== */}
      {showAudioModal && featureId === "audio-mp3" && (
        <>
          <div className="fixed inset-0 z-[45] bg-black/85" onClick={() => setShowAudioModal(false)} />
          <div className="fixed inset-0 z-[55] m-auto w-[86vw] h-[86vh] overflow-auto flex flex-col bg-slate-950 p-3 rounded-2xl border border-slate-600 shadow-[0_25px_80px_rgba(0,0,0,0.8)]">
            {/* Header — judul PILIH GAYA BAHASA */}
            <div className="shrink-0 flex items-center justify-between gap-2 pb-2 border-b border-yellow-400/30 bg-slate-900 rounded-lg px-3 py-2.5">
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                🗣️ PILIH GAYA BAHASA{" "}
                <span className="text-slate-400 normal-case tracking-normal">
                  · 14 Watak Suara Premium — Teks Dokumen → MP3
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAudioModal(false)}
                className="px-2.5 py-1 rounded-lg border border-yellow-400/30 bg-black/60 hover:bg-black/80 text-[10px] font-bold text-white transition-all active:scale-95"
                title="Tutup panel audio"
              >
                ✕ Tutup
              </button>
            </div>

            {/* ===== PILIH GAYA — 2 SEKAT (LAKI-LAKI kiri | PEREMPUAN kanan) ===== */}
            <div className="shrink-0 grid grid-cols-2 gap-3 py-2.5">
              {/* SEKAT KIRI — KATEGORI LAKI-LAKI */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-sky-500/30 bg-slate-900 p-2.5 min-w-0">
                <p className="flex items-center gap-1.5 px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-sky-300">
                  👨 Kategori Laki-laki
                </p>
                {AUDIO_VOICES.filter((v) => v.cat === "laki").map((v) => (
                  <VoiceStyleItem
                    key={v.id}
                    v={v}
                    selected={audioVoice === v.id}
                    onToggle={(id) => setAudioVoice((prev) => (prev === id ? "" : id))}
                  />
                ))}
              </div>

              {/* SEKAT KANAN — KATEGORI PEREMPUAN */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-pink-500/30 bg-slate-900 p-2.5 min-w-0">
                <p className="flex items-center gap-1.5 px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-pink-300">
                  👩 Kategori Perempuan
                </p>
                {AUDIO_VOICES.filter((v) => v.cat === "perempuan").map((v) => (
                  <VoiceStyleItem
                    key={v.id}
                    v={v}
                    selected={audioVoice === v.id}
                    onToggle={(id) => setAudioVoice((prev) => (prev === id ? "" : id))}
                  />
                ))}
              </div>
            </div>
            {/*PART1*/}

            {/* BARIS 1 : Penampil audio / status proses */}
            <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl border border-yellow-400/30 bg-slate-900 p-4">
              {audioStatus === "processing" ? (
                <div className="flex flex-col items-center gap-2 text-amber-300">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-wider">Sedang Memproses…</p>
                  <p className="text-[10px] text-slate-400">
                    AI sedang mengubah teks dokumen menjadi audio berkualitas…
                  </p>
                </div>
              ) : audioStatus === "error" ? (
                <div className="flex flex-col items-center gap-2 text-red-300 text-center max-w-md">
                  <p className="text-xs font-bold">⚠️ Terjadi kendala</p>
                  <p className="text-[10px]">{audioErr}</p>
                  <button
                    type="button"
                    onClick={() => setAudioStatus("idle")}
                    className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-black/40 hover:bg-black/60 text-[10px] font-bold text-white transition-all"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : audioStatus === "done" && audioUrl ? (
                <div className="w-full max-w-xl flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handlePlayAudio}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-400/50 bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-300 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95"
                      title="Putar audio"
                    >
                      <Play className="w-5 h-5" /> Putar
                    </button>
                    <button
                      type="button"
                      onClick={handleStopAudio}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl border border-red-400/50 bg-red-400/15 hover:bg-red-400/25 text-red-300 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95"
                      title="Stop audio"
                    >
                      <Square className="w-5 h-5" /> Stop
                    </button>
                  </div>
                  <audio ref={audioRef} src={audioUrl} controls className="w-full rounded-lg" />
                  <p className="text-center text-[9px] text-slate-400">
                    ✅ Audio selesai dibuat dengan gaya “{AUDIO_VOICES.find((v) => v.id === audioVoice)?.label ?? audioVoice}”
                    — tekan <b className="text-emerald-300">Putar</b> untuk mendengarnya.
                  </p>
                </div>
              ) : (
                <div className="text-center max-w-md">
                  <div className="text-4xl">🎧</div>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    Teks dari kolom dokumen akan diubah menjadi audio MP3 dengan gaya suara pilihanmu.
                    <br />
                    <span className="text-amber-400">Klik tombol 🔊 Generate Audio di bawah</span> untuk mulai.
                  </p>
                </div>
              )}
            </div>
            {/*PART2*/}

            {/* BARIS 2 — KEMBALI (kiri) | GENERATE AUDIO (tengah) | DOWNLOAD AUDIO (kanan) */}
            <div className="shrink-0 flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAudioModal(false)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-yellow-400/30 bg-black/40 hover:bg-black/60 text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                title="Tutup panel GENERATE AUDIO"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={handleGenerateAudio}
                disabled={audioStatus === "processing"}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-amber-400/50 bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider text-amber-300 transition-all active:scale-95"
                title="Suruh AI membuat audio dari teks dokumen"
              >
                {audioStatus === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses…
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" /> Generate Audio
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadAudio}
                disabled={audioStatus !== "done"}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-400/50 bg-emerald-400/15 hover:bg-emerald-400/25 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider text-emerald-300 transition-all active:scale-95"
                title="Unduh audio MP3 yang sudah dihasilkan"
              >
                <Download className="w-4 h-4" /> Download Audio
              </button>
            </div>
          </div>
        </>
          )}
    </div>
  );
}