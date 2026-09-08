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

El código web, la API y la configuración del código Apple recuperado usan un contrato de conexión común. La rama prepara el proyecto dedicado existente como destino. La transferencia de cuentas, árboles y archivos aún no se ha ejecutado: consultar [el estado comprobado de la unificación](GENEAI-cuenta-compartida.md) antes de publicar.

La publicación Realtime de las 13 tablas GENEAI se completó y verificó en ambas bases activas. La web vuelve a consultar datos al reanudar la app, recuperar red, reconectar Realtime y cada 60 segundos en primer plano. Los cambios remotos que llegan durante una edición marcada quedan pendientes. No se añade una cola de escritura sin conexión: hay que confirmar el guardado al recuperar internet.

El código Apple existente está ahora en `apple/GENEAI`, con recarga en primer plano, observación de sesión y carga paginada. Compartir código y configuración no comprueba la instalación actual del Mac; queda pendiente compilar e instalar esa actualización y verificar dos dispositivos reales.

## Rendimiento y actualizaciones

- Pantallas y mapa cargados cuando se necesitan; navegación disponible mientras carga una pantalla.
- Menús compactos, áreas táctiles y ventanas limitadas al espacio visible del teléfono.
- Archivos estáticos con nombre versionado guardados en caché; las respuestas de datos y autenticación usan la red.
- Se elimina la antigua caché de datos al activar este worker. Las comprobaciones de conexión dejan de recibir respuestas ficticias desde la caché.
- El worker cambia en cada compilación relevante, incluidos cambios de iconos/manifiesto/página sin conexión. Una actualización espera la acción Actualizar. Esa acción se aplaza mientras hay una edición marcada.

## Validación

Compilación de producción y comprobación TypeScript correctas. Las pruebas automáticas de esta mejora cubren navegación adaptable, escala legible, teclado, precarga, eventos de instalación, protección de edición, reanudación de datos y caché del worker. La identidad del manifiesto, los tamaños reales de los iconos y la revisión del worker se comprueban sobre los archivos generados.

La medición de la mejora móvil previa a la unificación redujo el JavaScript inicial comprimido de 264.783 a aproximadamente 217.168 bytes (18 % menos). La compilación posterior con las comprobaciones de cuenta informa aproximadamente 219,77 kB gzip para el chunk principal. Son medidas de descarga, no tiempos medidos en un teléfono.

Pendiente de comprobar en dispositivos reales: instalación iOS/Android, giro vertical/horizontal, teclado, tamaño de texto aumentado, actualización con ficha abierta y cambios entre Mac/teléfono con la misma cuenta. No se hicieron pruebas visuales ni modificaciones de filas de usuario; sí se reparó la publicación Realtime descrita en el estado de la unificación.

## Publicación en la GENEAI existente

El acceso de escritura a GitHub quedó habilitado al instalar ChatGPT Codex Connector en la cuenta propietaria. Los cambios se guardan en una rama del repositorio `smllthx/geneiai`. La publicación en producción está pendiente de reconciliar la fuente del despliegue existente.

El enlace comprobado con el proyecto Mac recuperado es https://geneiai-geneaia.vercel.app, del proyecto Vercel `geneiai`, enlazado a este repositorio. Su producción revisada es `dpl_EZ84frnVPyNrhWKJsBXzePJr45rK`: contiene 12 funciones de servidor y declara cambios locales adicionales (`gitDirty=1`). La vista previa de esta rama contiene 6 funciones. Antes de desplegar hay que recuperar y reconciliar la fuente exacta de esa producción, incluidas sus funciones y configuración. La referencia de commit por sí sola no representa todos los archivos publicados.

También existe `geneai-exclusivo`, cuya publicación 0.3.1 del 7 de septiembre usa otra compilación y 9 funciones. No se ha demostrado que sea la app usada actualmente en el Mac. La revisión anterior que lo trataba como destino de publicación era provisional; no debe sustituir al vínculo comprobado arriba.

Las búsquedas en los repositorios accesibles, archivos guardados e historial de despliegues no recuperaron el código fuente completo de producción. Vercel ofrece recuperación mediante sus API de archivos de despliegue, pero esas operaciones no están expuestas en la conexión disponible. La rama se mantiene en borrador y no se modificó ninguna publicación de producción.

Referencias: [instalación de apps web](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [sincronización Supabase](https://supabase.com/docs/guides/realtime/postgres-changes), [acceso de GitHub Apps a repositorios](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps).
