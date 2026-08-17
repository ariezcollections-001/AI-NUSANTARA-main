/**
 * AI-NUSANTARA — Feature Lock Mode (Topic Guard) — STEP 8.
 * Pembatasan DETERMINISTIK (server-side) agar AI tak pernah "buta fitur"
 * atau menjawab/melayani topik di luar ruang lingkup fitur yang dipilih.
 * Dipanggil oleh /api/ai/talk SEBELUM request ke provider; bila offTopic,
 * route kembalikan 400 + saran fitur lain. Melengkapi (bukan mengganti)
 * ON_TOPIC_ENFORCEMENT di lib/aiStrictEngine.ts yang bersifat instruksi teks.
 */
import { FEATURE_CATALOG, getCatalogFeature } from "@/lib/featureCatalog";
import type { CatalogFeature } from "@/lib/featureCatalog";

export interface TopicDecision {
  offTopic: boolean;
  reason?: string;
  /** Nama fitur (human readable) yang disarankan — boleh kosong. */
  suggestedFeature?: string;
  /** Slug fitur yang disarankan (untuk UI ganti kolom). */
  suggestedSlug?: string;
}

/** Fitur "umum" — obrolan bebas, tidak dilindungi topik guard. */
const FREE_FEATURES = new Set<string>(["chat-ai"]);

/**
 * Kata kerja manipulasi kertas dokumen — SELALU on-topic.
 * Berlaku semua fitur agar koreksi/edit/hapus dokumen tak pernah diblokir.
 */
const EDIT_VERBS: ReadonlyArray<string> = [
  "ubah", "ganti", "edit", "revisi", "koreksi", "perbaiki", "perbaikin",
  "hapus", "hapus bagian", "hapus sebagian", "tambah", "tambahkan",
  "perbanyak", "perluas", "perlebar", "ringkas", "merangkum",
  "terjemah", "terjemahkan", "sesuaikan", "lengkapi", "lengkapan",
  "ganti kata", "ganti kalimat", "ganti judul", "ganti paragraf",
  "poles", "koreksi kata", "perbaiki kalimat", "perbaiki kata",
  "sisipkan", "sisip", "ganti urutan", "atur ulang", "hapuskan",
  "update", "rubah", "tuliskan", "masukkan",
];

/** Kata kunci sapaan — pesan ini boleh lewat (biarkan AI menyapa). */
const GREETING_WORDS = new Set<string>([
  "hai", "halo", "hi", "hey", "selamat", "tes", "test", "coba", "cobain",
  "siapa", "kabar", "semuanya", "permisi", "terima", "kasih", "makasih",
  "dong", "tolong", "iya", "yes", "mantap", "oke", "ok", "senang",
]);
/**
 * Kata penghenti (stopwords) + kata generik tugas, bukan domain spesifik fitur.
 */
const STOPWORDS: ReadonlySet<string> = new Set<string>([
  "yang", "dan", "atau", "di", "ke", "dari", "untuk", "dengan", "sebuah",
  "saya", "kamu", "anda", "kita", "kami", "dia", "mereka", "ini", "itu",
  "dokumen", "kertas", "isi", "mengisi", "field", "pertanyaan", "pilih",
  "masukkan", "buat", "tulis", "kembali", "lihat", "baca", "tampilkan",
  "tanyakan", "ingin", "mau", "bisa", "dapat", "harus", "perlu", "sudah",
  "belum", "saja", "juga", "lebih", "sangat", "apakah", "bagaimana", "cara",
  "kenapa", "kapan", "berapa", "mana", "mohon", "silakan", "silahkan", "maaf",
]);

