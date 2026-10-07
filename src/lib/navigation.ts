import { Home, GitBranch, Users, Sparkles, Image, FileText, ListOrdered, Heart, Calendar, Dna, Compass, Scan, Upload, Merge, Settings } from 'lucide-react';

/** One menu definition for desktop, mobile drawers and menu settings. */
export const navigationGroups = [
  { key: 'primary', label: 'Principal', items: [
    { to: '/inicio', label: 'Inicio', icon: Home },
    { to: '/arbol', label: 'Árbol', icon: GitBranch },
    { to: '/personas', label: 'Personas', icon: Users },
    { to: '/investigacion', label: 'Investigar', icon: Sparkles },
  ] },
  { key: 'archive', label: 'Archivo familiar', items: [
    { to: '/fotos', label: 'Recuerdos y retratos', icon: Image },
    { to: '/documentos', label: 'Documentos y fuentes', icon: FileText },
    { to: '/apellidos', label: 'Apellidos', icon: ListOrdered },
    { to: '/familias', label: 'Familias', icon: Heart },
    { to: '/calendario', label: 'Calendario', icon: Calendar },
  ] },
  { key: 'investigation', label: 'Descubrimientos', items: [
    { to: '/adn', label: 'ADN y origen', icon: Dna },
    { to: '/coincidencias', label: 'Coincidencias', icon: Compass },
    { to: '/parecidos', label: 'Rasgos y parecidos', icon: Scan },
  ] },
  { key: 'utility', label: 'Herramientas y cuenta', items: [
    { to: '/importar', label: 'Importar / Exportar', icon: Upload },
    { to: '/fusionar', label: 'Fusionar duplicados', icon: Merge },
    { to: '/configuracion', label: 'Configuración', icon: Settings },
  ] },
];
