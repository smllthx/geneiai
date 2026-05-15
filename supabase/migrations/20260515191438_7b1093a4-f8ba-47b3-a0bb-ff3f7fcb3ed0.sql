
-- 1. Flag for FS push sync
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS sync_to_fs boolean NOT NULL DEFAULT false;

-- 2. Photo tags table (rectangles overlaid on photos)
CREATE TABLE IF NOT EXISTS public.foto_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  foto_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  x numeric NOT NULL DEFAULT 0,   -- % from left
  y numeric NOT NULL DEFAULT 0,   -- % from top
  w numeric NOT NULL DEFAULT 10,  -- % width
  h numeric NOT NULL DEFAULT 10,  -- % height
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.foto_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foto_tags_sel" ON public.foto_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "foto_tags_ins" ON public.foto_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "foto_tags_upd" ON public.foto_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "foto_tags_del" ON public.foto_tags FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_foto_tags_foto ON public.foto_tags(foto_id);
CREATE INDEX IF NOT EXISTS idx_foto_tags_persona ON public.foto_tags(persona_id);

-- 3. pg_cron + pg_net for periodic FamilySearch sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
