import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Sparkles, Check, X, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string; tools?: { name: string; result: any }[] };
type Sugerencia = {
  id: string; tipo: string; titulo: string; descripcion: string | null;
  payload: any; persona_id: string | null; estado: string; confianza: number; created_at: string;
};

export default function Asistente() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola 👋 Soy tu asistente genealógico. Pedime que **busque**, **complete** o **conecte** personas. Cualquier cambio lo dejo como sugerencia para que revises." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadSugerencias = async () => {
    const { data } = await supabase
      .from("sugerencias").select("*").eq("estado", "pendiente")
      .order("created_at", { ascending: false }).limit(20);
    setSugerencias((data ?? []) as Sugerencia[]);
  };
  useEffect(() => { loadSugerencias(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-genealogy", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      setMessages((m) => [...m, {
        role: "assistant",
        content: data?.content || "(sin respuesta)",
        tools: (data?.tool_events ?? []).map((t: any) => ({ name: t.name, result: t.result })),
      }]);
      if ((data?.tool_events ?? []).some((t: any) => t.name === "propose_change")) {
        await loadSugerencias();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error consultando al asistente");
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
        const { error } = await supabase.from("personas").insert({
          user_id: user.id,
          nombres: p.nombres ?? "Sin nombre",
          apellidos: p.apellidos ?? "",
          sexo: p.sexo ?? null,
          nac_fecha: p.nac_fecha ?? null,
          ocupacion: p.ocupacion ?? null,
          notas: p.notas ?? null,
        });
        if (error) throw error;
      } else if (s.tipo === "actualizar_persona" && s.persona_id) {
        const { error } = await supabase.from("personas").update(s.payload ?? {}).eq("id", s.persona_id);
        if (error) throw error;
      } else {
        toast.message("Tipo de sugerencia aún no aplicable automáticamente — marcada como aceptada.");
      }
      await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", s.id);
      toast.success("Sugerencia aceptada");
      loadSugerencias();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo aplicar");
    }
  };

  const rejectChange = async (s: Sugerencia) => {
    await supabase.from("sugerencias").update({ estado: "rechazada" }).eq("id", s.id);
    loadSugerencias();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Chat */}
      <div className="glass flex h-[calc(100vh-9rem)] flex-col rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Asistente genealógico</h2>
            <p className="text-[11px] text-muted-foreground">Lovable AI · Gemini 3.1 Pro</p>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-foreground/5"
              }`}>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                    {m.tools.map((t, j) => (
                      <div key={j} className="text-[10px] text-muted-foreground">
                        🔧 <span className="font-mono">{t.name}</span>
                        {t.result?.ok && " ✓"}
                        {t.result?.results && ` · ${t.result.results.length} resultados`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> pensando…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border/40 p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pedime que busque, complete o sugiera…"
              className="min-h-[44px] resize-none"
              autoFocus
            />
            <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sugerencias */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold">Sugerencias pendientes</h3>
          <span className="text-[10px] text-muted-foreground">{sugerencias.length}</span>
        </div>
        {sugerencias.length === 0 && (
          <p className="rounded-xl bg-foreground/5 p-3 text-xs text-muted-foreground">
            Ninguna por ahora. Pedile al asistente que proponga algo.
          </p>
        )}
        {sugerencias.map((s) => (
          <div key={s.id} className="glass rounded-xl p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.tipo.replaceAll("_", " ")}</p>
                <p className="truncate text-sm font-semibold">{s.titulo}</p>
              </div>
              <span className="rounded-full bg-foreground/8 px-1.5 py-0.5 text-[9px] tabular-nums">{s.confianza}%</span>
            </div>
            {s.descripcion && <p className="mb-2 text-xs text-muted-foreground">{s.descripcion}</p>}
            <div className="flex gap-1.5">
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
    </div>
  );
}
