import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { getBearer, getServiceSupabase, getSupabase, getUserOrThrow } from "./_lib/geneai.js";
import {
  GeneaiWorkError,
  createPerson,
  createRelationship,
  getPerson,
  getTreeContext,
  listTrees,
  proposeChange,
  searchPeople,
  updatePerson,
} from "./_lib/geneai-work/index.js";
import {
  fsCurrentPerson,
  fsPerson,
  fsRelatives,
  fsSearch,
  fsSources,
  fsStatus,
} from "./_lib/familysearch-work.js";

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
};
type SearchPerson = {
  id: string;
  title?: string;
  nombres?: string;
  apellidos?: string;
  url?: string;
};

const oauthSecurity = [{ type: "oauth2", scopes: ["openid", "profile", "email"] }];
const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
};

const certainty = z.enum(["comprobado", "probable", "hipotesis", "descartado"]);
const livingStatus = z.enum(["si", "no", "desconocido"]);
const sex = z.enum(["masculino", "femenino", "otro"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha AAAA-MM-DD");

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const personFields = {
  variantes_nombre: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  sexo: sex.nullable().optional(),
  viva: livingStatus.optional(),
  nac_fecha: date.nullable().optional(),
  nac_fecha_aprox: optionalText(120),
  nac_rango_ini: z.number().int().min(1).max(3000).nullable().optional(),
  nac_rango_fin: z.number().int().min(1).max(3000).nullable().optional(),
  bautismo_fecha: date.nullable().optional(),
  matrimonio_fecha: date.nullable().optional(),
  defuncion_fecha: date.nullable().optional(),
  entierro_fecha: date.nullable().optional(),
  ocupacion: optionalText(240),
  nacionalidad: optionalText(160),
  religion: optionalText(160),
  notas: optionalText(8000),
  certeza: certainty.optional(),
};

function originFor(req: ApiRequest) {
  const configured = (process.env.GENEAI_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) return `http://${host}`;
  return "https://geneiai.vercel.app";
}

function authChallenge(req: ApiRequest) {
  return `Bearer resource_metadata="${originFor(req)}/.well-known/oauth-protected-resource/mcp", scope="openid profile email"`;
}

function oauthClientId(req: ApiRequest) {
  const token = getBearer(req).slice("Bearer ".length);
  const payload = token.split(".")[1];
  if (!payload) return "";
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof claims.client_id === "string" ? claims.client_id : "";
  } catch {
    return "";
  }
}

function addCors(res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, mcp-session-id, last-event-id",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function readableError(error: unknown) {
  if (error instanceof GeneaiWorkError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  return {
    code: "GENEAI_WORK_ERROR",
    message: error instanceof Error ? error.message : "No se pudo completar la operación en GENEAI.",
    status: 500,
  };
}

async function asToolResult<T>(operation: () => Promise<T>, success: (data: T) => string) {
  try {
    const data = await operation();
    return {
      content: [{ type: "text" as const, text: success(data) }],
      structuredContent: { result: data },
    };
  } catch (error) {
    const safe = readableError(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: safe.message }],
      structuredContent: { error: { code: safe.code, message: safe.message } },
    };
  }
}

function peopleFrom(result: unknown): SearchPerson[] {
  if (Array.isArray(result)) return result as SearchPerson[];
  if (!result || typeof result !== "object") return [];
  const container = result as { people?: unknown; results?: unknown };
  if (Array.isArray(container.people)) return container.people as SearchPerson[];
  if (Array.isArray(container.results)) return container.results as SearchPerson[];
  return [];
}

function resultUrl(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const url = (result as { url?: unknown }).url;
  return typeof url === "string" ? url : "";
}

