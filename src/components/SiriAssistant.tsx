import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const QUICK = [
  { label: "Investigar a alguien", to: "/investigacion?tab=agente" },
  { label: "Lanzar agentes en paralelo", to: "/investigacion?tab=paralelo" },
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
      <button
        aria-label="Asistente"
        className="assistant-trigger fixed z-30 grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_40px_-8px_hsl(var(--mesh-2)/0.6)] ring-1 ring-border/40 transition-transform hover:scale-105 active:scale-95"
      >
        <span className="siri-orb absolute inset-0 rounded-full" />
        <span className="glass absolute inset-1 rounded-full" />
        <Sparkles className="relative h-5 w-5 text-foreground" />
      </button>
      </DialogTrigger>
      <DialogContent className="app-dialog max-w-lg rounded-3xl p-4" aria-describedby={undefined}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="siri-orb h-6 w-6 rounded-full" />
                <DialogTitle className="text-base">Genealogista IA</DialogTitle>
              </div>

            </div>

            <div className="glass mb-3 flex items-center gap-2 rounded-2xl px-3 py-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="¿Qué querés hacer? Ej: investigar una rama familiar…"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <Button size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Enviar al asistente" onClick={submit}>
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.to}
                  onClick={() => { navigate(q.to); setOpen(false); }}
                  className="glass-pill min-h-11 whitespace-normal text-sm hover:bg-foreground/5"
                >
                  {q.label}
                </button>
              ))}
            </div>
      </DialogContent>
    </Dialog>
  );
}
