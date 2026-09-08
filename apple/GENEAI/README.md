# GENEAI para Apple — actualización de la aplicación existente

Este directorio conserva la aplicación SwiftUI entregada como
`GENAIA-Apple-Native-WebBased-v0.3.zip` y su documentación de origen. Es una
actualización de ese código dentro del repositorio de GENEAI; no crea otra app ni
modifica la aplicación instalada. Se conservan el target `GENAIAApple`, el bundle
identifier `com.genaia.app` y los nombres internos. El nombre visible es **GENEAI**.

## Cuenta, backend y actualización de datos

- La configuración procede únicamente de `../../config/geneai-backend.json`, la
  misma fuente que usa la web. El proyecto preparado es `camdtylwddleifaegzaf`.
  `scripts/configure_backend.py` valida esa fuente y genera el archivo local de
  Xcode sin romper `https://` con los comentarios de `.xcconfig`.
- Cada instalación inicia sesión con la misma cuenta de Supabase. El SDK conserva
  su sesión local mediante su almacenamiento persistente predeterminado de Apple,
  con una clave de almacenamiento vinculada al proyecto. No se copian tokens entre
  la web y dispositivos. Cerrar sesión afecta solo a esta instalación.
- Un observador de Auth actualiza la identidad; cambiar de cuenta o cerrar sesión
  cancela lecturas y vacía el modelo y los formularios. Un fallo de red conserva la
  identidad y el último conjunto completo de datos de esa misma cuenta.
- Todas las ventanas comparten una actualización al volver a primer plano y cada
  60 segundos mientras alguna está activa. El botón Actualizar, `⌘R` y el gesto de
  actualizar usan el mismo coordinador. Las actualizaciones concurrentes se unen.
- El perfil determina `active_arbol_id`, como en la web. Las consultas conservan
  el filtro de usuario y leen el árbol activo junto a registros sin árbol; sin
  árbol activo leen el alcance completo permitido para esa cuenta. No se escoge
  otro árbol silenciosamente. Personas, relaciones, eventos, lugares, documentos
  y árboles se recorren en páginas de 1.000 filas con orden estable. Si falta el
  perfil, la carga se detiene sin ampliar el alcance ni sustituir los últimos datos.
- Cada carga publica un conjunto completo y conserva la persona seleccionada si
  sigue disponible. Los editores capturan su cuenta y árbol al abrirse y rechazan
  un guardado si cambió ese contexto.

## Validación de esta actualización

