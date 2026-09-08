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

El código nativo de macOS no está en este repositorio. No se ha verificado qué dirección/backend utiliza la app instalada actualmente en el Mac. Tampoco se ha comprobado en vivo la publicación de todas las tablas Realtime. Estas comprobaciones requieren acceso a esos entornos; conservar variables y cuenta evita configurar una conexión distinta.

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

Antes de desplegar, reconciliar el código con la versión actual de `geneai-exclusivo`: la última publicación revisada declara cambios locales adicionales sobre el commit base. Conservar esos cambios y las variables actuales. No crear un proyecto nuevo ni sustituir ciegamente la publicación existente.

Referencias: [instalación de apps web](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [sincronización Supabase](https://supabase.com/docs/guides/realtime/postgres-changes), [acceso de GitHub Apps a repositorios](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps).
