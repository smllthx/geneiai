-- Multi-tree scope for GENEAI.
-- Keeps existing data intact while allowing each account to manage separate trees.

CREATE TABLE IF NOT EXISTS public.arboles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT 'Árbol principal',
  descripcion TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arboles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'arboles' AND policyname = 'own arboles select'
  ) THEN
    CREATE POLICY "own arboles select" ON public.arboles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'arboles' AND policyname = 'own arboles insert'
  ) THEN
    CREATE POLICY "own arboles insert" ON public.arboles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'arboles' AND policyname = 'own arboles update'
  ) THEN
    CREATE POLICY "own arboles update" ON public.arboles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'arboles' AND policyname = 'own arboles delete'
  ) THEN
    CREATE POLICY "own arboles delete" ON public.arboles FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TRIGGER arboles_updated
BEFORE UPDATE ON public.arboles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;

ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.relaciones ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.fotos ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.familias ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.research_tasks ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;
ALTER TABLE public.sugerencias ADD COLUMN IF NOT EXISTS arbol_id UUID REFERENCES public.arboles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS personas_arbol_idx ON public.personas(user_id, arbol_id);
CREATE INDEX IF NOT EXISTS relaciones_arbol_idx ON public.relaciones(user_id, arbol_id);
CREATE INDEX IF NOT EXISTS eventos_arbol_idx ON public.eventos(user_id, arbol_id);

-- Create one default tree per existing user with data, then attach current rows.
INSERT INTO public.arboles (user_id, nombre, is_default)
SELECT p.id, 'Árbol principal', true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.arboles a WHERE a.user_id = p.id
);

UPDATE public.profiles p
SET active_arbol_id = a.id
FROM public.arboles a
WHERE a.user_id = p.id
  AND a.is_default = true
  AND p.active_arbol_id IS NULL;

UPDATE public.personas x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

UPDATE public.relaciones x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

UPDATE public.eventos x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

UPDATE public.documentos x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

UPDATE public.fotos x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

UPDATE public.familias x SET arbol_id = p.active_arbol_id
FROM public.profiles p
WHERE x.user_id = p.id AND x.arbol_id IS NULL;

