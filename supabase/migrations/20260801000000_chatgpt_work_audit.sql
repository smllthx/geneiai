-- Immutable audit trail for changes requested through ChatGPT Work.
CREATE TABLE IF NOT EXISTS public.work_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'chatgpt_work',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS work_audit_log_user_created_idx
  ON public.work_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS work_audit_log_tree_created_idx
  ON public.work_audit_log(arbol_id, created_at DESC);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_audit_log'
      AND policyname = 'own work audit read'
  ) THEN
    CREATE POLICY "own work audit read" ON public.work_audit_log
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_audit_log'
      AND policyname = 'own work audit insert'
  ) THEN
    CREATE POLICY "own work audit insert" ON public.work_audit_log
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
          arbol_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.arboles a
            WHERE a.id = work_audit_log.arbol_id AND a.user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;
COMMENT ON TABLE public.work_audit_log IS
  'Append-only record of authenticated changes initiated through the GENEAI Work MCP connection.';
-- Per-user allowlist populated only by the first-party GENEAI consent screen.
CREATE TABLE IF NOT EXISTS public.work_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  client_name TEXT NOT NULL DEFAULT 'ChatGPT Work',
  client_uri TEXT,
  redirect_uri TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
ALTER TABLE public.work_oauth_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "direct user manages work oauth clients"
  ON public.work_oauth_clients
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'client_id') IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'client_id') IS NULL
    AND redirect_uri ~ '^https://chatgpt[.]com/connector/oauth/[^/]+$'
  );
-- Supabase OAuth scopes govern OIDC claims, not database access. OAuth access
-- tokens are therefore denied direct PostgREST access to every existing RLS
-- table. The MCP validates the token, then uses its private server client and
-- the explicit user/tree checks in api/_lib/geneai-work instead.
DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target.table_name
        AND policyname = 'block direct oauth tokens'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((auth.jwt() ->> ''client_id'') IS NULL) WITH CHECK ((auth.jwt() ->> ''client_id'') IS NULL)',
        'block direct oauth tokens',
        target.table_name
      );
    END IF;
  END LOOP;
END $$;
COMMENT ON TABLE public.work_oauth_clients IS
  'OAuth client IDs explicitly approved from the GENEAI consent screen for each user.';
