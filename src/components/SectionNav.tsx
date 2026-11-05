import { NavLink, useLocation } from "react-router-dom";
import { navigationGroups } from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SectionNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const section = navigationGroups.find(group => group.items.some(item => !item.external && item.to === pathname));
  // Keep all available space for the interactive tree and research's own tab system.
  if (!section || section.direct || section.key === "tree" || section.key === "research") return null;
  return <nav className="section-nav" aria-label={t(section.label)}>{section.items.map(({ to, label, icon: Icon, external }) => external ?
    <a key={to} href={to} target="_blank" rel="noopener noreferrer" data-external-browser="true"><Icon size={20} />{t(label)}<small>MyHeritage ↗</small></a> :
    <NavLink key={to} to={to} end><Icon size={20} />{t(label)}</NavLink>
  )}</nav>;
}
