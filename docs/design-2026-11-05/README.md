# GENEAI 3.0.9 — adaptación de los tres ZIP

Las referencias aportadas GENEAI1(1), GENEAI2(1) y GENEAI3(1) se aplican a los componentes de la aplicación existente. No se importan cifras, nombres, fuentes ni retratos de las maquetas como datos de una cuenta.

## Decisiones de diseño

| Referencia | Aplicación y criterio |
| --- | --- |
| Inicio (1/2) | Fondo azul oscuro, una superficie por grupo, árbol protagonista, métricas reales, accesos y personas recientes. Las revisiones siguen disponibles debajo del resumen. |
| Árbol y abanico (1/2) | Se conservan el lienzo amplio, las generaciones libres, los nombres completos y retratos de 3.0.8. Iconos del mismo catálogo. No añadimos pestañas encima del lienzo. |
| Archivo familiar (1/2) | Personas, Apellidos, Familias, Calendario, Lugares y Línea de tiempo juntos; pestañas visibles además del menú. |
| Descubrimientos (1/2) | Coincidencias, Sugerencias y Pistas bajo una sección. Abrir una pista en Investigación conserva persona, búsqueda y texto de la pista. |
| Investigación (1/2) | Mantiene las funciones reales y sus grupos; documentos, fuentes, hipótesis e inferencias accesibles desde el menú. |
| Fotos y ADN (1/2) | Catálogo gráfico compartido, pestañas de sección. LiveMemory queda dentro de Fotos con MyHeritage y enlace externo explícitos. No se simulan funciones propias de servicios externos. |
| Herramientas y cuenta (1/2) | Importación/exportación, duplicados, preferencias, ajustes y selector de idioma. Conserva las opciones de personalización previas. |
| Idioma escritorio/móvil/italiano (1/2) | Español, English, Italiano; previsualizar, guardar y cancelar. Preferencia por cuenta en app_config.idioma; caché por usuario y otra independiente para la demostración. La navegación, Inicio, encabezados compartidos y cronologías tienen diccionario. Herramientas especializadas antiguas aún contienen textos en español. Documentos y nombres propios nunca se traducen automáticamente. |
| Cronologías (3) | Un componente en Inicio, Línea de tiempo y ficha personal. Horizontal con desplazamiento acotado; vertical con detalles en línea. Adaptado a móvil, teclado, datos aproximados, fuentes y lugares reales. |
| 60 SVG (1/2/3) | Se conservan sus formas originales en src/assets/icons/original; rellenos semánticos y paleta común generados por scripts/color-geneai-icons.py. Se añaden matrimonio, bautismo, defunción y oficio. |
| Matrimonio | Dos argollas doradas con cruces de trazos entrelazados. Compartido entre cronologías, información esencial y calendario. |
| Banderas | SVG de flag-icons 7.6.0, MIT, empaquetadas localmente. Países ISO y territorios reconocidos por código/nombre explícito en español, inglés, italiano, francés, alemán y portugués. Sin inferir nacionalidad a partir de apellidos o ciudades. Un lugar desconocido conserva un globo. |
| Logo y tipografía | BrandLogo y logo-tree.png existentes; --app-font y fuente del sistema. Se evita duplicar la marca y cargar un PNG de referencia como interfaz. |

## Opciones descartadas o ajustadas

- Los dos primeros paquetes repiten pantallas: se unifican y se usan las formas SVG de GENEAI2/3, sin menús duplicados.
- No se usan capturas PNG como controles ni el HTML de demostración como una segunda app: todo queda conectado a rutas y datos existentes.
- Se sustituyen el corazón para matrimonio y el calendario idéntico para bautismo/defunción por símbolos diferenciados.
- No se colorea sólo el fondo del botón: el color está en las propias figuras. Los glifos auxiliares sin equivalente en el paquete conservan su geometría funcional.
- Se mantienen tema claro, tema oscuro y preferencia Sistema. El azul oscuro de las referencias no anula la elección del usuario.
- Se conservan todos los eventos reales con sus fuentes. Sólo se suprime el evento sintético redundante de una fecha vital cuando existe el mismo evento explícito.
- Las fechas sin día/mes siguen siendo aproximadas o intervalos; no se muestran edades calculadas desde un año aproximado.
- Los adjuntos y las capturas privadas de referencia no se publican en el repositorio.

## Verificación

193 pruebas de regresión aprobadas, TypeScript, build de producción y contrato compartido. Pruebas nuevas cubren fechas aproximadas, fuentes, duplicados de eventos, banderas sin inferencia, cambio de orientación y guardado/cancelación de idioma. La galería `/diseno` incorpora Inicio, Cronología, Iconos y Banderas con datos ficticios y no consulta registros de cuentas.

Revisión visual en vista de escritorio y marco iPhone: detalle de matrimonio, alternancia horizontal/vertical, cambio a italiano y ausencia de desbordamiento horizontal en el marco móvil. Las cronologías del archivo filtran por árbol activo y sólo incluyen eventos de personas de ese árbol.

La adaptación es del cliente web/PWA. No produce instaladores nuevos ni modifica autenticación, relaciones familiares o políticas de acceso.

Referencia de banderas: https://github.com/lipis/flag-icons (MIT).
