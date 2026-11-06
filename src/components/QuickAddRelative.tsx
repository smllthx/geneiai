import { Suspense, useState } from "react";
import { lazyView } from "./LazyView";
import { UserPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const RelativeContent = lazyView(() => import("./QuickAddRelativeContent"));

export type RelativeKind =
  | "padre" | "madre" | "conyuge" | "hijo" | "hermano"
  | "union_civil" | "conviviente" | "cohabitante"
  | "padrino" | "madrina" | "ahijado" | "primo" | "prima"
  | "socio_negocio" | "testigo" | "otro";

export type QuickAddRelativeProps = {
  personaId: string;
  personaSexo?: string | null;
  defaultTipo: RelativeKind;
  trigger?: React.ReactNode;
  onAdded?: () => void;
  initialOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function QuickAddRelative({ trigger, initialOpen = false, onOpenChange, ...form }: QuickAddRelativeProps) {
  const [open, setOpen] = useState(initialOpen);
  function changeOpen(value: boolean) {
    setOpen(value);
    onOpenChange?.(value);
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline"><UserPlus className="h-4 w-4" /> Agregar familiar</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agregar familiar</DialogTitle></DialogHeader>
        <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Abriendo formulario…</p>}>
          <RelativeContent {...form} onClose={() => changeOpen(false)} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
