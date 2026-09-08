# GENEAI 3.0.1: correcciones y verificación

## Cambios concretos

- Árbol clásico: índice de relaciones por persona, componentes con identidad estable, límite de seis generaciones por vista, protección ante ciclos, recarga con error visible y reintento. Cambiar la persona central ya no descarga otra vez el archivo completo. Los campos de agregar familiares permanecen montados durante una actualización.
- Árbol moderno: elimina los datos de muestra del inicio, consulta el árbol activo con paginación, escucha cambios, dibuja solo personas con posición en la familia central y permite centrar otra rama desde la búsqueda. Antes apilaba miles de personas ajenas a esa rama en la misma coordenada. Agregar familiares abre el editor real; el botón de evidencia llama a la función real; impresión, opciones y navegación táctil tienen acciones.
- Personas: conserva la lista durante una recarga, cancela consultas superpuestas, filtra eventos de otras tablas y difiere el filtro mientras se escribe.
- Cargas: tiempos máximos para consultas y funciones, rechazo de errores visible, clasificación específica para sesión, FamilySearch, red e IA. La recuperación no elimina almacenamiento de cuentas, borradores ni IndexedDB.
- Sincronización: los componentes reutilizan la suscripción global, evitando una suscripción extra por página. Se conserva la sincronización en segundo plano existente y sus controles de cuenta.
- Actualizaciones: `/release.json` sin caché, novedades al entrar/regresar y botón «Actualizar ahora». La activación comprueba si se está editando. El mismo enlace y la misma instalación PWA reciben la web actualizada.
- Enlaces: navegador integrado para fuentes que permiten iframe, con salida explícita a navegador; OAuth de FamilySearch se abre en una ventana superior, valida el retorno y avisa a la app. No se sortean restricciones de los proveedores.
- Servidor: restauradas `familysearch-auth`, `familysearch-sync` y `familysearch-push` en el proyecto unificado, todas con verificación JWT. El intercambio exige state de un solo uso, los retornos se limitan a GENEAI y la importación/exportación respeta el árbol activo. No se ejecutó ninguna exportación real a FamilySearch.
- Apple: los módulos pendientes abren la web real en WebKit, con perfil web separado por cuenta. La primera sesión web se inicia con la misma cuenta; los tokens nativos no se copian. El OAuth usa ASWebAuthenticationSession. Se preparan consulta de novedades y script de compilación/actualización con respaldo del ejecutable anterior.

## Evidencia

TypeScript web válido. 87 pruebas automatizadas pasan (24 archivos), incluidos límites de árboles, ciclos, aislamiento de cuentas, recuperación de carga, enlaces integrados y avisos de actualización. Seis pruebas de configuración Apple pasan. La compilación de producción termina correctamente.

La prueba sintética con 7.000 relaciones verifica que, una vez construido el índice, 100 consultas repetidas de padres no vuelven a leer las 7.000 relaciones ajenas. Con 4.077 personas, el árbol moderno dibuja solo la familia posicionada, sin crear miles de tarjetas superpuestas. Estos resultados no son una medición de velocidad en el iPhone del usuario.

El navegador abrió el inicio de sesión real de GENEAI en el dominio de producción sin pedir una cuenta de Vercel. La verificación posterior a la publicación se registra en la descripción del cambio.

## Límites pendientes

No se dispone aquí de una sesión interactiva del usuario dentro de GENEAI ni de Xcode/macOS. No se afirma que todos los botones hayan sido probados manualmente, que la autorización de FamilySearch se haya completado o que el ejecutable del Mac ya esté instalado. No se comprobó la configuración de las credenciales oficiales de FamilySearch en ejecución autenticada.

El ZIP Apple es código fuente actualizado, no un binario compilado ni notarizado. `scripts/actualizar_mac.sh` compila en el Mac y conserva un respaldo al sustituir una instalación con la misma identidad. Las apps nativas antiguas necesitan esta primera instalación; una notificación web no puede reemplazar un ejecutable que todavía no tiene un actualizador.

Los archivos históricos de almacenamiento y la activación de proveedores de IA siguen requiriendo verificación; esta entrega no declara que esos pendientes de la transferencia anterior estén resueltos. La transferencia de cuentas ya aplicada se conserva.
