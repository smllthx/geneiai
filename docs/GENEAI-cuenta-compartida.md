# GENEAI: conexión común y estado de la unificación

Revisión del 8 de septiembre de 2026. Estos cambios pertenecen a `smllthx/geneiai` y al código Apple recuperado de la misma aplicación. La actualización está en una rama de revisión; no se ha desplegado sobre las publicaciones existentes ni instalado una nueva compilación Apple.

## Qué se comprobó

Hay dos bases activas con genealogía distinta. El cliente web de la publicación antigua y la configuración Apple recuperada señalan `fbqovchaouhisdyxhdhy`. El proyecto dedicado existente es `camdtylwddleifaegzaf`, con una cuenta y datos más recientes. El antiguo `.env` del repositorio señalaba un tercer proyecto al que la conexión actual no concede acceso.

La rama prepara el proyecto dedicado como conexión común. Esto es una configuración propuesta y verificable, no una transferencia de datos ejecutada. El mapa de cuentas y la conservación de sus árboles están detallados en [el plan de transferencia](GENEAI-transferencia-cuentas.md).

## Cambios aplicados en las bases

Se completó la publicación existente `supabase_realtime` en los dos proyectos activos, sin modificar filas, usuarios, contraseñas, privilegios ni políticas RLS.

Tablas: `arboles`, `profiles`, `personas`, `relaciones`, `eventos`, `documentos`, `fotos`, `dna_estimates`, `familias`, `research_tasks`, `hipotesis`, `generated_inferences`, `sugerencias`.

| Proyecto | Registro remoto de migración |
| --- | --- |
| Dedicado, `camdtylwddleifaegzaf` | `20260908143447_complete_geneai_account_realtime` |
| Anterior, `fbqovchaouhisdyxhdhy` | `20260908143458_complete_geneai_account_realtime` |

[SQL exacto aplicado](operations/complete_geneai_account_realtime.sql). Es una copia de auditoría de una operación ya registrada remotamente. No ejecutar el historial completo del repositorio sobre ninguna base existente.

Después de aplicar la operación, las 13 tablas figuran en ambas publicaciones. Se verificó RLS mediante transacciones revertidas con el rol autenticado: el propietario puede consultar sus personas y no las de otros; una identidad ajena no puede leer personas, perfiles ni árboles. Esta prueba no equivale a una auditoría completa. Los asesores mantienen avisos preexistentes, entre ellos tablas de otros productos sin RLS en la base antigua; esta tarea no las modificó.

## Cambios preparados en el código

- `config/geneai-backend.json` es el contrato público común de proyecto, URL y clave publicable. Web, API y la generación de configuración Apple lo comparten.
- Las variables existentes se validan contra ese contrato. Una URL, referencia o clave JWT antigua de otro proyecto bloquea la conexión con un error explícito. Las claves opacas nuevas requieren validación real por el proveedor; su pertenencia no puede deducirse localmente.
- La web publicada comprueba la identidad de su API antes de mostrar el acceso. Una página de Vercel, una API antigua o una configuración distinta no se consideran una conexión válida. El notificador de actualización sigue disponible si la comprobación falla, para permitir reemplazar el worker antiguo.
- Al cambiar de usuario se descartan consultas almacenadas y borradores de interfaz. Las invocaciones pendientes y deduplicadas no pueden entregar respuestas de la identidad anterior.
- Cerrar sesión afecta a ese dispositivo. Las contraseñas las valida el mismo Supabase Auth; cada dispositivo conserva su propia sesión.
- Web escucha los perfiles y árboles además de los datos, refresca al volver y dispone de una consulta periódica en primer plano. El perfil compartido usa `profiles.display_name`; los demás campos de cuenta existentes siguen en los metadatos Auth.
- El código Apple existente está en `apple/GENEAI`. Incluye observación de sesión, carga paginada y recarga al volver a primer plano. Conserva la identidad de instalación `com.genaia.app` y muestra GENEAI.

## Configuración que debe reconciliar el despliegue

La rama incorpora configuración pública de `camdtylwddleifaegzaf`. Antes de publicar, actualizar de forma coherente las variables efectivas de cada entorno: `SUPABASE_URL`, `SUPABASE_PROJECT_ID` o `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` y las claves públicas correspondientes si están definidas.

Las credenciales privadas de servidor deben pertenecer al mismo proyecto y existir sólo en el servidor. `GENEAI_PUBLIC_URL` debe contener el origen HTTPS definitivo de la misma app; no usar la dirección del panel Vercel. Revisar también los destinos permitidos de OAuth y recuperación de cuenta. No se modificó ninguna variable remota, contraseña ni secreto.

El endpoint `/api/health` publica sólo la identidad configurada, sin claves. No es una prueba de disponibilidad de todas las funciones ni de una sesión real. Verificar luego acceso con cuenta de prueba, persistencia de cambios entre dos dispositivos y aislamiento de usuarios.

## Validación de la rama

- Compilación web de producción correcta; TypeScript de frontend y endpoints modificados sin errores.
- 76 pruebas Vitest correctas en 19 archivos, incluidas regresiones de cambio de cuenta, consultas deduplicadas pendientes, metadatos OAuth, sincronización y PWA.
- 6 pruebas Python de la configuración Apple correctas; contrato compartido, plist y scripts comprobados.
- 7 pruebas Swift preparadas, sin ejecutar por ausencia de Xcode/Swift. No se verificó visualmente la aplicación ni se instalaron binarios en dispositivos.
- Publicación Realtime y aislamiento RLS comprobados en las dos bases activas como se describe arriba.

## Pendientes que impiden afirmar que todo está unido

1. Resolver la vinculación de las dos cuentas distintas y conservar sus datos y archivos según el plan de transferencia. No se han copiado usuarios, hashes, contraseñas, árboles, documentos ni fotografías.
2. Recuperar y reconciliar la fuente completa de producción. La publicación antigua incluye 12 funciones y cambios locales que no están en GitHub; la publicación exclusiva 0.3.1 incluye otra fuente y 9 funciones. Sustituirlas con esta rama eliminaría funciones existentes.
3. Configurar el dominio y la protección Vercel. El usuario sigue observando la pantalla de acceso Vercel; no se verificó acceso anónimo ni se cambió esa protección.
4. Compilar y firmar el código Apple en macOS, conservando el identificador existente, e instalarlo sobre la app actual. Este entorno no dispone de Xcode y no verificó un binario Apple.
5. Probar inicio de sesión, cambios de cuenta, contraseñas existentes, creación/edición entre dispositivos y adjuntos en los despliegues reconciliados. Las pruebas automatizadas locales no sustituyen esa comprobación.

Referencias: [migración de usuarios Auth](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects), [restauración y archivos Storage](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [cierre de sesión por dispositivo](https://supabase.com/docs/guides/auth/signout).
