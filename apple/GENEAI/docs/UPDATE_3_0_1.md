# GENEAI 3.0.1 — código Apple

La misma app conserva `com.genaia.app` y el backend unificado. Los módulos que antes mostraban una pantalla pendiente ahora abren sus funciones reales de GENEAI dentro de WebKit. Importar abre la integración web completa. Cada cuenta nativa tiene un perfil web separado; el primer acceso web pide ingresar con la misma cuenta. No se copian tokens nativos a JavaScript.

Los enlaces nuevos se abren en una ventana integrada. La autorización oficial de FamilySearch usa ASWebAuthenticationSession y regresa al callback de GENEAI. Los sitios que exigen un navegador externo conservan esa opción. El cliente oficial de FamilySearch y su retorno autorizado deben estar configurados en el servidor; no se inventan ni transportan claves en el paquete.

Al abrir o regresar a la app se consulta el aviso de novedades publicado. «Actualizar funciones web» recarga el contenido web disponible; una edición señalada como pendiente bloquea la recarga. Esto no reemplaza el ejecutable nativo.

## Instalar en el Mac

Este ZIP contiene código fuente, no una app compilada ni notarizada. La compilación y los flujos Apple todavía deben verificarse en macOS; el entorno de desarrollo usado para esta actualización no tiene Xcode.

Con Xcode y XcodeGen instalados, ejecuta `scripts/actualizar_mac.sh` desde esta carpeta. El script compila, verifica la identidad, firma localmente y conserva un respaldo del ejecutable anterior antes de reemplazarlo. Si detecta otra identidad o varias instalaciones se detiene. No elimina las bases de datos ni solicita contraseñas de GENEAI. El sistema puede pedir volver a ingresar tras un cambio de firma.

Para desarrollo: `scripts/build_and_run.sh`. Para validar macOS/iOS y las pruebas nativas: `scripts/validate_apple.sh`.

Las versiones antiguas que no incluyen un actualizador no pueden instalar este código al recibir una notificación web. Necesitan esta primera instalación en el Mac. Un canal futuro de binarios nativos requiere una compilación firmada, distribución y notarización verificadas; no se publica un actualizador sin un binario real.
