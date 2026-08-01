# GENEAI

App web familiar/genealógica con React, Vite, Supabase y OpenAI.

## Link fijo recomendado

Publicar en Vercel con el proyecto `geneiai` para obtener un link estable como:

```text
https://geneiai.vercel.app
```

Cada cambio de código/diseño debe guardarse con Git y subirse a GitHub. Vercel publica automáticamente cada cambio subido a la rama `main`.

## Variables necesarias

Configura estas variables en Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

La clave de OpenAI se guarda dentro de la app en `Configuración -> IA`.

## ChatGPT Work

GENEAI expone una conexión MCP privada en:

```text
https://geneiai.vercel.app/mcp
```

Esto permite usar la aplicación web y ChatGPT Work al mismo tiempo sobre la misma cuenta, el mismo árbol activo y las mismas reglas de acceso de Supabase. La conexión incluye búsqueda y lectura de personas, creación y actualización de fichas, relaciones familiares y propuestas revisables. No expone herramientas para borrar personas.

La conexión usa OAuth 2.1 de Supabase. En la configuración del servidor OAuth, la ruta de autorización de GENEAI debe ser:

```text
/oauth/consent
```

Para probarla en Work, activa el modo de desarrollador de ChatGPT y añade el endpoint MCP anterior. Al conectar, GENEAI mostrará su pantalla de permiso e iniciará sesión con la cuenta existente. Esta conexión no necesita una API key nueva de OpenAI: Work aporta el modelo y GENEAI aporta los datos y las acciones autorizadas.

Los cambios solicitados desde Work se limitan al usuario y al árbol activo, y se registran de forma best-effort en `work_audit_log` después de aplicar la migración `20260801000000_chatgpt_work_audit.sql`.

## Desarrollo local

```bash
npm install
npm run dev
```
