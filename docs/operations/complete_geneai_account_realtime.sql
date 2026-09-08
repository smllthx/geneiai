-- Complete the existing GENEAI realtime publication without changing rows or access policies.
DO $geneai$
DECLARE
  target text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'The existing supabase_realtime publication is required';
  END IF;
  FOREACH target IN ARRAY ARRAY['arboles','profiles','personas','relaciones','eventos','documentos','fotos','dna_estimates','familias','research_tasks','hipotesis','generated_inferences','sugerencias']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=target AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'GENEAI table % must already exist with RLS enabled', target;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
    END IF;
  END LOOP;
END
$geneai$;
