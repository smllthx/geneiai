
ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'familysearch';
ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'myheritage';
ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'relato_familiar';
ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'periodico';
ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'cementerio';

CREATE TABLE IF NOT EXISTS public.contradicciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  severidad text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descripcion text,
  personas uuid[] NOT NULL DEFAULT '{}',
  eventos uuid[] NOT NULL DEFAULT '{}',
  estado text NOT NULL DEFAULT 'abierta',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contradicciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contradicciones_sel" ON public.contradicciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contradicciones_ins" ON public.contradicciones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contradicciones_upd" ON public.contradicciones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contradicciones_del" ON public.contradicciones FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS contradicciones_user_idx ON public.contradicciones(user_id, created_at DESC);
