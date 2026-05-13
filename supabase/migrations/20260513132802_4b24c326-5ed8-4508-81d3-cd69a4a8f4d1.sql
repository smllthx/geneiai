
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'lector');
CREATE TYPE public.certeza_nivel AS ENUM ('comprobado', 'probable', 'hipotesis', 'descartado');
CREATE TYPE public.viva_status AS ENUM ('si', 'no', 'desconocido');
CREATE TYPE public.relacion_tipo AS ENUM ('padre', 'madre', 'conyuge', 'hijo', 'hermano', 'otro');
CREATE TYPE public.relacion_naturaleza AS ENUM ('biologica', 'adoptiva', 'desconocida');
CREATE TYPE public.evento_tipo AS ENUM ('nacimiento','bautismo','matrimonio','inmigracion','viaje','residencia','censo','defuncion','entierro','otro');
CREATE TYPE public.documento_tipo AS ENUM ('acta_civil','partida_parroquial','pasaporte','lista_pasajeros','censo','foto','certificado','lapida','carta','otro');
CREATE TYPE public.documento_estado AS ENUM ('pendiente','transcrito','verificado','dudoso');
CREATE TYPE public.hipotesis_estado AS ENUM ('abierta','probable','confirmada','descartada');
CREATE TYPE public.coincidencia_estado AS ENUM ('pendiente','confirmada','rechazada','hipotesis','fusionada');
CREATE TYPE public.inferencia_estado AS ENUM ('pending','accepted_as_hypothesis','rejected','confirmed');
CREATE TYPE public.tarea_tipo AS ENUM ('buscar_matrimonio','buscar_nacimiento','buscar_defuncion','buscar_pasajeros','buscar_parroquial','otro');
CREATE TYPE public.tarea_estado AS ENUM ('pendiente','en_proceso','encontrado','descartado');

-- ============ PROFILES & ROLES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ LUGARES ============
CREATE TABLE public.lugares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pais TEXT,
  region TEXT,
  provincia TEXT,
  ciudad TEXT,
  parroquia TEXT,
  archivo TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lugares ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER lugares_updated BEFORE UPDATE ON public.lugares FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERSONAS ============
CREATE TABLE public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  variantes_nombre TEXT[] DEFAULT '{}',
  sexo TEXT,
  nac_fecha DATE,
  nac_fecha_aprox TEXT,
  nac_rango_ini INT,
  nac_rango_fin INT,
  nac_lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  bautismo_fecha DATE,
  bautismo_lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  matrimonio_fecha DATE,
  matrimonio_lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  defuncion_fecha DATE,
  defuncion_lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  entierro_fecha DATE,
  entierro_lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  ocupacion TEXT,
  nacionalidad TEXT,
  religion TEXT,
  notas TEXT,
  certeza public.certeza_nivel NOT NULL DEFAULT 'probable',
  viva public.viva_status NOT NULL DEFAULT 'desconocido',
  ids_externos JSONB NOT NULL DEFAULT '{}'::jsonb,
  enlaces JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE INDEX personas_user_idx ON public.personas(user_id);
CREATE INDEX personas_apellidos_idx ON public.personas(user_id, apellidos);
CREATE TRIGGER personas_updated BEFORE UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RELACIONES ============
CREATE TABLE public.relaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  pariente_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  tipo public.relacion_tipo NOT NULL,
  naturaleza public.relacion_naturaleza NOT NULL DEFAULT 'biologica',
  certeza public.certeza_nivel NOT NULL DEFAULT 'probable',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, persona_id, pariente_id, tipo)
);
ALTER TABLE public.relaciones ENABLE ROW LEVEL SECURITY;

-- ============ EVENTOS ============
CREATE TABLE public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  tipo public.evento_tipo NOT NULL,
  fecha DATE,
  fecha_aprox TEXT,
  rango_ini INT,
  rango_fin INT,
  lugar_original TEXT,
  lugar_id UUID REFERENCES public.lugares(id) ON DELETE SET NULL,
  descripcion TEXT,
  fuente_id UUID,
  certeza public.certeza_nivel NOT NULL DEFAULT 'probable',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE INDEX eventos_persona_idx ON public.eventos(persona_id);
CREATE TRIGGER eventos_updated BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DOCUMENTOS ============
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  fecha DATE,
  tipo public.documento_tipo NOT NULL DEFAULT 'otro',
  archivo_path TEXT,
  url TEXT,
  transcripcion TEXT,
  traduccion TEXT,
  resumen TEXT,
  ocr_texto TEXT,
  ocr_calidad TEXT,
  ocr_dudas TEXT,
  personas_mencionadas UUID[] DEFAULT '{}',
  lugares_mencionados UUID[] DEFAULT '{}',
  cita TEXT,
  repositorio TEXT,
  estado public.documento_estado NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER documentos_updated BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add fuente_id FK now that documentos exists
