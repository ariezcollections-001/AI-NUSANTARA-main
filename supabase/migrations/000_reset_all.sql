-- =============================================================================
-- AI-NUSANTARA — RESET BERSIH (versi SUPER AMAN)
-- Jalankan script ini DULU (sekali saja) untuk menghapus SEMUA objek yang
-- mungkin tertinggal dari migrasi 001–004.
--
-- Setiap perintah di-bungkus blok DO ... EXCEPTION WHEN OTHERS THEN NULL
-- sehingga script TIDAK pernah gagal, apakah objek ada maupun tidak.
-- (Ini memperbaiki kelemahan versi sebelumnya: DROP ... IF EXISTS pada tabel
--  yang belum ada tetap error "relation does not exist".)
-- =============================================================================

-- 1) DROP POLICIES (untuk masing-masing tabel)
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_select_own"             ON public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_update_own"             ON public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_founder_select_all"     ON public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_founder_update_all"     ON public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_insert_self"            ON public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "ai_settings_select_active"    ON public.ai_settings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "ai_settings_founder_all"      ON public.ai_settings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "founder_config_founder_all"   ON public.founder_config;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pricing_packages_select_visible" ON public.pricing_packages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "pricing_packages_founder_all"   ON public.pricing_packages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "transactions_select_own"      ON public.transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "transactions_insert_own"      ON public.transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "transactions_founder_select_all" ON public.transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "transactions_founder_update_all" ON public.transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "security_logs_founder_all"    ON public.security_logs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "support_tickets_select_own"   ON public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "support_tickets_insert_own"   ON public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "support_tickets_founder_all"  ON public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "founder_select_all"           ON public.founder;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "founder_no_insert_from_client" ON public.founder;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "founder_no_update_from_client" ON public.founder;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) DROP TRIGGERS
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created          ON auth.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_ai_settings_updated_at    ON public.ai_settings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_founder_config_updated_at ON public.founder_config;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pricing_packages_updated_at ON public.pricing_packages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3) DROP FUNCTIONS
DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.is_founder();
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.set_updated_at();
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP FUNCTION IF EXISTS public.handle_new_user();
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4) DROP TABLES — urut dari yang mereferensikan, ke yang direferensikan
DO $$ BEGIN
  DROP TABLE IF EXISTS public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.transactions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.security_logs;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.pricing_packages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.founder_config;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.ai_settings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.founder;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP TABLE IF EXISTS public.users;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

