import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSearch,
  Languages,
  Link2,
  ScanText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type WorkflowAction = {
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
};

type ResearchEntry = {
  id: string;
  objetivo: string;
  url: string;
  estado: "positivo" | "negativo" | "neutro";
  nota: string;
  createdAt: string;
};

const LOG_KEY = "geneai:research-log";

function readLog(): ResearchEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLog(entries: ResearchEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 120)));
  } catch {}
}

function downloadCsv(entries: ResearchEntry[]) {
  const escape = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["fecha", "estado", "objetivo", "url", "nota"].map(escape).join(","),
    ...entries.map((entry) => [entry.createdAt, entry.estado, entry.objetivo, entry.url, entry.nota].map(escape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geneai-bitacora-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DocumentIntelligencePanel({
  activeTitle,
  hasActiveDocument,
  onTranscribe,
  onExtract,
  onSuggestions,
  className,
}: {
  activeTitle?: string | null;
  hasActiveDocument?: boolean;
  onTranscribe?: () => void | Promise<void>;
  onExtract?: () => void | Promise<void>;
  onSuggestions?: () => void | Promise<void>;
  className?: string;
}) {
  const actions: WorkflowAction[] = [
    {
      label: "OCR / HTR",
      description: "Lee texto impreso o manuscrito y deja una transcripción editable.",
      icon: <ScanText className="h-4 w-4" />,
      disabled: !hasActiveDocument,
      onClick: onTranscribe,
    },
    {
      label: "Traducir e interpretar",
      description: "Prepara contexto histórico, idioma, símbolos, sellos o abreviaturas.",
      icon: <Languages className="h-4 w-4" />,
      disabled: !hasActiveDocument,
      onClick: onExtract,
    },
    {
      label: "Extraer evidencia",
      description: "Nombres, fechas, lugares, relaciones, ocupaciones y eventos.",
      icon: <FileSearch className="h-4 w-4" />,
      disabled: !hasActiveDocument,
      onClick: onExtract,
    },
    {
      label: "Crear sugerencias",
      description: "Convierte lo extraído en tareas revisables, sin tocar el árbol automáticamente.",
      icon: <Sparkles className="h-4 w-4" />,
      disabled: !hasActiveDocument,
      onClick: onSuggestions,
    },
  ];

  const steps = [
    "Subir fuente",
    "Transcribir",
    "Traducir / explicar",
    "Extraer datos",
    "Vincular personas",
    "Confirmar evidencia",
  ];

  return (
    <section className={cn("rounded-3xl border border-cyan-300/20 bg-card/70 p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Mesa documental IA</p>
          <h2 className="font-display text-xl font-semibold">De documento a evidencia verificable</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Flujo unificado inspirado en herramientas documentales modernas: subir, leer, traducir, extraer,
            conectar y confirmar. La IA sugiere; tú decides qué entra al árbol.
          </p>
          {activeTitle && (
            <Badge variant="outline" className="mt-2 max-w-full truncate">
              Documento activo: {activeTitle}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">OCR / HTR</Badge>
          <Badge variant="secondary">Entidades</Badge>
          <Badge variant="secondary">Citas</Badge>
          <Badge variant="secondary">Revisión humana</Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium">
              {index + 1}. {step}
            </span>
            {index < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className="rounded-2xl border border-border/70 bg-background/50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">{action.icon}</span>
            <span className="mt-2 block text-sm font-semibold">{action.label}</span>
            <span className="mt-1 block text-xs leading-snug text-muted-foreground">{action.description}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
          <BookOpenCheck className="mb-2 h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Base de conocimiento</p>
          <p className="mt-1 text-xs text-muted-foreground">Cada fuente queda conectada a personas, eventos, lugares e hipótesis revisables.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
          <ClipboardList className="mb-2 h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Trazabilidad</p>
          <p className="mt-1 text-xs text-muted-foreground">Guarda transcripción, extracto, cita, repositorio, estado y personas mencionadas.</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
          <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">No automático destructivo</p>
          <p className="mt-1 text-xs text-muted-foreground">Las relaciones y duplicados pasan por Sugerencias antes de modificar el árbol.</p>
        </div>
      </div>
    </section>
  );
}

export function ResearchLogPanel({ className }: { className?: string }) {
  const [entries, setEntries] = useState<ResearchEntry[]>(() => readLog());
  const [objetivo, setObjetivo] = useState("");
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<ResearchEntry["estado"]>("neutro");
  const [nota, setNota] = useState("");

  const stats = useMemo(() => ({
    positivos: entries.filter((entry) => entry.estado === "positivo").length,
    negativos: entries.filter((entry) => entry.estado === "negativo").length,
    neutros: entries.filter((entry) => entry.estado === "neutro").length,
  }), [entries]);

  const add = () => {
    const entry: ResearchEntry = {
      id: crypto.randomUUID(),
      objetivo: objetivo.trim() || "Búsqueda sin objetivo escrito",
      url: url.trim(),
      estado,
      nota: nota.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    writeLog(next);
    setObjetivo("");
    setUrl("");
    setEstado("neutro");
    setNota("");
  };

  const remove = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    writeLog(next);
  };

  return (
    <section className={cn("rounded-3xl border border-border bg-card/70 p-4", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Bitácora de investigación</p>
          <h2 className="font-display text-xl font-semibold">Registro de búsquedas y resultados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anota búsquedas positivas, negativas y neutras. Sirve para no repetir caminos y para justificar hipótesis.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{stats.positivos} positivas</Badge>
          <Badge variant="outline">{stats.negativos} negativas</Badge>
          <Badge variant="outline">{stats.neutros} neutras</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1.2fr_1fr_150px]">
        <div>
          <Label>Objetivo / persona / pista</Label>
          <Input value={objetivo} onChange={(event) => setObjetivo(event.target.value)} placeholder="Ej. Buscar acta de matrimonio de..." />
        </div>
        <div>
          <Label>URL o repositorio</Label>
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://, FamilySearch, archivo, libro..." />
        </div>
        <div>
          <Label>Resultado</Label>
          <Select value={estado} onValueChange={(value) => setEstado(value as ResearchEntry["estado"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="positivo">Positivo</SelectItem>
              <SelectItem value="negativo">Negativo</SelectItem>
              <SelectItem value="neutro">Neutro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="lg:col-span-3">
          <Label>Resumen, cita, abstract o próximos pasos</Label>
          <Textarea value={nota} onChange={(event) => setNota(event.target.value)} rows={3} placeholder="Qué encontré, qué no encontré, por qué importa, y qué buscar después." />
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-3">
          <Button onClick={add}><CheckCircle2 className="h-4 w-4" /> Guardar entrada</Button>
          <Button variant="outline" onClick={() => downloadCsv(entries)} disabled={!entries.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-border/70">
          {entries.slice(0, 20).map((entry) => (
            <div key={entry.id} className="border-b border-border/60 p-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.estado === "positivo" ? "default" : entry.estado === "negativo" ? "destructive" : "secondary"}>
                      {entry.estado}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{entry.objetivo}</p>
                  {entry.url && (
                    <a href={entry.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary underline">
                      <Link2 className="h-3 w-3" /> {entry.url}
                    </a>
                  )}
                  {entry.nota && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.nota}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(entry.id)}>Quitar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