ALTER TABLE public.eventos ADD CONSTRAINT eventos_fuente_fk FOREIGN KEY (fuente_id) REFERENCES public.documentos(id) ON DELETE SET NULL;

-- ============ VARIANTES & EQUIVALENCIAS ============
CREATE TABLE public.variantes_apellido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apellido_base TEXT NOT NULL,
  variante TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, apellido_base, variante)
);
ALTER TABLE public.variantes_apellido ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.equivalencias_nombre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_base TEXT NOT NULL,
  equivalente TEXT NOT NULL,
  idioma TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nombre_base, equivalente)
);
ALTER TABLE public.equivalencias_nombre ENABLE ROW LEVEL SECURITY;

-- ============ HIPOTESIS ============
CREATE TABLE public.hipotesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  personas UUID[] DEFAULT '{}',
  documentos UUID[] DEFAULT '{}',
  argumentos_favor TEXT,
  argumentos_contra TEXT,
  probabilidad INT DEFAULT 50,
  estado public.hipotesis_estado NOT NULL DEFAULT 'abierta',
  proxima_accion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hipotesis ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER hipotesis_updated BEFORE UPDATE ON public.hipotesis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ COINCIDENCIAS ============
CREATE TABLE public.coincidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  ref_a UUID NOT NULL,
  ref_b UUID NOT NULL,
  score INT NOT NULL DEFAULT 0,
  razones JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado public.coincidencia_estado NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coincidencias ENABLE ROW LEVEL SECURITY;

-- ============ BUSQUEDAS EXTERNAS ============
CREATE TABLE public.busquedas_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  objetivo TEXT,
  query TEXT NOT NULL,
  url TEXT,
  resultado_encontrado BOOLEAN DEFAULT false,
  url_hallazgo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.busquedas_externas ENABLE ROW LEVEL SECURITY;

-- ============ INFERENCIAS ============
CREATE TABLE public.inference_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.inference_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules read all auth" ON public.inference_rules FOR SELECT TO authenticated USING (true);

INSERT INTO public.inference_rules (code, nombre, descripcion) VALUES
  ('R1','Inferencia por padres e hijos','Estima rango de nacimiento de un padre/madre a partir del nacimiento de hijos'),
  ('R2','Inferencia por matrimonio','Sugiere búsqueda de matrimonio antes del primer hijo'),
  ('R3','Inferencia por defunción','Estima rango de defunción según documentos donde aparece vivo o cónyuge viudo/a'),
  ('R4','Inferencia por inmigración','Estima rango migratorio entre nacimiento y primer documento americano'),
  ('R5','Inferencia por lugares','Sugiere residencia familiar probable según lugares de hijos'),
  ('R6','Inferencia por apellidos','Usa variantes conocidas de apellidos'),
  ('R7','Inferencia por nombres repetidos','Detecta patrones familiares y equivalencias italiano↔español'),
  ('R8','Inferencia por documentos','Sugiere relaciones familiares dentro de un mismo documento');

CREATE TABLE public.generated_inferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
  inference_type TEXT NOT NULL,
  inferred_field TEXT,
  inferred_value TEXT,
  date_range_start INT,
  date_range_end INT,
  explanation TEXT NOT NULL,
  confidence_score INT NOT NULL DEFAULT 0,
  status public.inferencia_estado NOT NULL DEFAULT 'pending',
  rule_code TEXT,
  related_person_ids UUID[] DEFAULT '{}',
  related_event_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_inferences ENABLE ROW LEVEL SECURITY;
CREATE INDEX gi_person_idx ON public.generated_inferences(person_id);
CREATE TRIGGER gi_updated BEFORE UPDATE ON public.generated_inferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inference_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inference_id UUID NOT NULL REFERENCES public.generated_inferences(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.documentos(id) ON DELETE SET NULL,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  peso INT DEFAULT 1
);
ALTER TABLE public.inference_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.personas(id) ON DELETE CASCADE,
  inference_id UUID REFERENCES public.generated_inferences(id) ON DELETE SET NULL,
  tipo public.tarea_tipo NOT NULL DEFAULT 'otro',
  descripcion TEXT,
  estado public.tarea_estado NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER rt_updated BEFORE UPDATE ON public.research_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS POLICIES (own_user pattern) ============
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'lugares','personas','relaciones','eventos','documentos',
    'variantes_apellido','equivalencias_nombre','hipotesis',
    'coincidencias','busquedas_externas','generated_inferences',
    'inference_sources','research_tasks'
  ]) LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)', t||'_del', t);
  END LOOP;
END $$;

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos','documentos',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "docs own read" ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
