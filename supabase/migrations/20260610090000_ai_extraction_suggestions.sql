-- IA genealógica normalizada: extracción documental, sugerencias revisables y biografías.
-- No modifica datos existentes; sólo agrega tablas y políticas RLS.

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arbol_id uuid REFERENCES public.arboles(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('relacion','duplicado','evento','fuente','biografia','dato')),
  title text NOT NULL DEFAULT 'Sugerencia de IA',
  description text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence integer NOT NULL DEFAULT 60 CHECK (confidence >= 0 AND confidence <= 100),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aceptado','rechazado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_ai_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arbol_id uuid REFERENCES public.arboles(id) ON DELETE SET NULL,
  document_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  names jsonb NOT NULL DEFAULT '[]'::jsonb,
  dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

CREATE TABLE IF NOT EXISTS public.ai_biographies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arbol_id uuid REFERENCES public.arboles(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  biography_text text NOT NULL,
  editable_text text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','accepted','discarded')),
  confidence integer NOT NULL DEFAULT 60 CHECK (confidence >= 0 AND confidence <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_ai_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_biographies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_suggestions' AND policyname = 'ai_suggestions_sel') THEN
    CREATE POLICY ai_suggestions_sel ON public.ai_suggestions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_suggestions' AND policyname = 'ai_suggestions_ins') THEN
    CREATE POLICY ai_suggestions_ins ON public.ai_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_suggestions' AND policyname = 'ai_suggestions_upd') THEN
    CREATE POLICY ai_suggestions_upd ON public.ai_suggestions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_ai_data' AND policyname = 'document_ai_data_sel') THEN
    CREATE POLICY document_ai_data_sel ON public.document_ai_data FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_ai_data' AND policyname = 'document_ai_data_ins') THEN
    CREATE POLICY document_ai_data_ins ON public.document_ai_data FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_ai_data' AND policyname = 'document_ai_data_upd') THEN
    CREATE POLICY document_ai_data_upd ON public.document_ai_data FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_biographies' AND policyname = 'ai_biographies_sel') THEN
    CREATE POLICY ai_biographies_sel ON public.ai_biographies FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_biographies' AND policyname = 'ai_biographies_ins') THEN
    CREATE POLICY ai_biographies_ins ON public.ai_biographies FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_biographies' AND policyname = 'ai_biographies_upd') THEN
    CREATE POLICY ai_biographies_upd ON public.ai_biographies FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_suggestions_user_status_idx ON public.ai_suggestions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_suggestions_person_idx ON public.ai_suggestions(person_id, status);
CREATE INDEX IF NOT EXISTS document_ai_data_document_idx ON public.document_ai_data(document_id);
CREATE INDEX IF NOT EXISTS ai_biographies_person_idx ON public.ai_biographies(person_id, created_at DESC);

CREATE TRIGGER ai_suggestions_updated
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER document_ai_data_updated
  BEFORE UPDATE ON public.document_ai_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER ai_biographies_updated
  BEFORE UPDATE ON public.ai_biographies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