/** Kata kunci domain masing-masing fitur (diperluas; amnah cross-attribution). */
const FEATURE_DOMAIN: Record<string, string[]> = {
  "gen-rpp": ["rpp", "perangkat", "pembelajaran", "belajar", "kurikulum", "merdeka",
    "profil", "pancasila", "pelajar", "asesmen", "diagnostik", "formatif",
    "sumatif", "rubrik", "lkpd", "kdt", "kompetensi", "sikap", "afektif", "psikomotor",
    "sarana", "prasarana", "kelas", "mapel", "mata pelajaran", "remedial", "alokasi",
    "bobot", "durasi", "penilaian", "kriteria", "standar", "kkm", "pbl"],
  "buat-soal": ["soal", "bank", "hots", "stimulus", "pilihan", "ganda", "esai",
    "kunci", "jawaban", "pembahasan", "indikator", "kesulitan", "bobot", "butir",
    "ambang", "distraktor", "pg", "pilgan", "uraian", "essay", "opsi"],
  "koreksi-tugas": ["koreksi", "komentar", "rubrik", "skor", "nilai", "feedback",
    "balik", "penilaian", "perbaiki", "peringkatan", "deskriptif", "kompetensi"],
  "bahan-ajar": ["bahan", "ajar", "modul", "materi", "slide", "presentasi",
    "handout", "tema", "inset", "ringkasan", "lembar", "kuis"],
  "bedah-jurnal": ["jurnal", "riset", "penelitian", "metodologi", "abstrak",
    "literatur", "referensi", "analisis", "metode", "kuantitatif", "kualitatif",
    "paper", "variabel", "hipotesis", "diskusi", "temuan"],
  "rangkum-buku": ["buku", "rangkum", "ringkasan", "sinopsis", "bab", "isbn",
    "penulis", "penerbit", "tokoh", "alur", "halaman"],
  "kerangka-skripsi": ["skripsi", "kerangka", "bab", "pendahuluan", "metodologi",
    "hasil", "pembahasan", "simpulan", "pustaka", "abstrak", "latar", "rumusan"],
  "tiktok-viral": ["tiktok", "viral", "konten", "trend", "hook", "caption",
    "suara", "musik", "challenge", "duet", "video", "algoritma", "engagement",
    "fyp", "reel", "short"],
  "caption-ig": ["instagram", "copywriting", "posting", "engagement", "hook",
    "story", "reel", "bio", "cta", "like", "komen"],
  "ide-bisnis": ["bisnis", "umkm", "modal", "pasar", "margin", "swot",
    "eksekusi", "ide", "usaha", "pendanaan", "keuntungan", "profit", "omzet"],
  "bahasa-formal": ["formal", "profesional", "korporat", "kbbi", "puebi", "surat",
    "email", "kalimat", "efektif", "tata", "bahasa", "naskah"],
  "audio-mp3": ["audio", "mp3", "narasi", "voice", "over", "script", "suara",
    "podcast", "iklan", "emosi", "jeda", "voiceover"],
  "generator-propaganda": ["propaganda", "kampanye", "posisi", "persuasi",
    "etika", "verifikasi", "fakta", "audiens"],
};
/** Kata kunci domain suatu fitur: curated + yang terekstrak dari katalog. */
function domainKeywords(cat: CatalogFeature): string[] {
  const curated = (FEATURE_DOMAIN[cat.feature_slug] ?? []).map((s) => s.toLowerCase());
  const derived = [...(cat.doc_sections ?? []), cat.feature_name, cat.seo_title, cat.seo_description]
    .join(" ")
    .toLowerCase()
    .split(/[\s(),;/.:-\u00C0-\u024F]+/)
    .filter((t) => t.length >= 3);
  return Array.from(new Set([...curated, ...derived]));
}

/** Tokenisasi sederhana, membuang stopwords (lowercase). */
function substantiveTokens(text: string): string[] {
  return text
    .split(/[\s,.;:!?()\n\r]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Apakah pesan hanya berupa sapaan/generik? → boleh lewat. */
function isGreeting(text: string): boolean {
  const toks = text
    .replace(/[\s.,;:!?\n\r()]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!toks.length) return true;
  return toks.every((t) => GREETING_WORDS.has(t));
}

/** Skor kecocokan antara pesan dan kata kunci domain sebuah fitur. */
function overlapScore(text: string, kw: string[]): number {
  let s = 0;
  for (const k of kw) {
    const parts = k.split(/[\s()_-]+/).filter((x) => x.length >= 3);
    if (parts.length === 0) continue;
    if (parts.every((p) => text.includes(p))) s += 2; // frasa utuh
    else if (parts.some((p) => text.includes(p))) s += 1; // sebagian
  }
  return s;
}

/** Sarankan fitur lain yang paling cocok (atau Chat AI bila tak ada). */
function suggestFeature(text: string, currentSlug: string) {
  let best: { name: string; slug: string; score: number } | undefined;
  for (const f of FEATURE_CATALOG) {
    if (f.feature_slug === currentSlug || FREE_FEATURES.has(f.feature_slug)) continue;
    const score = overlapScore(text, domainKeywords(f));
    if (score > 0 && (!best || score > best.score)) {
      best = { name: f.feature_name, slug: f.feature_slug, score };
    }
  }
  if (!best) {
    const chat = getCatalogFeature("chat-ai");
    if (chat) best = { name: chat.feature_name, slug: chat.feature_slug, score: 0 };
  }
  return best ? { name: best.name, slug: best.slug } : undefined;
}

/**
 * Apakah pesan `message` berada di luar ruang lingkup `feature`?
 * `docText` disertakan untuk konteks (disiapkan untuk Step 5 memori).
 *
 * Urutan: bebas obrolan → sapaan/generik → edit dokumen → ada kata kunci
 * domain fitur aktif → substansif tapi nol kecocokan → off-topic.
 */
export function isOffTopic(feature: string, message: string, _docText = ""): TopicDecision {
  const f = (feature ?? "").trim().toLowerCase();
  const text = (message ?? "").trim().toLowerCase();

  if (!f || FREE_FEATURES.has(f)) return { offTopic: false };
  if (!text) return { offTopic: false };
  if (isGreeting(text)) return { offTopic: false };
  for (const v of EDIT_VERBS) if (text.includes(v)) return { offTopic: false };

  const cat = getCatalogFeature(f);
  const featKw = cat ? domainKeywords(cat) : [];
  if (featKw.length > 0 && overlapScore(text, featKw) > 0) return { offTopic: false };

  // Substantif tapi tak matching domain fitur aktif → off-topic.
  if (substantiveTokens(text).length === 0) return { offTopic: false };
  const sug = suggestFeature(text, f);
  const featName = cat?.feature_name ?? f;
  return {
    offTopic: true,
    reason:
      "Ini di luar ruang lingkup fitur \"" +
      featName +
      "\". Saya hanya mendukung topik pada '" +
      featName +
      "'" +
      (sug ? ". Silakan pilih **" + sug.name + "** untuk hal ini ya." : ". Untuk diskusi bebas, buka Chat AI (Umum)."),
    suggestedFeature: sug?.name,
    suggestedSlug: sug?.slug,
  };
}

export default { isOffTopic };


