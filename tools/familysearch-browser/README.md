# GENAIA · Compañero local de FamilySearch (Playwright)

Segunda vía para consultar FamilySearch **desde tu Mac**, complementaria al OAuth oficial
(que sigue funcionando en GENAIA → Importar → FamilySearch → "API oficial (opcional)").

## Principios de seguridad

- Escucha solo en `127.0.0.1`. No se expone a internet, no hay scraping en la nube.
- Abre **Chrome visible** (fallback Chromium). El login lo haces tú, a mano o con el
  autorrelleno del navegador/llavero.
- **Nunca** se leen, registran ni almacenan contraseñas. No se graban capturas, vídeos,
  trazas ni HAR del login.
- Solo se persisten **cookies** en `~/.genaia/familysearch/cookies.json` (dir `0700`,
  archivo `0600`). `familysearch_browser_logout` las borra.
- Solo navega la **UI visible** de FamilySearch. Sin APIs internas ni bypass de acceso.
- Solo lectura: nunca escribe en FamilySearch ni modifica tus datos genealógicos.

## Instalación (Mac)

```bash
npm run familysearch:browser:install
```

## Uso

```bash
npm run familysearch:browser
# http://127.0.0.1:8787/        → UI local
# http://127.0.0.1:8787/health  → estado
```

Después, en GENAIA → **Importar → FamilySearch → Navegador local**: abre FamilySearch,
inicia sesión en la ventana y usa la búsqueda de prueba.

## REST local

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del compañero |
| POST | `/tools/familysearch_browser_open` | Abre el navegador visible |
| POST | `/tools/familysearch_browser_status` | Estado de navegador/sesión |
| POST | `/tools/familysearch_browser_search_people` | `{ nombre, apellido, anio, lugar, limit }` |
| POST | `/tools/familysearch_browser_get_person` | `{ pid }` |
| POST | `/tools/familysearch_browser_get_sources` | `{ pid }` |
| POST | `/tools/familysearch_browser_logout` | Cierra sesión y borra cookies |

Cuando no hay sesión, la respuesta es `{"ok":false,"status":"login_required"}`.
Si el DOM de FamilySearch cambia, se devuelve un error explícito (`FS_DOM_CHANGED`);
nunca se inventan datos.

## MCP local (stdio)

```json
{
  "mcpServers": {
    "genaia-familysearch-browser": {
      "command": "node",
      "args": ["/Users/TU_USUARIO/genaia/tools/familysearch-browser/src/mcp.js"],
      "env": { "GENAIA_FS_BROWSER_PORT": "8787" }
    }
  }
}
```

## Variables

| Variable | Por defecto |
| --- | --- |
| `GENAIA_FS_BROWSER_PORT` | `8787` |
| `GENAIA_FS_STATE_DIR` | `~/.genaia/familysearch` |
| `GENAIA_FS_TIMEOUT` | `45000` |
