-- Performance and integrity hardening for GENEAI.
-- Safe additions only: indexes, optional metadata columns and non-destructive guards.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast search and active-tree filters.
CREATE INDEX IF NOT EXISTS personas_user_arbol_apellidos_idx
  ON public.personas(user_id, arbol_id, lower(apellidos), lower(nombres));

CREATE INDEX IF NOT EXISTS personas_user_arbol_updated_idx
  ON public.personas(user_id, arbol_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS personas_nombres_trgm_idx
  ON public.personas USING gin ((coalesce(nombres, '') || ' ' || coalesce(apellidos, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS relaciones_persona_tipo_idx
  ON public.relaciones(user_id, arbol_id, persona_id, tipo);

CREATE INDEX IF NOT EXISTS relaciones_pariente_tipo_idx
  ON public.relaciones(user_id, arbol_id, pariente_id, tipo);

CREATE INDEX IF NOT EXISTS eventos_user_arbol_persona_tipo_fecha_idx
  ON public.eventos(user_id, arbol_id, persona_id, tipo, fecha);

CREATE INDEX IF NOT EXISTS eventos_lugar_fecha_idx
  ON public.eventos(user_id, lugar_id, fecha);

CREATE INDEX IF NOT EXISTS documentos_user_arbol_estado_fecha_idx
  ON public.documentos(user_id, arbol_id, estado, fecha DESC);

CREATE INDEX IF NOT EXISTS documentos_personas_mencionadas_gin_idx
  ON public.documentos USING gin(personas_mencionadas);

CREATE INDEX IF NOT EXISTS fotos_user_arbol_created_idx
  ON public.fotos(user_id, arbol_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_suggestions_user_arbol_status_type_idx
  ON public.ai_suggestions(user_id, arbol_id, status, suggestion_type, created_at DESC);

-- Merge/version metadata without deleting duplicate rows.
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS fusionado_en UUID REFERENCES public.personas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fusionado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fusionado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.relaciones
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

-- Generic version bump used for optimistic conflict detection in the UI.
CREATE OR REPLACE FUNCTION public.bump_row_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.row_version = COALESCE(OLD.row_version, 0) + 1;
  IF NEW.updated_at IS NOT NULL THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personas_bump_version ON public.personas;
CREATE TRIGGER personas_bump_version
BEFORE UPDATE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS relaciones_bump_version ON public.relaciones;
CREATE TRIGGER relaciones_bump_version
BEFORE UPDATE ON public.relaciones
FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS eventos_bump_version ON public.eventos;
CREATE TRIGGER eventos_bump_version
BEFORE UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS documentos_bump_version ON public.documentos;
CREATE TRIGGER documentos_bump_version
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

-- Prevent clearly impossible chronology in future writes. Existing data is untouched.
CREATE OR REPLACE FUNCTION public.validate_persona_chronology()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nac_fecha IS NOT NULL AND NEW.defuncion_fecha IS NOT NULL AND NEW.defuncion_fecha < NEW.nac_fecha THEN
    RAISE EXCEPTION 'La defunción no puede ser anterior al nacimiento';
  END IF;
  IF NEW.nac_fecha IS NOT NULL AND NEW.matrimonio_fecha IS NOT NULL AND NEW.matrimonio_fecha < NEW.nac_fecha THEN
    RAISE EXCEPTION 'El matrimonio no puede ser anterior al nacimiento';
  END IF;
  IF NEW.nac_rango_ini IS NOT NULL AND NEW.nac_rango_fin IS NOT NULL AND NEW.nac_rango_fin < NEW.nac_rango_ini THEN
    RAISE EXCEPTION 'El rango de nacimiento está invertido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personas_validate_chronology ON public.personas;
CREATE TRIGGER personas_validate_chronology
BEFORE INSERT OR UPDATE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.validate_persona_chronology();

CREATE OR REPLACE FUNCTION public.prevent_exact_person_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id UUID;
BEGIN
  SELECT id INTO existing_id
  FROM public.personas
  WHERE user_id = NEW.user_id
    AND COALESCE(arbol_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.arbol_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND lower(trim(nombres)) = lower(trim(NEW.nombres))
    AND lower(trim(apellidos)) = lower(trim(NEW.apellidos))
    AND nac_fecha IS NOT DISTINCT FROM NEW.nac_fecha
    AND defuncion_fecha IS NOT DISTINCT FROM NEW.defuncion_fecha
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una persona idéntica en este árbol: %', existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personas_prevent_exact_duplicate ON public.personas;
CREATE TRIGGER personas_prevent_exact_duplicate
BEFORE INSERT ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.prevent_exact_person_duplicate();
