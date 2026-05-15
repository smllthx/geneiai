# Rediseño integral + nuevo logo + IA potente

Petición muy amplia. Propongo dividirla en **5 tandas** para mantener calidad. Empezamos por lo visual (logo + paleta + nav) y luego avanzamos a las funcionalidades de IA y módulos avanzados.

---

## Tanda 1 — Identidad visual (logo + paleta + tipografía)

1. **Eliminar branding Lovable**: quitar badge "Edit with Lovable" y referencias del `index.html` / `manifest`.
2. **Nuevo logo "Árbol de raíces"**:
   - SVG inline (no imagen) con árbol simétrico: raíces abajo, ramas arriba, ambas entrelazadas formando un círculo.
   - 4 colores de acento unidos en gradiente continuo:
     - 🇨🇭 Suiza → rojo `#DA291C`
     - 🇪🇸 España → amarillo dorado `#F1BF00`
     - 🇨🇱 Chile → azul `#0033A0`
     - 🇮🇹 Italia → verde `#008C45`
   - Las ramas/raíces se funden de un color al siguiente, simbolizando linaje unido.
3. **Paleta minimalista**: fondo neutro (off-white / charcoal), un único acento (azul profundo) y los 4 colores patrios reservados solo para el logo y badges de origen.
4. **Tipografía única**: Inter (regular 400, semibold 600, bold 700). Eliminar Instrument Serif salvo en hero del logo.
5. Reducir gradientes pastel y sombras del mesh global → fondo plano con un único radial sutil.

## Tanda 2 — Navegación y fichas más limpias

1. **Sidebar agrupado** (ya está parcialmente):
   - **Archivo**: Árbol, Personas, Familias, Documentos, Fotos
   - **Investigación**: Investigación, ADN, Coincidencias, Fuentes
   - **Herramientas**: Importar, Agente IA, Configuración
   Colapsables en móvil.
2. **Ficha persona**:
   - Ocultar campos vacíos por defecto + botón "+ Agregar dato".
   - Barra de completitud (0–100%) con color sin datos / parcial / completo.
   - Escala de confianza explícita por campo: "Muy seguro · Algo seguro · Dudoso".
   - Resaltar línea directa del usuario con borde de color configurable.

## Tanda 3 — IA potente y omnipresente

1. **Edge function `ai-genealogy`** con AI Gateway de Lovable usando `google/gemini-3.1-pro-preview` (la última disponible) con fallback a `openai/gpt-5.5-pro`.
2. **Extracción automática** al subir documento / GEDCOM / foto:
   - OCR + parsing → propuesta de personas, fechas, lugares.
   - Apartado nuevo **"Sugeridos"** en sidebar donde la IA lista entidades a añadir al árbol con un clic.
3. **IA con permisos de escritura**: tool-calling para crear/editar personas, relaciones, notas, fuentes. Confirmación del usuario antes de aplicar.
4. **Chat global** flotante (mejora del SiriAssistant): contexto de la persona / página actual.
5. **Búsqueda fuzzy** (Levenshtein) para nombres/apellidos/lugares con typos.

## Tanda 4 — Investigación externa automatizada

1. **Conector credenciales**: tabla `external_credentials` (cifrada) para MyHeritage, FamilySearch, Ancestry, Geneanet. Form en Configuración.
2. **Edge function `external-search`**: dado un nombre/fecha/lugar, consulta APIs / scrapea resultados públicos y devuelve coincidencias con score.
3. **Modo manual y automático**: cron diario que sugiere nuevas pistas por persona.
4. **Notificaciones** in-app de coincidencias nuevas (ADN + parientes).

## Tanda 5 — Módulos avanzados

1. **Estimación étnica interactiva**: gráfico de dona (Recharts) por región + evolución por generación.
2. **Analizador de fotos**: Gemini Vision para detectar rostros, agrupar por similitud, sugerir rasgos heredados.
3. **Mapa migratorio animado**: timeline con play/pause, filtros por fecha y línea.
4. **Vista abanico mejorada**: zoom + pan + control de generaciones.
5. **Gestión masiva**: añadir múltiples hijos en una sola tabla.
6. **Contexto histórico** en timeline de cada persona.

---

## Decisiones que necesito de ti

1. **¿Empiezo por la Tanda 1** (logo + paleta + quitar Lovable) y vamos avanzando, o prefieres otro orden?
2. **Credenciales externas**: ¿guardamos cifradas en la base de datos del proyecto, o usamos los conectores oficiales de Lovable cuando existan?
3. **Modelo IA por defecto**: ¿`google/gemini-3.1-pro-preview` (más reciente Gemini) o `openai/gpt-5.5-pro` (top reasoning)? Puedo dejar selector en Configuración.

Confírmame y arranco con la Tanda 1.
