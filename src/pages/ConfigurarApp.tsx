import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Provider = "openai";

interface Config {
  user_id: string;
  acento: string;
  idioma: string;
  region_busqueda: string | null;
  proveedor_default: Provider;
  modelo_default: string;
  proveedores_activos: Provider[];
  asistente_voz: boolean;
  investigacion_auto: boolean;
  configurado: boolean;
}

const ACENTOS = [
  { id: "azul", label: "Azul iOS", h: 211 },
  { id: "violeta", label: "Violeta", h: 280 },
  { id: "rosa", label: "Rosa", h: 340 },
  { id: "verde", label: "Verde", h: 150 },
  { id: "naranja", label: "Naranja", h: 25 },
];

const REGIONES = ["Argentina", "Italia (Liguria)", "Suiza", "España", "Francia", "Alemania", "Brasil", "Uruguay", "Otra"];

export default function ConfigurarApp() {
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState({ personas: 0, documentos: 0, eventos: 0 });
  const [cfg, setCfg] = useState<Config>({
    user_id: "",
    acento: "azul",
    idioma: "es",
    region_busqueda: null,
    proveedor_default: "openai",
    modelo_default: "openai/gpt-4o-mini",
    proveedores_activos: ["openai"],
    asistente_voz: false,
    investigacion_auto: true,
    configurado: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ count: pc }, { count: dc }, { count: ec }, { data: existing }] = await Promise.all([
        supabase.from("personas").select("*", { count: "exact", head: true }),
        supabase.from("documentos").select("*", { count: "exact", head: true }),
        supabase.from("eventos").select("*", { count: "exact", head: true }),
        supabase.from("app_config").select("*").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setStats({ personas: pc ?? 0, documentos: dc ?? 0, eventos: ec ?? 0 });
      setCfg((c) => ({
        ...c,
        user_id: u.user!.id,
        ...(existing ? { ...(existing as any), proveedor_default: "openai", modelo_default: "openai/gpt-4o-mini", proveedores_activos: ["openai"] } : {}),
      }));
      setLoading(false);
    })();
  }, []);

  const guardar = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_config").upsert({
        ...cfg,
        proveedor_default: "openai",
        modelo_default: "openai/gpt-4o-mini",
        proveedores_activos: ["openai"],
        configurado: true,
      }, { onConflict: "user_id" });
      if (error) throw error;
      // Aplicar acento al CSS
      const acento = ACENTOS.find((a) => a.id === cfg.acento);
      if (acento) document.documentElement.style.setProperty("--primary", `${acento.h} 100% 50%`);
      toast.success("Configuración guardada");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6" />
          <h1 className="font-display text-3xl font-bold tracking-tight">Auto-configurar</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          La app se adapta a tu árbol y a cómo querés trabajar. 4 pasos rápidos.
        </p>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-foreground/10"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Tu árbol hoy</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Personas", v: stats.personas },
                { l: "Documentos", v: stats.documentos },
                { l: "Eventos", v: stats.eventos },
              ].map((s) => (
                <div key={s.l} className="glass rounded-2xl p-4 text-center">
                  <p className="font-display text-2xl font-bold">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.personas === 0
                ? "Tu árbol está vacío. Te recomendamos importar un GEDCOM o crear las primeras personas."
                : stats.personas < 20
                ? "Buen comienzo. Activá la investigación automática para que la app busque por vos."
                : "Tenés un árbol robusto. Vamos a habilitarte agentes en paralelo para procesarlo más rápido."}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Color de acento</h2>
            <div className="flex flex-wrap gap-2">
              {ACENTOS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setCfg((c) => ({ ...c, acento: a.id }));
                    document.documentElement.style.setProperty("--primary", `${a.h} 100% 50%`);
                  }}
                  className={`glass-pill h-10 px-4 ${cfg.acento === a.id ? "ring-2 ring-primary" : ""}`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: `hsl(${a.h} 100% 50%)` }}
                  />
                  {a.label}
                </button>
              ))}
            </div>
            <h2 className="font-display text-xl font-semibold">Región principal</h2>
            <select
              className="glass-input w-full"
              value={cfg.region_busqueda ?? ""}
              onChange={(e) => setCfg((c) => ({ ...c, region_busqueda: e.target.value || null }))}
            >
              <option value="">Sin preferencia</option>
              {REGIONES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">IA de la app</h2>
            <p className="text-sm text-muted-foreground">
              Todas las secciones inteligentes usan ChatGPT con tu configuración de OpenAI.
            </p>
            {([
              { id: "openai", label: "ChatGPT para genealogía", req: "Asistente virtual, búsquedas, análisis, lectores y agentes en segundo plano" },
            ] as const).map((p) => (
              <label key={p.id} className="glass flex cursor-default items-center justify-between gap-3 rounded-2xl p-3">
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.req}</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={true}
                  readOnly
                />
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Comportamiento</h2>
            <label className="glass flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3">
              <div>
                <p className="font-medium">Investigación automática diaria</p>
                <p className="text-xs text-muted-foreground">El agente busca pistas nuevas en segundo plano.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={cfg.investigacion_auto}
                onChange={(e) => setCfg((c) => ({ ...c, investigacion_auto: e.target.checked }))}
              />
            </label>
            <label className="glass flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3">
              <div>
                <p className="font-medium">Asistente por voz (próximamente)</p>
                <p className="text-xs text-muted-foreground">Hablale al asistente como a Siri.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={cfg.asistente_voz}
                onChange={(e) => setCfg((c) => ({ ...c, asistente_voz: e.target.checked }))}
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Atrás
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="rounded-xl">Siguiente</Button>
          ) : (
            <Button onClick={guardar} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar y empezar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
