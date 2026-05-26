-- Replica identity full para que los eventos UPDATE/DELETE traigan la fila completa
ALTER TABLE public.personas REPLICA IDENTITY FULL;
ALTER TABLE public.relaciones REPLICA IDENTITY FULL;
ALTER TABLE public.eventos REPLICA IDENTITY FULL;
ALTER TABLE public.documentos REPLICA IDENTITY FULL;
ALTER TABLE public.fotos REPLICA IDENTITY FULL;

-- Agregar a la publicación realtime (idempotente)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personas','relaciones','eventos','documentos','fotos'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;