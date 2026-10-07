# GENEAI 3.0.4 — 2026-10-07

## Changes

- Uploaded gallery photos can be associated with a person and selected as their portrait. Portraits appear in the people list, person details and both tree card implementations. Failed images display initials. Portrait writes report database failures and notify other views only after success.
- Investigation tools are grouped under Search, AI, Review and History, preserving existing URLs. Desktop, mobile and menu settings share one navigation definition. People actions are consolidated under Tools; gallery albums use one person grouping.
- Research criteria persist in URLs and generate provider links for names, places, approximate dates and catalogue fields. Place results link to the place view and FamilySearch catalogue. Provider links open outside the embedded browser.
- Archive search reads all result pages, scopes cached queries by account and tree, and reports database errors. Hypotheses are scoped through their people rather than a nonexistent tree column.
- Main navigation uses route prefetching and transitions; initial authentication still completes before private content is shown.

## Verification

- TypeScript app check passed.
- Vitest: 36 files, 117 tests passed.
- Product contract: 14 tests passed.
- Shared backend production build passed. Existing bundle size and outdated Browserslist warnings remain.
- Chromium responsive checks at 390×844, 834×1194 and 1440×1000: no horizontal page overflow or page JavaScript errors. Temporary preview used the actual investigation page with the production styles and was removed afterward.
- Final code review found no blocking issues after correcting hypothesis scoping and portrait tree assignment.

## Limits

External cards are prepared search links, not imported provider results. FamilySearch returned a protected page during direct access; Firecrawl research was unavailable due to account credits. No complete catalogue extraction was performed. Unindexed catalogue materials are not excluded by a digital-only filter; provider access restrictions remain in effect.

No Render service was provisioned or migrated. The existing shared backend identity is retained. Apple source version metadata is synchronized, but no native binary or Safari/WebKit execution was verified in this Linux environment.
