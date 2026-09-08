# GENEAI: plan de conservación y unificación de cuentas

**Actualización:** la transferencia de 4.028 registros a la cuenta principal ya se aplicó. Hay 4.077 personas y tres árboles. Los archivos y la publicación siguen en verificación. Véase [el estado más reciente](GENEAI-transferencia-aplicada.md); las secciones siguientes conservan el plan y las comprobaciones anteriores.

**Estado: propuesta pendiente de ejecución.** Este documento no acredita una
migración, una vinculación de cuentas ni una publicación de la aplicación.
Inventario de referencia: 8 de septiembre de 2026.

## Objetivo y alcance

Conservar la genealogía existente en el backend dedicado de GENEAI y trasladar
allí los registros genealógicos de la cuenta antigua cuya titularidad se
verifique. La web y la aplicación de Mac deberán utilizar el mismo backend y
la misma cuenta de destino.

El origen comparte infraestructura con finanzas e iHealth. La transferencia
debe limitarse a las tablas y archivos de GENEAI de las cuentas autorizadas.
Los otros cuatro usuarios de Auth y los datos de finanzas e iHealth quedan
fuera del alcance. No se propone copiar usuarios de Auth en bloque ni
contraseñas, sesiones o tokens.

## Inventario verificado

| Dato | Destino dedicado: r***@udd.cl | Origen compartido: r***@yopmail.com | Suma orientativa sin fusionar registros |
| --- | ---: | ---: | ---: |
| Personas | 2.016 | 2.061 | 4.077 |
| Relaciones | 6.550 | 302 | 6.852 |
| Eventos | 5.799 | 9 | 5.808 |
| Lugares | 702 | 41 | 743 |
| Documentos | 0 | 2 | 2 |
| Fotos | 0 | 4 | 4 |
| Árboles | 1 | 2 | 3 |

El origen contiene seis usuarios de Auth. También existe allí una cuenta
r***@udd.cl cuyo correo coincide con el del destino, pero cuyo identificador
de Auth es distinto y que no contiene genealogía en el inventario revisado.
El destino tiene una cuenta confirmada, r***@udd.cl.

No hay identificadores de personas comunes entre los dos conjuntos. Esto
permite distinguir sus registros actuales, pero **no demuestra que representen
personas diferentes**. No se deduplicará automáticamente por nombres, fechas,
parentescos ni ausencia de coincidencias de identificadores.

La última columna es una referencia aritmética, no un resultado de migración.
Se recalculará con un inventario actualizado y con las reglas reales de cada
tabla antes de transferir. Los conteos de documentos y fotos corresponden a
registros. En los buckets genealógicos del origen se observaron un objeto en
`documentos` y ocho en `fotos`; el destino no tiene objetos. Estas cantidades
no equivalen a los registros ni prueban su propietario: falta resolver cada
referencia, revisar archivos faltantes y determinar los originales y derivados
que deben transferirse.

## Vinculación propuesta de cuentas

| Cuenta de origen | Cuenta de destino propuesta | Condición pendiente |
| --- | --- | --- |
| r***@udd.cl, sin genealogía inventariada | r***@udd.cl del backend dedicado | Verificar el control de ambas cuentas y registrar su correspondencia; la coincidencia del correo no iguala sus identificadores. |
| r***@yopmail.com, con genealogía | r***@udd.cl del backend dedicado | Verificar que el usuario controla esta cuenta o está autorizado para transferir sus datos, y confirmar expresamente la vinculación. |
| Otros cuatro usuarios del origen | Ninguna | Excluidos de la transferencia. |

La verificación debe realizarse mediante los mecanismos de autenticación o
administración autorizados. No se solicitarán contraseñas ni tokens en el chat.
La correspondencia técnica de identificadores se preparará como un registro
privado de la operación, sin incluirla en este documento ni en el repositorio.
La cuenta confirmada del destino seguirá siendo la identidad de acceso; la
propuesta no requiere crear otra cuenta para el mismo usuario.

## Árboles y archivos que deben conservarse

- Mantener el árbol actual del destino y sus 2.016 personas.
- Conservar por separado el árbol principal del origen, con sus 2.061 personas,
  y el árbol Giannetti, actualmente vacío. El árbol vacío también forma parte
  del inventario y no debe descartarse.
- Preservar la pertenencia de cada registro a su árbol, sus relaciones, eventos,
  lugares y referencias. No incorporar todo al árbol del destino por defecto.
- Conservar los dos registros de documentos y las cuatro fotos del origen,
  junto con sus archivos originales, asociaciones y metadatos. Incluir las
  miniaturas u otros objetos derivados solo cuando estén referenciados o sean
  necesarios para visualizar los originales.
- Inventariar los buckets, rutas, tamaños, tipos de contenido y permisos de esos
  objetos. Copiar únicamente los objetos genealógicos autorizados. Comparar
  tamaños y sumas de comprobación después de la copia, y actualizar las
  referencias mediante una correspondencia explícita de rutas.

