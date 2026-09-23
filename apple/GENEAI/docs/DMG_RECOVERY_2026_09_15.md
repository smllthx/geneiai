# GENEAI — Recuperación del empaquetado de macOS

## Estado

Cambio preparado el 15 de septiembre de 2026 sobre `main`, commit
`8fab5c5fb379d82aaf4c979badda130a26b06440` de `smllthx/geneiai`.
El traspaso mencionaba `scripts/crear_dmg.sh`, pero ese archivo no estaba en
la carpeta `apple/GENEAI/scripts` del remoto inspeccionado. Esta es una
implementación nueva basada en la configuración existente, no el script
original recuperado ni un instalador ya compilado.

Se conservan el target `GENAIAApple`, producto `GENEAI`, bundle
`com.genaia.app`, versión 3.0.2 y el generador existente del backend compartido.
No se modifican la web, los datos, las credenciales ni la aplicación instalada.
No se agregan dependencias al proyecto ni se ejecutan migraciones.

## Uso en un Mac autorizado

Desde la raíz de **este mismo repositorio completo**, en la rama que contiene
el cambio:

```bash
bash apple/GENEAI/scripts/crear_dmg.sh --check
bash apple/GENEAI/scripts/crear_dmg.sh
```

El primer comando valida requisitos y la configuración pública del backend.
No ejecuta una compilación. El segundo reutiliza `generate.sh`, compila la
aplicación Release para la arquitectura del Mac que ejecuta el comando,
comprueba su identidad y ejecutable, crea una imagen comprimida, la verifica,
la monta de solo lectura y la desmonta. Después publica el archivo completo
sin sobrescribir un instalador existente y muestra su SHA-256.

Con la versión actual, la salida esperada tras una ejecución **exitosa** es
`apple/dist/GENEAI-3.0.2-macOS.dmg`. Los registros de compilación se guardan
en archivos `GENEAI-build.*` dentro de `apple/dist`.

Requisitos: macOS, Xcode completo configurado, XcodeGen y Python 3. El script
no instala herramientas ni acepta licencias. La configuración del proyecto
consultado establece macOS 15.0 como mínimo; eso no demuestra compatibilidad
en ningún equipo que no haya sido probado. No genera un binario universal:
compila para `arm64` o `x86_64` según el Mac anfitrión.

## Comprobaciones realizadas en esta entrega

```bash
bash -n apple/GENEAI/scripts/crear_dmg.sh
python3 -m unittest discover -s apple/GENEAI/tests -p test_dmg_cli.py -v
```

Resultado en Linux: **6 pruebas correctas**. Cubren sintaxis, ayuda, rechazo
de opciones desconocidas o adicionales y rechazo de compilación/comprobación
en un sistema no macOS. No prueban la ruta de compilación de Xcode ni simulan
un DMG real. No se repitió la batería web de Vitest, TypeScript o Vite.

## Pendientes y límites

- Ejecutar y revisar la compilación y las pruebas nativas en un Mac real.
- Verificar el DMG, abrir la app y probar acceso, datos y actualización de la
  instalación anterior sin pérdida de información.
- Revisar firma para distribución y notarización por separado. Esta ruta
  desactiva la firma de Xcode durante la compilación, no configura Developer ID
  y no notariza. No modifica Gatekeeper ni elimina atributos de cuarentena.
- No se ha creado, instalado o publicado un DMG en esta entrega. El acceso
  remoto consultado no tenía ningún equipo disponible.

## Publicación web observada

Vercel devolvió `READY` para el despliegue de producción
`dpl_AXsvkYjsjCT4wGq7BkMCfMJPfn1k`, asociado al mismo commit de `main`.
`public/release.json` declara versión 3.0.2. No se encontraron errores de
runtime en la consulta de las últimas 24 horas; esto no acredita uso real ni
pruebas funcionales. La web no fue reemplazada por este cambio. La apertura
pública y la descarga del repositorio no pudieron verificarse desde el entorno
remoto utilizado; no se reporta una prueba de navegador exitosa.
