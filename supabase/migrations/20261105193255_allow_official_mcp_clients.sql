-- Extend the existing consent policy while preserving the installed desktop callback.
alter policy "direct user manages work oauth clients" on public.work_oauth_clients
  with check (
    (select auth.uid()) = user_id
    and (auth.jwt() ->> 'client_id') is null
    and (
      not active
      or redirect_uri in (
        'https://claude.ai/api/mcp/auth_callback',
        'https://claude.com/api/mcp/auth_callback',
        'https://chatgpt.com/connector_platform_oauth_redirect'
      )
      or redirect_uri ~ '^https://chatgpt[.]com/connector/oauth/[A-Za-z0-9_-]{8,200}$'
      or case
        when redirect_uri ~ '^http://127[.]0[.]0[.]1:[1-9][0-9]{3,4}/callback(/[A-Za-z0-9_-]{8,128})?$'
        then split_part(split_part(redirect_uri, ':', 3), '/', 1)::integer between 1024 and 65535
        else false
      end
    )
  );
