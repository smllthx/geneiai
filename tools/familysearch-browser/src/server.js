#!/usr/bin/env node
import http from "node:http";
import { HOST, PORT } from "./config.js";
import { TOOLS, TOOL_NAMES } from "./tools.js";

const UI = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GENAIA · Compañero FamilySearch (local)</title>
<style>
 body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:32px;background:#f6f7f9;color:#101828}
 .card{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:24px}
 h1{font-size:22px;font-weight:800;margin:0 0 4px}
 p{color:#475467;font-size:14px}
 button{font:inherit;font-weight:600;padding:10px 14px;border-radius:12px;border:1px solid #d0d5dd;background:#fff;cursor:pointer;margin:4px 6px 4px 0}
 pre{background:#0c111d;color:#e4e7ec;padding:14px;border-radius:12px;overflow:auto;font-size:12px;max-height:50vh}
 input{font:inherit;padding:9px 11px;border:1px solid #d0d5dd;border-radius:10px;margin:4px 6px 4px 0}
</style></head><body><div class="card">
<h1>Compañero local de FamilySearch</h1>
<p>Se ejecuta solo en tu Mac (127.0.0.1). GENAIA nunca lee ni guarda tu contraseña: el inicio de sesión ocurre en la ventana visible del navegador.</p>
<div>
 <button onclick="call('familysearch_browser_open')">Abrir FamilySearch</button>
 <button onclick="call('familysearch_browser_status')">Estado de sesión</button>
 <button onclick="call('familysearch_browser_logout')">Cerrar sesión y borrar cookies</button>
</div>
<div>
 <input id="n" placeholder="Nombre"><input id="a" placeholder="Apellido"><input id="y" placeholder="Año aprox."><input id="l" placeholder="Lugar">
 <button onclick="search()">Buscar</button>
</div>
<pre id="out">Listo.</pre>
</div><script>
async function call(tool, body){
  document.getElementById('out').textContent='…';
  const r = await fetch('/tools/'+tool,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});
  document.getElementById('out').textContent = JSON.stringify(await r.json(), null, 2);
}
function search(){
  call('familysearch_browser_search_people',{
    nombre:document.getElementById('n').value||undefined,
    apellido:document.getElementById('a').value||undefined,
    anio:Number(document.getElementById('y').value)||undefined,
    lugar:document.getElementById('l').value||undefined});
}
</script></body></html>`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export function createServer(tools = TOOLS) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "genaia-familysearch-browser", tools: Object.keys(tools), version: 1 });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { ...CORS, "content-type": "text/html; charset=utf-8" });
      return res.end(UI);
    }
    if (req.method === "POST" && url.pathname.startsWith("/tools/")) {
      const name = url.pathname.slice("/tools/".length);
      const tool = tools[name];
      if (!tool) return json(res, 404, { ok: false, error: `Herramienta desconocida: ${name}`, tools: Object.keys(tools) });
      const body = await readBody(req);
      if (body === null) return json(res, 400, { ok: false, error: "JSON inválido." });
      try {
        return json(res, 200, await tool(body));
      } catch (err) {
        const code = err?.code ?? "FS_BROWSER_ERROR";
        return json(res, code === "login_required" ? 200 : 500, {
          ok: false,
          status: code === "login_required" ? "login_required" : "error",
          error: err?.message ?? "Error inesperado",
          code,
        });
      }
    }
    return json(res, 404, { ok: false, error: "Ruta no encontrada" });
  });
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  createServer().listen(PORT, HOST, () => {
    console.log(`GENAIA · compañero FamilySearch escuchando en http://${HOST}:${PORT}`);
    console.log(`UI local: http://${HOST}:${PORT}/  ·  Herramientas: ${TOOL_NAMES.join(", ")}`);
  });
}
