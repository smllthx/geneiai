---
name: familysearch-browser
description: Reglas de uso y seguridad del compañero local de FamilySearch (Playwright, 127.0.0.1) en GENAIA.
---

# FamilySearch por navegador local (GENAIA)

Vía **complementaria** al OAuth oficial de FamilySearch. No sustituye ni elimina
OAuth, Supabase ni el MCP/Work existentes.

## Cuándo usarla

- El usuario quiere consultar FamilySearch con su propia sesión del navegador.
- La API oficial no está conectada o no expone lo que se ve en la UI.
- Siempre desde el Mac del usuario, con el compañero local corriendo.

## Reglas de seguridad (no negociables)

1. Nunca pidas, leas, registres ni almacenes contraseñas. El login lo hace el usuario
   en la ventana visible (o con autorrelleno del navegador).
2. Prohibido capturar pantalla, vídeo, traza o HAR durante el login.
3. Solo se persisten cookies en `~/.genaia/familysearch/cookies.json` (`0600`).
   `familysearch_browser_logout` cierra el navegador y las borra.
4. Solo la UI visible de FamilySearch. Nada de APIs internas/ocultas ni bypass de acceso.
5. Solo lectura: nunca escribas en FamilySearch.
6. El servidor escucha únicamente en `127.0.0.1`. Sin scraping en la nube ni proxys.
7. Sin sesión → responde `login_required`. DOM cambiado → error explícito
   (`FS_DOM_CHANGED`); jamás inventes datos.

## Reglas de datos en GENAIA

- **Nunca importes automáticamente** al árbol lo que venga del navegador local.
  Todo pasa por comparación/propuesta revisable por el usuario.
- No modifiques datos genealógicos existentes con estos resultados.
- Si `http://127.0.0.1:8787` no responde desde la app publicada, muestra
  "Compañero local no accesible" con el enlace a la UI local.

## Herramientas

`familysearch_browser_open`, `familysearch_browser_status`,
`familysearch_browser_search_people` (nombre, apellido, año aprox., lugar),
`familysearch_browser_get_person` (pid), `familysearch_browser_get_sources` (pid),
`familysearch_browser_logout`. Además `GET /health`.

## Comandos

```bash
npm run familysearch:browser:install   # instala deps + Chromium (solo local)
npm run familysearch:browser           # arranca en http://127.0.0.1:8787
```

## MCP local (stdio)

```json
{
  "mcpServers": {
    "genaia-familysearch-browser": {
      "command": "node",
      "args": ["/Users/TU_USUARIO/genaia/tools/familysearch-browser/src/mcp.js"]
    }
  }
}
```
