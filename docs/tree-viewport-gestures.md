# Navegación táctil del árbol — 22 de septiembre de 2026

Implementación sobre el árbol existente de GENEAI, inspirada en la navegación del video de referencia. No copia datos, gráficos ni código de otra aplicación.

## Comportamiento

Una cámara compartida controla las vistas retrato, horizontal, abanico, descendencia y linaje. Separar o juntar dos dedos modifica continuamente el zoom entre 15 % y 300 %. El punto situado entre los dedos conserva su posición relativa mientras ambos dedos se desplazan. Al retirar uno, se puede continuar arrastrando sin reiniciar el encuadre. Arrastrar una ficha mueve la vista; tocarla sin arrastrar mantiene su acción original.

El desplazamiento con un dedo tiene desaceleración al soltar y se interrumpe inmediatamente al volver a tocar. Los botones +, − y centrar tienen transición de 220 ms. Doble toque sobre espacio vacío amplía la vista. Las preferencias de movimiento reducido desactivan animación e inercia. Los menús, búsqueda y paneles quedan fuera de la superficie gestual y no se escalan.

En escritorio: arrastre con botón izquierdo, desplazamiento de trackpad/rueda en dos ejes, Ctrl/Meta + rueda para zoom anclado al cursor. Con el lienzo enfocado: flechas para mover, +/− para zoom, 0/Home para centrar. Los campos de texto y activaciones de teclado de las fichas conservan su funcionamiento.

## Rendimiento y límites

`treeViewport.ts` combina los eventos en `requestAnimationFrame` y modifica variables CSS de transformación. Sólo `TreeViewportToolbar.tsx` se suscribe al valor del zoom; el grafo de personas no se vuelve a renderizar por cada movimiento. Se limpian listeners y animaciones al desmontar, cancelar, perder el foco o cambiar el tamaño. La transferencia de captura implícita de una ficha a la superficie no cancela el arrastre.

No se modifican relaciones, personas, consultas Supabase, autenticación, fuentes, diseños de fichas ni lógica de investigación. No se modifica el código de la aplicación nativa Swift ni su instalador. Los gestos de trackpad específicos de Safari/macOS requieren verificación física adicional; no se afirma compatibilidad medida con todos los navegadores ni una tasa de fotogramas garantizada.

## Pruebas reproducibles

El script compila el controlador TypeScript real y lo prueba en una página aislada con Chromium. Incluye 200 combinaciones matemáticas dentro de una de sus 18 comprobaciones, gestos nativos multitáctiles mediante CDP, transiciones entre uno/dos/tres dedos, cancelación, arrastre sobre botones, selección por toque, controles fijos, teclado, reinicio, inercia, movimiento reducido, limpieza y agrupación de 100 eventos en un fotograma con 1.000 elementos de prueba.

```sh
npm ci
python -m pip install playwright
python -m playwright install chromium
python scripts/test-tree-viewport.py
```

`CHROMIUM_PATH` permite seleccionar un Chromium instalado. `TREE_QA_OUTPUT` permite elegir el directorio del informe JSON y captura; de forma predeterminada se usa un directorio temporal, no la carpeta del proyecto.

Validación realizada: controlador compilado con TypeScript estricto; sintaxis TSX de la integración revisada; 18/18 comprobaciones del controlador pasaron en Chromium 144. No equivale a una prueba de la aplicación completa con una sesión autenticada. Pendiente de validación física en Safari/iPhone/iPad y de comparación perceptual con el video. La compilación y el despliegue de la aplicación se deben verificar por separado en Vercel antes de considerar una versión publicada.