## Secuencia de transferencia propuesta

1. **Resolver los requisitos pendientes.** Verificar la vinculación de cuentas,
   recuperar la fuente correspondiente a la aplicación en producción y disponer
   de acceso autorizado para publicarla y transferir sus objetos de Storage.
   El alcance y el esquema de la fuente recuperada deben conservar las funciones
   actuales de GENEAI. Tener acceso al repositorio no acredita por sí solo que
   contenga esa versión de producción.

2. **Crear copias de recuperación.** Respaldar los registros genealógicos
   seleccionados del origen y el estado previo del destino, incluyendo esquema,
   políticas aplicables y manifiestos de archivos. Conservar también la
   configuración del despliegue que permite volver a la versión anterior.
   Guardar las copias en almacenamiento privado, fuera del repositorio. Registrar
   la fecha de corte y comprobar que las copias se pueden leer y restaurar.
   No eliminar ni modificar el origen durante la copia o la validación.

3. **Preparar una simulación sin escrituras (dry run).** Actualizar los conteos
   por cuenta, árbol y tabla. Comprobar claves foráneas, campos obligatorios,
   restricciones únicas, archivos faltantes y posibles colisiones en todas las
   tablas, no solo en personas. Preparar un informe de registros que se
   importarían, correspondencias necesarias y elementos bloqueados. Cualquier
   ambigüedad de propietario o colisión debe quedar pendiente de resolución.

4. **Definir una operación idempotente.** Asignar una identidad estable a cada
   registro importado a partir de origen, tabla e identificador original. Guardar
   una correspondencia privada con su identificador en destino y con la cuenta
   autorizada. Una segunda ejecución debe reconocer lo ya transferido y no
   duplicarlo ni sobrescribir registros actuales del destino. Revalidar las
   colisiones antes de reutilizar identificadores; no generarlos de nuevo en
   cada intento. Usar estados y puntos de recuperación por lote para reanudar
   fallos de base de datos o de almacenamiento.

5. **Controlar los cambios durante la transferencia.** Acordar una ventana breve
   de mantenimiento o registrar y reconciliar los cambios posteriores al corte.
   Importar en el orden que exijan las dependencias comprobadas del esquema.
   Aplicar la correspondencia de propietarios y árboles a cada registro
   dependiente. Copiar los archivos y validar sus referencias antes de dar la
   operación por terminada. Conservar el conjunto previo del destino.

6. **Validar datos y acceso.** Contrastar los resultados con el dry run y los
   conteos finales previstos; comprobar relaciones y referencias sin huérfanos,
   integridad de archivos, conservación de los tres árboles y ausencia de
   duplicados causados por reintentos. Verificar que no se transfirió ningún
   usuario o dato excluido. Probar lecturas y escrituras con la sesión ordinaria
   del usuario, además de pruebas de denegación para accesos no autorizados.

7. **Unificar la conexión y comprobar ambos dispositivos.** Configurar web y Mac
   contra el backend dedicado verificado y la identidad de destino. Publicar
   únicamente desde la fuente recuperada y reconciliada. Verificar el acceso
   normal de GENEAI, la apertura desde Inicio, la lectura del mismo árbol y una
   modificación controlada que aparezca en el otro dispositivo. La simulación
   y los conteos no sustituyen esta comprobación de sincronización real.

## RLS, permisos y actualizaciones en tiempo real

Las políticas de seguridad por fila (RLS) deben conservar el aislamiento por
usuario y los permisos propios de cada árbol. Revisar las dependencias entre
tablas y las políticas de Storage con el esquema real; no copiar políticas
del backend compartido de manera indiscriminada ni desactivar RLS para que la
aplicación funcione. Las credenciales administrativas, si la transferencia las
requiere, pertenecen a un entorno de ejecución privado y nunca a los clientes
web o Mac.

**Hecho ya verificado:** la publicación de actualizaciones en tiempo real de
las 13 tablas de GENEAI está habilitada en ambos backends, sin modificar sus
filas. Esto no transfiere datos, no vincula las cuentas y no conecta entre sí
los dos proyectos. La sincronización final requiere que los clientes usen el
mismo backend, reciban sus cambios y tengan permiso para leerlos.

## Criterio de cierre y reversión

La unificación solo podrá declararse completada cuando estén verificadas la
vinculación de cuentas, la conservación de registros y archivos, el acceso por
RLS y la sincronización entre web y Mac. Conservar el informe de conteos,
incidencias, correspondencias y validaciones en un registro privado.

Si una fase falla, detener la operación antes de cambiar la conexión de los
clientes. La reversión debe distinguir los registros importados de los datos
previos y de las modificaciones posteriores del usuario; no usar borrados
generales como mecanismo de deshacer. Mantener disponible la versión anterior
del despliegue y las copias de recuperación. Cualquier retirada futura del
origen requiere una decisión posterior y separada de esta transferencia.
