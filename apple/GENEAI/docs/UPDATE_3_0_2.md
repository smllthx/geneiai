# GENEAI 3.0.2 — paridad visual y búsqueda de lugares

Esta actualización conserva el mismo target `GENAIAApple`, bundle identifier
`com.genaia.app` y backend Supabase de GENEAI. El cambio de versión se publica
junto a la web 3.0.2.

- La web comparte la sesión, árbol activo y datos con macOS, iPad y iPhone.
- La navegación se agrupa en Archivo familiar, Investigación y Herramientas.
- La ficha y el árbol usan superficies adaptativas liquid-glass; el árbol tiene
  zoom y desplazamiento también en abanico, descendencia y linaje.
- El buscador de lugares consulta bajo demanda lugares de culto, parroquias,
  cementerios, comunas/municipios y patrimonio mediante OpenStreetMap.
- Los retratos se encuadran antes de guardarse y se reutilizan en toda la ficha.

El entorno actual es Linux y no incluye Xcode, por lo que el DMG no se compila
ni firma aquí. En un Mac, ejecuta `./scripts/actualizar_mac.sh` desde esta carpeta
para generar el proyecto, compilar y actualizar la instalación existente.