function createServer(sb: SupabaseClient, userId: string) {
  const server = new McpServer(
    {
      name: "GENEAI Work",
      version: "1.0.0",
      websiteUrl: "https://geneiai.vercel.app",
    },
    { capabilities: { logging: {} } },
  );

  const protectedMeta = { securitySchemes: oauthSecurity };

  server.registerTool("get_tree_context", {
    title: "Ver árbol activo",
    description: "Obtiene el árbol genealógico activo y un resumen de sus datos en la cuenta GENEAI conectada.",
    inputSchema: {},
    annotations: readAnnotations,
    _meta: protectedMeta,
  }, async () => asToolResult(
    () => getTreeContext(sb, userId),
    () => "Contexto del árbol activo obtenido desde GENEAI.",
  ));

  server.registerTool("list_trees", {
    title: "Listar árboles",
    description: "Lista únicamente los árboles genealógicos pertenecientes a la cuenta GENEAI conectada.",
    inputSchema: {},
    annotations: readAnnotations,
    _meta: protectedMeta,
  }, async () => asToolResult(
    () => listTrees(sb, userId),
    () => "Árboles de GENEAI obtenidos.",
  ));

  server.registerTool("search", {
    title: "Buscar personas en GENEAI",
    description: "Busca personas por nombre o apellido dentro del árbol activo de la cuenta GENEAI conectada.",
    inputSchema: {
      query: z.string().trim().max(240).default("").describe("Nombre, apellido o texto a buscar; vacío devuelve personas recientes."),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: readAnnotations,
    _meta: protectedMeta,
  }, async ({ query, limit }) => {
    try {
      const found = await searchPeople(sb, userId, { query, limit });
      const results = peopleFrom(found).map((person) => ({
        id: person.id,
        title: person.title || [person.nombres, person.apellidos].filter(Boolean).join(" ") || "Persona sin nombre",
        url: person.url || `https://geneiai.vercel.app/personas/${person.id}`,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ results }) }],
        structuredContent: { results },
      };
    } catch (error) {
      const safe = readableError(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ error: safe.message, results: [] }) }],
        structuredContent: { error: { code: safe.code, message: safe.message }, results: [] },
      };
    }
  });

  server.registerTool("fetch", {
    title: "Abrir persona de GENEAI",
    description: "Obtiene la ficha y relaciones de una persona por su identificador estable, solo dentro del árbol activo.",
    inputSchema: {
      id: z.string().uuid().describe("Identificador UUID devuelto por search."),
    },
    annotations: readAnnotations,
    _meta: protectedMeta,
  }, async ({ id }) => {
    try {
      const person = await getPerson(sb, userId, { personId: id });
      const container = person as unknown as Record<string, unknown>;
      const record = (container.person && typeof container.person === "object" ? container.person : container) as Record<string, unknown>;
      const title = (typeof record.title === "string" && record.title)
        || [record.nombres, record.apellidos].filter((value) => typeof value === "string" && value).join(" ")
        || "Persona";
      const url = (typeof record.url === "string" && record.url)
        || (typeof container.url === "string" && container.url)
        || `https://geneiai.vercel.app/personas/${id}`;
      const fetched = {
        id,
        title,
        text: JSON.stringify(person, null, 2),
        url,
        metadata: person,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(fetched) }],
        structuredContent: fetched,
      };
    } catch (error) {
      const safe = readableError(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ id, error: safe.message }) }],
        structuredContent: { id, error: { code: safe.code, message: safe.message } },
      };
    }
  });

  server.registerTool("create_person", {
    title: "Crear persona",
    description: "Crea una persona en el árbol activo de GENEAI. Úsala solo cuando el usuario haya pedido expresamente guardar esa persona. No borra datos.",
    inputSchema: {
      nombres: z.string().trim().min(1).max(200),
      apellidos: z.string().trim().min(1).max(200),
      ...personFields,
    },
    annotations: writeAnnotations,
    _meta: protectedMeta,
  }, async (input) => asToolResult(
    () => createPerson(sb, userId, input),
    (data) => `Persona creada en GENEAI${resultUrl(data) ? `: ${resultUrl(data)}` : "."}`,
  ));

  server.registerTool("update_person", {
    title: "Actualizar persona",
    description: "Actualiza campos permitidos de una persona del árbol activo. Úsala solo tras una petición explícita del usuario; rechaza ediciones fuera de su árbol y no permite borrar la persona.",
    inputSchema: {
      personId: z.string().uuid(),
      changes: z.object({
        nombres: z.string().trim().min(1).max(200).optional(),
        apellidos: z.string().trim().min(1).max(200).optional(),
        ...personFields,
      }).strict().refine((changes) => Object.keys(changes).length > 0, "Incluye al menos un cambio."),
      expectedRowVersion: z.number().int().min(1).describe("Versión devuelta por fetch; evita sobrescribir cambios más nuevos."),
    },
    annotations: writeAnnotations,
    _meta: protectedMeta,
  }, async (input) => asToolResult(
    () => updatePerson(sb, userId, input),
    (data) => `Persona actualizada en GENEAI${resultUrl(data) ? `: ${resultUrl(data)}` : "."}`,
  ));

  server.registerTool("create_relationship", {
    title: "Añadir relación familiar",
    description: "Añade una relación entre dos personas del mismo árbol activo y su relación inversa. Úsala solo cuando el usuario confirme las dos personas y el parentesco. No elimina relaciones.",
    inputSchema: {
      sourcePersonId: z.string().uuid(),
      targetPersonId: z.string().uuid(),
      type: z.enum(["padre", "madre", "hijo", "conyuge", "hermano", "otro"]),
      nature: z.enum(["biologica", "adoptiva", "desconocida"]).optional(),
      certainty: certainty.optional(),
      notes: optionalText(4000),
    },
    annotations: writeAnnotations,
    _meta: protectedMeta,
  }, async (input) => asToolResult(
    () => createRelationship(sb, userId, input),
    () => "Relación familiar guardada en GENEAI para ambas personas.",
  ));

  server.registerTool("propose_change", {
    title: "Proponer cambio",
    description: "Guarda una propuesta revisable en GENEAI cuando la evidencia no basta para modificar directamente una persona, relación, evento o fuente. No aplica el cambio ni borra datos.",
    inputSchema: {
      type: z.enum(["nueva_persona", "actualizar_persona", "nueva_relacion", "nuevo_evento", "nueva_fuente", "otro"]),
      title: z.string().trim().min(1).max(240),
      description: optionalText(4000),
      personId: z.string().uuid().nullable().optional(),
      payload: z.record(z.unknown()),
      confidence: z.number().min(0).max(1).optional(),
    },
    annotations: writeAnnotations,
    _meta: protectedMeta,
  }, async (input) => asToolResult(
    () => proposeChange(sb, userId, input),
    () => "Propuesta guardada en GENEAI para revisión, sin aplicar cambios automáticamente.",
  ));

  return server;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  addCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!["POST", "GET", "DELETE"].includes(req.method ?? "")) {
    res.setHeader("Allow", "POST, GET, DELETE, OPTIONS");
    return res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  }

  if (!getBearer(req)) {
    res.setHeader("WWW-Authenticate", authChallenge(req));
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authentication required" },
      id: null,
    });
  }

  let authSb: SupabaseClient;
  let sb: SupabaseClient;
  let user: User;
  try {
    authSb = getSupabase(req);
    user = await getUserOrThrow(authSb);
  } catch {
    res.setHeader("WWW-Authenticate", authChallenge(req));
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid or expired GENEAI authorization" },
      id: null,
    });
  }

  const clientId = oauthClientId(req);
  if (!clientId) {
    return res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "This endpoint only accepts approved GENEAI OAuth connections" },
      id: null,
    });
  }

  try {
    sb = getServiceSupabase();
  } catch {
    return res.status(503).json({
      jsonrpc: "2.0",
      error: { code: -32004, message: "GENEAI Work is not configured on the server" },
      id: null,
    });
  }

  const configuredClients = (process.env.GENEAI_WORK_CLIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const { data: approvedClient, error: approvalError } = await sb.from("work_oauth_clients")
    .select("id")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .eq("active", true)
    .maybeSingle();
  if (approvalError || !approvedClient || (configuredClients.length > 0 && !configuredClients.includes(clientId))) {
    return res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "This OAuth client is not approved for the connected GENEAI account" },
      id: null,
    });
  }

  const server = createServer(sb, user.id);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
  } catch {
    if (!res.headersSent) {
      return res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "GENEAI could not process the MCP request" },
        id: null,
      });
    }
  }
}
