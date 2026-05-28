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
];

const POSITIONS: Record<string, { x: number; y: number }> = {
  "DC5N-DQC": { x: -520, y: -250 },
  "LARA-001": { x: -260, y: -250 },
  "GXQ4-SM9": { x: 260, y: -250 },
  "BOU-001": { x: 520, y: -250 },
  "G0VB-TSS": { x: -390, y: 10 },
  "G0VB-SGT": { x: 390, y: 10 },
  "PUQT-GS2": { x: 0, y: 280 },
};

const edgeLineage = (relationship: GenealogyRelationship, peopleById: Map<string, GenealogyPerson>): LineageSide => {
  if (relationship.to === "PUQT-GS2") return relationship.type === "padre" ? "paterna" : "materna";
  return peopleById.get(relationship.from)?.lineage ?? "central";
};

export function buildGenealogyLayout(
  people: GenealogyPerson[] = mockPeople,
  relationships: GenealogyRelationship[] = mockRelationships,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const nodes: TreeNode[] = people.map((person) => ({
    id: person.id,
    type: "person",
    position: POSITIONS[person.id] ?? { x: 0, y: 0 },
    data: { person },
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

