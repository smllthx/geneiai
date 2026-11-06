# GeneAI identity memory — 3.0.10

The existing private cloud index and worker are now connected to `/motor-identidad` (Investigación → Motor de identidad). This release does not create another database or overwrite family records.

## Existing model, preserved and made reviewable

`supabase/functions/_shared/neuralIdentity.ts` and `neural-memory-worker/index.ts` recover the exact deployed `geneai-identidad-1.0.0` inference logic and weights. Eleven structured comparison features feed eight tanh hidden units and a sigmoid ranking output. Features describe names and registered aliases, birth/death years, birth place, shared relatives and contradictions. This small identity ranker is not a foundation language model.

The previous training dataset and calibration report were not available in the repository. No new training or accuracy claim is made. The score is a ranking signal, not a probability that two people are identical. Contradictions cap it at .29; insufficient corroboration caps it at .49. The interface deliberately shows supporting facts rather than a confidence percentage.

The worker already runs through the project's one-time job-ticket dispatch. It processes the private `neural_person_index`, records versioned proposals in `neural_identity_notes`, and matches document mentions only when a literal excerpt supports them. It calls no external model for person-to-person matching. Existing document extraction can use the app's configured AI separately. Person edits and relationship/document changes invalidate pending proposals via existing database triggers. The UI reloads counts and proposals every 30 seconds and on account data events.

This release checks in the deployed worker source for traceability; it does not redeploy or change that worker, its existing database triggers, cron, RLS, or service credentials. Its JWT platform flag remains disabled because it authenticates private, single-use job tickets. It must not be exposed as a user-triggered endpoint.

## Human review and scope

The new page reads only the authenticated user's active tree. It shows the index count, processed/pending persons, document excerpts, variants, and side-by-side facts. Confirm/Reject updates only the pending proposal's `status`, filtered by user, tree and ID. A confirmation neither merges people nor replaces facts. Database RLS and version checks remain authoritative. Reviewed proposals remain in the Confirmadas/Descartadas views.

Both legacy duplicate detectors now use a common candidate retriever with registered variants and the user's name equivalences. They paginate the entire active tree, exclude merged records, and keep existing persisted confidence/score at zero (unverified). They do not send profiles to an AI provider. Giovanni/Juan with a recorded alias and identical birth date/place is a regression fixture. Unrecorded name translations are not inferred.

## Data integrity fixes

- Universal search prioritizes exact full names and registered aliases, requires every query token for approximate name matches, counts all results, and pages the visible list. It defaults to Árbol actual; Todos mis árboles is explicit. Each result identifies its tree.
- Age uses completed birthdays. Year-only or estimated dates produce an approximate label; contradictory living/death status does not produce an age.
- Spouses, children, parents and siblings each have their own tab and count.
- The private sharing endpoint requires explicit `viva = no` before sending a sanitized deceased profile to its optional AI provider. Living/unknown status stays protected even if a death date is present. Living relatives remain excluded.
- GEDCOM families are built from recorded parent edges, never by attaching every child to every spouse. A single parent is retained. Approximate years/ranges remain qualified dates. The export reads all pages, and the importer reads GEDCOM pointers and continued text correctly.

## Validation

`src/lib/identityIntegrity.test.ts` covers names, dates, model boundaries, family/approximate-date round trips and pagination. `api/edgeIntegrity.test.ts` bundles the actual four edge handlers against simulated Supabase and AI: privacy contradictions, missing auth, wrong owner, Giovanni/Juan and a 1,203-person export are exercised without touching real family data. UI tests cover search scope/counts and a scoped identity review that never updates person records.
