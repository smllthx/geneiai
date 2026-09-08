import { expect, it, vi } from 'vitest';
import { getCanonicalBackendIdentity } from '../../shared/backendIdentity';
import { verifyServerBackend } from './backendConnection';

it('accepts only the configured server and sends no account credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    ok: true, service: 'GENEAI', backend: getCanonicalBackendIdentity(),
  }), { headers: { 'Content-Type': 'application/json' } }));
  await verifyServerBackend(fetcher);
  expect(fetcher).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }));
});

it.each([
  { ok: true, service: 'GENEAI', backend: { projectRef: 'another-project' } },
  { ok: true, service: 'GENEAI' },
])('blocks a stale or different server before login', async body => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  await expect(verifyServerBackend(fetcher)).rejects.toThrow('conexiones distintas');
});

it('does not treat a hosting login page as a healthy GENEAI server', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('<html>Sign in</html>'));
  await expect(verifyServerBackend(fetcher)).rejects.toThrow('No se pudo comprobar');
});
