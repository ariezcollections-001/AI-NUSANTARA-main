-- =============================================================================
-- AI-NUSANTARA — Founder Table & is_founder() Fix
-- TAHAP 3: Perbaiki ketiadaan tabel founder & sinkronkan is_founder()
-- =============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: founder
-- Tabel otoritas founder yang dipisah dari public.users.
-- Satu-satunya sumber kebenaran (authoritative) untuk akses founder panel.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'founder'
                              CHECK (role IN ('founder')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.founder IS 'Tabel founder otoritas tinggi untuk akses panel founder.';

CREATE INDEX IF NOT EXISTS idx_founder_id   ON public.founder (id);
CREATE INDEX IF NOT EXISTS idx_founder_email ON public.founder (email);
CREATE INDEX IF NOT EXISTS idx_founder_role  ON public.founder (role);

-- ----------------------------------------------------------------------------
-- UPDATE: is_founder() — cek BOTH users table AND founder table
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND role = 'founder'
  )
  OR EXISTS (
    SELECT 1 FROM public.founder
    WHERE id = auth.uid() AND role = 'founder'
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS: founder table — hanya founder yang bisa akses
-- ----------------------------------------------------------------------------
ALTER TABLE public.founder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder_select_all" ON public.founder;
CREATE POLICY "founder_select_all"
  ON public.founder FOR SELECT
  TO authenticated
  USING (public.is_founder());

DROP POLICY IF EXISTS "founder_no_insert_from_client" ON public.founder;
CREATE POLICY "founder_no_insert_from_client"
  ON public.founder FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "founder_no_update_from_client" ON public.founder;
CREATE POLICY "founder_no_update_from_client"
  ON public.founder FOR UPDATE
  TO authenticated
  WITH CHECK (false);

-- service_role tetap punya akses penuh (untuk seed route, dll)
REVOKE ALL ON public.founder FROM anon;