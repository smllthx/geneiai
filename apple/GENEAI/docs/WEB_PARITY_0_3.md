# Paridad implementada en 0.3

Esta fase se basó directamente en la lógica de la web GENAIA.

## Persona

La web:
- crea y actualiza `personas`;
- mantiene `certeza=probable` como valor por defecto;
- usa árbol activo;
- carga relaciones, eventos, documentos, fotos, hipótesis, inferencias y coincidencias;
- permite edición y creación.

La app Apple 0.3 porta:
- creación;
- actualización;
- selección;
- ficha;
- familia;
- eventos;
- documentos;
- edición no destructiva.

## Relaciones

La lógica nativa replica la convención web:
- padre ↔ hijo;
- madre ↔ hijo;
- cónyuge ↔ cónyuge;
- hermano ↔ hermano;
- `naturaleza=biologica`;
- `certeza=probable`.

Además replica la normalización del helper web para:
- padre/progenitor/father;
- madre/progenitora/mother;
- hijo/hija/child;
- hermano/hermana/sibling;
- múltiples términos de pareja/cónyuge;
- inferencia visual de hermanos por padres compartidos;
- inferencia visual de coprogenitores por hijos compartidos.

## FamilySearch local

La web usa:
- `http://127.0.0.1:8787`;
- `/health`;
- `/tools/familysearch_browser_status`;
- `/tools/familysearch_browser_open`;
- `/tools/familysearch_browser_search_people`;
- `/tools/familysearch_browser_logout`.

La app macOS nativa usa el mismo contrato y mantiene la consulta en solo lectura.
