
-- external accounts (FamilySearch, etc.)
CREATE TABLE public.external_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  account_ref text,
  scope text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ext_acc_sel ON public.external_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ext_acc_ins ON public.external_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ext_acc_upd ON public.external_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ext_acc_del ON public.external_accounts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER ext_acc_updated BEFORE UPDATE ON public.external_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- fotos
CREATE TABLE public.fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  storage_path text,
  titulo text,
  descripcion text,
  fecha date,
  fecha_aprox text,
  lugar_id uuid,
  personas_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fotos_sel ON public.fotos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY fotos_ins ON public.fotos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY fotos_upd ON public.fotos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY fotos_del ON public.fotos FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER fotos_updated BEFORE UPDATE ON public.fotos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX fotos_personas_idx ON public.fotos USING GIN(personas_ids);

-- dna_estimates
CREATE TABLE public.dna_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid,
  region text NOT NULL,
  porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  fuente text,
  rama text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dna_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dna_sel ON public.dna_estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY dna_ins ON public.dna_estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY dna_upd ON public.dna_estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY dna_del ON public.dna_estimates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER dna_updated BEFORE UPDATE ON public.dna_estimates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- familias
CREATE TABLE public.familias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  head_persona_id uuid,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;
CREATE POLICY familias_sel ON public.familias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY familias_ins ON public.familias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY familias_upd ON public.familias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY familias_del ON public.familias FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER familias_updated BEFORE UPDATE ON public.familias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- actividad (feed)
CREATE TABLE public.actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  ref_id uuid,
  ref_tipo text,
  descripcion text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.actividad ENABLE ROW LEVEL SECURITY;
CREATE POLICY actividad_sel ON public.actividad FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY actividad_ins ON public.actividad FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY actividad_del ON public.actividad FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX actividad_user_created_idx ON public.actividad(user_id, created_at DESC);

-- foto_persona helper field on personas (foto principal)
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS foto_url text;

-- bucket fotos público
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fotos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'fotos');
CREATE POLICY "fotos_user_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'fotos' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "fotos_user_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'fotos' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "fotos_user_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'fotos' AND auth.uid()::text = (storage.foldername(name))[1]
);
