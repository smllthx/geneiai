import release from '../../public/release.json';
export type AppRelease = { version: string; publishedAt: string; changes: string[] };
export const currentRelease: AppRelease = release;
export async function fetchAppRelease(): Promise<AppRelease> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/release.json', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('No se pudo comprobar la versión.');
    const value = await response.json();
    if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version) || !Array.isArray(value.changes) || !value.changes.every((line: unknown) => typeof line === 'string')) throw new Error('Versión no válida.');
    return value;
  } finally { window.clearTimeout(timeout); }
}
