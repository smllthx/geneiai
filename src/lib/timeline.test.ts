import { describe, expect, it } from "vitest";
import { buildTimeline, eventType, timelineDate } from "./timeline";
import { countryCode, countryCodes } from "./countries";

describe("archive timelines", () => {
  it("keeps approximate dates and ranges without inventing a day or an age", () => {
    const items = buildTimeline([{ id: "p", nombres: "Elena", nac_fecha_aprox: "ABT 1865" }], [
      { id: "e", persona_id: "p", tipo: "inmigracion", rango_ini: 1890, rango_fin: 1896 },
    ]);
    expect(items.map(i => i.dateLabel)).toEqual(["hacia 1865", "entre 1890 y 1896"]);
    expect(timelineDate(items[0], "it")).toBe("circa 1865");
    expect(timelineDate(items[1], "en")).toBe("between 1890 and 1896");
    expect(items[0].date).toBeUndefined();
  });
  it("deduplicates only the vital placeholder and retains distinct source records", () => {
    const items = buildTimeline([{ id: "p", nombres: "Elena", matrimonio_fecha: "1890-09-08" }], [
      { id: "civil", persona_id: "p", tipo: "matrimonio", fecha: "1890-09-08", fuente_id: "doc-civil" },
      { id: "church", persona_id: "p", tipo: "matrimonio", fecha: "1890-09-08", fuente_id: "doc-church" },
    ]);
    expect(items).toHaveLength(2);
    expect(items.map(i => i.sourceId)).toEqual(expect.arrayContaining(["doc-civil", "doc-church"]));
  });
  it("keeps undated events after dated events and displays explicit recorded places", () => {
    const items = buildTimeline([{ id: "p", nombres: "Elena", nac_fecha: "1865-09-08", nac_lugar_id: "it" }], [
      { id: "e", persona_id: "p", tipo: "residencia", lugar_original: "Portofino" },
    ], [{ id: "it", ciudad: "Génova", pais: "Italia" }]);
    expect(items[0].place).toBe("Génova, Italia"); expect(items[1].year).toBeNull();
    expect(timelineDate(items[0], "en")).toBe("Sep 8, 1865");
    expect(eventType("Defunción")).toBe("defuncion");
    expect(eventType("emigracion")).toBe("migracion");
  });
});

describe("world flags", () => {
  it("covers all ISO countries and resolves explicit names in several languages", () => {
    expect(countryCodes.length).toBeGreaterThanOrEqual(249);
    expect(countryCode("Italia")).toBe("IT"); expect(countryCode("Svizzera")).toBe("CH");
    expect(countryCode("Valparaíso, Chile")).toBe("CL"); expect(countryCode("NZ")).toBe("NZ");
    expect(countryCode("日本")).toBeNull();
  });
  it("does not guess nationality from a surname, city, missing or historical territory", () => {
    for (const value of [null, "", "Portofino", "Sanguineti", "Yugoslavia", "Austria-Hungría"]) expect(countryCode(value)).toBeNull();
  });
});
