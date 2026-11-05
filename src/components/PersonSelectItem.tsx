import PersonPortrait from "./PersonPortrait";
import { SelectItem } from "./ui/select";
import { personFullName, type SearchablePerson } from "@/lib/personSearch";

export default function PersonSelectItem({ person, suffix }: { person: SearchablePerson; suffix?: string }) {
  const name = personFullName(person);
  const label = suffix ? `${name} · ${suffix}` : name;
  return <SelectItem value={person.id} textValue={label}>
    <span className="inline-flex items-center gap-2">
      <PersonPortrait person={person} className="h-6 w-6 shrink-0 rounded-full" />
      {label}
    </span>
  </SelectItem>;
}
