import { lazy, useEffect, useState, type ComponentType } from "react";
import { hasOpenEditor, isModuleLoadError, recoverStaleView, revalidateFailedAssets } from "@/lib/moduleRecovery";

function ModuleUnavailable({ editorWasOpen }: { editorWasOpen: boolean }) {
  const [retrying, setRetrying] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (!online || (!retrying && editorWasOpen)) return;
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    const run = async () => {
      if (!retrying) return recoverStaleView(controller.signal);
      await revalidateFailedAssets(controller.signal);
      if (!current) return;
      setRetrying(false);
      if (navigator.onLine && (!hasOpenEditor() || window.confirm("Si recargas, podrías perder cambios sin guardar. ¿Recargar esta pestaña?"))) window.location.reload();
    };
    void run().finally(() => window.clearTimeout(timeout));
    return () => { current = false; controller.abort(); window.clearTimeout(timeout); };
  }, [online, editorWasOpen, retrying]);

  return <section role="alert" className="mx-auto my-8 max-w-md rounded-2xl border bg-card p-5">
    <h2 className="font-semibold">{online ? "Esta sección no terminó de cargar" : "Estás sin conexión"}</h2>
    <p className="my-3 text-sm text-muted-foreground">{online ? "Puedes volver a abrirla recargando esta pestaña." : "Cuando vuelva la conexión podrás abrir esta sección."}</p>
    <button type="button" disabled={!online || retrying} onClick={() => setRetrying(true)} className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50">Volver a cargar</button>
  </section>;
}

/** Keep the surrounding navigation and other mounted views alive if this chunk is unavailable. */
export function lazyView<Props>(load: () => Promise<{ default: ComponentType<Props> }>) {
  return lazy<ComponentType<Props>>(async () => {
    try { return await load(); }
    catch (error) {
      if (!isModuleLoadError(error)) throw error;
      const editorWasOpen = hasOpenEditor();
      return { default: () => <ModuleUnavailable editorWasOpen={editorWasOpen} /> };
    }
  });
}
