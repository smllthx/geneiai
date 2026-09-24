# GENEAI — diseño adaptable, 24 de septiembre de 2026

## Entrega

Rediseño del inicio y la navegación sobre `smllthx/geneiai`, partiendo de `main` en `254cf301fe62ca0e8dc5d688fa178c7afc18c5d1`. La revisión está en la rama `codex/geneai-liquid-design-2026-09-24`, [PR #7](https://github.com/smllthx/geneiai/pull/7). La ruta `/diseno` utiliza los componentes reales con datos explícitamente ficticios para comparar las pantallas sin exponer el archivo familiar.

[Abrir la galería interactiva](https://geneiai-git-codex-geneai-liquid-design-2026-09-24-geneaia.vercel.app/diseno). El cambio se entrega en vista previa y no se ha aplicado a producción.

| Vista | Comportamiento |
| --- | --- |
| iPhone web | Una columna, encabezado compacto y navegación inferior flotante. |
| iPhone app web | El mismo producto en modo PWA, sin barra de dirección y con áreas seguras del sistema. |
| iPad web / app web | Navegación según el ancho disponible: inferior en ventanas estrechas; lateral a partir de 900 px. |
| Mac web | Barra lateral, controles superiores agrupados y contenido distribuido en dos columnas cuando cabe. |
| Claro / oscuro | Degradados azul, lavanda y menta; Sistema como valor inicial y cambios automáticos en vivo. |

La vista de comparación usa iframes a 393, 1024 y 1440 px. Es una simulación de tamaños del navegador, no una prueba en hardware Apple. App web significa PWA; no se genera un nuevo IPA ni DMG en esta entrega. El material en la web se aproxima mediante CSS a Liquid Glass; no invoca los materiales nativos de SwiftUI.

## Cambios

- Árbol protagonista, cuatro métricas legibles y una única búsqueda que envía la consulta.
- Revisiones reunidas en un panel; evita presentar ceros como resultados si la carga falla.
- Mapa, línea de tiempo, tareas de completitud y actividad se abren cuando se necesitan. Las secciones pesadas se cargan al desplegarlas.
- Personas recientes sin identificadores técnicos en el inicio; actividad repetida agrupada.
- Cristal en controles y navegación. Superficies de contenido más opacas y sin desenfoque repetido.
- Fuente del sistema, foco visible, objetivos táctiles, modo de contraste/transparencia reducida y respeto al movimiento reducido.
- El tema anterior escribía oscuro incluso sin elección explícita. La nueva preferencia empieza en Sistema y permite conservar una elección explícita de Claro u Oscuro.
- Navegación de archivo y opciones avanzadas agrupadas. Reportar problemas sigue disponible en Ajustar vista.
- Se sustituye la URL del mapa que mostraba aviso de API key por los tiles estándar de OpenStreetMap, con atribución; no se añaden descargas masivas ni precarga.

## Fuentes oficiales consultadas

- Apple Human Interface Guidelines, Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple, Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- Apple Design Resources (el catálogo consultado ya incluye iOS/iPadOS 27): https://developer.apple.com/design/resources/
- Apple, novedades de los sistemas y ajustes de legibilidad de Liquid Glass: https://www.apple.com/os/
- Apple, introducción del diseño en iOS 26 y macOS Tahoe 26: https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- OpenStreetMap, política de tiles: https://operations.osmfoundation.org/policies/tiles/

## Verificación

- Suite completa local: 98 pruebas en 28 archivos, todas aprobadas.
- TypeScript: aprobado.
- Build web: aprobado, con avisos previos sobre tamaño de chunks.
- Contrato común de producto/backend: verificado. No se cambian cuentas, registros, RLS ni identidades nativas.
- Despliegue de revisión aprobado en Vercel. Última revisión visual del código `4eea4bf47a6bca3bf9a58422a5525de7c8bb4c64`; el ajuste posterior solo tipa los iconos, completa dependencias de efectos y aclara las etiquetas de cuenta en el menú de demostración.
- Comprobación en Chromium de los iframes a 393, 1024 y 1440 px: ancho de contenido y ancho de scroll iguales (378, 1009 y 1425 px respectivamente, descontando barra de scroll). Sin desbordamiento horizontal.
- iPhone: cambio entre claro y oscuro, menú y grupo Archivo familiar, tamaño de texto al 140 % sin desbordamiento horizontal y restablecimiento automático.
- iPad: apertura del panel Lugares y migraciones comprobada; Mac: distribución en dos columnas y controles superiores comprobados.
- Después del último ajuste: TypeScript y las 3 pruebas de navegación aprobados. Lint de App, AppLayout y DashboardView sin errores ni advertencias. MobileBottomNav conserva una advertencia anterior sobre exportaciones para Fast Refresh.
- No se ha probado en Safari ni en dispositivos Apple físicos. No se valida aquí instalación, trabajo offline, datos familiares autenticados ni compilación de las apps nativas existentes.

## Capturas de la vista previa

Las imágenes usan datos ficticios y se tomaron en la galería de comparación:

- [iPhone claro, app web](./iphone-claro.jpg)
- [iPhone oscuro, app web](./iphone-oscuro.jpg)
- [iPad claro, app web](./ipad-claro.jpg)
- [Mac claro, navegador](./mac-claro.jpg)
- [Mac oscuro, navegador](./mac-oscuro.jpg)
