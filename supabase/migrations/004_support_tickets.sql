-- =============================================================================
-- AI-NUSANTARA — Support Tickets (Live Chat CS ledger)
-- TAHAP 4: Ruang Kendali Live Chat CS — ledger tiket aduan user
-- Jalankan file ini di Supabase SQL Editor atau via Supabase CLI migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: support_tickets
-- Ledger tiket aduan / live chat user untuk Ruang Kendali CS Founder
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  user_email   TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'unresolved', 'resolved', 'closed')),
  priority     TEXT        NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  chat_history JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.support_tickets IS 'Tiket aduan / live chat user untuk Ruang Kendali CS Founder.';

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC);

-- -----------------------------------------------------------------------------
-- RLS: support_tickets — user baca tiket sendiri, founder full CRUD
-- -----------------------------------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_founder());

DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_founder_all" ON public.support_tickets;
CREATE POLICY "support_tickets_founder_all"
  ON public.support_tickets FOR ALL
  TO authenticated
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- -----------------------------------------------------------------------------
-- TRIGGER: auto-update updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
REVOKE ALL ON public.support_tickets FROM anon;

-- -----------------------------------------------------------------------------
-- REALTIME: aktifkan kanal realtime untuk tiket & transaksi (Live Monitor)
-- Idempotent — aman dijalankan berulang kali tanpa error "already a member"
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;
