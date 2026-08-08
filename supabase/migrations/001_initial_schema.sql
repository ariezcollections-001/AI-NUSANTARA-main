-- =============================================================================
-- AI-NUSANTARA — Initial Database Schema (Supabase / PostgreSQL)
-- TAHAP 1: Pondasi & Database Absolut
-- Jalankan file ini di Supabase SQL Editor atau via Supabase CLI migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- HELPER: cek apakah user saat ini adalah founder
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'founder'
  );
$$;

-- -----------------------------------------------------------------------------
-- TABLE: users
-- Profil pengguna terhubung ke auth.users (Supabase Auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL UNIQUE,
  role              TEXT        NOT NULL DEFAULT 'user'
                                CHECK (role IN ('user', 'founder')),
  character_balance INTEGER     NOT NULL DEFAULT 5000 CHECK (character_balance >= 0),
  device_fingerprint TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Profil pengguna AI-NUSANTARA dengan saldo karakter dan role.';

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- -----------------------------------------------------------------------------
-- TABLE: ai_settings
-- Konfigurasi dinamis 11 fitur AI (prompt, temperatur, SEO, on/off)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id              SERIAL      PRIMARY KEY,
  feature_slug    TEXT        NOT NULL UNIQUE,
  feature_name    TEXT        NOT NULL,
  system_prompt   TEXT        NOT NULL,
  temperature     REAL        NOT NULL DEFAULT 0.0
                              CHECK (temperature >= 0.0 AND temperature <= 1.0),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  seo_title       TEXT,
  seo_description TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_settings IS 'Pengaturan fitur AI dinamis yang dikendalikan Founder.';

CREATE INDEX IF NOT EXISTS idx_ai_settings_active ON public.ai_settings (is_active);
CREATE INDEX IF NOT EXISTS idx_ai_settings_slug ON public.ai_settings (feature_slug);

-- -----------------------------------------------------------------------------
-- TABLE: founder_config
-- Key-value store untuk API keys, batas kata, maintenance mode, dll.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_config (
  id         SERIAL      PRIMARY KEY,
  key_name   TEXT        NOT NULL UNIQUE,
  key_value  TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.founder_config IS 'Konfigurasi rahasia Founder (API keys, maintenance, batas input).';

CREATE INDEX IF NOT EXISTS idx_founder_config_key ON public.founder_config (key_name);

-- -----------------------------------------------------------------------------
-- TABLE: pricing_packages
-- Paket top-up QRIS (harga Rupiah & jumlah karakter)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id               SERIAL  PRIMARY KEY,
  package_name     TEXT    NOT NULL UNIQUE,
  price            INTEGER NOT NULL CHECK (price > 0),
  character_amount INTEGER NOT NULL CHECK (character_amount > 0),
  is_visible       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.pricing_packages IS 'Paket top-up saldo karakter via QRIS.';

CREATE INDEX IF NOT EXISTS idx_pricing_packages_visible ON public.pricing_packages (is_visible);

-- -----------------------------------------------------------------------------
-- TABLE: transactions
-- Riwayat transaksi pembayaran QRIS per user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  order_id   TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL CHECK (amount > 0),
  status     TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'success', 'failed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Transaksi top-up QRIS Midtrans/Xendit.';

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE: security_logs
-- Jejak audit keamanan (login gagal, brute-force, dll.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_logs (
  id         SERIAL      PRIMARY KEY,
  event_type TEXT        NOT NULL,
  ip_address INET,
  details    JSONB,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.security_logs IS 'Log keamanan siber untuk Dashboard Founder.';

CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON public.security_logs (timestamp DESC);

-- -----------------------------------------------------------------------------
-- TRIGGER: auto-update updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_founder_config_updated_at ON public.founder_config;
CREATE TRIGGER trg_founder_config_updated_at
  BEFORE UPDATE ON public.founder_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pricing_packages_updated_at ON public.pricing_packages;
CREATE TRIGGER trg_pricing_packages_updated_at
  BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- TRIGGER: buat profil users otomatis saat signup Supabase Auth
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) — HARDENING
-- =============================================================================

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs      ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (kecuali service_role bypass)
ALTER TABLE public.users            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.founder_config     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs      FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS: users — auth.uid() = id (isolasi antar-user)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_founder_select_all" ON public.users;
CREATE POLICY "users_founder_select_all"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_founder());

DROP POLICY IF EXISTS "users_founder_update_all" ON public.users;
CREATE POLICY "users_founder_update_all"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- Insert hanya via trigger auth signup (SECURITY DEFINER), bukan client langsung
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- RLS: ai_settings — baca fitur aktif (user), full CRUD (founder)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_settings_select_active" ON public.ai_settings;
CREATE POLICY "ai_settings_select_active"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (is_active = TRUE OR public.is_founder());

DROP POLICY IF EXISTS "ai_settings_founder_all" ON public.ai_settings;
CREATE POLICY "ai_settings_founder_all"
  ON public.ai_settings FOR ALL
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- -----------------------------------------------------------------------------
-- RLS: founder_config — hanya founder
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "founder_config_founder_all" ON public.founder_config;
CREATE POLICY "founder_config_founder_all"
  ON public.founder_config FOR ALL
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- -----------------------------------------------------------------------------
-- RLS: pricing_packages — baca paket visible (user), full CRUD (founder)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_packages_select_visible" ON public.pricing_packages;
CREATE POLICY "pricing_packages_select_visible"
  ON public.pricing_packages FOR SELECT
  TO authenticated
  USING (is_visible = TRUE OR public.is_founder());

DROP POLICY IF EXISTS "pricing_packages_founder_all" ON public.pricing_packages;
CREATE POLICY "pricing_packages_founder_all"
  ON public.pricing_packages FOR ALL
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- -----------------------------------------------------------------------------
-- RLS: transactions — auth.uid() = user_id (isolasi antar-user)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_founder_select_all" ON public.transactions;
CREATE POLICY "transactions_founder_select_all"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_founder());

DROP POLICY IF EXISTS "transactions_founder_update_all" ON public.transactions;
CREATE POLICY "transactions_founder_update_all"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- -----------------------------------------------------------------------------
-- RLS: security_logs — hanya founder (baca & tulis audit)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "security_logs_founder_all" ON public.security_logs;
CREATE POLICY "security_logs_founder_all"
  ON public.security_logs FOR ALL
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- =============================================================================
-- SEED DATA — Default Founder Config
-- =============================================================================
INSERT INTO public.founder_config (key_name, key_value) VALUES
  ('global_maintenance_mode',       'false'),
  ('max_input_words_free',          '500'),
  ('max_input_words_premium',       '5000'),
  ('openai_api_key_free',           ''),
  ('openai_api_key_paid',           ''),
  ('claude_api_key_free',           ''),
  ('claude_api_key_paid',           ''),
  ('deepseek_api_key',              ''),
  ('gemini_api_key',                ''),
  ('midtrans_server_key',           ''),
  ('midtrans_client_key',           ''),
  ('xendit_secret_key',             ''),
  ('founder_allowed_ip',            ''),
  ('admin_route_hash',              'x-founder-control-99f7jK'),
  ('adsense_script',                ''),
  ('broadcast_banner',              ''),
  ('referral_bonus_characters',     '50000')
ON CONFLICT (key_name) DO NOTHING;

-- =============================================================================
-- SEED DATA — Paket Top-Up Default (MASTER_PLAN.md)
-- =============================================================================
INSERT INTO public.pricing_packages (package_name, price, character_amount, is_visible) VALUES
  ('Paket Pemula',     15000,  100000, TRUE),
  ('Paket Produktif',  35000,  300000, TRUE),
  ('Paket Bisnis',     75000,  800000, TRUE)
ON CONFLICT (package_name) DO NOTHING;

-- =============================================================================
-- SEED DATA — 11 Fitur AI Nusantara
-- =============================================================================
INSERT INTO public.ai_settings (feature_slug, feature_name, system_prompt, temperature, is_active, seo_title, seo_description) VALUES
(
  'generator-rpp-kurmer',
  'Generator RPP & Modul Ajar Kurikulum Merdeka',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Buat draf RPP lengkap Kurikulum Merdeka dengan CP, TP, ATP, P3, dan Asesmen (Diagnostik/Formatif/Sumatif).',
  0.0, TRUE,
  'Generator RPP Kurikulum Merdeka | AI-NUSANTARA',
  'Buat RPP & modul ajar Kurikulum Merdeka lengkap CP, TP, ATP, P3, dan asesmen resmi Kemendikbudristek gratis dengan AI-NUSANTARA.'
),
(
  'pembuat-soal-akm-hots',
  'Pembuat Soal Ujian AKM/HOTS + Kunci Jawaban',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Susun soal pilihan ganda atau esai berbasis studi kasus kehidupan nyata di Indonesia sesuai standar Asesmen Kompetensi Minimum Kemendikbudristek, lengkap dengan kunci jawaban.',
  0.0, TRUE,
  'Generator Soal AKM HOTS + Kunci Jawaban | AI-NUSANTARA',
  'Buat soal ujian AKM/HOTS standar Kemendikbudristek dengan kunci jawaban otomatis via AI-NUSANTARA.'
),
(
  'pembuat-narasi-rapor',
  'Pembuat Narasi Rapor Otomatis',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Ubah input nilai angka dan catatan perilaku menjadi paragraf deskripsi nilai formal standar e-Rapor resmi sekolah Indonesia.',
  0.0, TRUE,
  'Generator Narasi Rapor Otomatis e-Rapor | AI-NUSANTARA',
  'Ubah nilai angka dan catatan singkat menjadi narasi rapor formal standar e-Rapor dengan AI-NUSANTARA.'
),
(
  'generator-lkpd',
  'Generator Lembar Kerja Peserta Didik (LKPD)',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Buat lembar kerja peserta didik interaktif dan terstruktur berdasarkan tema pelajaran yang diberikan.',
  0.0, TRUE,
  'Generator LKPD Interaktif | AI-NUSANTARA',
  'Buat Lembar Kerja Peserta Didik (LKPD) interaktif sesuai tema pelajaran dengan AI-NUSANTARA.'
),
(
  'perangkum-jurnal-pdf',
  'Perangkum Jurnal & PDF Ilmiah',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Rangkum latar belakang, metode, hasil, dan kesimpulan jurnal ilmiah menjadi bahasa Indonesia tajam untuk dosen penguji.',
  0.0, TRUE,
  'Perangkum Jurnal & PDF Ilmiah | AI-NUSANTARA',
  'Ringkas jurnal internasional (.pdf/.docx) menjadi bahasa Indonesia tajam dengan AI-NUSANTARA.'
),
(
  'parafrase-anti-plagiarisme',
  'Parafrase Akademis & Anti-Plagiarisme',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Ubah susunan kalimat menjadi format tulisan ilmiah standar EYD V / PUEBI terbaru agar lolos cek plagiarisme.',
  0.0, TRUE,
  'Parafrase Akademis Anti-Plagiarisme | AI-NUSANTARA',
  'Parafrase teks akademis standar EYD V/PUEBI agar lolos Turnitin dengan AI-NUSANTARA.'
),
(
  'skrip-video-viral',
  'Pembuat Skrip Video Viral TikTok/Reels/Shopee',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Buat naskah video pendek 30-60 detik dengan gaya bahasa pilihan (Gaul TikTok, Anak Jaksel, atau Campuran Daerah), instruksi visual/akting, dan Hook 3 detik pertama.',
  0.0, TRUE,
  'Generator Skrip Video Viral TikTok & Reels | AI-NUSANTARA',
  'Buat skrip video viral TikTok, Reels, Shopee dengan hook memikat via AI-NUSANTARA.'
),
(
  'deskripsi-produk-seo',
  'Generator Deskripsi Produk SEO Marketplace',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Susun deskripsi produk SEO untuk Shopee, Tokopedia, dan TikTok Shop dengan emoji persuasif.',
  0.0, TRUE,
  'Generator Deskripsi Produk SEO Marketplace | AI-NUSANTARA',
  'Optimalkan deskripsi produk Shopee, Tokopedia, TikTok Shop dengan AI-NUSANTARA.'
),
(
  'asisten-balas-chat',
  'Asisten Pembalas Chat & Komplain Pembeli',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Deteksi emosi pembeli Indonesia yang marah/komplain, lalu buat balasan super ramah standar CS Shopee Mall/Tokopedia Care dengan sapaan akrab (Kak/Sis/Gan).',
  0.0, TRUE,
  'Asisten Balas Chat & Komplain Pembeli | AI-NUSANTARA',
  'Balas chat dan komplain pembeli marketplace dengan nada ramah CS profesional via AI-NUSANTARA.'
),
(
  'generator-ide-bisnis',
  'Generator Ide Bisnis Modal Kecil',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Berikan rekomendasi bisnis franchise, kuliner kekinian, atau agensi affiliate berdasarkan modal rupiah dan lokasi, lengkap analisis SWOT kilat.',
  0.0, TRUE,
  'Generator Ide Bisnis Modal Kecil | AI-NUSANTARA',
  'Dapatkan ide bisnis UMKM modal kecil dengan analisis SWOT via AI-NUSANTARA.'
),
(
  'pembuat-teks-iklan',
  'Pembuat Teks Iklan Konten',
  'Anda adalah mesin AI-NUSANTARA profesional tingkat tinggi. Dilarang keras mengarang fakta/statistik/kutipan palsu. Seluruh output wajib valid sesuai regulasi di Indonesia. Jika data input kurang lengkap, wajib jawab jujur bahwa data tidak mencukupi. Jangan pernah menebak atau berasumsi. Susun kalimat promosi pendek CTR dan konversi tinggi untuk FB Ads, Google Ads, dan TikTok Ads.',
  0.0, TRUE,
  'Generator Teks Iklan FB/Google/TikTok Ads | AI-NUSANTARA',
  'Buat teks iklan digital CTR tinggi untuk FB Ads, Google Ads, TikTok Ads dengan AI-NUSANTARA.'
)
ON CONFLICT (feature_slug) DO NOTHING;

-- =============================================================================
-- GRANTS — izinkan akses schema public untuk role Supabase standar
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Revoke akses anon ke tabel sensitif (wajib login)
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.ai_settings FROM anon;
REVOKE ALL ON public.founder_config FROM anon;
REVOKE ALL ON public.pricing_packages FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.security_logs FROM anon;
