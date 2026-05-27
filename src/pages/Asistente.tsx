import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bot, Send, Sparkles, Loader2, User, Wand2, ListChecks, Check, X, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { isCreditOrAiError, localAssistantReply } from "@/lib/offlineAi";

type ToolEvent = { name: string; args?: any; result?: any };
type Msg = { role: "user" | "assistant"; content: string; tools?: ToolEvent[] };
type Sugerencia = {
  id: string; tipo: string; titulo: string; descripcion: string | null;
  payload: any; persona_id: string | null; estado: string; confianza: number;
};

const TOOL_LABELS: Record<string, string> = {
  search_personas: "Buscando personas",
  get_persona: "Consultando ficha",
  list_recent: "Listando personas",
  create_persona: "Creando persona",
  update_persona: "Actualizando datos",
  create_relation: "Conectando relación",
  set_proband: "Definiendo persona principal",
  mega_search: "🚀 Lanzando 6 agentes",
  web_search: "🌐 Buscando en la web",
  agent_investigar: "🧠 Investigación IA",
  check_coherence: "🛡️ Verificando coherencia",
  navigate_to: "↗️ Navegando",
  propose_change: "📝 Sugerencia creada",
};

const QUICK = [
  "Mostrame el árbol de la persona principal",
  "Lanzá el mega-buscador para la persona principal",
  "Buscá información en la web sobre…",
  "Creá una persona llamada …",
  "Verificá la coherencia del árbol",
  "Conectá a … como padre de …",
];

export default function Asistente() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "👋 Hola, soy **GENAIA**. Puedo hacer **todo** en la app por vos: crear personas, conectar relaciones, lanzar investigaciones, buscar en la web, verificar coherencia, navegar pantallas. **Pedime lo que quieras.**" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadSugerencias = async () => {
    const { data } = await supabase.from("sugerencias").select("*")
      .eq("estado", "pendiente").order("created_at", { ascending: false }).limit(20);
    setSugerencias((data ?? []) as Sugerencia[]);
  };
  useEffect(() => { loadSugerencias(); }, []);
  const [params] = useSearchParams();
  useEffect(() => {
    const p = params.get("prompt");
    if (p) { send(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (textParam?: string) => {
    const text = (textParam ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      let { data, error } = await supabase.functions.invoke("ai-genealogy", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error || data?.error) {
        if (!isCreditOrAiError(error ?? data?.error)) throw (error ?? new Error(data.error));
        data = await localAssistantReply(text);
        toast.info("Configura OpenAI para respuestas completas de ChatGPT. Usé una respuesta local.");
      }
      const events: ToolEvent[] = data?.tool_events ?? [];
      setMessages((m) => [...m, { role: "assistant", content: data?.content || "(sin respuesta)", tools: events }]);
      // Auto-actions on UI side
      const nav = events.find((e) => e.name === "navigate_to" && e.result?.navigate_to);
      if (nav?.result?.navigate_to) {
        toast.success(`Navegando…`, { description: nav.result.navigate_to });
        setTimeout(() => navigate(nav.result.navigate_to), 400);
      }
      const created = events.find((e) => e.name === "create_persona" && e.result?.ok);
      if (created) toast.success("Persona creada");
      const rel = events.find((e) => e.name === "create_relation" && e.result?.ok);
      if (rel) toast.success("Relación creada");
      const mega = events.find((e) => e.name === "mega_search" && e.result?.ok);
      if (mega) toast.success(`Mega-buscador: ${mega.result.sugerencias ?? 0} hallazgos`);
      if (events.some((e) => e.name === "propose_change")) await loadSugerencias();
    } catch (e: any) {
      const data = await localAssistantReply(text);
      setMessages((m) => [...m, { role: "assistant", content: data.content, tools: data.tool_events }]);
      toast.info("Respuesta local activada. Configura OpenAI para usar ChatGPT.");
    } finally {
      setLoading(false);
    }
  };

  const applyChange = async (s: Sugerencia) => {
    try {
      if (s.tipo === "nueva_persona") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("no auth");
        const p = s.payload ?? {};
        await supabase.from("personas").insert({
          user_id: user.id, nombres: p.nombres ?? "Sin nombre", apellidos: p.apellidos ?? "",
          sexo: p.sexo ?? null, nac_fecha: p.nac_fecha ?? null, ocupacion: p.ocupacion ?? null, notas: p.notas ?? null,
        });
      } else if (s.tipo === "actualizar_persona" && s.persona_id) {
        await supabase.from("personas").update(s.payload ?? {}).eq("id", s.persona_id);
      }
      await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", s.id);
      toast.success("Aceptada");
      loadSugerencias();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  };
  const rejectChange = async (s: Sugerencia) => {
    await supabase.from("sugerencias").update({ estado: "rechazada" }).eq("id", s.id);
    loadSugerencias();
  };

  return (
    <div
      className="-mx-3 -mt-3 flex flex-col bg-background md:-mx-6 md:-mt-0"
      style={{ minHeight: "calc(100vh - 1px)" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.55rem)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
            <Bot className="h-4.5 w-4.5" />
            {loading && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
          </div>
          <div>
            <p className="font-display text-sm font-semibold leading-none">GENAIA</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Hace todo en la app</p>
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <ListChecks className="h-3.5 w-3.5" /> {sugerencias.length}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0">
            <SheetHeader className="border-b border-border/60 p-4"><SheetTitle>Sugerencias pendientes</SheetTitle></SheetHeader>
            <div className="space-y-2 p-3">
              {sugerencias.length === 0 && (
                <p className="rounded-xl bg-foreground/5 p-3 text-xs text-muted-foreground">Ninguna por ahora.</p>
              )}
              {sugerencias.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border/60 bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.tipo.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 text-sm font-semibold">{s.titulo}</p>
                  {s.descripcion && <p className="mt-1 text-xs text-muted-foreground">{s.descripcion}</p>}
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => applyChange(s)}>
                      <Check className="mr-1 h-3 w-3" /> Aceptar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => rejectChange(s)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4" style={{ paddingBottom: "10rem" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-foreground/10" : "bg-primary/15"}`}>
              {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60"
            }`}>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.tools && m.tools.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                  {m.tools.map((t, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{TOOL_LABELS[t.name] ?? t.name}</span>
                      {t.result?.ok && <span className="text-emerald-500">✓</span>}
                      {t.result?.error && <span className="text-destructive">✗</span>}
                      {t.result?.results && <span>· {t.result.results.length}</span>}
                      {t.result?.sugerencias != null && <span>· {t.result.sugerencias} hallazgos</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="inline-flex items-center gap-1">
              GENAIA está pensando<span className="animate-pulse">…</span>
            </span>
          </div>
        )}
        {messages.length <= 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5 px-1">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)}
                className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] transition-all hover:border-primary/50 hover:bg-primary/5">
                <Wand2 className="mr-1 inline h-3 w-3 text-primary" />{q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer fixed bottom (above mobile nav) */}
      <div
        className="fixed inset-x-0 z-30 px-3 md:left-64 md:px-6"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-[0_-8px_24px_-12px_hsl(var(--foreground)/0.15)] backdrop-blur-md">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Pedime cualquier cosa…"
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="h-10 w-10 shrink-0 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
