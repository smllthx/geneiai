import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { GeneaiWorkError, __test, createRelationship } from "./index";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const TREE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TREE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_A = "aaaaaaaa-1111-4111-8111-111111111111";
const PERSON_B = "bbbbbbbb-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; error: null; count?: number }> {
  private filters: Array<[string, unknown]> = [];
  private mode: "select" | "insert" | "upsert" = "select";
  private values: Row[] = [];
  private one = false;

  constructor(
    private table: string,
    private database: Record<string, Row[]>,
    private writes: Array<{ table: string; values: Row[] }>,
  ) {}

  select() { return this; }
  eq(field: string, value: unknown) { this.filters.push([field, value]); return this; }
  order() { return this; }
  maybeSingle() { this.one = true; return this.execute(); }
  single() { this.one = true; return this.execute(); }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Row | Row[]) {
    this.mode = "upsert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  private async execute() {
    if (this.mode === "insert" || this.mode === "upsert") {
      this.writes.push({ table: this.table, values: this.values });
      return { data: this.one ? this.values[0] ?? null : this.values, error: null };
    }
    const rows = (this.database[this.table] ?? []).filter((row) =>
      this.filters.every(([field, value]) => row[field] === value),
    );
    return { data: this.one ? rows[0] ?? null : rows, error: null };
  }

  then<TResult1 = { data: Row[] | Row | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function fakeSupabase(personRows: Row[]) {
  const writes: Array<{ table: string; values: Row[] }> = [];
  const database: Record<string, Row[]> = {
    arboles: [
      { id: TREE_A, user_id: USER_A, nombre: "Árbol A", is_default: true },
      { id: TREE_B, user_id: USER_B, nombre: "Árbol B", is_default: true },
    ],
    profiles: [
      { id: USER_A, active_arbol_id: TREE_A },
      { id: USER_B, active_arbol_id: TREE_B },
    ],
    personas: personRows,
    relaciones: [],
    work_audit_log: [],
  };
  const client = {
    from(table: string) {
      return new FakeQuery(table, database, writes);
    },
  } as unknown as SupabaseClient;
  return { client, writes };
}

describe("GENEAI Work validation", () => {
  it("rejects fields that could escape user and tree ownership", () => {
    expect(() => __test.sanitizePersonFields({ user_id: USER_B, nombres: "Ana" }, "update"))
      .toThrowError(GeneaiWorkError);
    try {
      __test.sanitizePersonFields({ arbol_id: TREE_B }, "update");
    } catch (error) {
      expect((error as GeneaiWorkError).code).toBe("FORBIDDEN_FIELDS");
    }
  });

  it("rejects impossible dates and chronology", () => {
    expect(__test.isValidDate("2024-02-29")).toBe(true);
    expect(__test.isValidDate("2023-02-29")).toBe(false);
    expect(() => __test.validateChronology({ nac_fecha: "1980-01-01", defuncion_fecha: "1979-12-31" }))
      .toThrowError(GeneaiWorkError);
  });

  it("rejects system fields inside a Work proposal payload", () => {
    expect(() => __test.sanitizeSuggestionPayload("actualizar_persona", {
      notas: "Dato revisable",
      arbol_id: TREE_B,
    })).toThrowError(GeneaiWorkError);
    expect(__test.sanitizeSuggestionPayload("actualizar_persona", {
      ocupacion: "Carpintera",
    })).toEqual({ ocupacion: "Carpintera" });
  });

  it("rejects a relationship when one person belongs to another tree", async () => {
    const { client, writes } = fakeSupabase([
      { id: PERSON_A, user_id: USER_A, arbol_id: TREE_A, nombres: "Ana", apellidos: "A", sexo: "femenino" },
      { id: PERSON_B, user_id: USER_A, arbol_id: TREE_B, nombres: "Bea", apellidos: "B", sexo: "femenino" },
    ]);

    await expect(createRelationship(client, USER_A, {
      sourcePersonId: PERSON_A,
      targetPersonId: PERSON_B,
      type: "hermano",
    })).rejects.toMatchObject({ code: "PERSON_NOT_FOUND", status: 404 });
    expect(writes.filter((write) => write.table === "relaciones")).toHaveLength(0);
  });

  it("rejects a relationship to a person owned by another user", async () => {
    const { client, writes } = fakeSupabase([
      { id: PERSON_A, user_id: USER_A, arbol_id: TREE_A, nombres: "Ana", apellidos: "A", sexo: "femenino" },
      { id: PERSON_B, user_id: USER_B, arbol_id: TREE_A, nombres: "Bea", apellidos: "B", sexo: "femenino" },
    ]);

    await expect(createRelationship(client, USER_A, {
      sourcePersonId: PERSON_A,
      targetPersonId: PERSON_B,
      type: "hermano",
    })).rejects.toMatchObject({ code: "PERSON_NOT_FOUND", status: 404 });
    expect(writes.filter((write) => write.table === "relaciones")).toHaveLength(0);
  });

  it("writes both directions only for two people in the active tree", async () => {
    const { client, writes } = fakeSupabase([
      { id: PERSON_A, user_id: USER_A, arbol_id: TREE_A, nombres: "Ana", apellidos: "A", sexo: "femenino" },
      { id: PERSON_B, user_id: USER_A, arbol_id: TREE_A, nombres: "Bea", apellidos: "B", sexo: "femenino" },
    ]);

    const result = await createRelationship(client, USER_A, {
      sourcePersonId: PERSON_A,
      targetPersonId: PERSON_B,
      type: "madre",
      nature: "biologica",
      certainty: "probable",
    });
    const relationWrite = writes.find((write) => write.table === "relaciones");
    expect(result.inverseType).toBe("hijo");
    expect(relationWrite?.values).toHaveLength(2);
    expect(relationWrite?.values[0]).toMatchObject({
      user_id: USER_A,
      arbol_id: TREE_A,
      persona_id: PERSON_A,
      pariente_id: PERSON_B,
      tipo: "madre",
    });
  });

  it("uses the parent's sex for the inverse of a child relationship", async () => {
    const { client } = fakeSupabase([
      { id: PERSON_A, user_id: USER_A, arbol_id: TREE_A, nombres: "Álex", apellidos: "A", sexo: "masculino" },
      { id: PERSON_B, user_id: USER_A, arbol_id: TREE_A, nombres: "Bea", apellidos: "B", sexo: "femenino" },
    ]);

    const result = await createRelationship(client, USER_A, {
      sourcePersonId: PERSON_A,
      targetPersonId: PERSON_B,
      type: "hijo",
    });

    expect(result.inverseType).toBe("madre");
  });
});
