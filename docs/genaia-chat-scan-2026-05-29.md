# GENAIA chat scan - 2026-05-29

Este archivo resume el escaneo de las funciones pedidas en el chat reciente y el estado real dentro del codigo.

## Confirmado en la app

- Arbol moderno en `/arbol` con Supabase: `src/components/tree/GenealogyTreeView.tsx`.
- Vistas del arbol: retrato, horizontal, abanico, descendencia y linaje.
- Arbol clasico en `/arbol-clasico`.
- Ficha genealogica completa en `/personas/:id` y ficha moderna en `/personas/:id/ficha`.
- Investigacion como hub con pestanas: buscar, agente IA, importadas pendientes, busqueda IA, insights, paralelo, web externa, pistas, hipotesis e inferencias.
- Personas importadas pendientes dentro de Investigacion.
- Origen ancestral en `/origen-ancestral`.
- Cuadros IA en `/cuadros-ia`.
- Configuracion, credenciales, importacion/exportacion, documentos, fotos, fuentes, calendario, duplicados y coincidencias.
- Busqueda interna por nombre, apellido, codigo, documento, evento, hipotesis y lugar.
- Asistente con fallback local cuando ChatGPT/OpenAI no responde por API key, cuota o funcion edge.

## Actualizado hoy

- La ficha de persona dejo de tener botones IA sueltos y ahora agrupa acciones rapidas e investigacion IA.
- Smart Insights tiene boton de actualizar y escucha cambios de datos.
- Tree Insights tiene boton de actualizar y escucha cambios de datos.
- Agregar familiar ordena personas por apellido y nombre.
- Union civil, convivencia y cohabitacion se guardan como vinculo de pareja con nota de tipo de union.
- Relaciones antiguas guardadas como "otra relacion" con notas de union civil, convivencia o cohabitacion tambien se reconocen como pareja.
- El arbol clasico muestra bloque de pareja/uniones en las vistas clasica, lineas, abanico y dinastica.
- El arbol moderno ahora reconoce multiples parejas/uniones y no solo la primera.
- El asistente local puede buscar personas por chat y abrir la ficha cuando hay una sola coincidencia.
- Los controles del arbol moderno usan tokens visuales de GENAIA en lugar de tonos aislados.

## Parcial o pendiente

- React Flow no esta instalado porque el entorno no pudo acceder a `registry.npmjs.org`.
- La vista moderna tiene un motor propio de pan, zoom, lineas y nodos. Esta preparada para migrar a React Flow, pero aun no importa `@xyflow/react`.
- Varias acciones IA existen como botones y funciones edge, pero dependen de OpenAI/Supabase configurado; si no hay API key o creditos, aparece fallback local.
- El trabajo autonomo con IA en segundo plano cuando la app esta cerrada necesita jobs programados externos; una app web no puede ejecutar tareas permanentes si el navegador esta cerrado.
- Touch Bar de MacBook no se puede controlar directamente desde una app web normal.

## Como instalar React Flow cuando haya internet

Ejecutar en la carpeta del proyecto:

```bash
npm install @xyflow/react
npm run build
git add package.json package-lock.json src
git commit -m "Install React Flow"
git push origin main
```

Luego migrar `GenealogyTreeView` a `ReactFlow`, `Background`, `Controls` y `MiniMap`.
