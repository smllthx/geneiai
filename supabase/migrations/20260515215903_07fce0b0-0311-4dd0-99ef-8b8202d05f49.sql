
CREATE TABLE IF NOT EXISTS public.rasgos_faciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  foto_id uuid,
  foto_url text,
  rasgos jsonb NOT NULL DEFAULT '{}'::jsonb,
  vector double precision[] DEFAULT NULL,
  resumen text,
  modelo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rasgos_faciales ENABLE ROW LEVEL SECURITY;
CREATE POLICY rf_sel ON public.rasgos_faciales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rf_ins ON public.rasgos_faciales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rf_upd ON public.rasgos_faciales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY rf_del ON public.rasgos_faciales FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER rf_uat BEFORE UPDATE ON public.rasgos_faciales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS rf_persona_idx ON public.rasgos_faciales(persona_id);

CREATE TABLE IF NOT EXISTS public.parecidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_a uuid NOT NULL,
  persona_b uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  rasgos_comunes jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimacion_genetica numeric,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, persona_a, persona_b)
);
ALTER TABLE public.parecidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pa_sel ON public.parecidos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pa_ins ON public.parecidos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pa_upd ON public.parecidos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pa_del ON public.parecidos FOR DELETE USING (auth.uid() = user_id);
