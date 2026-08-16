#!/usr/bin/env node
/**
 * Servidor MCP (stdio) que reutiliza EXACTAMENTE el mismo módulo de herramientas
 * que el servidor REST local. Solo para uso en el Mac del usuario.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TOOLS } from "./tools.js";

const server = new McpServer({ name: "genaia-familysearch-browser", version: "1.0.0" });

const schemas = {
  familysearch_browser_open: {},
  familysearch_browser_status: {},
  familysearch_browser_search_people: {
    nombre: z.string().optional(),
    apellido: z.string().optional(),
    anio: z.number().int().min(1000).max(2100).optional(),
    lugar: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  familysearch_browser_get_person: { pid: z.string() },
  familysearch_browser_get_sources: { pid: z.string() },
  familysearch_browser_logout: {},
};

const descriptions = {
  familysearch_browser_open: "Abre FamilySearch en un navegador visible local para iniciar sesión manualmente.",
  familysearch_browser_status: "Estado del navegador local y de la sesión de FamilySearch.",
  familysearch_browser_search_people: "Busca personas en la UI visible de FamilySearch (nombre, apellido, año aprox., lugar).",
  familysearch_browser_get_person: "Lee los datos y relaciones visibles de una persona por PID.",
  familysearch_browser_get_sources: "Lee las fuentes visibles de una persona por PID.",
  familysearch_browser_logout: "Cierra el navegador y borra las cookies locales.",
};

for (const [name, handler] of Object.entries(TOOLS)) {
  server.tool(name, descriptions[name], schemas[name], async (args) => {
    try {
      const result = await handler(args ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ ok: false, code: err?.code ?? "FS_BROWSER_ERROR", error: err?.message }, null, 2) }],
      };
    }
  });
}

await server.connect(new StdioServerTransport());