En Linux se pueden ejecutar las pruebas de configuración y la validación de la
fuente compartida, sin mostrar la clave:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/configure_backend.py --check
```

Este entorno no dispone de Swift, Xcode ni simuladores Apple. **El código Swift no
se ha compilado ni ejecutado aquí.** Se mantiene el requisito original del SDK
Supabase (`from: 2.0.0`); sus firmas se contrastaron con documentación y código
oficial actuales, pero debe verificarse la versión exacta que resuelva SwiftPM.

En un Mac con Xcode y XcodeGen, `./scripts/validate_apple.sh` genera el proyecto,
resuelve dependencias, compila para macOS y simulador iOS y ejecuta siete pruebas
de modelo sin conexión a producción. No instala ni abre la app. Antes de entregar
un binario, registrar Xcode y la versión resuelta de Supabase y comprobar en
macOS, iPad e iPhone:

1. Restauración tras cerrar y volver a abrir, expiración de token sin conexión y
   recuperación al volver a primer plano; el fallo de red no cierra la sesión.
2. Cambios de cuenta, cierre local y una respuesta antigua que termine después;
   ninguna colección o borrador de la cuenta anterior reaparece.
3. Igual cuenta, árbol, personas y relaciones que la web, incluyendo conjuntos
   con más de 1.000 filas; cambios remotos visibles al activar, actualizar o en
   el próximo intervalo de 60 segundos.
4. Árbol activo cambiado desde otro dispositivo mientras está abierto un editor;
   el formulario anterior debe exigir abrirse de nuevo antes de guardar.

Las pruebas Swift incluidas verifican borrado de datos al salir, respuestas de
otra cuenta, carga incompleta, perfil ausente, selección conservada y contexto de ambos editores.
No sustituyen pruebas reales de Auth, conectividad, permisos RLS o interfaz Apple.

## Historial de origen · GENAIA Apple Native — Web-Based Foundation

Esta versión reemplaza el enfoque de “starter genérico” por una arquitectura explícitamente
basada en la aplicación web GENAIA existente (`smllthx/geneiai`).

## Principio rector

La web es el **contrato funcional**. SwiftUI rediseña la interfaz y la interacción para Apple,
pero no inventa una aplicación paralela ni elimina capacidades.

Cada feature nativa tiene una `webRoute` equivalente para trazabilidad.

## Estado de esta versión (0.3)

Implementado en código:

- Catálogo completo de módulos de la web → SwiftUI.
- Navegación agrupada equivalente a:
  - Archivo familiar
  - Investigación
  - Herramientas
- Shell adaptativo:
  - iPhone: tabs principales + catálogo “Más”.
  - iPad/macOS/visionOS: `NavigationSplitView` con sidebar + contenido + inspector.
- Login Supabase con el mismo modelo de sesión que la web.
- Restauración de sesión y sign out.
- Cliente Supabase compartido.
- Repositorio de lectura real para:
  - árboles activos
  - personas
  - relaciones
  - eventos
  - lugares
  - documentos
  - actividad
  - métricas de Inicio
- `AppModel.load()` usa el backend real cuando existe sesión.
- Perfil de persona basado en la web:
  - ficha
  - datos vitales
  - familia
  - cronología
  - fuentes/documentos
  - calidad
- Árbol basado en las mismas relaciones `padre`, `madre`, `hijo`, `conyuge`, `hermano`.
- Inicio basado en las métricas que ya muestra la web.
- Investigación conserva conflictos, coincidencias, hipótesis, inferencias y tareas como módulos separados.
- Apariencia Light/Dark automática y diseño Apple nativo.
- La web sigue funcionando y no es sustituida.

## Qué NO hace todavía

- No realiza escrituras destructivas.
- No implementa aún todos los formularios de edición de la web.
- No incluye service-role keys.
- FamilySearch browser local sigue siendo una integración macOS separada.
- watchOS se agregará como companion, no como copia de la app completa.

## Generar el proyecto

```bash
brew install xcodegen
# Ejecutar desde apple/GENEAI; usa la configuración compartida del repositorio.
./scripts/generate.sh
open GENAIAApple.xcodeproj
```

## Seguridad

La app cliente usa una **publishable key** y la sesión del usuario. La autorización real
debe seguir dependiendo de RLS y de las funciones server-side existentes. Nunca agregues
`SUPABASE_SERVICE_ROLE_KEY` a Xcode, `Info.plist`, `.xcconfig` o al repositorio.

## Documentación

- `docs/WEB_TO_NATIVE_MAP.md`: contrato web → nativo.
- `docs/DATA_CONTRACT.md`: tablas y campos usados por el cliente.
- `docs/NEXT_MIGRATION_STEPS.md`: orden recomendado para completar la migración.


## Añadido en 0.3

- Port de la lógica de parentesco de `src/lib/kinship.ts`, incluyendo sinónimos,
  relaciones inversas, inferencia de hermanos por padres compartidos y cónyuge visual por hijos compartidos.
- Creación y edición de personas contra Supabase.
- Creación de relaciones recíprocas con la misma convención de la web.
- Búsqueda nativa en personas, lugares y documentos.
- Pantalla Importar / Exportar.
- Cliente macOS para el compañero FamilySearch en `127.0.0.1:8787`.
- No se añadió borrado destructivo en el cliente nativo todavía.
