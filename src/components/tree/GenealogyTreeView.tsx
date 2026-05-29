import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildGenealogyLayout, mockPeople, mockRelationships } from "./genealogyLayout";
import DescendancyView from "./DescendancyView";
import FanChartView from "./FanChartView";
import FounderLineageView from "./FounderLineageView";
import PersonNode from "./PersonNode";
import PersonSidePanel from "./PersonSidePanel";
import TreeFloatingToolbar from "./TreeFloatingToolbar";
import TreeOptionsPanel from "./TreeOptionsPanel";
import TreeToolbar from "./TreeToolbar";
import type { RelativeKind } from "./AddRelativeButton";
import type { GenealogyPerson, GenealogyRelationship, TreeEdge, TreeFilters, TreeNode, TreeOptions, TreeViewMode } from "./types";

const NODE_W = 260;
const NODE_H = 172;
const CENTER_X = 850;
const CENTER_Y = 420;

const edgeColor: Record<TreeEdge["lineage"], string> = {
  paterna: "#10b981",
  materna: "#8b5cf6",
  central: "#94a3b8",
};

const defaultFilters: TreeFilters = {
  query: "",
  paternal: false,
  maternal: false,
  noSources: false,
  withSources: false,
  incomplete: false,
};

const defaultOptions: TreeOptions = {
  showAiHints: true,
  showProblems: true,
  showPortraits: true,
  showNoSources: true,
  showAlternativeParents: false,
  showAlternativeSpouses: true,
  showIncompleteBranches: true,
  darkMode: false,
};

const yearOf = (value?: string | null) => String(value ?? "").match(/\d{4}/)?.[0];
const initialsOf = (nombres: string, apellidos: string) =>
  `${nombres.trim()[0] ?? ""}${apellidos.trim()[0] ?? ""}`.toUpperCase() || "P";
const placeLabel = (place: any) =>
  [place?.ciudad, place?.provincia, place?.region, place?.pais].filter(Boolean).join(", ");

const convertRelationship = (row: any): GenealogyRelationship | null => {
  if (row.tipo === "padre" || row.tipo === "madre") {
    return { id: row.id, from: row.pariente_id, to: row.persona_id, type: row.tipo };
  }
  if (row.tipo === "hijo") {
    return { id: row.id, from: row.persona_id, to: row.pariente_id, type: "hijo" };
  }
  if (row.tipo === "conyuge") {
    return { id: row.id, from: row.persona_id, to: row.pariente_id, type: "conyuge" };
  }
  return null;
};

