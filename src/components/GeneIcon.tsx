import { forwardRef, useId, useMemo, type SVGProps } from "react";
import sprite from "@/assets/icons/geneai.svg?raw";
import names from "@/assets/icons/names.json";

export const geneIconNames = names;
export type GeneIconProps = SVGProps<SVGSVGElement> & { name: string; size?: number | string; title?: string };

// Trusted, bundled artwork only. Each icon carries its own shapes and paint
// servers: no external <use> request, shared hidden definitions, or network race.
const artwork = new Map([...sprite.matchAll(/<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)]
  .map(([, name, content]) => [name, content]));

const imageUrls = new Map<string, string>();
/** Isolated SVG image for non-React surfaces such as Leaflet markers. */
export function geneIconDataUrl(name: string) {
  const key = artwork.has(name) ? name : "spark";
  if (!imageUrls.has(key)) imageUrls.set(key, `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${artwork.get(key)}</svg>`)}`);
  return imageUrls.get(key)!;
}

/** Local vector artwork. Colors are part of the shapes, never an emoji or a CSS filter. */
export const GeneIcon = forwardRef<SVGSVGElement, GeneIconProps>(function GeneIcon({ name, size = 24, title, className = "", ...props }, ref) {
  const instance = useId();
  const content = useMemo(() => {
    const prefix = `gene-${instance.replace(/:/g, "")}-`;
    return (artwork.get(name) ?? artwork.get("spark")!)
      .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
  }, [name, instance]);
  return <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" focusable="false"
    role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    className={`gene-icon ${className}`} {...props}>
    {title && <title>{title}</title>}<g dangerouslySetInnerHTML={{ __html: content }} />
  </svg>;
});

export function geneIcon(name: string) {
  return forwardRef<SVGSVGElement, Omit<GeneIconProps, "name">>(function Icon(props, ref) {
    return <GeneIcon ref={ref} name={name} {...props} />;
  });
}

export const MarriageIcon = geneIcon("marriage");
