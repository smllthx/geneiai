-- OAuth tokens issued for Work are valid identity tokens, but they must never
-- become a second direct database or storage API. Only the MCP server may turn
-- an approved token into scoped GENEAI operations.
DROP POLICY IF EXISTS "block direct oauth tokens from geneai storage" ON storage.objects;
CREATE POLICY "block direct oauth tokens from geneai storage"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL)
  WITH CHECK ((auth.jwt() ->> 'client_id') IS NULL);

-- The audit is readable by its owner but append-only from the private MCP
-- backend. Normal user sessions cannot forge Work audit entries.
DROP POLICY IF EXISTS "own work audit insert" ON public.work_audit_log;
