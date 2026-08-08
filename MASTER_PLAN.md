# MASTER PLAN: MULTI-AI SAAS PLATFORM NUSANTARA
**Status:** Production-Ready Blueprint (God-Mode Omnipotent Architecture)  
**Target Pasar:** Indonesia (Mass Market: Guru, Mahasiswa, Pelaku UMKM, Afiliator)  
**Target Deployment Awal:** Server Gratisan (Vercel & Supabase Free Tier) dengan skalabilitas siap pakai.  
**Prinsip Utama:** Menjadi platform agregator AI nomor satu di Indonesia yang kebal eror, anti-rugi secara finansial, aman dari peretasan, dan dikendalikan penuh oleh Founder tanpa menyentuh kodingan lagi.

---

## 1. TECH STACK & ARSITEKTUR INFRASTRUKTUR
- **Framework Utama:** Next.js (React) App Router terbaru dengan TypeScript (Dioptimasi untuk performa tinggi, Server-Side Rendering (SSR), dan ramah PWA/Capacitor untuk dibungkus menjadi APK Android).
- **Styling & UI Components:** Tailwind CSS & Shadcn UI (Gaya visual futuristik Dark-Ops untuk Founder, gaya bersih minimalis ala Notion/Canva untuk User).
- **Database & Autentikasi:** Supabase / PostgreSQL dengan sistem keamanan Row Level Security (RLS) ketat dan hashing password standar industri.
- **Caching & Rate Limiting:** Upstash Redis / Memory Caching untuk mengunci batas kuota, mencegah serangan Brute-Force, dan mengoptimalkan kecepatan akses.
- **Otak AI (Dynamic Multi-Engine):** Mengintegrasikan API OpenAI (GPT-4o Mini), Claude (Haiku), DeepSeek V3, dan Google Gemini.
- **Gerbang Pembayaran (Payment Gateway):** Midtrans atau Xendit API (Penghasil kode QRIS Dinamis otomatis dengan validasi Webhook).

---

## 2. FITUR UNGGULAN & LOKALISASI RADIKAL NUSANTARA (11 FITUR AI)
Semua fitur diproses di backend menggunakan nilai **Temperatur 0.0** (Nol Mutlak) secara default untuk memastikan keakuratan data, menghilangkan sifat "kreatif mengarang", dan mematuhi instruksi *Anti-Halusinasi*. Nama fitur, kalimat prompt kaku, dan status aktifnya dibaca secara dinamis dari database.

### Kategori Guru & Mahasiswa (Format 100% Akurat Regulasi Resmi Indonesia)
1. **Generator RPP & Modul Ajar Kurikulum Merdeka:** Mengonstruksi draf dokumen ajar lengkap dengan komponen resmi: Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), Alur Tujuan Pembelajaran (ATP), Profil Pelajar Pancasila (P3), dan Asesmen (Diagnostik/Formatif/Sumatif).
2. **Pembuat Soal Ujian AKM/HOTS + Kunci Jawaban:** Menyusun soal pilihan ganda atau esai berbasis studi kasus kehidupan nyata di Indonesia sesuai standar Asesmen Kompetensi Minimum Kemendikbudristek.
3. **Pembuat Narasi Rapor Otomatis:** Mengubah input nilai angka dan catatan singkat perilaku menjadi paragraf deskripsi nilai formal standar aplikasi e-Rapor resmi sekolah.
4. **Generator Lembar Kerja Peserta Didik (LKPD):** Lembar tugas dan aktivitas siswa yang interaktif dan terstruktur berdasarkan tema pelajaran.
5. **Perangkum Jurnal & PDF Ilmiah:** Ekstraktor file dokumen (.pdf / .docx) yang merangkum latar belakang, metode, hasil, dan kesimpulan jurnal internasional menjadi bahasa Indonesia tajam untuk dosen penguji.
6. **Parafrase Akademis & Anti-Plagiarisme:** Mengubah susunan kalimat berantakan menjadi format tulisan ilmiah standar EYD V / PUEBI terbaru agar lolos dari sistem cek Turnitin.

