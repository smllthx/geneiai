
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis text,
  severity text,
  suggested_action text,
  user_message text,
  applied boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY er_sel ON public.error_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY er_ins ON public.error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY er_upd ON public.error_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY er_del ON public.error_reports FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX error_reports_user_created_idx ON public.error_reports (user_id, created_at DESC);
