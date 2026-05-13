# Archivo Familiar Sanguineti Aeschlimann

App web full-stack de genealogía privada en español, inspirada funcionalmente (no visualmente) en herramientas profesionales. Diseño editorial sobrio: marfil, beige, gris carbón, oliva suave, acento burdeos.

## Alcance de la v1

Entregable único con todos los módulos navegables. Los críticos quedan plenamente funcionales; los avanzados con lógica básica lista para iterar.

### Módulos plenamente funcionales
1. **Autenticación** (email/password vía Lovable Cloud) + privacidad por usuario (RLS).
2. **Dashboard** con métricas reales, accesos rápidos y conteo de inferencias abiertas.
3. **Personas**: CRUD completo, ficha con pestañas (Resumen, Familia, Eventos, Fuentes, Búsquedas sugeridas, Hipótesis, **Inferencias**, Timeline, Notas), todos los campos pedidos, flag persona viva = privada.
4. **Relaciones familiares** (padre, madre, cónyuges, hijos; hermanos calculados; biológica/adoptiva/desconocida; certeza).
5. **Eventos vitales y migratorios** (todos los tipos, fecha exacta o rango, lugar original + normalizado, certeza, fuente).
6. **Documentos/fuentes** con storage (PDF/imagen), transcripción, traducción, personas/lugares mencionados, estado, OCR placeholder.
7. **Lugares** con ficha y personas/eventos asociados.
8. **Buscador avanzado** con filtros, búsqueda en transcripciones, uso de variantes, resultados agrupados.
9. **Variantes de apellidos/nombres** (tabla editable + semillas Sanguineti, Aeschlimann, Queirolo).
10. **Investigación externa**: queries y enlaces para FamilySearch, MyHeritage, Google, Google Books, con variantes y rangos ±5/±10. Tarjetas con copiar query, marcar resultado, pegar URL, crear documento. Sin scraping.
11. **Coincidencias sugeridas** (motor interno) con score 0–100 y razones; acciones confirmar/rechazar/hipótesis/fusionar.
12. **Hipótesis** CRUD con argumentos a favor/en contra, probabilidad, estado, próxima acción.
13. **Línea de tiempo** por persona, apellido y lugar.
14. **Árbol familiar visual** (persona central, padres, cónyuges, hijos; expandir; colores por certeza; clic abre ficha lateral).
15. **Pistas relacionadas** (Record Detective interno) por reglas heurísticas.
16. **Importar/exportar CSV** + GEDCOM “próximamente”.
17. **Configuración** (perfil, variantes, datos de ejemplo opt-in).

### Módulo nuevo: Inferencias familiares automáticas

Página `/inferencias` + pestaña “Inferencias” dentro de cada persona.

**Motor de reglas** (ejecutable por persona o global, recalcula y upsertea):
- **R1 padres↔hijos**: si falta nac. del padre/madre y hay hijos con nac., genera rango (padre: −20/−45 años respecto al primer hijo; madre: −18/−42).
- **R2 matrimonio por hijos**: si pareja tiene hijos sin matrimonio, sugiere búsqueda 0–10 años antes del primer hijo, en lugar del primer hijo o cercano.
- **R3 defunción**: vivo en doc año X y sin defunción → “vivo al menos hasta X”. Cónyuge marcado viudo/a en doc → defunción antes de ese doc, con rango.
- **R4 inmigración**: nacido en Europa con doc en América → evento migratorio entre nacimiento y primer doc americano. Hijo nacido en América → migró antes. Hijo Europa luego hijo América → rango entre ambos.
- **R5 lugares**: varios hijos en mismo lugar → residencia familiar probable durante esos años. Coherencia matrimonio/nac./defunción → “zona familiar probable”.
- **R6 apellidos**: usar tabla `variantes_apellido` para ampliar coincidencias.
- **R7 nombres repetidos**: detectar nombres de abuelos en nietos; equivalencias italiano↔español (Giovanni=Juan, Giuseppe=José, Luigi=Luis, Maria=María, Francesco=Francisco, Michele=Miguel, Battista=Bautista; tabla extensible) sólo como ayuda de búsqueda.
- **R8 documentos**: si un doc menciona varias personas con mismo apellido (adultos+niños), sugerir grupo familiar; estado inicial hipótesis.

