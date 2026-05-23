-- Elimina duplicados existentes conservando el más antiguo
DELETE FROM public.relaciones a
USING public.relaciones b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.persona_id = b.persona_id
  AND a.pariente_id = b.pariente_id
  AND a.tipo = b.tipo;

-- Índice único para prevenir duplicados futuros desde cualquier vía
CREATE UNIQUE INDEX IF NOT EXISTS relaciones_uniq_user_pair_tipo
ON public.relaciones (user_id, persona_id, pariente_id, tipo);