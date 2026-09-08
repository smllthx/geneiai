# GENEAI: instalación y adaptación por dispositivo

Esta mejora pertenece al repositorio existente `smllthx/geneiai`. Mantiene el nombre GENEAI, la identidad del manifiesto `/`, el inicio `/`, el alcance `/` y los iconos existentes. No crea otra aplicación, cuenta, base de datos ni proyecto de alojamiento.

## Uso

Abre la dirección habitual de GENEAI e inicia sesión con tu cuenta. En **Configuración → GENEAI en este dispositivo** aparecen instrucciones adecuadas para el dispositivo y un botón de instalación cuando el navegador lo permite.

- iPhone/iPad: abre GENEAI en Safari, toca Compartir y Añadir a pantalla de inicio. Si aparece Abrir como app web, actívalo. Conserva el nombre GENEAI.
- Android: usa Instalar GENEAI cuando aparezca; también puedes usar el menú de Chrome → Instalar aplicación/Añadir a pantalla de inicio.
- Mac: conserva la GENEAI que ya utilizas. Para instalar la misma web en Safari, macOS Sonoma o posterior ofrece Archivo → Añadir al Dock.

El sistema solicita la confirmación de instalación en el dispositivo. La web no puede añadir su icono de forma silenciosa.

El ajuste automático está activado de forma predeterminada. Se adapta al ancho disponible, a la orientación, a las áreas seguras y al teclado. En Ajustar vista puedes recuperar el modo automático o guardar una preferencia manual. Las preferencias de tamaño son locales a cada dispositivo.

## Datos compartidos

Se conserva el cliente Supabase existente y sus variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, junto con la autenticación y las API actuales. Los dispositivos deben usar la misma cuenta y árbol. El inicio y las pantallas que escuchan la sincronización vuelven a consultar datos al reanudar la app, recuperar red o reconectar Realtime.

Los cambios remotos que llegan durante una edición marcada quedan pendientes y se aplican al terminar. Se mantiene el mecanismo existente de bloqueo de edición. No se añade una cola de escritura sin conexión: hay que confirmar el guardado al recuperar internet.

El código nativo de macOS no está en este repositorio. El 8 de septiembre de 2026 se recuperó `GENAIA-Apple-Native-WebBased-v0.3.zip`: su manifiesto identifica `smllthx/geneiai`, y su configuración Supabase coincide con la del cliente JavaScript servido por [la GENEAI publicada](https://geneiai-geneaia.vercel.app). Esa coincidencia identifica el vínculo entre los dos proyectos, pero no comprueba la configuración de la app instalada actualmente en el Mac ni una sincronización real entre dispositivos.

El `.env` versionado en GitHub apunta a otro proyecto Supabase. Antes de publicar hay que verificar los valores efectivos del despliegue y conservar la conexión de producción; reutilizar el `.env` local no garantiza compartir datos con el Mac. No se modificaron variables ni credenciales. Tampoco se ha comprobado en vivo la publicación de todas las tablas Realtime.

El nativo recuperado consulta datos al iniciar la sesión, pero no incluye recarga al activar la app ni suscripción Realtime. Su actualización automática necesita una mejora nativa además de estos cambios web. Comparte las tablas principales y `profiles.active_arbol_id`; deben verificarse también diferencias de filtrado de registros sin árbol y personas fusionadas.

## Rendimiento y actualizaciones

- Pantallas y mapa cargados cuando se necesitan; navegación disponible mientras carga una pantalla.
- Menús compactos, áreas táctiles y ventanas limitadas al espacio visible del teléfono.
- Archivos estáticos con nombre versionado guardados en caché; las respuestas de datos y autenticación usan la red.
- Se elimina la antigua caché de datos al activar este worker. Las comprobaciones de conexión dejan de recibir respuestas ficticias desde la caché.
- El worker cambia en cada compilación relevante, incluidos cambios de iconos/manifiesto/página sin conexión. Una actualización espera la acción Actualizar. Esa acción se aplaza mientras hay una edición marcada.

## Validación

Compilación de producción y comprobación TypeScript correctas. Veinte pruebas automáticas cubren navegación adaptable, escala legible, teclado, precarga, eventos de instalación, protección de edición, reanudación de datos y caché del worker. La identidad del manifiesto, los tamaños reales de los iconos y la revisión del worker se comprueban sobre los archivos generados.

El JavaScript inicial comprimido medido mediante el grafo de importaciones del build pasa de 264.783 a aproximadamente 217.168 bytes (18 % menos). Esta medida es tamaño descargado, no tiempo de carga medido en un teléfono.

Pendiente de comprobar en dispositivos reales: instalación iOS/Android, giro vertical/horizontal, teclado, tamaño de texto aumentado, actualización con ficha abierta y cambios entre Mac/teléfono con la misma cuenta. No se hicieron pruebas visuales ni modificaciones de datos reales.

## Publicación en la GENEAI existente

El acceso de escritura a GitHub quedó habilitado al instalar ChatGPT Codex Connector en la cuenta propietaria. Los cambios se guardan en una rama del repositorio `smllthx/geneiai`. La publicación en producción está pendiente de reconciliar la fuente del despliegue existente.

El enlace comprobado con el proyecto Mac recuperado es https://geneiai-geneaia.vercel.app, del proyecto Vercel `geneiai`, enlazado a este repositorio. Su producción revisada es `dpl_EZ84frnVPyNrhWKJsBXzePJr45rK`: contiene 12 funciones de servidor y declara cambios locales adicionales (`gitDirty=1`). La vista previa de esta rama contiene 6 funciones. Antes de desplegar hay que recuperar y reconciliar la fuente exacta de esa producción, incluidas sus funciones y configuración. La referencia de commit por sí sola no representa todos los archivos publicados.

También existe `geneai-exclusivo`, cuya publicación 0.3.1 del 7 de septiembre usa otra compilación y 9 funciones. No se ha demostrado que sea la app usada actualmente en el Mac. La revisión anterior que lo trataba como destino de publicación era provisional; no debe sustituir al vínculo comprobado arriba.

Las búsquedas en los repositorios accesibles, archivos guardados e historial de despliegues no recuperaron el código fuente completo de producción. Vercel ofrece recuperación mediante sus API de archivos de despliegue, pero esas operaciones no están expuestas en la conexión disponible. La rama se mantiene en borrador y no se modificó ninguna publicación de producción.

Referencias: [instalación de apps web](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [sincronización Supabase](https://supabase.com/docs/guides/realtime/postgres-changes), [acceso de GitHub Apps a repositorios](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps).
