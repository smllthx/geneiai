CREATE TABLE IF NOT EXISTS public.familysearch_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familysearch_oauth_states TO authenticated;
GRANT ALL ON public.familysearch_oauth_states TO service_role;

ALTER TABLE public.familysearch_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own familysearch oauth states"
ON public.familysearch_oauth_states
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS familysearch_oauth_states_user_idx
ON public.familysearch_oauth_states (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS external_accounts_user_provider_uniq
ON public.external_accounts (user_id, provider);