### Kategori UMKM & Afiliator (Gaya Bahasa Jualan Tren Lokal)
7. **Pembuat Skrip Video Viral TikTok/Reels/Shopee:** Menghasilkan draf naskah video pendek 30-60 detik dengan pilihan gaya bahasa: 'Gaul TikTok', 'Anak Jaksel', atau 'Campuran Daerah', lengkap dengan instruksi visual/akting dan Hook 3 detik pertama yang memikat.
8. **Generator Deskripsi Produk SEO Marketplace:** Menyusun teks deskripsi dagangan yang dioptimasi untuk algoritma pencarian Shopee, Tokopedia, dan TikTok Shop bertabur emoji persuasif untuk menaikkan konversi penjualan.
9. **Asisten Pembalas Chat & Komplain Pembeli:** Mendeteksi emosi pembeli Indonesia yang marah atau komplain, lalu mengubahnya menjadi balasan otomatis super ramah standar CS Shopee Mall/Tokopedia Care dengan sapaan akrab (Kak/Sis/Gan).
10. **Generator Ide Bisnis Modal Kecil:** Memberikan rekomendasi bisnis franchise, kuliner kekinian, atau agensi affiliate berdasarkan modal rupiah terkecil dan lokasi pengguna, lengkap dengan analisis SWOT kilat.
11. **Pembuat Teks Iklan Konten Konten:** Penyusun kalimat promosi pendek dengan CTR dan konversi tinggi untuk kebutuhan FB Ads, Google Ads, dan TikTok Ads.

---

## 3. LOGIKA MONETISASI ANTI-RUGI & FINANCIAL PROTECTIONS
- **Sistem Pay-per-Character (Saldo Kredit Teks):** Platform mengeliminasi total sistem langganan bulanan tanpa batas (*unlimited subscription*). Pendapatan Founder dikunci lewat sistem potong saldo per karakter teks.
- **Rumus Potong Saldo Dinamis:** `Total Potong Saldo = Jumlah Karakter Input User + Jumlah Karakter Output AI`. Saldo berkurang secara *real-time* di kolom `character_balance` database Supabase begitu AI selesai merespons.
- **Emergency Intercept:** Backend bertindak sebagai satpam keuangan. Jika jumlah karakter input yang diketik user melebihi sisa `character_balance` milik mereka, backend akan membatalkan hit API ke OpenAI/Claude, mengunci tombol generate, dan menampilkan pesan: "Saldo karakter Anda tidak mencukupi, silakan top-up via QRIS."
- **Skema Paket Top-Up Kuota (QRIS Dinamis):**
  - Paket Pemula: Rp15.000 mendapatkan 100.000 Karakter.
  - Paket Produktif: Rp35.000 mendapatkan 300.000 Karakter.
  - Paket Bisnis: Rp75.000 mendapatkan 800.000 Karakter.
  *(Seluruh harga dan jumlah karakter ini dapat diubah secara instan melalui Dashboard Admin).*

---

## 4. CYBERSECURITY HARDENING (KEAMANAN MILITER BERLAPIS)
- **Invisible Admin Wall (Dashboard Founder):** URL pintu masuk Admin disamarkan total menggunakan kombinasi hash acak (contoh: `/x-founder-control-99f7jK`). Akses dari luar IP Founder akan dilempar ke halaman error 404 palsu. Proses login wajib menggunakan verifikasi Dua Langkah (OTP via Email/WhatsApp). Salah password 3 kali otomatis memblokir IP siber pelaku via Cloudflare/Redis Rate Limiter selama 24 jam.
- **Anti-Sharing Account (Device Fingerprinting):** Sistem menggunakan taktik *Canvas Fingerprinting* di frontend. Satu akun user Premium dilarang keras aktif di lebih dari 1 perangkat secara bersamaan. Jika akun tersebut terdeteksi masuk di HP lain, sesi login di HP pertama akan dihancurkan (*Force Log Out*) secara otomatis untuk mencegah 1 akun patungan beramai-ramai di grup WhatsApp.
- **PostgreSQL Row Level Security (RLS):** Database dikunci mati dengan aturan RLS. User biasa hanya diizinkan membaca dan menulis data yang memiliki ID miliknya sendiri (`auth.uid() = user_id`).
- **Data Sanitization & Encryption:** Semua input teks disaring ketat melalui library `zod` dan `dompurify` untuk membunuh ancaman SQL Injection dan Cross-Site Scripting (XSS). Kunci API pihak ketiga disimpan terenkripsi menggunakan algoritma militer AES-256-GCM di database.

---

