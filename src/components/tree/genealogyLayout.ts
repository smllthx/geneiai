import { familyLayers } from "@/lib/treeRendering";
import type { GenealogyPerson, GenealogyRelationship, LineageSide, TreeEdge, TreeNode } from "./types";

export const mockPeople: GenealogyPerson[] = [
  {
    id: "PUQT-GS2",
    givenNames: "Rodrigo Alonso",
    surnames: "Aeschlimann Sanguineti",
    birth: "2003",
    mainPlace: "Chile",
    initials: "RA",
    sourcesCount: 0,
    incomplete: true,
    researchStatus: "pendiente",
    lineage: "central",
  },
  {
    id: "CONY-001",
    givenNames: "Persona",
    surnames: "Cónyuge",
    birth: "2004",
    mainPlace: "Chile",
    initials: "PC",
    sourcesCount: 0,
    incomplete: true,
    researchStatus: "pendiente",
    lineage: "central",
  },
  {
    id: "HIJO-001",
    givenNames: "Hijo 1",
    surnames: "Aeschlimann",
    birth: "2030",
    mainPlace: "Chile",
    initials: "H1",
    sourcesCount: 0,
    incomplete: true,
    researchStatus: "pendiente",
    lineage: "central",
  },
  {
    id: "HIJO-002",
    givenNames: "Hijo 2",
    surnames: "Aeschlimann",
    birth: "2032",
    mainPlace: "Chile",
    initials: "H2",
    sourcesCount: 0,
    incomplete: true,
    researchStatus: "pendiente",
    lineage: "central",
  },
  {
    id: "G0VB-TSS",
    givenNames: "Rolf",
    surnames: "Aeschlimann",
    birth: "1983",
    mainPlace: "Chile",
    initials: "RA",
    sourcesCount: 2,
    incomplete: true,
    researchStatus: "en_revision",
    lineage: "paterna",
  },
  {
    id: "G0VB-SGT",
    givenNames: "Fabiola",
    surnames: "Sanguineti",
    birth: "1983",
    mainPlace: "Chile",
    initials: "FS",
    sourcesCount: 1,
    incomplete: true,
    researchStatus: "en_revision",
    lineage: "materna",
  },
  {
    id: "DC5N-DQC",
    givenNames: "Erick",
    surnames: "Aeschlimann Barraza",
    birth: "1953",
    mainPlace: "Chile",
    initials: "EA",
    sourcesCount: 3,
    incomplete: false,
    researchStatus: "documentado",
    lineage: "paterna",
  },
  {
    id: "LARA-001",
    givenNames: "Patricia",
    surnames: "Lara Cortés",
    birth: "1959",
    mainPlace: "Chile",
    initials: "PL",
    sourcesCount: 0,
    incomplete: true,
    researchStatus: "pendiente",
    lineage: "paterna",
  },
  {
    id: "GXQ4-SM9",
    givenNames: "Luis Alcides",
    surnames: "Sanguineti Cortes",
    birth: "1958",
    mainPlace: "Chile",
    initials: "LS",
    sourcesCount: 4,
    incomplete: false,
    researchStatus: "documentado",
    lineage: "materna",
  },
  {
    id: "BOU-001",
    givenNames: "Maritza",
    surnames: "Bou Salazar",
    birth: "1965",
    mainPlace: "Chile",
    initials: "MB",
    sourcesCount: 2,
    incomplete: true,
    researchStatus: "en_revision",
    lineage: "materna",
  },
];

export const mockRelationships: GenealogyRelationship[] = [
  { id: "r-erick-rolf", from: "DC5N-DQC", to: "G0VB-TSS", type: "padre" },
  { id: "r-patricia-rolf", from: "LARA-001", to: "G0VB-TSS", type: "madre" },
  { id: "r-rolf-rodrigo", from: "G0VB-TSS", to: "PUQT-GS2", type: "padre" },
  { id: "r-fabiola-rodrigo", from: "G0VB-SGT", to: "PUQT-GS2", type: "madre" },
  { id: "r-luis-fabiola", from: "GXQ4-SM9", to: "G0VB-SGT", type: "padre" },
  { id: "r-maritza-fabiola", from: "BOU-001", to: "G0VB-SGT", type: "madre" },
  { id: "r-rodrigo-conyuge", from: "PUQT-GS2", to: "CONY-001", type: "conyuge" },
  { id: "r-rodrigo-hijo-1", from: "PUQT-GS2", to: "HIJO-001", type: "hijo" },
  { id: "r-rodrigo-hijo-2", from: "PUQT-GS2", to: "HIJO-002", type: "hijo" },
];

export function indexFamilyLinks(relationships: GenealogyRelationship[]) {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const rel of relationships) {
    if (rel.type === "conyuge") continue;
    if (!parents.has(rel.to)) parents.set(rel.to, []);
    if (!children.has(rel.from)) children.set(rel.from, []);
    if (!parents.get(rel.to)!.includes(rel.from)) parents.get(rel.to)!.push(rel.from);
    if (!children.get(rel.from)!.includes(rel.to)) children.get(rel.from)!.push(rel.to);
  }
  return { parents, children };
}

export function buildGenealogyLayout(
  people: GenealogyPerson[] = mockPeople,
  relationships: GenealogyRelationship[] = mockRelationships,
  centerId = "PUQT-GS2",
  generations = 4,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const { parents, children } = indexFamilyLinks(relationships);
  const position = new Map([[centerId, { x: 0, y: 40 }]]);
  const lineages = new Map<string, LineageSide>([[centerId, "central"]]);
  const rootParents = parents.get(centerId) ?? [];
  const maternal = new Set(relationships.filter(r => r.to === centerId && r.type === "madre").map(r => r.from));
  const placeLayers = (links: Map<string, string[]>, direction: number) => {
    const layers = familyLayers(centerId, generations, id => links.get(id) ?? []);
    layers.slice(1).forEach((layer, index) => {
      const fresh = layer.filter(node => !node.repeated && !position.has(node.id) && peopleById.has(node.id));
      fresh.forEach((node, column) => {
        position.set(node.id, { x: (column - (fresh.length - 1) / 2) * 300, y: 40 + direction * 275 * (index + 1) });
        lineages.set(node.id, direction > 0 ? "central" : maternal.has(rootParents[node.rootSide]) ? "materna" : "paterna");
      });
    });
  };
  placeLayers(parents, -1);
  placeLayers(children, 1);
  const siblings = new Set(rootParents.flatMap(id => children.get(id) ?? []));
  let siblingColumn = 0, spouseColumn = 0;
  for (const id of siblings) {
    if (!position.has(id)) position.set(id, { x: -300 * ++siblingColumn, y: 40 });
  }
  for (const rel of relationships) {
    if (rel.type !== "conyuge" || (rel.from !== centerId && rel.to !== centerId)) continue;
    const id = rel.from === centerId ? rel.to : rel.from;
    if (!position.has(id)) position.set(id, { x: 300 * ++spouseColumn, y: 40 });
  }
  const nodes: TreeNode[] = [...position.entries()].flatMap(([id, xy]) => {
    const person = peopleById.get(id);
    return person ? [{ id, type: "person", position: xy, data: { person: { ...person, lineage: lineages.get(id) ?? person.lineage } } }] : [];
  });
  const visibleIds = new Set(nodes.map(node => node.id));
  const edges: TreeEdge[] = relationships.filter(r => visibleIds.has(r.from) && visibleIds.has(r.to)).map(rel => ({
    id: rel.id, source: rel.from, target: rel.to, type: rel.type, lineage: lineages.get(rel.from) ?? "central",
  }));
  return { nodes, edges };
}
