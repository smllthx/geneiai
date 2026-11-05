import { forwardRef, type SVGProps } from "react";
import sprite from "@/assets/icons/geneai.svg";
import names from "@/assets/icons/names.json";

export const geneIconNames = names;
export type GeneIconProps = SVGProps<SVGSVGElement> & { name: string; size?: number | string; title?: string };

/** Local vector artwork. Colors are part of the shapes, never an emoji or a CSS filter. */
export const GeneIcon = forwardRef<SVGSVGElement, GeneIconProps>(function GeneIcon({ name, size = 24, title, className = "", ...props }, ref) {
  return <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" focusable="false"
    role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    className={`gene-icon ${className}`} {...props}>
    {title && <title>{title}</title>}<use href={`${sprite}#${names.includes(name) ? name : "spark"}`} />
  </svg>;
});

export function geneIcon(name: string) {
  return forwardRef<SVGSVGElement, Omit<GeneIconProps, "name">>(function Icon(props, ref) {
    return <GeneIcon ref={ref} name={name} {...props} />;
  });
}

export const MarriageIcon = geneIcon("marriage");
