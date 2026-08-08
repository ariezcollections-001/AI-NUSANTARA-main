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
-- -----------------------------------------------------------------------------
INSERT INTO auth.providers (provider_id)
VALUES ('google')
ON CONFLICT (provider_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Verifikasi provider terdaftar
-- -----------------------------------------------------------------------------
SELECT provider_id FROM auth.providers ORDER BY provider_id;