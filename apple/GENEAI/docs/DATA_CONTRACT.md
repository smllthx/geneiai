# Data contract usado por la app Apple

Estas tablas ya existen en GENAIA y forman parte del contrato compartido con la web.

## Core genealógico

### `arboles`
`id`, `user_id`, `nombre`, `descripcion`, `is_default`, `created_at`, `updated_at`

### `profiles`
`id`, `display_name`, `proband_id`, `proband_asked`, `active_arbol_id`

### `personas`
Campos usados inicialmente:
`id`, `user_id`, `nombres`, `apellidos`, `variantes_nombre`, `sexo`,
`nac_fecha`, `nac_fecha_aprox`, `nac_rango_ini`, `nac_rango_fin`, `nac_lugar_id`,
`bautismo_fecha`, `bautismo_lugar_id`, `matrimonio_fecha`, `matrimonio_lugar_id`,
`defuncion_fecha`, `defuncion_lugar_id`, `entierro_fecha`, `entierro_lugar_id`,
`ocupacion`, `nacionalidad`, `religion`, `notas`, `certeza`, `viva`,
`ids_externos`, `enlaces`, `foto_url`, `arbol_id`, `fusionado_en`, `row_version`.

### `relaciones`
`id`, `user_id`, `persona_id`, `pariente_id`, `tipo`, `naturaleza`,
`certeza`, `notas`, `arbol_id`, `row_version`

La web usa relaciones explícitas y también relaciones inversas:
- padre
- madre
- hijo
- conyuge
- hermano

El cliente nativo debe tolerar duplicados/inversas y no fusionar automáticamente.

### `eventos`
`id`, `persona_id`, `tipo`, `fecha`, `fecha_aprox`, `rango_ini`, `rango_fin`,
`lugar_original`, `lugar_id`, `descripcion`, `fuente_id`, `certeza`, `arbol_id`

### `lugares`
`id`, `pais`, `region`, `provincia`, `ciudad`, `parroquia`, `archivo`, `lat`, `lng`, `notas`

### `documentos`
`id`, `titulo`, `fecha`, `tipo`, `archivo_path`, `url`, `transcripcion`,
`traduccion`, `resumen`, `ocr_texto`, `personas_mencionadas`,
`lugares_mencionados`, `cita`, `repositorio`, `estado`, `arbol_id`

## Investigación

- `coincidencias`
- `hipotesis`
- `generated_inferences`
- `research_tasks`
- `actividad`

La primera versión nativa los muestra en modo lectura/revisión. Las mutaciones se irán portando
solo después de copiar las reglas de validación de la web.