## 5. ZERO-CODE ADMIN INFRASTRUCTURE (PUSAT KENDALI MUTLAK FOUNDER)
Founder diberikan kuasa absolut untuk mengendalikan seluruh jalannya aplikasi dari satu halaman visual Dashboard Admin (Mewah, Dark-Ops Theme) dari layar HP tanpa perlu menyentuh kodingan lagi selamanya:
- **Tab Dashboard & Statistik:** Memantau grafik pendapatan Rupiah, grafik pengeluaran token API global, jumlah pengguna aktif, riwayat transaksi sukses, dan tabel `security_logs` (jejak percobaan peretasan).
- **Tab Akun Admin:** Formulir rahasia untuk gonta-ganti email dan password login Akun Founder Anda secara langsung kapan saja.
- **Tab Manajemen API Key & Batas Kata:** Kolom input terenkripsi untuk bebas mengubah API Key OpenAI, Claude, DeepSeek, atau Server Key Midtrans. Serta kolom numerik untuk mengubah batas maksimal input kata untuk Pengguna Gratis (`max_input_words_free`) dan Pengguna Premium (`max_input_words_premium`) secara *real-time*.
- **Tab Kustomisasi Fitur AI & SEO:** Tabel interaktif berisi 11 fitur AI. Founder bisa langsung mengganti Nama Fitur, mengedit teks System Prompt Kaku, menggeser slider temperatur kreativitas AI (0.0 - 1.0), mengubah judul Meta Title dan Deskripsi SEO yang muncul di Google, serta tombol sakelar (ON/OFF Switch) untuk mematikan fitur tertentu jika sedang terjadi kendala.
- **Tab Paket Pembayaran:** Menu untuk menambah atau mengubah harga paket top-up rupiah serta jumlah karakter yang diperoleh user.
- **Tab Pengaturan Iklan & Broadcast:** Kolom teks khusus untuk langsung *copy-paste* script iklan Google AdSense agar tayang otomatis di dashboard user, serta kolom input teks pengumuman massal (*Broadcast Banner*) di atas aplikasi.
- **Master Sakelar Sistem (Global Maintenance Mode ON/OFF Switch):** Tombol sakelar utama di dasbor founder untuk mematikan atau menyalakan seluruh platform AI-NUSANTARA secara instan dari HP tanpa terminal. Jika dimatikan, semua rute user otomatis dialihkan ke halaman pemeliharaan (Maintenance Page) dan hit API AI dikunci total.
- **Master Sakelar Sistem (Global Maintenance Mode ON/OFF Switch):** Tombol sakelar utama di dasbor founder untuk mematikan atau menyalakan seluruh platform AI-NUSANTARA secara instan dari HP tanpa terminal. Jika dimatikan, semua rute user otomatis dialihkan ke halaman pemeliharaan (Maintenance Page) dan hit API AI dikunci total.

---

## 6. VIRAL MARKETING, OFFLINE SYNC, & OPTIMASI GOOGLE SEO LOKAL
- **Sistem Referal Otomatis (Mesin Promosi Gratis):** Setiap user dibekali link referal unik (`://domain.com`). Jika orang lain mendaftar dari link tersebut dan melakukan top-up QRIS, 'User A' otomatis mendapatkan bonus +50.000 kredit karakter gratis. Skema ini memaksa pengguna mempromosikan web Anda ke grup-grup WhatsApp secara sukarela.
- **PWA Offline Sync & HP Kentang Optimization:** Seluruh aset gambar dikompresi maksimal menggunakan format `.webp` agar website super ringan dibuka di HP Android jadul dengan sinyal pelosok 3G/4G. Jika sinyal putus di tengah jalan saat generate, input user disimpan di IndexedDB lokal dan otomatis diproses kembali ke server saat internet stabil.
- **Programmatic SEO:** Aplikasi otomatis memproduksi file `sitemap.xml` dinamis untuk ke-11 rute fitur. Di bawah form input user, disediakan ruang teks statis sepanjang 300 kata (Placeholder Artikel SEO) agar robot *crawling* Google menaikkan peringkat halaman website Anda ke posisi paling atas pencarian Indonesia secara organik.
- **Dynamic AdSlot:** Menyiapkan ruang kosong responsif bertanda `<ins class="adsbygoogle">` di bawah hasil teks AI dan sidebar menu dashboard user. Slot ini otomatis menyembunyikan dirinya jika kode iklan di Dashboard Founder dikosongkan.
-
## 4. MARKETING VIRALITAS & INTEGRASI IKLAN
- **Sistem Afiliasi Otomatis:** Pengguna mendapatkan link referal unik. Jika orang lain mendaftar dari link tersebut dan top-up QRIS, pengajak otomatis mendapatkan komisi bonus kuota karakter.
- **Programmatic SEO:** Otomatis menghasilkan `sitemap.xml` dinamis. Setiap halaman fitur dibekali Meta Tags bahasa Indonesia statis-dinamis dan Placeholder Artikel 300 kata untuk merajai pencarian Google teratas.
- **Dynamic AdSlot:** Menyiapkan kotak kosong responsive `<ins class="adsbygoogle">` untuk Google AdSense atau banner sponsor kustom di bawah output AI dan sidebar, yang teks kodenya bisa di-copy-paste langsung dari Dashboard Founder tanpa koding lagi.
-