**Score 0–100** ponderando: coincidencia apellido, cercanía fechas, coincidencia lugar, tipo de relación familiar, presencia de fuente documental, cantidad de datos indirectos. Etiqueta certeza: baja (<40), media (40–70), alta (>70).

**Explicación generada** por inferencia: dato faltante, familiares usados, regla aplicada, fuerza, documento sugerido para confirmar.

**Tarjeta de inferencia** muestra: persona afectada, dato inferido, familiares usados, explicación, certeza, y botones:
- Aceptar como hipótesis (crea registro en `hipotesis`).
- Descartar (status `rejected`).
- Crear búsqueda sugerida (en `busquedas_externas`).
- Crear tarea de investigación (en `research_tasks`).

**Banner permanente** en `/inferencias` y pestaña: *“Esta información es inferida automáticamente. No debe considerarse comprobada hasta asociarla a una fuente documental.”*

## Arquitectura técnica

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn. React Router con todas las rutas pedidas + `/inferencias`.
- **Backend**: Lovable Cloud: Auth, Postgres con RLS por `user_id`, Storage privado `documentos`.
- **Diseño**: tokens HSL en `index.css` (marfil background, gris carbón foreground, oliva primary, burdeos accent, azul grisáceo link); títulos Cormorant Garamond, cuerpo Inter; variantes Button/Card/Badge.
- **Estado**: TanStack Query.
- **Motor de inferencias**: TypeScript puro en `src/lib/inferences/` (reglas R1–R8 como funciones que reciben snapshot de persona+familia+eventos+docs y devuelven inferencias). Botón “Recalcular” en `/inferencias` y al guardar persona/evento/doc.

### Esquema de BD (resumen)
```text
profiles, user_roles
personas(... certeza, viva, ids_externos jsonb, enlaces jsonb)
relaciones, eventos, lugares, documentos
variantes_apellido, equivalencias_nombre(base, variante, idioma)
hipotesis, coincidencias, busquedas_externas

inference_rules(id, code, nombre, descripcion, activa)
generated_inferences(id, user_id, person_id, inference_type, inferred_field,
  inferred_value, date_range_start, date_range_end, explanation,
  confidence_score, status [pending|accepted_as_hypothesis|rejected|confirmed],
  rule_code, related_person_ids[], related_event_ids[], created_at, updated_at)
inference_sources(id, inference_id, documento_id, evento_id, peso)
research_tasks(id, user_id, person_id, inference_id, tipo
  [buscar_matrimonio|buscar_nacimiento|buscar_defuncion|buscar_pasajeros|buscar_parroquial|otro],
  descripcion, estado [pendiente|en_proceso|encontrado|descartado], created_at)
```
RLS: `user_id = auth.uid()` en todas. Storage por carpeta `auth.uid()/...`.

### Rutas
`/login`, `/dashboard`, `/personas`, `/personas/:id`, `/arbol`, `/documentos`, `/documentos/:id`, `/buscar`, `/investigacion-externa`, `/coincidencias`, `/pistas`, `/hipotesis`, `/inferencias`, `/lugares`, `/linea-de-tiempo`, `/configuracion`.

## Confirmaciones

Voy a proceder con todo lo anterior salvo que indiques lo contrario.

1. **Lovable Cloud** activado para auth + base de datos + storage. ¿OK?
2. **Datos de ejemplo** opt-in desde Configuración (no automáticos). ¿OK?

Si confirmas (o respondes “adelante”), implemento la v1 completa con el módulo de Inferencias incluido.