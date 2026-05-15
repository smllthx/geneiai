## Plan de rediseño completo

Ejecuto en este turno todo lo que sea viable sin romper el proyecto. Lo que no entre queda anotado al final como "pendiente próxima iteración".

### Fase 1 — Sistema visual Liquid Glass (esta sesión)
- Refinar `src/index.css` y `tailwind.config.ts`: tokens HSL claros/oscuros, vidrios `glass`/`glass-strong`, blur 24-40px, bordes 1px translúcidos, sombras suaves multicapa, radios 16/20/28, animaciones (fade, scale, float).
- Tipografía: SF Pro / Inter para UI + Instrument Serif para títulos editoriales.
- Componentes base reutilizables: `GlassCard`, `SectionHeader`, `EmptyState`, `StatPill`, `CertaintyDot`.

### Fase 2 — Reorganización de navegación
Sidebar + bottom-nav refactorizadas a 11 secciones limpias:
```
Inicio · Árbol · Personas · Familias · Documentos · Fotos
Investigación · Coincidencias · ADN · Fuentes · Configuración
```
- "Familias" nueva (agrupa por unidad familiar).
- "Fotos" nueva (separada de Documentos).
- "Investigación" unifica `agente`, `agentes-paralelo`, `investigacion-externa`, `pistas`, `hipotesis`, `inferencias` bajo tabs internos.
- "Fuentes" = vista de `documentos` filtrada por `tipo=fuente` + citas.
- "Configuración" absorbe `configurar-app`.
- Rutas viejas redirigen a las nuevas para no romper enlaces.

### Fase 3 — Árbol genealógico estilo MyHeritage
- `Arbol.tsx` rehecho con pan/zoom (rueda + drag, pinch en touch), nodo central = "Yo" o persona seleccionada.
- Capas: ascendientes arriba (sin límite de generaciones, lazy expand), descendientes abajo, hermanos a la izquierda, cónyuges a la derecha.
- `FamilyTreeNode`: foto circular, nombre, n.✱ – †, lugar nac/def, badge de certeza.
- Tap → abre ficha. Long-press → menú rápido (agregar pariente).
- Botón "Centrar en mí" + selector de persona base.

### Fase 4 — Ficha completa de persona
Refinar `PersonaDetail.tsx`:
- Hero glass con foto grande, nombre, fechas, lugares, badges.
- Tabs: Resumen · Familia · Línea de tiempo · Fotos · Documentos · Fuentes · Investigación · Coincidencias · Notas.
- Sub-componentes nuevos: `TimelineEvent`, `SourceCard`, `MatchCard`, `PhotoCard`, `BiographyCard`.

### Fase 5 — Importar / Exportar
- Página `Importar` con wizard 4 pasos: Origen → Subir/Conectar → Preview con detección de duplicados (fuzzy por nombre+fecha±2 años) → Confirmar.
- **GEDCOM**: import (ya existe parcial, lo robustezco) + export desde menú.
- **CSV/JSON**: parser ya existe, le agrego preview y dedupe.
- **FamilySearch OAuth**: 
  - Edge function `familysearch-auth/start` → genera URL de autorización (state + PKCE).
  - Edge function `familysearch-auth/callback` → intercambia code por tokens, los guarda en nueva tabla `external_accounts` (provider, access_token, refresh_token, expires_at).
  - Edge function `familysearch-sync` → llama API GEDCOM-X de FamilySearch para descargar el árbol del usuario (configurable: N generaciones ascendentes/descendentes), normaliza y guarda en `personas`/`relaciones` con dedupe.
  - UI: botón "Conectar FamilySearch" → OAuth popup → estado conectado → "Sincronizar ahora" + selector generaciones + "Descargar GEDCOM".
- **MyHeritage**: solo botón "Importar GEDCOM exportado de MyHeritage" (no tiene API pública), con instrucciones inline.

### Fase 6 — Coincidencias e Investigación
- `Coincidencias.tsx` rehecho: cards con score Alto/Medio/Bajo, razones, acciones Aceptar/Descartar/Fusionar.
- Edge function `detectar-coincidencias`: corre fuzzy sobre todas las personas del usuario (ya tengo `lib/search/fuzzy.ts`) y popula tabla `coincidencias`.
- `Investigacion.tsx` (nueva, unifica): tabs Agente / Externa / Pistas / Hipótesis / Inferencias, con confianza por color.

### Fase 7 — Fotos
- Bucket `fotos` (público) creado por migración.
- Tabla `fotos` (id, user_id, url, descripcion, fecha_aprox, lugar_id, personas_ids[]).
- Página `Fotos` con galería masonry, filtros por persona/familia/lugar, modal de detalle con tag de personas.
- `PhotoCard` reutilizable.

### Fase 8 — ADN / Estimación
- Página `ADN.tsx`: mapa de orígenes (lista por región con porcentaje + barras), tarjetas por rama familiar, formulario manual para pegar resultados de tests externos.
- Tabla `dna_estimates` (user_id, region, porcentaje, fuente, notas).
- Banner permanente: "Estimación referencial, no diagnóstico genético oficial".

### Fase 9 — Inicio / Ecosistema
- `Dashboard` rehecho como feed Apple-style: stats, actividad reciente (cambios últimos 7 días), coincidencias nuevas, tareas pendientes, favoritos, ramas destacadas.

### Cambios de base de datos (migración única)
- `external_accounts(user_id, provider, access_token, refresh_token, expires_at, account_ref, created_at)` + RLS.
- `fotos(...)` + RLS + bucket público.
- `dna_estimates(...)` + RLS.
- `familias(id, user_id, nombre, head_persona_id, notas)` + RLS.
- `actividad(user_id, tipo, ref_id, descripcion, created_at)` para feed.
- Bucket storage `fotos` público + policies.

### Detalles técnicos
- FamilySearch usa OAuth2 Authorization Code + GEDCOM-X JSON. Sandbox: `https://identbeta.familysearch.org`, prod: `https://ident.familysearch.org`. Endpoints: `/cis-web/oauth2/v3/authorization` y `/token`. API: `https://api.familysearch.org/platform/tree/...`. Token expira ~1h, refresh con `refresh_token`.
- Edge functions todas con CORS, Zod validation, JWT del usuario para autorizar.
- React Router: agrego rutas nuevas y redirects con `<Navigate>` para legacy.
- Pan/zoom del árbol con `react-zoom-pan-pinch` (ligero, ya soporta touch).

### Qué probablemente NO entre en este turno
- Edición visual de relaciones desde el árbol con drag.
- Sincronización bidireccional FamilySearch (solo pull en esta primera versión).
- Tagging interactivo de personas en fotos (rectángulos sobre imagen) — sale con campo `personas_ids[]` plano.
- Mapa real de ADN (Leaflet) — sale como lista visual con barras.

Si algo crítico queda fuera lo digo al final.
