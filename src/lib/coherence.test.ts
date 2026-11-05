import { expect, it } from "vitest";
import { checkCoherence } from "./coherence";
const child = { id: "c", nombres: "C", apellidos: "R", nac_rango_ini: 1870, nac_rango_fin: 1895 };
const parent = { id: "p", nombres: "P", apellidos: "R", nac_fecha: "1865-05-06" };
const relation = { id: "1", persona_id: "c", pariente_id: "p", tipo: "padre" };

it("uses both bounds and reports only a conflict that the entire range supports", () => {
  expect(checkCoherence([child, parent], [relation])).toEqual([]);
  expect(checkCoherence([{...child, nac_rango_fin: 1873}, parent], [relation])).toEqual([
    expect.objectContaining({ rule: "padre_joven" }),
  ]);
});

it("reports duplicated parental records and links to oneself", () => {
  const result = checkCoherence([child, parent], [relation, {...relation, id: "2"}, {...relation, id: "3", tipo: "conyuge", persona_id: "p"}]);
  expect(result.map(issue => issue.rule)).toEqual(["vinculo_repetido", "autorrelacion"]);
});
