# GENEAI: transferencia aplicada y publicación

## Datos reunidos el 8 de septiembre de 2026

El propietario confirmó que controla ambas cuentas y autorizó usar la cuenta universitaria existente como principal, conservar los árboles de ambas y publicar la actualización. Esa autorización está resuelta.

La transferencia de datos se aplicó en el proyecto dedicado existente `camdtylwddleifaegzaf`. No se creó otro proyecto ni otra cuenta. Los registros originales de la base compartida permanecen disponibles.

| Comprobación en destino | Resultado |
| --- | ---: |
| Personas | 4.077 |
| Árboles | 3 |
| Relaciones | 6.852 |
| Eventos | 5.808 |
| Lugares | 743 |
| Registros de documentos | 2 |
| Registros de fotos | 4 |

Se incorporaron 4.028 registros de 23 tablas con contenido; se revisaron 27 tablas compatibles. Los dos árboles importados están identificados con “(cuenta anterior)”. Se preservó el árbol predeterminado y activo del destino, sus registros existentes y los identificadores originales de las personas. No se deduplicaron familiares por nombre.

## Respaldo y verificación

- Antes de escribir en las tablas de la app se guardó una copia privada completa de los registros seleccionados, protegida con RLS y sin acceso de `anon` ni `authenticated`. Los conteos y huellas de cada tabla coincidieron con el origen.
- La simulación se revirtió. La aplicación posterior fue una operación transaccional con detección de colisiones, control de propietarios y conteos.
- Se conservó una inconsistencia cronológica preexistente en una persona, sin inventar fechas. Sólo la validación cronológica se suspendió durante la importación bloqueada; quedó habilitada antes de confirmar. Las comprobaciones de propietario, pertenencia al árbol, claves foráneas y RLS permanecieron activas.
- Se comprobó con el rol autenticado de la cuenta principal que puede leer las 4.077 personas y los tres árboles, sin filas de otro propietario.
- Las tablas y usuarios de finanzas e iHealth quedaron fuera de la operación. No se copiaron contraseñas, hashes, tokens, sesiones ni claves privadas.

Historial remoto: `20260908180926_prepare_private_geneai_account_transfer` y `20260908181720_merge_confirmed_geneai_account_data`. El registro privado conserva los propietarios, conteos anteriores y posteriores, las filas originales y la incidencia cronológica; esos datos no se publican en GitHub.

## Pendientes de archivos y clientes

El estado registrado es `data_applied_files_pending`: la transferencia de filas está aplicada; los archivos binarios todavía no se copiaron. Un documento mantiene un archivo privado en el almacenamiento original. Las cuatro fotos conservan sus referencias originales. Mantener activo el almacenamiento de origen hasta completar y verificar la copia. No confundir conteos de registros con archivos accesibles desde la cuenta nueva.

La contraseña vigente de la cuenta principal sigue siendo la misma. Cada dispositivo tendrá su propia sesión contra el proyecto dedicado. Las cuentas antiguas no se eliminaron ni se habilitó el acceso con sus contraseñas en el proyecto de destino.

## Servidor y publicación

Se corrigió un fallo real de la vista previa en Node 24 (`ERR_IMPORT_ATTRIBUTE_MISSING`) agregando el atributo JSON requerido. Una prueba ejecuta el módulo emitido en Node ESM para cubrir esa regresión.

El siguiente control del servidor detectó variables Vercel de otro proyecto (`BACKEND_ORIGIN_MISMATCH`). La configuración de despliegue ahora declara la conexión pública común; el build usa el mismo contrato que Apple. Las credenciales privadas sólo se validan al solicitar operaciones privadas; nunca se usan para sustituir el token del usuario.

La compilación web, TypeScript y las pruebas afectadas pasaron. La publicación final y su acceso anónimo deben comprobarse en Vercel. El código Apple sigue pendiente de compilar e instalar en macOS/iPad/iPhone.

La fuente completa de la publicación anterior no se recuperó. El conteo de funciones por sí solo no identifica funciones faltantes; no se ha verificado paridad completa. La publicación anterior debe conservarse como punto de recuperación.
