-- =============================================================================
-- AI-NUSANTARA — Enable Google OAuth Provider
-- TAHAP 2: Aktifkan provider Google di Supabase Auth
--
-- CATATAN PENTING:
-- Untuk Supabase CLOUD (https://drnbbnrocaeizelwroao.supabase.co):
--   Provider Google WAJIB diaktifkan melalui Dashboard:
--   Authentication > Providers > Google > Enable
--   Lalu isi Client ID & Client Secret dari Google Cloud Console.
--   SQL ini TIDAK cukup untuk Supabase Cloud karena konfigurasi
--   provider disimpan di GoTrue config (bukan database).
--
-- Untuk Supabase SELF-HOSTED / LOCAL (via supabase start):
--   SQL ini akan mengaktifkan provider Google di tabel auth.providers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Aktifkan provider Google di tabel auth.providers (self-hosted/local)
--
-- PENTING: Untuk Supabase CLOUD, blok ini TIDAK melakukan apapun karena:
--   - Tabel `auth.providers` di cloud tidak bisa di-INSERT langsung dari SQL
--     (GoTrutha mengelola konfigurasi provider, bukan live-reload via tabel).
--   - Provider Google WAJIB diaktifkan lewat:
--       Authentication > Providers > Google > Enable
--     lalu isi Client ID & Client Secret dari Google Cloud Console.
--
-- Blok di bawah ini DO-PROTECTED dengan EXCEPTION handler supaya TIDAK
-- menggagalkan migrasi di Supabase Cloud (yang menolak akses ke schema auth).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'providers'
  ) THEN
    BEGIN
      INSERT INTO auth.providers (provider_id)
      VALUES ('google')
      ON CONFLICT (provider_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Abaikan error (mis. permission denied di Supabase Cloud).
      NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Verifikasi provider terdaftar (hanya untuk SELF-HOSTED/local)
--
-- PERBAIKAN AUDIT: SELECT verifikasi di BARIS BAWAH TIDAK DIJALANKAN di
-- Supabase Cloud karena `auth.providers` tidak bisa di-query langsung oleh
-- user biasa (permission denied), yang akan membuat SQL editor menampilkan
-- error meskipun isi migrasi sudah sukses. Untuk itu SELECT ini dihapus.
--
-- Cara verifikasi yang benar di Supabase Cloud:
--   Dashboard > Authentication > Providers > Google (pastikan status = Enabled)
-- -----------------------------------------------------------------------------
/* SELECT provider_id FROM auth.providers ORDER BY provider_id; */