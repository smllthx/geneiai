import { describe, expect, it } from "vitest";
import { calcularParentesco, construirCaminoParentesco } from "./parentesco";

const people = [
  { id: "yo", sexo: "masculino", nombres: "Yo" },
  { id: "madre", sexo: "femenino", nombres: "Madre" },
  { id: "abuela", sexo: "femenino", nombres: "Abuela" },
  { id: "tia", sexo: "femenino", nombres: "Tía" },
  { id: "primo", sexo: "masculino", nombres: "Primo" },
];

describe("parentesco", () => {
  it("normaliza relaciones de progenitor y encuentra ascendientes", () => {
    const rels = [
      { persona_id: "yo", pariente_id: "madre", tipo: "progenitora" },
      { persona_id: "madre", pariente_id: "abuela", tipo: "madre adoptiva" },
    ];
    expect(calcularParentesco("yo", "abuela", rels, people)?.texto).toContain("abuela");
  });

  it("mantiene un camino para hermanos y primos", () => {
    const rels = [
      { persona_id: "yo", pariente_id: "madre", tipo: "madre" },
      { persona_id: "tia", pariente_id: "madre", tipo: "hermana" },
      { persona_id: "primo", pariente_id: "tia", tipo: "hijo" },
    ];
    expect(construirCaminoParentesco("yo", "primo", rels)).toEqual(["yo", "madre", "tia", "primo"]);
  });
});
