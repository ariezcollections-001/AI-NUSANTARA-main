# PROMPT CURSOR EXECUTION SHEET (AI-NUSANTARA MUTAKHIR)
Instruksi: Salin dan jalankan ke Cursor Composer (Ctrl+I) per tahap. 
Nama platform resmi: AI-NUSANTARA.

---

### 📌 TAHAP 1: PONDASI & DATABASE ABSOLUT
Fokus bangun struktur dasar aplikasi AI-NUSANTARA yang aman:

1. STRUKTUR FOLDER PROYEK:
Buat folder Next.js App Router TypeScript terbaru 
(app/, components/, hooks/, lib/, dan api/).

2. SKEMA DATABASE POSTGRESQL/SUPABASE:
Buat file skema SQL aman untuk tabel:
- users: id (uuid), email, role ('user'|'founder'), 
  character_balance (int, default 5000), 
  device_fingerprint, created_at.
- ai_settings: id (serial), feature_slug, feature_name, 
  system_prompt, temperature (float, default 0.0), 
  is_active (bool, default true), seo_title, seo_description.
- founder_config: id (serial), key_name, key_value, updated_at.
  (Simpan API Keys, password founder, max_input_words_free/premium, 
  dan parameter global_maintenance_mode (boolean, default false)).
- pricing_packages: id (serial), price, package_name, 
  character_amount, is_visible (bool, default true).
- transactions: order_id, user_id, amount, status, created_at.
- security_logs: id, event_type, ip_address, details, timestamp.

3. SECURITY HARDENING:
Aktifkan Row Level Security (RLS) di semua tabel. 
Validasikan auth.uid() = user_id agar tidak bocor. 
Buat berkas .gitignore untuk mengunci file .env lokal.

---

### 📌 TAHAP 2: BACKEND API AI-NUSANTARA
Buat seluruh LOGIKA BACKEND di folder app/api/ yang aman:

1. GLOBAL MAINTENANCE INTERCEPT:
Setiap kali ada request masuk ke API pemrosesan teks AI 
atau API halaman user, backend wajib memeriksa nilai 
global_maintenance_mode di tabel founder_config. Jika bernilai 
true, batalkan semua proses, kunci hit ke API global, 
dan kembalikan status error pemeliharaan sistem secara instan.

2. DYNAMIC INPUT VALIDATION (ANTI-RUGI):
Validasi batas kata dari database. Hitung jumlah karakter INPUT 
dan OUTPUT. Potong saldo character_balance di database 
secara real-time. Jika saldo habis, batalkan hit ke API global.

3. DUAL-ENGINE AUTOMATIC FAILOVER:
Membaca API Key dari founder_config. Utamakan API Key Gratisan. 
Jika limit, otomatis pindah ke API Key Berbayar (OpenAI/Claude) 
dalam 1 milidetik via Circuit Breaker tanpa disadari user. 
System prompt kaku dan temperatur AI wajib dibaca dari database.

4. INVISIBLE ADMIN WALL & ANTI-SHARING:
- Samarkan rute Dashboard Admin dengan hash acak (Contoh: /x-founder-control-99f7jK). 
  Akses luar IP Founder lempar ke 404 palsu. OTP via email.
- Sesi perangkat dikunci via Canvas Fingerprinting. 
  Jika login di perangkat baru, paksa keluar perangkat lama.

---

### 📌 TAHAP 3: FRONTEND DASHBOARD USER AI-NUSANTARA
Buat DASHBOARD USER memakai Tailwind CSS & Shadcn UI (Mobile-First).

1. MIDDLEWARE MAINTENANCE PAGE:
Buat komponen halaman Maintenance Page yang estetik dengan pesan 
"AI-NUSANTARA sedang dalam pemeliharaan sistem". Jika nilai 
global_maintenance_mode di database bernilai true, gunakan 
Next.js middleware untuk mengalihkan (redirect) seluruh user 
yang membuka aplikasi langsung ke halaman maintenance ini.

2. TAMPILAN DASHBOARD UTAMA:
Pasang LOGO dan TEKS "AI-NUSANTARA" di bagian atas Sidebar Navigasi 
dan Header utama aplikasi. Sidebar harus dinamis memuat daftar menu 
dari tabel ai_settings. Kunci mesin AI temperatur 0.0 di backend.

SUNTIKKAN BACKEND SYSTEM PROMPT KAKU ANTI-HALUSINASI:
"Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. 
Dilarang keras mengarang fakta/statistik/kutipan palsu. 
Seluruh output wajib valid sesuai regulasi di Indonesia. 
Jika data input kurang lengkap, wajib jawab jujur bahwa data 
tidak mencukupi. Jangan pernah menebak atau berasumsi."

Terapkan 11 Fitur Utama Nusantara (Sesuai MASTER_PLAN.md).

FITUR PENDUKUNG WAJIB DI UI USER:
- Dynamic Input Length Limiter (Menampilkan sisa kata dari DB).
- Tombol Mikrofon Voice-to-Text Multi-Bahasa Daerah.
- Tombol One-Click Utility ("Salin Teks" & "Ekspor .docx/PDF").
- History Logs & PWA Offline Sync (Simpan di IndexedDB jika DC).
- KOTAK DISCLAIMER KUNING di bawah tombol generate: "⚠️ AI-NUSANTARA 
  hanyalah asisten pembantu yang bisa salah. Pengguna wajib 
  memeriksa dan meneliti output dengan teliti."

---

### 📌 TAHAP 4: QRIS, SEO & ADMIN PANEL AI-NUSANTARA
Buat gerbang pembayaran, marketing, dan Dashboard Admin:

1. WEBHOOK QRIS AUTOMATION (MIDTRANS/XENDIT):
API Route /api/webhook/payment wajib verifikasi "Signature Key" 
(SHA512). Tolak request di luar IP resmi Payment Gateway. 
Cek Idempotency order_id unik. Saldo bertambah otomatis real-time.

2. FITUR VIRALITAS & PROGRAMMATIC SEO:
- Link referal unik bonus +50.000 karakter gratis untuk pengajak.
- File sitemap.xml.ts dinamis. Pasang metadata SEO bahasa Indonesia 
  menggunakan nama "AI-NUSANTARA". Ruang teks Artikel SEO 300 kata di bawah form.
- Dynamic AdSlot: Kotak kosong slot iklan Google AdSense 
  (<ins class="adsbygoogle">) di bawah output AI dan sidebar menu.

3. DASHBOARD FOUNDER KONTROL MUTLAK (DARK-OPS THEME):
Buat halaman khusus Admin untuk kendali penuh tanpa ubah kode:
- NEW: SAKELAR UTAMA SERVER (Global Maintenance ON/OFF Switch). 
  Sebuah tombol toggle besar di bagian atas dashboard untuk menyalakan/
  mematikan seluruh platform AI-NUSANTARA secara real-time dari HP.
- Tab Statistik: Grafik omzet & token cost, ban user, log siber.
- Tab Keamanan: Ubah Email dan Password Admin secara mandiri.
- Tab API & Batas Kata: Ganti API Keys & ubah batas kata gratis/premium.
- Tab Kustomisasi AI & SEO: Edit nama fitur, ubah System Prompt, 
  geser temperatur, edit Meta SEO Google, dan tombol sakelar On/Off.
- Tab Paket QRIS: Tambah/ubah harga paket top-up secara instan.
- Tab Iklan & Broadcast: Pasang script AdSense & buat teks banner pengumuman.
-
