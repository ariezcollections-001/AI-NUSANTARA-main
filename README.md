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
