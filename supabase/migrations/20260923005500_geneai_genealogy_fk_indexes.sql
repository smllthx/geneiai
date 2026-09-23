-- Add covering foreign-key indexes without changing accounts, records or RLS.
-- Safe to replay; retain existing indexes until there is workload evidence.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE INDEX IF NOT EXISTS geneai_relaciones_pariente_fk_idx ON public.relaciones (pariente_id);
CREATE INDEX IF NOT EXISTS geneai_relaciones_persona_fk_idx ON public.relaciones (persona_id);
CREATE INDEX IF NOT EXISTS geneai_personas_arbol_fk_idx ON public.personas (arbol_id);
CREATE INDEX IF NOT EXISTS geneai_eventos_arbol_fk_idx ON public.eventos (arbol_id);
