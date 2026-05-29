import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK = [
  { label: "Investigar a alguien", to: "/agente" },
  { label: "Lanzar agentes en paralelo", to: "/agentes-paralelo" },
  { label: "Importar árbol", to: "/importar" },
  { label: "Auto-configurar la app", to: "/configurar-app" },
  { label: "Ver coincidencias", to: "/coincidencias" },
];

export default function SiriAssistant() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const navigate = useNavigate();

  const submit = () => {
    if (!text.trim()) {
      navigate(`/asistente`);
    } else {
      navigate(`/asistente?prompt=${encodeURIComponent(text)}`);
    }
    setOpen(false);
    setText("");
  };

  return (
    <>
      <button
        aria-label="Asistente"
        onClick={() => setOpen(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
        className="fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_40px_-8px_hsl(var(--mesh-2)/0.6)] ring-1 ring-border/40 transition-transform hover:scale-105 active:scale-95 md:!bottom-6"
      >
        <span className="siri-orb absolute inset-0 rounded-full" />
        <span className="glass absolute inset-1 rounded-full" />
        <Sparkles className="relative h-5 w-5 text-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/10 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpen(false)}>
          <div className="glass-strong w-full max-w-lg rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="siri-orb h-6 w-6 rounded-full" />
                <span className="font-display text-sm font-semibold">Asistente</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="glass mb-3 flex items-center gap-2 rounded-2xl px-3 py-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="¿Qué querés hacer? Ej: investigar una rama familiar…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button size="icon" className="h-8 w-8 rounded-full" onClick={submit}>
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.to}
                  onClick={() => { navigate(q.to); setOpen(false); }}
                  className="glass-pill hover:bg-foreground/5"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
