<<<<<<< HEAD
# AI-NUSANTARA

Platform agregator AI nomor satu di Indonesia — Guru, Mahasiswa, UMKM, dan Afiliator.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL + Auth + RLS)

## Setup Lokal (TAHAP 1)

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi environment

```bash
cp .env.example .env.local
```

Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` dari [Supabase Dashboard](https://supabase.com/dashboard).

### 3. Inisialisasi database Supabase

Jalankan migration SQL di Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql
```

Atau via Supabase CLI:

```bash
supabase db push
```

### 4. Jalankan dev server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Struktur Folder


## Konfigurasi URL Redirect (Penting — lokal vs Vercel)

Supabase menentukan host link konfirmasi email berdasarkan pengaturan di dashboard
**Supabase Dashboard → Authentication → URL Configuration**. Supabase akan
**mengabaikan** `redirect_to` dari aplikasi jika URL tersebut tidak ada di daftar
**Redirect URLs**. Akibatnya, saat uji lokal, bisa terlempar ke domain Vercel.

Kode aplikasi sudah otomatis menyesuaikan origin lewat `getAppUrl()` di
`lib/url.ts` (localhost saat dev, domain Vercel saat produksi). Yang perlu Anda
lakukan **sekali** di dashboard Supabase:

1. **Redirect URLs** — pastikan berisi **semua** origin yang Anda pakai:
   ```
   http://localhost:3000/**
   https://ai-nusantara-main.vercel.app/**
   ```
2. **Site URL** — bisa diarahkan ke produksi (`https://ai-nusantara-main.vercel.app`);
   selama `redirect_to` lokal sudah masuk allowlist, uji lokal tetap di localhost.

### Verifikasi cepat

Jalankan script untuk mengecek config (memerlukan Personal Access Token Supabase
untuk membaca pengaturan dari dashboard):

```bash
# hanya cek lokal (tanpa Supabase API)
node scripts/check-redirect.js

# cek lengkap termasuk Site URL + Redirect URLs dari Supabase
export SUPABASE_ACCESS_TOKEN=<personal-access-token>
node scripts/check-redirect.js
```

> Personal Access Token dibuat di https://supabase.com/dashboard/account/tokens
> (bukan anon key / service role key).

**Catatan:** email verifikasi yang sudah terkirim sebelumnya tetap memakai URL
lama. Setelah mengubah pengaturan, daftar akun baru atau klik "kirim ulang
verifikasi", lalu pastikan host link emailnya `http://localhost:3000` saat uji lokal.

```
app/           → Halaman & API routes (App Router)
  api/         → Backend API endpoints
components/    → Komponen UI React
hooks/         → Custom React hooks
lib/           → Utilitas, Supabase client, types
supabase/      → Migration SQL & konfigurasi Supabase
```

## Dokumentasi Proyek

- [MASTER_PLAN.md](./MASTER_PLAN.md) — Blueprint arsitektur lengkap
- [PROMPT_CURSOR.md](./PROMPT_CURSOR.md) — Instruksi eksekusi per tahap

## Lisensi

MIT — lihat [LICENSE](./LICENSE).
=======
# AI-NUSANTARA-main
>>>>>>> 3db09ee0b395f7ed31cc5b47a291d55b03bbb86d
"# AI-NUSANTARA-main" 
"# AI-NUSANTARA-main" 
"# AI-NUSANTARA-main" 
