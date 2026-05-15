
CREATE TABLE IF NOT EXISTS public.credenciales_externas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proveedor text NOT NULL,
  username text,
  password_cifrado text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, proveedor)
);

ALTER TABLE public.credenciales_externas ENABLE ROW LEVEL SECURITY;

CREATE POLICY ce_sel ON public.credenciales_externas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ce_ins ON public.credenciales_externas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ce_upd ON public.credenciales_externas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ce_del ON public.credenciales_externas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER ce_set_updated_at
BEFORE UPDATE ON public.credenciales_externas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sugerencias
  ADD COLUMN IF NOT EXISTS tipo_externo text,
  ADD COLUMN IF NOT EXISTS url_externa text;
