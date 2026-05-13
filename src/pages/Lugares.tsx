import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Lugares() {
  const [items, setItems] = useState<any[]>([]);
  const [d, setD] = useState<any>({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "", archivo: "" });
  const load = async () => { const { data } = await supabase.from("lugares").select("*").order("pais"); setItems(data ?? []); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("lugares").insert({ ...d, user_id: user.id });
    if (error) return toast.error(error.message);
    setD({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "", archivo: "" }); load();
  };
  const del = async (id: string) => { await supabase.from("lugares").delete().eq("id", id); load(); };
  return (
    <div>
      <PageHeader title="Lugares" subtitle="País, región, ciudad, parroquia, archivo. Para geocodificación futura." />
      <Card className="archivo-card mb-6"><CardContent className="grid gap-2 pt-6 md:grid-cols-3">
        {["pais","region","provincia","ciudad","parroquia","archivo"].map((k) =>
          <Input key={k} placeholder={k} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} />)}
        <Button onClick={add}>Añadir lugar</Button>
      </CardContent></Card>
      <div className="grid gap-2">{items.map((l) => (
        <Card key={l.id} className="archivo-card"><CardContent className="flex items-center justify-between pt-4 text-sm">
          <span>{[l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ")}{l.parroquia && ` · ${l.parroquia}`}</span>
          <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-4 w-4" /></Button>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}
