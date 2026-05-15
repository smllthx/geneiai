
CREATE TABLE public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  mensaje text,
  url text,
  tipo text NOT NULL DEFAULT 'info',
  leida boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_sel ON public.notificaciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notif_ins ON public.notificaciones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY notif_upd ON public.notificaciones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notif_del ON public.notificaciones FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_notif_user_created ON public.notificaciones(user_id, created_at DESC);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_sel ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ps_ins ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ps_upd ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ps_del ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
