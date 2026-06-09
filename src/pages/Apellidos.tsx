import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import CertezaBadge from "@/components/CertezaBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GitBranch, UserRound } from "lucide-react";
import { personaCode } from "@/lib/personaCode";
import { toast } from "sonner";
import { fetchAllPeople, getActiveTreeId } from "@/lib/peopleData";

const year = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value).getUTCFullYear();
  return Number.isFinite(parsed) ? parsed : null;
};

const lifeSpan = (p: any) => {
  const born = year(p.nac_fecha) ?? p.nac_rango_ini;
  const died = year(p.defuncion_fecha);
  if (born && died) return `${born}-${died}`;
  if (born) return `${born}-`;
  if (died) return `-${died}`;
  return "Sin fechas";
};

const surnameKey = (p: any) => {
  const value = String(p.apellidos ?? "").trim();
  return value || "Sin apellido";
};

export default function Apellidos() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [activeSurname, setActiveSurname] = useState<string>("todos");

  useEffect(() => {
    (async () => {
      try {
        const treeId = await getActiveTreeId();
        const data = await fetchAllPeople(
          "id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,nac_rango_fin,defuncion_fecha,nac_lugar,nacionalidad,certeza,viva,foto_url,updated_at",
          { treeId },
        );
        setPersonas([...data].sort((a, b) =>
          `${a.apellidos ?? ""} ${a.nombres ?? ""}`.localeCompare(`${b.apellidos ?? ""} ${b.nombres ?? ""}`, "es"),
        ));
      } catch (e: any) {
        toast.error(e.message ?? "No se pudieron cargar los apellidos");
        setPersonas([]);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const persona of personas) {
      const key = surnameKey(persona);
      const list = map.get(key) ?? [];
      list.push(persona);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([apellido, rows]) => ({ apellido, rows }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido, "es"));
  }, [personas]);

  const surnames = useMemo(() => grouped.map((g) => g.apellido), [grouped]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return grouped
      .filter((group) => activeSurname === "todos" || group.apellido === activeSurname)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((p) => {
          if (!text) return true;
          return [
            p.nombres,
            p.apellidos,
            p.nac_lugar,
            p.nacionalidad,
            personaCode(p.id),
          ].filter(Boolean).join(" ").toLowerCase().includes(text);
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [activeSurname, grouped, q]);

  return (
    <div>
      <PageHeader
        title="Apellidos"
        subtitle="Listado genealógico por apellido, con acceso directo a ficha y árbol."
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-[18rem_1fr]">
        <Card className="archivo-card">
          <CardContent className="p-3">
            <button
              onClick={() => setActiveSurname("todos")}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${activeSurname === "todos" ? "bg-primary/15 font-semibold" : "hover:bg-foreground/5"}`}
            >
              <span>Todos los apellidos</span>
              <span className="text-xs text-muted-foreground">{personas.length}</span>
            </button>
            <div className="max-h-[62vh] overflow-y-auto pr-1">
              {grouped.map((group) => (
                <button
                  key={group.apellido}
                  onClick={() => setActiveSurname(group.apellido)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${activeSurname === group.apellido ? "bg-primary/15 font-semibold" : "hover:bg-foreground/5"}`}
                >
                  <span className="truncate">{group.apellido}</span>
                  <span className="text-xs text-muted-foreground">{group.rows.length}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar persona, apellido, lugar o código"
              className="max-w-xl"
            />
            <div className="text-sm text-muted-foreground">
              {filtered.reduce((sum, group) => sum + group.rows.length, 0)} personas · {activeSurname === "todos" ? surnames.length : 1} apellidos
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card className="archivo-card">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No hay personas para mostrar con ese filtro.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtered.map((group) => (
                <Card key={group.apellido} className="archivo-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <div>
                      <h2 className="font-display text-xl">{group.apellido}</h2>
                      <p className="text-xs text-muted-foreground">{group.rows.length} persona(s)</p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Fechas</TableHead>
                        <TableHead>Lugar / origen</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Certeza</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <button
                              onClick={() => navigate(`/personas/${p.id}`)}
                              className="flex min-w-0 items-center gap-3 text-left"
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/10">
                                {p.foto_url ? (
                                  <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <UserRound className="h-5 w-5 text-muted-foreground" />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold leading-tight">{p.nombres || "Sin nombre"}</span>
                                <span className="block truncate text-xs text-muted-foreground">{p.apellidos || "Sin apellido"}</span>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{lifeSpan(p)}</TableCell>
                          <TableCell className="max-w-[18rem] truncate">{[p.nac_lugar, p.nacionalidad].filter(Boolean).join(" · ") || "Sin dato"}</TableCell>
                          <TableCell className="font-mono text-xs">{personaCode(p.id)}</TableCell>
                          <TableCell><CertezaBadge value={p.certeza} /></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/personas/${p.id}`)}>
                                Ficha
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/arbol?centro=${p.id}`)} title="Ver en árbol pedigree">
                                <GitBranch className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
