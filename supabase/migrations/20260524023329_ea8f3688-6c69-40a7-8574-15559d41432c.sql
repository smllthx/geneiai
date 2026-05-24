DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.personas;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.relaciones;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

UPDATE public.relaciones r
SET tipo = 'madre'
FROM public.personas p
WHERE r.pariente_id = p.id
  AND r.tipo = 'padre'
  AND p.sexo = 'femenino';

UPDATE public.relaciones r
SET tipo = 'padre'
FROM public.personas p
WHERE r.pariente_id = p.id
  AND r.tipo = 'madre'
  AND p.sexo = 'masculino';