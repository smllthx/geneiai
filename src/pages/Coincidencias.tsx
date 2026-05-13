import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}
const similarity = (a: string, b: string) => 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length, 1);

export default function Coincidencias() {
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("coincidencias").select("*").order("score", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const recalc = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { data: ps } = await supabase.from("personas").select("*");
    const personas = ps ?? [];
    const found: any[] = [];
    for (let i = 0; i < personas.length; i++) for (let j = i+1; j < personas.length; j++) {
      const a = personas[i], b = personas[j];
      const simAp = similarity(a.apellidos, b.apellidos);
      const simNo = similarity(a.nombres, b.nombres);
      if (simAp < 0.7 || simNo < 0.6) continue;
      const yA = a.nac_fecha ? new Date(a.nac_fecha).getUTCFullYear() : a.nac_rango_ini;
      const yB = b.nac_fecha ? new Date(b.nac_fecha).getUTCFullYear() : b.nac_rango_ini;
      const cercaFecha = yA && yB ? Math.abs(yA - yB) <= 5 : false;
      const score = Math.round((simAp * 40 + simNo * 30 + (cercaFecha ? 30 : 0)));
      const razones = [`Apellido ${Math.round(simAp*100)}% similar`, `Nombre ${Math.round(simNo*100)}% similar`];
      if (cercaFecha) razones.push("año cercano");
      found.push({ user_id: user.id, tipo: "persona", ref_a: a.id, ref_b: b.id, score, razones });
    }
    await supabase.from("coincidencias").delete().eq("estado", "pendiente");
    if (found.length) await supabase.from("coincidencias").insert(found);
    toast.success(`${found.length} coincidencias`); load();
  };

  return (
    <div>
      <PageHeader title="Coincidencias sugeridas" subtitle="Pares de registros internos similares por nombre, apellido, fechas y lugares."
        actions={<Button onClick={recalc}><Sparkles className="h-4 w-4" /> Recalcular</Button>} />
      {items.length === 0 ? <p className="text-muted-foreground">Sin coincidencias. Pulsa Recalcular.</p> :
        <div className="grid gap-2">{items.map((c) => (
          <Card key={c.id} className="archivo-card"><CardContent className="pt-4 text-sm">
            <div className="flex justify-between"><span>Score: <strong>{c.score}/100</strong></span><span className="archivo-chip">{c.estado}</span></div>
            <div className="mt-1 text-muted-foreground text-xs">{(c.razones as string[]).join(" · ")}</div>
          </CardContent></Card>
        ))}</div>}
    </div>
  );
}
