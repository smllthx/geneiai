/** Explicit living status wins over contradictory death fields. Unknown stays protected. */
export function canDiscloseDeceasedPerson(person: { viva?: string | null; defuncion_fecha?: string | null }): boolean {
  return person.viva === "no";
}
