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

const POSITIONS: Record<string, { x: number; y: number }> = {
  "DC5N-DQC": { x: -520, y: -520 },
  "LARA-001": { x: -230, y: -520 },
  "GXQ4-SM9": { x: 230, y: -520 },
  "BOU-001": { x: 520, y: -520 },
  "G0VB-TSS": { x: -260, y: -260 },
  "G0VB-SGT": { x: 260, y: -260 },
  "PUQT-GS2": { x: 0, y: 40 },
  "CONY-001": { x: 360, y: 40 },
  "HIJO-001": { x: -160, y: 350 },
  "HIJO-002": { x: 160, y: 350 },
};

const edgeLineage = (relationship: GenealogyRelationship, peopleById: Map<string, GenealogyPerson>): LineageSide => {
  if (relationship.type === "conyuge" || relationship.type === "hijo") return "central";
  if (relationship.to === "PUQT-GS2") return relationship.type === "padre" ? "paterna" : "materna";
  return peopleById.get(relationship.from)?.lineage ?? "central";
};

const parentRelsOf = (id: string, relationships: GenealogyRelationship[]) =>
  relationships.filter((relationship) => relationship.to === id && (relationship.type === "padre" || relationship.type === "madre"));

const childrenOf = (id: string, relationships: GenealogyRelationship[]) =>
  relationships
    .filter((relationship) => relationship.from === id && (relationship.type === "hijo" || relationship.type === "padre" || relationship.type === "madre"))
    .map((relationship) => relationship.to);

const spouseOf = (id: string, relationships: GenealogyRelationship[]) =>
  relationships.find((relationship) => relationship.type === "conyuge" && (relationship.from === id || relationship.to === id));

const inferLineages = (centerId: string, relationships: GenealogyRelationship[]) => {
  const result = new Map<string, LineageSide>([[centerId, "central"]]);
  const markAncestors = (id: string | undefined, lineage: LineageSide) => {
    if (!id || result.get(id) === lineage) return;
    result.set(id, lineage);
    for (const parent of parentRelsOf(id, relationships)) markAncestors(parent.from, lineage);
  };
  for (const parent of parentRelsOf(centerId, relationships)) {
    markAncestors(parent.from, parent.type === "madre" ? "materna" : "paterna");
  }
  const spouse = spouseOf(centerId, relationships);
  if (spouse) result.set(spouse.from === centerId ? spouse.to : spouse.from, "central");
  for (const childId of childrenOf(centerId, relationships)) result.set(childId, "central");
  return result;
};

const buildDynamicPositions = (centerId: string, relationships: GenealogyRelationship[]) => {
  const positions = new Map<string, { x: number; y: number }>([[centerId, { x: 0, y: 40 }]]);
  const parents = parentRelsOf(centerId, relationships);
  const father = parents.find((r) => r.type === "padre")?.from;
  const mother = parents.find((r) => r.type === "madre")?.from;
  if (father) positions.set(father, { x: -260, y: -260 });
  if (mother) positions.set(mother, { x: 260, y: -260 });

  const placeGrandparents = (parentId: string | undefined, baseX: number) => {
    if (!parentId) return;
    const grandparents = parentRelsOf(parentId, relationships);
    const grandFather = grandparents.find((r) => r.type === "padre")?.from;
    const grandMother = grandparents.find((r) => r.type === "madre")?.from;
    if (grandFather) positions.set(grandFather, { x: baseX - 145, y: -520 });
    if (grandMother) positions.set(grandMother, { x: baseX + 145, y: -520 });
  };
  placeGrandparents(father, -260);
  placeGrandparents(mother, 260);

  const siblings = Array.from(new Set([...(father ? childrenOf(father, relationships) : []), ...(mother ? childrenOf(mother, relationships) : [])]))
    .filter((id) => id !== centerId);
  siblings.forEach((siblingId, index) => {
    positions.set(siblingId, { x: -360 - index * 280, y: 40 });
  });

  const spouse = spouseOf(centerId, relationships);
  if (spouse) positions.set(spouse.from === centerId ? spouse.to : spouse.from, { x: 360, y: 40 });

  const children = childrenOf(centerId, relationships);
  children.forEach((childId, index) => {
    positions.set(childId, { x: (index - (children.length - 1) / 2) * 320, y: 350 });
  });

  return positions;
};

export function buildGenealogyLayout(
  people: GenealogyPerson[] = mockPeople,
  relationships: GenealogyRelationship[] = mockRelationships,
  centerId = "PUQT-GS2",
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const dynamicPositions = buildDynamicPositions(centerId, relationships);
  const lineages = inferLineages(centerId, relationships);
  const nodes: TreeNode[] = people.map((person) => ({
    id: person.id,
    type: "person",
    position: dynamicPositions.get(person.id) ?? POSITIONS[person.id] ?? { x: 0, y: 0 },
    data: { person: { ...person, lineage: lineages.get(person.id) ?? person.lineage } },
  }));
  const edges: TreeEdge[] = relationships.map((relationship) => ({
    id: relationship.id,
    source: relationship.from,
    target: relationship.to,
    type: relationship.type,
    lineage: edgeLineage(relationship, peopleById),
  }));
  return { nodes, edges };
}
