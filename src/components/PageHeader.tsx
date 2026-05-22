import { ReactNode } from "react";

export default function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] font-medium text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
