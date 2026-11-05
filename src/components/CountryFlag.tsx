import "flag-icons/css/flag-icons.min.css";
import { countryCode, countryName } from "@/lib/countries";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeneIcon } from "./GeneIcon";

export default function CountryFlag({ country, decorative = false, className = "" }: { country?: string | null; decorative?: boolean; className?: string }) {
  const { locale } = useLanguage();
  const code = countryCode(country);
  if (!code) return <GeneIcon name="globe" size={20} className={className} />;
  const label = countryName(code, locale);
  return <span className={`country-flag fi fi-${code.toLowerCase()} ${className}`} role={decorative ? undefined : "img"}
    aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : label} title={label} />;
}