const dedupeRelationships = (relationships: GenealogyRelationship[]) => {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    const key = relationship.type === "conyuge"
      ? ["conyuge", relationship.from, relationship.to].sort().join(":")
      : `${relationship.type}:${relationship.from}:${relationship.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const nodeCenter = (node: TreeNode) => ({
  x: CENTER_X + node.position.x + NODE_W / 2,
  y: CENTER_Y + node.position.y + NODE_H / 2,
});

const nodeWithView = (node: TreeNode, view: TreeViewMode): TreeNode => {
  if (view === "horizontal") return { ...node, position: { x: node.position.y * 1.08, y: node.position.x * 0.82 } };
  return node;
};

const edgePath = (source: TreeNode, target: TreeNode) => {
  const a = nodeCenter(source);
  const b = nodeCenter(target);
  if (Math.abs(a.y - b.y) < 40) {
    const sourceX = a.x <= b.x ? a.x + NODE_W / 2 - 12 : a.x - NODE_W / 2 + 12;
    const targetX = a.x <= b.x ? b.x - NODE_W / 2 + 12 : b.x + NODE_W / 2 - 12;
    const midX = sourceX + (targetX - sourceX) / 2;
    return `M ${sourceX} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${targetX} ${b.y}`;
  }
  const sourceY = a.y <= b.y ? a.y + NODE_H / 2 - 10 : a.y - NODE_H / 2 + 10;
  const targetY = a.y <= b.y ? b.y - NODE_H / 2 + 10 : b.y + NODE_H / 2 - 10;
  const midY = sourceY + (targetY - sourceY) / 2;
  return `M ${a.x} ${sourceY} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${targetY}`;
};

const siblingPath = (source: TreeNode, target: TreeNode) => {
  const a = nodeCenter(source);
  const b = nodeCenter(target);
  const sourceX = a.x <= b.x ? a.x + NODE_W / 2 - 12 : a.x - NODE_W / 2 + 12;
  const targetX = a.x <= b.x ? b.x - NODE_W / 2 + 12 : b.x + NODE_W / 2 - 12;
  const midX = sourceX + (targetX - sourceX) / 2;
  return `M ${sourceX} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${targetX} ${b.y}`;
};

const matchesFilters = (person: GenealogyPerson, filters: TreeFilters) => {
  const q = filters.query.trim().toLowerCase();
  const text = `${person.givenNames} ${person.surnames} ${person.birth ?? ""} ${person.death ?? ""} ${person.mainPlace ?? ""} ${person.id}`.toLowerCase();
  if (q && !text.includes(q)) return false;
  if (filters.paternal && person.lineage !== "paterna" && person.lineage !== "central") return false;
  if (filters.maternal && person.lineage !== "materna" && person.lineage !== "central") return false;
  if (filters.noSources && person.sourcesCount > 0) return false;
  if (filters.withSources && person.sourcesCount === 0) return false;
  if (filters.incomplete && !person.incomplete) return false;
  return true;
};

export default function GenealogyTreeView() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<GenealogyPerson[]>(mockPeople);
  const [relationships, setRelationships] = useState<GenealogyRelationship[]>(mockRelationships);
  const [centerId, setCenterId] = useState("PUQT-GS2");
  const [loading, setLoading] = useState(true);
  const { nodes, edges } = useMemo(() => buildGenealogyLayout(people, relationships, centerId), [people, relationships, centerId]);
  const [selected, setSelected] = useState<GenealogyPerson | null>(() => nodes.find((node) => node.id === "PUQT-GS2")?.data.person ?? null);
  const [filters, setFilters] = useState<TreeFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<TreeViewMode>("portrait");
  const [options, setOptions] = useState<TreeOptions>(defaultOptions);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [scale, setScale] = useState(0.88);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const viewportRef = useRef<HTMLDivElement>(null);

  const displayNodes = useMemo(() => nodes.map((node) => nodeWithView(node, viewMode)), [nodes, viewMode]);
  const nodesById = useMemo(() => new Map(displayNodes.map((node) => [node.id, node])), [displayNodes]);
  const visibleIds = useMemo(() => new Set(displayNodes.filter((node) => matchesFilters(node.data.person, filters)).map((node) => node.id)), [displayNodes, filters]);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const siblingEdges = useMemo(() => {
    const parentToChildren = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (edge.type !== "padre" && edge.type !== "madre") continue;
      const children = parentToChildren.get(edge.source) ?? new Set<string>();
      children.add(edge.target);
      parentToChildren.set(edge.source, children);
    }
    const pairs = new Set<string>();
    for (const children of parentToChildren.values()) {
      const ids = Array.from(children);
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) pairs.add([ids[i], ids[j]].sort().join(":"));
      }
    }
    return Array.from(pairs).map((pair) => {
      const [source, target] = pair.split(":");
      return { id: `sibling:${pair}`, source, target };
    });
  }, [edges]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setLoading(false);
        return;
      }
      const [{ data: personas }, { data: rels }, { data: lugares }, { data: docs }, { data: profile }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,nac_fecha,nac_rango_ini,defuncion_fecha,viva,nac_lugar_id,foto_url,certeza").eq("user_id", user.id).limit(5000),
        supabase.from("relaciones").select("id,persona_id,pariente_id,tipo").eq("user_id", user.id).limit(10000),
        supabase.from("lugares").select("id,ciudad,provincia,region,pais").eq("user_id", user.id).limit(5000),
        supabase.from("documentos").select("personas_mencionadas").eq("user_id", user.id).limit(5000),
        supabase.from("profiles").select("proband_id").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (!personas?.length) {
        setLoading(false);
        return;
      }
      const places = new Map((lugares ?? []).map((place: any) => [place.id, place]));
      const sourceCounts = new Map<string, number>();
      for (const doc of docs ?? []) {
        for (const personId of (doc as any).personas_mencionadas ?? []) {
          sourceCounts.set(personId, (sourceCounts.get(personId) ?? 0) + 1);
        }
      }
      const convertedPeople: GenealogyPerson[] = personas.map((person: any) => {
        const birth = yearOf(person.nac_fecha) ?? (person.nac_rango_ini ? String(person.nac_rango_ini) : undefined);
        const death = yearOf(person.defuncion_fecha) ?? (person.viva === "si" ? "Vive" : undefined);
        const place = places.get(person.nac_lugar_id);
        const sourcesCount = sourceCounts.get(person.id) ?? 0;
        return {
          id: person.id,
          givenNames: person.nombres,
          surnames: person.apellidos,
          birth,
          death,
          mainPlace: placeLabel(place) || "Lugar por completar",
          avatarUrl: person.foto_url ?? undefined,
          initials: initialsOf(person.nombres, person.apellidos),
          sourcesCount,
          incomplete: !birth || !place || sourcesCount === 0,
          researchStatus: sourcesCount > 1 ? "documentado" : sourcesCount === 1 ? "en_revision" : "pendiente",
          lineage: "central",
        };
      });
      const convertedRels = dedupeRelationships((rels ?? []).map(convertRelationship).filter(Boolean) as GenealogyRelationship[]);
      const proband = (profile as any)?.proband_id;
      const validCenter = proband && convertedPeople.some((person) => person.id === proband) ? proband : convertedPeople[0].id;
      setPeople(convertedPeople);
      setRelationships(convertedRels);
      setCenterId(validCenter);
      setSelected(convertedPeople.find((person) => person.id === validCenter) ?? convertedPeople[0]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const centerTree = () => {
    setScale(0.88);
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    setScale((current) => Math.min(1.55, Math.max(0.45, Number((current + delta).toFixed(2)))));
  };

  const expandBranch = async (person: GenealogyPerson) => {
    if (expandedBranches.has(person.id)) {
      setExpandedBranches((current) => {
        const next = new Set(current);
        next.delete(person.id);
        return next;
      });
      return;
    }
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { data: rels } = await supabase
      .from("relaciones")
      .select("id,persona_id,pariente_id,tipo")
      .eq("user_id", user.id)
      .or(`persona_id.eq.${person.id},pariente_id.eq.${person.id}`)
      .limit(200);
    const relatedIds = Array.from(new Set((rels ?? []).flatMap((rel: any) => [rel.persona_id, rel.pariente_id]))).filter((id) => id && id !== person.id);
    const missingIds = relatedIds.filter((id) => !people.some((p) => p.id === id));
    if (missingIds.length) {
      const { data: newPeople } = await supabase
        .from("personas")
        .select("id,nombres,apellidos,nac_fecha,nac_rango_ini,defuncion_fecha,viva,nac_lugar_id,foto_url,certeza")
        .in("id", missingIds);
      const converted = (newPeople ?? []).map((row: any): GenealogyPerson => ({
        id: row.id,
        givenNames: row.nombres,
        surnames: row.apellidos,
        birth: yearOf(row.nac_fecha) ?? (row.nac_rango_ini ? String(row.nac_rango_ini) : undefined),
        death: yearOf(row.defuncion_fecha) ?? (row.viva === "si" ? "Vive" : undefined),
        mainPlace: "Lugar por completar",
        avatarUrl: row.foto_url ?? undefined,
        initials: initialsOf(row.nombres, row.apellidos),
        sourcesCount: 0,
        incomplete: true,
        researchStatus: "pendiente",
        lineage: "central",
      }));
      setPeople((current) => [...current, ...converted]);
    }
    const convertedRels = dedupeRelationships((rels ?? []).map(convertRelationship).filter(Boolean) as GenealogyRelationship[]);
    setRelationships((current) => dedupeRelationships([...current, ...convertedRels]));
    setExpandedBranches((current) => new Set(current).add(person.id));
    toast.success(`Rama expandida: ${person.givenNames}`);
  };

  const handleAction = (action: "profile" | "ai" | "expand", person: GenealogyPerson) => {
    setSelected(person);
    if (action === "profile") navigate(`/personas/${person.id}/ficha`);
    if (action === "ai") toast.info(`Buscar evidencia con IA para ${person.givenNames}`);
    if (action === "expand") expandBranch(person);
  };

  const handleAddRelative = (kind: RelativeKind, person: GenealogyPerson) => {
    navigate(`/personas/nueva?relacion=${person.id}&tipo=${kind}`);
  };

  return (
    <div className={`-mx-3 -my-3 min-h-[calc(100vh-1px)] md:-mx-6 md:-my-6 ${options.darkMode ? "bg-slate-950" : "bg-slate-100"}`}>
      <div
        ref={viewportRef}
        className={`relative h-[calc(100vh-1px)] min-h-[720px] overflow-hidden [background-size:28px_28px] ${
          options.darkMode
            ? "bg-[radial-gradient(circle_at_1px_1px,#334155_1px,transparent_0)]"
            : "bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)]"
        }`}
        onWheel={handleWheel}
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button,article,input")) return;
          setDrag({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y });
        }}
        onMouseMove={(event) => {
          if (!drag) return;
          setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <TreeToolbar filters={filters} onFiltersChange={setFilters} onCenter={centerTree} onAddPerson={() => navigate("/personas/nueva")} />

        {loading && (
          <div className="absolute left-1/2 top-28 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando árbol desde Supabase…
          </div>
        )}

        <TreeFloatingToolbar
          view={viewMode}
          scale={scale}
          onViewChange={(value) => {
            setViewMode(value);
            centerTree();
          }}
          onOptions={() => setOptionsOpen(true)}
          onHome={() => navigate("/inicio")}
          onFullscreen={() => viewportRef.current?.requestFullscreen?.()}
          onCenter={centerTree}
          onZoomIn={() => setScale((value) => Math.min(1.55, value + 0.08))}
          onZoomOut={() => setScale((value) => Math.max(0.45, value - 0.08))}
        />

        <TreeOptionsPanel open={optionsOpen} options={options} onChange={setOptions} onClose={() => setOptionsOpen(false)} />

        <div className="absolute bottom-4 left-4 z-10 hidden rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:block">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Mini mapa</p>
          <div className="relative h-24 w-40 rounded-xl bg-slate-100">
            {displayNodes.map((node) => (
              <span
                key={node.id}
                className={`absolute h-2 w-3 rounded-sm ${node.data.person.incomplete ? "bg-slate-400" : node.data.person.lineage === "materna" ? "bg-violet-500" : node.data.person.lineage === "paterna" ? "bg-emerald-500" : "bg-slate-500"}`}
                style={{ left: `${50 + node.position.x / 16}%`, top: `${50 + node.position.y / 12}%` }}
              />
            ))}
          </div>
        </div>

        {(viewMode === "fan") && (
          <FanChartView nodes={displayNodes} edges={edges} centerId={centerId} onSelect={(id) => setSelected(displayNodes.find((node) => node.id === id)?.data.person ?? null)} />
        )}
        {(viewMode === "descendancy") && (
          <DescendancyView
            nodes={displayNodes}
            relationships={relationships}
            centerId={centerId}
            onSelect={(id) => setSelected(displayNodes.find((node) => node.id === id)?.data.person ?? null)}
            onAddChild={(id) => navigate(`/personas/nueva?relacion=${id}&tipo=hijo`)}
          />
        )}
        {(viewMode === "founder") && (
          <FounderLineageView
            nodes={displayNodes}
            relationships={relationships}
            centerId={centerId}
            onSelect={(id) => setSelected(displayNodes.find((node) => node.id === id)?.data.person ?? null)}
          />
        )}

        {(viewMode === "portrait" || viewMode === "horizontal") && <div
          className="absolute left-1/2 top-1/2 h-[900px] w-[1700px] origin-center"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          }}
        >
          <div className="pointer-events-none absolute left-[700px] top-[18px] rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">Abuelos</div>
          <div className="pointer-events-none absolute left-[760px] top-[270px] rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">Padres</div>
          <div className="pointer-events-none absolute left-[820px] top-[575px] rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">Persona central</div>
          <div className="pointer-events-none absolute left-[830px] top-[885px] rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">Hijos</div>
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {siblingEdges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;
              const hidden = hasActiveFilters && (!visibleIds.has(edge.source) || !visibleIds.has(edge.target));
              return (
                <path
                  key={edge.id}
                  d={siblingPath(source, target)}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeDasharray="6 8"
                  strokeLinecap="round"
                  strokeWidth={hidden ? 1.25 : 2}
                  opacity={hidden ? 0.12 : 0.65}
                />
              );
            })}
            {edges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;
              const hidden = hasActiveFilters && (!visibleIds.has(edge.source) || !visibleIds.has(edge.target));
              return (
                <path
                  key={edge.id}
                  d={edgePath(source, target)}
                  fill="none"
                  stroke={edgeColor[edge.lineage]}
                  strokeLinecap="round"
                  strokeWidth={hidden ? 1.5 : 3}
                  opacity={hidden ? 0.16 : 0.8}
                />
              );
            })}
          </svg>

          {displayNodes.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{ left: CENTER_X + node.position.x, top: CENTER_Y + node.position.y }}
            >
              <PersonNode
                person={node.data.person}
                selected={selected?.id === node.id}
                dimmed={hasActiveFilters && !visibleIds.has(node.id)}
                showPortrait={options.showPortraits}
                expanded={expandedBranches.has(node.id)}
                onSelect={setSelected}
                onAction={handleAction}
                onAddRelative={handleAddRelative}
              />
            </div>
          ))}
        </div>}

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> paterna</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> materna</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> datos incompletos</span>
        </div>

        <PersonSidePanel
          person={selected}
          onClose={() => setSelected(null)}
          onEdit={(person) => navigate(`/personas/${person.id}`)}
          onAiEvidence={(person) => toast.info(`Buscar evidencia con IA para ${person.givenNames}`)}
        />
      </div>
    </div>
  );
}
