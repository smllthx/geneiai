CREATE TYPE sugerencia_estado AS ENUM ('pendiente', 'aceptada', 'rechazada');

CREATE TABLE public.sugerencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  persona_id uuid,
  estado sugerencia_estado NOT NULL DEFAULT 'pendiente',
  origen text,
  confianza integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sugerencias_sel" ON public.sugerencias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sugerencias_ins" ON public.sugerencias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sugerencias_upd" ON public.sugerencias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sugerencias_del" ON public.sugerencias FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX sugerencias_user_estado_idx ON public.sugerencias(user_id, estado);

CREATE TRIGGER sugerencias_set_updated_at
  BEFORE UPDATE ON public.sugerencias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();