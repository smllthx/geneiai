import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS del compañero local
import {
  DomChangedError,
  extractPid,
  looksLoggedOut,
  parsePersonFacts,
  parseRelatives,
  parseSearchRows,
  parseSources,
  personUrl,
  pickYear,
} from "../src/parse.js";

describe("extractPid", () => {
  it("lee el PID de una URL de FamilySearch", () => {
    expect(extractPid("https://www.familysearch.org/tree/person/details/GXR9-K4M")).toBe("GXR9-K4M");
    expect(extractPid("/tree/person/details/L1QT-2ZQ4?x=1")).toBe("L1QT-2ZQ4");
  });
  it("devuelve null si no hay PID", () => {
    expect(extractPid("https://www.familysearch.org/search")).toBeNull();
    expect(extractPid(undefined as unknown as string)).toBeNull();
  });
});

describe("parseSearchRows", () => {
  it("normaliza filas visibles", () => {
    const rows = parseSearchRows([
      {
        name: "Giovanni  Battista Sanguineti",
        url: "https://www.familysearch.org/tree/person/details/GXR9-K4M",
        details: "Nacimiento 1850 Chiavari\nFallecimiento 1920 Buenos Aires",
      },
      { name: "", url: "https://www.familysearch.org/tree/person/details/AAAA-111" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].pid).toBe("GXR9-K4M");
    expect(rows[0].name).toBe("Giovanni Battista Sanguineti");
    expect(rows[0].year).toBe(1850);
    expect(rows[0].birth).toContain("1850");
    expect(rows[0].death).toContain("1920");
  });

  it("lanza error explícito si el DOM cambió", () => {
    expect(() => parseSearchRows([{ name: "x", url: "https://ejemplo.com/nada" }])).toThrow(DomChangedError);
    expect(() => parseSearchRows("nope" as unknown as unknown[])).toThrow(DomChangedError);
  });

  it("no inventa resultados con lista vacía", () => {
    expect(parseSearchRows([])).toEqual([]);
  });
});

describe("parsePersonFacts / parseRelatives / parseSources", () => {
  it("filtra pares incompletos", () => {
    expect(parsePersonFacts([{ label: "Nacimiento", value: "12 marzo 1850" }, { label: "", value: "x" }])).toEqual([
      { label: "Nacimiento", value: "12 marzo 1850", year: 1850 },
    ]);
  });

  it("normaliza relaciones con PID", () => {
    const rels = parseRelatives([
      { relation: "Cónyuge", people: [{ name: "Maria Rosa", url: "/tree/person/details/L1QT-2ZQ4" }] },
      { relation: "Hijos", people: [{ name: "Sin enlace" }] },
    ]);
    expect(rels[0]).toMatchObject({ relation: "Cónyuge", pid: "L1QT-2ZQ4", url: personUrl("L1QT-2ZQ4") });
    expect(rels[1]).toMatchObject({ relation: "Hijos", pid: null });
  });

  it("normaliza fuentes visibles", () => {
    expect(parseSources([{ title: " Acta de bautismo ", url: "https://x", detail: null }, { title: "" }])).toEqual([
      { title: "Acta de bautismo", url: "https://x", detail: null },
    ]);
  });
});

describe("looksLoggedOut / pickYear", () => {
  it("detecta pantalla de identificación", () => {
    expect(looksLoggedOut({ url: "https://ident.familysearch.org/cis-web/signin" })).toBe(true);
    expect(looksLoggedOut({ url: "https://www.familysearch.org/tree/find", bodyText: "Buscar en el árbol" })).toBe(false);
  });
  it("extrae año", () => {
    expect(pickYear("nacido en 1783 en Chiavari")).toBe(1783);
    expect(pickYear("sin fecha")).toBeNull();
  });
});
