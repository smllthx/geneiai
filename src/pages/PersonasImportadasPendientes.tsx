import { useEffect, useMemo, useState } from "react";
import { Link2, Loader2, Search, Sparkles, UserCheck, UserRound, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { personaCode } from "@/lib/personaCode";

type RelKind = "padre" | "madre" | "conyuge" | "hijo" | "hermano";

const yearOf = (value?: string | null) => String(value ?? "").match(/\d{4}/)?.[0];
const fullName = (p: any) => `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim();
const firstSurname = (p: any) => String(p.apellidos ?? "").split(/\s+/)[0] ?? "";
const sourceOf = (p: any) => {
  const ids = p.ids_externos ?? {};
  const enlaces = p.enlaces ?? {};
  return ids.import_source || ids.source || enlaces.import_source || enlaces.source || (ids.myheritage_id ? "MyHeritage" : "GEDCOM");
};

function possibleLinks(person: any, all: any[]) {
  const birth = Number(yearOf(person.nac_fecha) ?? person.nac_rango_ini);
  const surname = firstSurname(person).toLowerCase();
  return all
    .filter((candidate) => candidate.id !== person.id)
    .map((candidate) => {
      const candidateBirth = Number(yearOf(candidate.nac_fecha) ?? candidate.nac_rango_ini);
      const sameSurname = surname && String(candidate.apellidos ?? "").toLowerCase().includes(surname);
      const placeMatch = person.nac_lugar_id && person.nac_lugar_id === candidate.nac_lugar_id;
      const ageGap = birth && candidateBirth ? Math.abs(candidateBirth - birth) : 0;
      let kind: RelKind = "hermano";
      let confidence = 35;
      let reason = "Apellido o datos cercanos";
      if ((person.sexo ?? "").toLowerCase().startsWith("f") && birth && candidateBirth && birth <= candidateBirth - 15) {
        kind = "madre"; confidence = 78; reason = "Mujer con edad posible para ser madre";
      } else if ((person.sexo ?? "").toLowerCase().startsWith("m") && birth && candidateBirth && birth <= candidateBirth - 15) {
        kind = "padre"; confidence = 76; reason = "Hombre con edad posible para ser padre";
      } else if (ageGap <= 8 && sameSurname) {
        kind = "hermano"; confidence = 68; reason = "Apellido compartido y edad cercana";
      } else if (ageGap <= 15) {
        kind = "conyuge"; confidence = 52; reason = "Edad compatible para cónyuge";
      }
      if (sameSurname) confidence += 10;
      if (placeMatch) confidence += 8;
      return { candidate, kind, confidence: Math.min(96, confidence), reason };
    })
    .filter((s) => s.confidence >= 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export default function PersonasImportadasPendientes() {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sex, setSex] = useState("todos");
  const [life, setLife] = useState("todos");

  const load = async () => {
    setLoading(true);
    const [{ data: personas }, { data: relaciones }] = await Promise.all([
      supabase.from("personas").select("*").order("apellidos"),
      supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
    ]);
    setPeople(personas ?? []);
    setRels(relaciones ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of rels) {
      ids.add(rel.persona_id);
      ids.add(rel.pariente_id);
    }
    return ids;
  }, [rels]);

  const unlinked = useMemo(() => people.filter((p) => {
    const review = (p.enlaces as any)?.tree_status;
    if (review === "no_corresponde") return false;
    if (linkedIds.has(p.id)) return false;
    const query = q.trim().toLowerCase();
    if (query && !`${p.nombres} ${p.apellidos} ${p.nac_fecha ?? ""} ${p.defuncion_fecha ?? ""} ${p.notas ?? ""}`.toLowerCase().includes(query)) return false;
    if (sex !== "todos" && String(p.sexo ?? "desconocido").toLowerCase() !== sex) return false;
    if (life === "vivo" && p.viva !== "si") return false;
    if (life === "fallecido" && !(p.viva === "no" || p.defuncion_fecha)) return false;
    if (life === "desconocido" && (p.viva === "si" || p.viva === "no" || p.defuncion_fecha)) return false;
    return true;
  }), [people, linkedIds, q, sex, life]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const person of unlinked) {
      const key = firstSurname(person).toUpperCase() || "SIN APELLIDO";
      map.set(key, [...(map.get(key) ?? []), person]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [unlinked]);

  const createRelation = async (person: any, candidate: any, kind: RelKind) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    let row: any = { user_id: user.id, tipo: kind, certeza: "probable" };
    if (kind === "padre" || kind === "madre") row = { ...row, persona_id: candidate.id, pariente_id: person.id };
    else if (kind === "hijo") row = { ...row, persona_id: person.id, pariente_id: candidate.id };
    else row = { ...row, persona_id: person.id, pariente_id: candidate.id };
    const { error } = await supabase.from("relaciones").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Vínculo creado como probable");
    load();
  };

  const mark = async (person: any, status: "pending_review" | "no_corresponde") => {
    const enlaces = { ...(person.enlaces ?? {}), tree_status: status };
    const { error } = await supabase.from("personas").update({ enlaces }).eq("id", person.id);
    if (error) return toast.error(error.message);
    toast.success(status === "pending_review" ? "Marcada para revisar después" : "Marcada como no corresponde");
    load();
  };

  if (loading) return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Personas importadas pendientes"
        subtitle="Personas GEDCOM/MyHeritage sin relaciones familiares activas. Revísalas, ordénalas por apellido y vincúlalas al árbol principal."
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_180px_180px]">
          <div className="flex items-center gap-2 rounded-xl border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, apellido, fecha o nota…" className="border-0 px-0 focus-visible:ring-0" />
          </div>
          <Select value={sex} onValueChange={setSex}>
            <SelectTrigger><SelectValue placeholder="Sexo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo sexo</SelectItem>
              <SelectItem value="masculino">Hombre</SelectItem>
              <SelectItem value="femenino">Mujer</SelectItem>
              <SelectItem value="desconocido">Desconocido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={life} onValueChange={setLife}>
            <SelectTrigger><SelectValue placeholder="Estado vital" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo estado</SelectItem>
              <SelectItem value="vivo">Vivo</SelectItem>
              <SelectItem value="fallecido">Fallecido</SelectItem>
              <SelectItem value="desconocido">Desconocido</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        {unlinked.length} persona(s) sin vincular de {people.length} totales. No se elimina nada; solo se organizan y vinculan.
      </div>

      {grouped.map(([surname, list]) => (
        <section key={surname} className="space-y-2">
          <h2 className="sticky top-0 z-10 rounded-xl bg-background/90 px-2 py-2 font-display text-xl font-semibold backdrop-blur">{surname}</h2>
          <div className="grid gap-3">
            {list.map((person) => {
              const suggestions = possibleLinks(person, people);
              return (
                <Card key={person.id} className="overflow-hidden">
                  <CardContent className="grid gap-4 p-4 xl:grid-cols-[1fr_1.2fr]">
                    <div className="flex gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                        {person.foto_url ? <img src={person.foto_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{fullName(person)}</h3>
                          <Badge variant="outline">{personaCode(person.id)}</Badge>
                          <Badge>{sourceOf(person)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Nacida/o: {person.nac_fecha ?? person.nac_rango_ini ?? "?"} · Fallecida/o: {person.defuncion_fecha ?? (person.viva === "si" ? "Vive" : "?")}
                        </p>
                        <p className="text-sm text-muted-foreground">Sexo: {person.sexo || "Desconocido"} · Estado: {person.viva || "Desconocido"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => mark(person, "pending_review")}>Revisar después</Button>
                          <Button size="sm" variant="outline" onClick={() => mark(person, "no_corresponde")}><X className="h-4 w-4" /> No corresponde</Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Posibles vínculos</p>
                      {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Sin sugerencias suficientes. Busca por apellido o revisa manualmente.</p>}
                      <div className="space-y-2">
                        {suggestions.map(({ candidate, kind, confidence, reason }) => (
                          <div key={`${person.id}-${candidate.id}-${kind}`} className="rounded-xl border bg-background p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{fullName(candidate)}</p>
                                <p className="text-xs text-muted-foreground">{confidence}% · {reason}</p>
                              </div>
                              <Badge variant="secondary">posible {kind}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Button size="sm" onClick={() => createRelation(person, candidate, kind)}><Link2 className="h-4 w-4" /> Agregar como {kind}</Button>
                              <Button size="sm" variant="outline" onClick={() => createRelation(person, candidate, "padre")}>Padre</Button>
                              <Button size="sm" variant="outline" onClick={() => createRelation(person, candidate, "madre")}>Madre</Button>
                              <Button size="sm" variant="outline" onClick={() => createRelation(person, candidate, "conyuge")}>Cónyuge</Button>
                              <Button size="sm" variant="outline" onClick={() => createRelation(person, candidate, "hijo")}>Hijo/a</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {grouped.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><UserCheck className="mx-auto mb-3 h-8 w-8" /> No hay personas importadas pendientes con estos filtros.</CardContent></Card>
      )}
    </div>
  );
}
