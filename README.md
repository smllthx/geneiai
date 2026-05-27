# GENAIA

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

## Desarrollo local

```bash
npm install
npm run dev
```
