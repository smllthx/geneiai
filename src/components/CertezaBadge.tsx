import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  comprobado: "bg-primary/15 text-primary border-primary/30",
  probable: "bg-secondary text-secondary-foreground border-border",
  hipotesis: "bg-accent/15 text-accent border-accent/30",
  descartado: "bg-muted text-muted-foreground border-border line-through",
};

const labels: Record<string, string> = {
  comprobado: "Comprobado", probable: "Probable", hipotesis: "Hipótesis", descartado: "Descartado",
};

export default function CertezaBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles[value])}>
      {labels[value] ?? value}
    </span>
  );
}
