import { clearAppCache, isAppEditing } from './pwa';
import { toast } from 'sonner';

export type HealAction = 'reload' | 'clear-cache' | 'clear-storage' | 'reset-sw' | 'relogin' | 'deep-repair' | 'none';

export async function applyHeal(action: HealAction) {
  if (action === 'none') return;
  if (isAppEditing()) { toast('Guarda o cierra la edición antes de reiniciar.'); return; }
  if (action === 'relogin') {
    // Offer the real sign-in screen; never delete tokens behind the SDK's back.
    window.location.assign('/login');
    return;
  }
  if (['clear-cache', 'reset-sw', 'clear-storage', 'deep-repair'].includes(action)) {
    // Diagnoses may propose old destructive action names. Recovery now clears
    // only public application caches, preserving accounts, preferences and drafts.
    const ok = await clearAppCache();
    if (!ok) { toast.error('No se pudo renovar la caché. Vuelve a intentar.'); return; }
  }
  if (!isAppEditing()) window.location.reload();
}
