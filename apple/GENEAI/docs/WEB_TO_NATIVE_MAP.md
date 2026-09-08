# Contrato GENAIA Web → Apple Native

La fuente funcional es la web actual. Este mapa debe revisarse antes de implementar o refactorizar
cualquier feature SwiftUI.

| Grupo | Web | Ruta web | Equivalente nativo |
|---|---|---|---|
| Archivo | Inicio | `/inicio` | Dashboard |
| Archivo | Árbol | `/arbol` | Tree workspace |
| Archivo | Árbol moderno | `/arbol-moderno` | Tree layouts |
| Archivo | Personas | `/personas` | People browser |
| Archivo | Apellidos | `/apellidos` | Surnames |
| Archivo | Ficha genealógica | `/personas/:id/ficha` | Person profile |
| Archivo | Editar persona | `/personas/:id` | Person editor |
| Archivo | Familias | `/familias` | Families |
| Archivo | Recuerdos | `/fotos` | Memories |
| Archivo | Documentos | `/documentos` | Documents |
| Archivo | Fuentes | `/fuentes` | Sources |
| Archivo | Calendario | `/calendario` | Calendar |
| Investigación | Genealogista IA | `/asistente` | AI genealogist |
| Investigación | Investigación | `/investigacion` | Research hub |
| Investigación | Investigación externa | `/investigacion-externa` | External research |
| Investigación | Importadas pendientes | `/importadas-pendientes` | Review queue |
| Investigación | Buscar | `/buscar` | Global genealogical search |
| Investigación | Coincidencias | `/coincidencias` | Matches |
| Investigación | ADN y origen | `/adn` | DNA & origin |
| Investigación | Cuadros IA | `/cuadros-ia` | AI boards |
| Investigación | Rasgos y parecidos | `/parecidos` | Resemblance |
| Investigación | Pistas | `/pistas` | Clues |
| Investigación | Hipótesis | `/hipotesis` | Hypotheses |
| Investigación | Inferencias | `/inferencias` | Inferences |
| Investigación | Sugerencias | `/sugerencias` | Suggestions |
| Investigación | Tareas IA | `/tareas-ia` | AI tasks |
| Archivo | Lugares | `/lugares` | Places |
| Archivo | Línea de tiempo | `/linea-de-tiempo` | Timeline |
| Herramientas | Importar / Exportar | `/importar` | Import & connections |
| Herramientas | Fusionar duplicados | `/fusionar` | Merge review |
| Herramientas | Agente | `/agente` | Agent workspace |
| Herramientas | Credenciales | `/credenciales` | Credentials / integrations |
| Herramientas | Configuración | `/configuracion` | Settings |

## Capacidades transversales que también son contrato

La web actual no es solo una lista de rutas. Las apps Apple deben preservar progresivamente:

- sesión y autenticación Supabase;
- árbol activo;
- probando/persona central;
- búsqueda universal;
- personas recientes;
- menú agrupado y configurable;
- ventanas auxiliares;
- atajos de teclado;
- sincronización / recarga de datos;
- notificaciones;
- trabajos en segundo plano;
- estados de investigación;
- importaciones pendientes de revisión;
- comparación antes de fusionar;
- FamilySearch OAuth y navegador local;
- IA y funciones server-side.

## Regla de implementación

Antes de migrar una feature:
1. leer la página web correspondiente;
2. identificar queries, mutaciones, validaciones y estados;
3. reproducir el contrato de datos;
4. diseñar la interacción Apple nativa;
5. validar que ninguna capacidad de la web desaparezca silenciosamente.
