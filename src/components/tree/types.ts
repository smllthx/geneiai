export type LineageSide = "paterna" | "materna" | "central";

export type PersonId = string;

export type GenealogyPerson = {
  id: PersonId;
  givenNames: string;
  surnames: string;
  birth?: string;
  death?: string;
  mainPlace?: string;
  avatarUrl?: string;
  initials?: string;
  sourcesCount: number;
  incomplete: boolean;
  researchStatus: "pendiente" | "en_revision" | "documentado";
  lineage: LineageSide;
};

export type GenealogyRelationshipType = "padre" | "madre" | "conyuge" | "hijo";

export type GenealogyRelationship = {
  id: string;
  from: PersonId;
  to: PersonId;
  type: GenealogyRelationshipType;
};

export type TreeNodeKind = "person" | "couple";

export type TreeNodeData = {
  person: GenealogyPerson;
};

export type TreeNode = {
  id: string;
  type: TreeNodeKind;
  position: { x: number; y: number };
  data: TreeNodeData;
};

export type TreeEdge = {
  id: string;
  source: string;
  target: string;
  type: GenealogyRelationshipType;
  lineage: LineageSide;
};

export type TreeFilters = {
  query: string;
  paternal: boolean;
  maternal: boolean;
  noSources: boolean;
  withSources: boolean;
  incomplete: boolean;
};

export type TreeViewMode = "portrait" | "horizontal" | "fan" | "descendancy" | "founder";

export type TreeOptions = {
  showAiHints: boolean;
  showProblems: boolean;
  showPortraits: boolean;
  showNoSources: boolean;
  showAlternativeParents: boolean;
  showAlternativeSpouses: boolean;
  showIncompleteBranches: boolean;
  darkMode: boolean;
};
