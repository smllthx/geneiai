import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { applyAppUpdate, clearAppCache, isAppEditing } from '@/lib/pwa';
import { currentRelease, fetchAppRelease, type AppRelease } from '@/lib/appRelease';

export default function AppUpdateNotifier() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const onShow = async () => {
      setRelease(currentRelease);
      setReady(false);
      try {
        const [latest, registration] = await Promise.all([
          fetchAppRelease(),
          navigator.serviceWorker?.getRegistration(),
        ]);
        if (active) {
          setRelease(open => open ? latest : null);
          setReady(Boolean(registration?.waiting) || latest.version !== currentRelease.version);
        }
      } catch { /* Installed notes remain available offline. */ }
    };
    const onClearCache = async () => {
      if (isAppEditing()) { toast('Guarda o cierra la edición antes de recargar.'); return; }
      const ok = await clearAppCache();
      if (ok && !isAppEditing()) window.location.reload();
      else toast('No se pudo recargar. Vuelve a intentarlo.');
    };
    window.addEventListener('geneai:show-release', onShow);
    window.addEventListener('genaia:clear-cache', onClearCache);
    return () => {
      active = false;
      window.removeEventListener('geneai:show-release', onShow);
      window.removeEventListener('genaia:clear-cache', onClearCache);
    };
  }, []);
  const dismiss = () => {
    setRelease(null);
  };
  const update = async () => {
    setBusy(true);
    try {
      const result = await applyAppUpdate();
      if (result === 'editing') toast('Guarda o cierra la edición antes de actualizar.');
      else if (result === 'unavailable' && !isAppEditing()) window.location.reload();
    } catch { toast.error('No se pudo actualizar. Comprueba la conexión y vuelve a intentar.'); }
    finally { setBusy(false); }
  };
  if (!release) return null;
  return <aside role="region" aria-label="Novedades de GENEAI" className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-lg rounded-2xl border bg-background p-4 shadow-xl" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    <h2 className="font-semibold">{ready ? 'Actualización disponible' : 'GENEAI actualizado'} · {release.version}</h2>
    <ul className="my-3 max-h-[32dvh] list-disc space-y-1 overflow-y-auto pl-5 text-sm text-muted-foreground">{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={dismiss}>{ready ? 'Más tarde' : 'Entendido'}</Button>
      {ready && <Button onClick={update} disabled={busy}>{busy ? 'Actualizando…' : 'Actualizar ahora'}</Button>}
    </div>
  </aside>;
}
