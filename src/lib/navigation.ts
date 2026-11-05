import { geneIcon, type GeneIconProps } from "@/components/GeneIcon";
import type { ComponentType } from "react";
const Activity = geneIcon("timeline"), Archive = geneIcon("archive"), BookOpen = geneIcon("book"), Calendar = geneIcon("calendar"), ChartPie = geneIcon("fan"), Compass = geneIcon("compass"), Dna = geneIcon("dna"), FileSearch = geneIcon("search"), FileText = geneIcon("document"), Fingerprint = geneIcon("user"), GitBranch = geneIcon("tree"), Heart = geneIcon("people"), Home = geneIcon("home"), Image = geneIcon("photo"), Images = geneIcon("photos"), Inbox = geneIcon("mail"), Landmark = geneIcon("building"), ListChecks = geneIcon("checklist"), ListOrdered = geneIcon("tag"), MapPin = geneIcon("pin"), Merge = geneIcon("merge"), Network = geneIcon("branches"), Scan = geneIcon("compare"), Settings = geneIcon("settings"), ShoppingBag = geneIcon("flask"), Sparkles = geneIcon("spark"), TestTube = geneIcon("flask"), Upload = geneIcon("upload"), Users = geneIcon("people");

export type NavItem = { to: string; label: string; icon: ComponentType<Omit<GeneIconProps, "name">>; external?: boolean };
export type NavSection = { key: string; label: string; icon: ComponentType<Omit<GeneIconProps, "name">>; direct?: boolean; items: NavItem[] };

const sections: NavSection[] = [
  { key: "primary", label: "Inicio", icon: Home, direct: true, items: [
    { to: "/inicio", label: "Inicio", icon: Home },
  ] },
  { key: "tree", label: "Árbol Genealógico", icon: GitBranch, items: [
    { to: "/arbol", label: "Mi árbol familiar", icon: GitBranch },
    { to: "/consistencia", label: "Consistency Checker", icon: ListChecks },
    { to: "/informe-de-relaciones", label: "Informe de relaciones", icon: Network },
    { to: "/cuadros-ia", label: "Infografías Familiares", icon: Images },
  ] },
  { key: "discoveries", label: "Descubrimientos", icon: Compass, items: [
    { to: "/coincidencias", label: "Coincidencias del árbol", icon: Users },
    { to: "/sugerencias", label: "Sugerencias", icon: ListChecks },
    { to: "/pistas", label: "Pistas de investigación", icon: FileSearch },
  ] },
  { key: "dna", label: "ADN", icon: Dna, items: [
    { to: "/adn", label: "Resumen de ADN", icon: Dna },
    { to: "/estimacion-etnica", label: "Estimación Étnica", icon: ChartPie },
    { to: "https://www.myheritage.es/dna/matches", label: "Coincidencias de ADN", icon: Users, external: true },
    { to: "https://www.myheritage.es/dna/ancient-origins", label: "Orígenes Antiguos", icon: Landmark, external: true },
    { to: "https://www.myheritage.es/dna/activate", label: "Activar kit de ADN", icon: TestTube, external: true },
    { to: "https://www.myheritage.es/dna/manage/", label: "Administrar kits de ADN", icon: Fingerprint, external: true },
    { to: "https://www.myheritage.es/dna", label: "Ordenar kits de ADN", icon: ShoppingBag, external: true },
  ] },
  { key: "photos", label: "Fotos", icon: Image, items: [
    { to: "/fotos", label: "Galería familiar", icon: Images },
    { to: "/parecidos", label: "Rasgos y parecidos", icon: Scan },
    { to: "https://www.myheritage.es/live-memory", label: "LiveMemory™", icon: Sparkles, external: true },
  ] },
  { key: "research", label: "Investigación", icon: FileSearch, items: [
    { to: "/investigacion", label: "Centro de investigación", icon: FileSearch },
    { to: "/documentos", label: "Documentos", icon: FileText },
    { to: "/fuentes", label: "Fuentes", icon: BookOpen },
    { to: "/hipotesis", label: "Hipótesis", icon: Compass },
    { to: "/inferencias", label: "Inferencias", icon: Sparkles },
    { to: "/asistente", label: "Genealogista IA", icon: Sparkles },
  ] },
  { key: "inbox", label: "Bandeja de entrada", icon: Inbox, direct: true, items: [
    { to: "/bandeja-de-entrada", label: "Bandeja de entrada", icon: Inbox },
  ] },
  { key: "archive", label: "Archivo familiar", icon: Archive, items: [
    { to: "/personas", label: "Personas", icon: Users },
    { to: "/apellidos", label: "Apellidos", icon: ListOrdered },
    { to: "/familias", label: "Familias", icon: Heart },
    { to: "/calendario", label: "Calendario", icon: Calendar },
    { to: "/lugares", label: "Lugares", icon: MapPin },
    { to: "/linea-de-tiempo", label: "Línea de tiempo", icon: Activity },
  ] },
  { key: "utility", label: "Herramientas y cuenta", icon: Settings, items: [
    { to: "/importar", label: "Importar y exportar", icon: Upload },
    { to: "/fusionar", label: "Fusionar duplicados", icon: Merge },
    { to: "/credenciales", label: "Credenciales", icon: Fingerprint },
    { to: "/configurar-app", label: "Preferencias de la app", icon: Settings },
    { to: "/configuracion", label: "Configuración", icon: Settings },
  ] },
];

const order = ["primary", "tree", "archive", "discoveries", "research", "photos", "dna", "inbox", "utility"];
export const navigationGroups = order.map(key => sections.find(section => section.key === key)!);
