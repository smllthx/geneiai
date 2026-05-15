## Alcance

Cierro de una sola pasada los puntos ❌ y ⚠️. MyHeritage automático queda fuera: **no existe API pública**, sólo import GEDCOM manual (ya está). Lo dejo documentado en pantalla en lugar de prometer algo imposible.

## 1. PersonaDetail rehecho (9 tabs + metadata) ⚠️

- Componentes nuevos en `src/components/persona/`: `PersonaHero`, `TabResumen`, `TabFamilia`, `TabTimeline`, `TabFotos`, `TabDocumentos`, `TabFuentes`, `TabInvestigacion`, `TabCoincidencias`, `TabNotas`, `TimelineEvent`, `SourceCard`, `MatchCard`, `PhotoCard`, `BiographyCard`.
- Estados loading / error / "no encontrada" con glass cards.
- Metadata dinámica vía `<PersonaMeta>` que actualiza `document.title`, `<meta name="description">`, `og:title`, `og:description`, `og:image` (foto de la persona o fallback).
- Botones "Volver al árbol", "Editar", "Investigar", "Compartir".
- `CertezaBadge` aplicado consistentemente.

## 2. Investigación unificada ⚠️

- `Investigacion.tsx` pasa a contener pestañas internas: Agente, Paralelo, Búsquedas externas, Pistas, Hipótesis, Inferencias.
- Las páginas viejas (`/agente`, `/pistas`, etc.) siguen accesibles pero redirigen a `/investigacion?tab=...` para no romper enlaces.

## 3. Edge function `detectar-coincidencias` ⚠️

- Nueva función Deno que:
  - Compara personas del usuario por nombre normalizado + fechas próximas (±3 años) + lugar.
  - Calcula score 0-100 con razones (`["mismo apellido","fecha ±2 años","mismo lugar"]`).
  - Hace upsert en `coincidencias` evitando duplicados (par ordenado `ref_a < ref_b`).
- Botón "Detectar coincidencias" en `Coincidencias.tsx` que la invoca.

## 4. Edición visual del árbol con drag ❌

- En `Arbol.tsx`, modo "Editar relaciones": al arrastrar una persona sobre otra aparece menú: padre/madre, hijo, cónyuge, hermano.
- Crea/elimina filas en `relaciones` (con su par inverso) usando el cliente Supabase.
- Confirmación toast + undo (5 s) usando snapshot del estado anterior.

## 5. Tagging interactivo en fotos ❌

- Nueva tabla `foto_tags` (foto_id, persona_id, x, y, w, h en %, user_id, RLS estándar).
- En `Fotos.tsx` modal de detalle: click & drag dibuja rectángulo, selector de persona, guarda tag. Hover muestra etiqueta con nombre y enlace a su ficha.

## 6. Mapa real de ADN con Leaflet ❌

- `bun add leaflet react-leaflet @types/leaflet`.
- `ADN.tsx`: vista doble (Lista | Mapa). Mapa con polígonos/markers aproximados por región (GeoJSON simple bundleado en `src/lib/dna-regions.ts` con 30-40 regiones principales y sus centroides). Opacidad ∝ porcentaje.

## 7. FamilySearch — sync periódica + push ❌

- **Push**: nueva edge function `familysearch-push` que toma personas locales con `ids_externos.familysearch_id` faltante y crea `Person` en FS vía `POST /platform/tree/persons` (GEDCOM-X), guardando el id devuelto. Sólo personas marcadas con flag `sync_to_fs = true` (nuevo bool en `personas`).
- **Periódica**: habilitar `pg_cron` + `pg_net`, programar `familysearch-sync` cada 24 h por usuario que tenga `external_accounts.metadata->>auto_sync = 'true'`. Toggle en Configuración.

## 8. Cambios de BD (1 migración)

```
ALTER TABLE personas ADD COLUMN sync_to_fs boolean NOT NULL DEFAULT false;
CREATE TABLE foto_tags (id, user_id, foto_id, persona_id, x, y, w, h, created_at) + RLS;
```

`pg_cron` se programa con `supabase--insert` (no migración) porque incluye URL y anon key específicos del proyecto.

## 9. Lo que NO entra (y por qué)

- **MyHeritage automático**: sin API pública. Mantengo el import manual de GEDCOM.
- Reconocimiento facial automático en fotos: fuera de alcance esta tanda.

## Detalles técnicos

- Todo en español. Tokens semánticos (`bg-background`, `text-foreground`, glass classes existentes), sin colores hardcodeados.
- Edge functions con CORS y validación JWT en código.
- Re-uso de `GlassCard`, `SectionHeader`, `StatPill`, `CertezaBadge`.
- Sin tocar `client.ts` ni `types.ts`.

## Riesgo

Tanda grande (~15-20 archivos nuevos, 1 migración, 2 edge functions nuevas, 1 cron). Si algo falla en producción lo arreglo en la siguiente iteración sin tocar lo demás.
