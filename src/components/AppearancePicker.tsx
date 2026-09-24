import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { getAppearance, setAppearance, subscribeAppearance, type Appearance } from "@/lib/appearance";

const options = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
] as const;

export default function AppearancePicker() {
  const appearance = useSyncExternalStore(subscribeAppearance, getAppearance, () => "system" as Appearance);
  return <div className="appearance-picker" role="group" aria-label="Apariencia">
    {options.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={appearance === value} onClick={() => setAppearance(value)}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </div>;
}
