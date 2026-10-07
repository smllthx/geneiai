# GENEAI 3.0.5

Investigation panels moved from person details and the main tree into Investigar → IA → Análisis de personas y árbol. The people list no longer launches AI from individual rows. The research page selects a person, displays person and tree insights, and carries that person's ID and name into the assistant prompt.

The main tree's four layouts now share the existing pointer camera. Only the genealogy content transforms; the viewport, zoom controls and surrounding sections retain their dimensions. Two-finger pinch is anchored beneath the fingers, dragging pans inside the viewport, and editing mode preserves relationship drag operations.

Responsive Chromium checks at 390×844, 834×1194 and 1440×1000 dispatched real two-touch gestures. Scale changed from 0.88 to 1.98 and then 0.66, while viewport and toolbar rectangles stayed identical and browser page scale stayed 1. No JavaScript errors or horizontal page overflow were observed. Temporary preview files were removed. These checks cover the shared canvas; authenticated production data and native Safari were not exercised.

Additional automated checks cover the pinch anchor, zooming in and out, unscaled controls, editing drag, research navigation and selected-person context transfer. Full application tests, shared product checks, TypeScript and the production build are required before publishing.
