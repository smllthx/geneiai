import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { generateBiographyAI } from "@/lib/aiApi";

export default function AIBiographyPanel({ personId, currentNotes }: { personId: string; currentNotes?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<any | null>(null);
  const [text, setText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_biographies" as any)
        .select("*")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setDraft(data);
      setText((data as any)?.editable_text ?? (data as any)?.biography_text ?? "");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo cargar biografía IA");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [personId]);

  const generate = async () => {
    setRunning(true);
    const t = toast.loading("Generando biografía con ChatGPT…");
    try {
      const result = await generateBiographyAI(personId);
      setDraft(result.biography);
      setText(result.biography.editable_text ?? result.biography.biography_text ?? "");
      toast.dismiss(t);
      toast.success("Biografía generada como borrador");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "No se pudo generar biografía");
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    const bio = text.trim();
    if (!bio) return toast.error("La biografía está vacía");
    const { error: bioError } = draft?.id
      ? await supabase.from("ai_biographies" as any).update({ editable_text: bio, status: "accepted" }).eq("id", draft.id)
      : await supabase.from("ai_biographies" as any).insert({ person_id: personId, biography_text: bio, editable_text: bio, status: "accepted" });
    if (bioError) return toast.error(bioError.message);
    const preserved = (currentNotes ?? "").replace(/<!-- BIO-IA-INICIO -->[\s\S]*?<!-- BIO-IA-FIN -->/g, "").trim();
    const notes = `<!-- BIO-IA-INICIO -->\n${bio}\n<!-- BIO-IA-FIN -->${preserved ? `\n\n${preserved}` : ""}`;
    const { error } = await supabase.from("personas").update({ notas: notes }).eq("id", personId);
    if (error) return toast.error(error.message);
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { source: "ai_biography" } }));
    toast.success("Biografía guardada en la ficha");
  };

  return (
    <Card className="archivo-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Sparkles className="h-5 w-5 text-cyan-300" /> Biografía IA editable
        </CardTitle>
        {draft?.confidence != null && <Badge variant="secondary">Confianza {draft.confidence}%</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
          La biografía es una ayuda de investigación. Revísala antes de guardarla; la IA no debe inventar datos.
        </p>
        {loading ? (
          <Skeleton className="h-44 rounded-2xl" />
        ) : (
          <Textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Genera o escribe una biografía genealógica verificable…"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar biografía con IA
          </Button>
          <Button variant="outline" onClick={save} disabled={!text.trim()}>
            <Save className="h-4 w-4" /> Guardar en ficha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
