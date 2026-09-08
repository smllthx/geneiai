import { getCanonicalBackendIdentity } from '../../shared/backendIdentity';

/** No session or private keys are sent to this public readiness endpoint. */
export async function verifyServerBackend(fetcher: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher('/api/health', {
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('El servidor de GENEAI no está disponible. Vuelve a intentarlo.');
    const actual = await response.json();
    const expected = getCanonicalBackendIdentity();
    if (actual.ok !== true || actual.service !== 'GENEAI' ||
        actual.backend?.projectRef !== expected.projectRef ||
        actual.backend?.supabaseUrl !== expected.supabaseUrl ||
        actual.backend?.authOrigin !== expected.authOrigin) {
      throw new Error('Esta versión y el servidor usan conexiones distintas. Es necesario actualizar la configuración de GENEAI.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('GENEAI')) throw error;
    throw new Error('No se pudo comprobar la conexión con GENEAI. Revisa internet y vuelve a intentarlo.');
  } finally {
    clearTimeout(timeout);
  }
}
