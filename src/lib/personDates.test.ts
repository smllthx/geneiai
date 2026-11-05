import { describe, expect, it } from "vitest";
import { birthLabel, birthSortYear, lifeDates } from "./personDates";
import { importedBirth, parseGedcom } from "./import/gedcom";
import { parseTabular } from "./import/tabular";

describe("birth dates throughout the archive", () => {
  it("uses exact dates first and formats them in UTC", () => {
    const p = { nac_fecha: "1865-09-08", nac_fecha_aprox: "hacia 1860", nac_rango_ini: 1855, defuncion_fecha: "1911-06-06" };
    expect(birthLabel(p, true)).toBe("8 de septiembre de 1865");
    expect(lifeDates(p)).toBe("1865–1911");
  });
  it("preserves the meaning of estimates, closed and open intervals", () => {
    expect(lifeDates({ nac_fecha_aprox: "1880" })).toBe("n. hacia 1880");
    expect(lifeDates({ nac_fecha_aprox: "BEF 1850" })).toBe("n. antes de 1850");
    expect(birthLabel({ nac_fecha_aprox: "??", nac_rango_ini: 1798, nac_rango_fin: 1802 })).toBe("entre 1798 y 1802");
    expect(birthLabel({ nac_rango_ini: 1788 })).toBe("desde 1788");
    expect(birthLabel({ nac_rango_fin: 1799 })).toBe("hasta 1799");
    expect(birthSortYear({ nac_fecha_aprox: "hacia 1800" })).toBe(1800);
    expect(lifeDates({ defuncion_fecha: "1911-06-06" })).toBe("f. 1911");
    expect(lifeDates({})).toBe("");
  });
  it("preserves partial dates from GEDCOM and tabular imports", () => {
    expect(importedBirth("SEP 1865")).toEqual({ nac_fecha_aprox: "SEP 1865" });
    expect(importedBirth("8 SEP 1865")).toEqual({ nac_fecha: "1865-09-08" });
    expect(importedBirth("1865")).toEqual({ nac_rango_ini: 1865, nac_rango_fin: 1865 });
    const result = parseGedcom("0 HEAD\n1 SOUR TEST\n0 @I1@ INDI\n1 NAME Maria /Rojas/\n1 BIRT\n2 DATE ABT 1894\n0 TRLR");
    expect(lifeDates(result.personas[0])).toBe("n. hacia 1894");
    expect(parseTabular([{ nac_fecha: "1890" }]).personas[0]).not.toHaveProperty("nac_fecha");
    expect(parseTabular([{ nac_fecha_aprox: "1890" }]).personas[0].nac_fecha_aprox).toBe("1890");
  });
});
