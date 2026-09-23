# GENEAI — consolidation checkpoint, 2026-09-22

## Scope and status

This is an integration candidate, not a completed migration or a published native release.
Continue the existing `smllthx/geneiai` product. Do not create another application.
Canonical production web origin: `https://geneiai.vercel.app`.
Canonical dedicated data project: `camdtylwddleifaegzaf`.
Vercel hosts the web/API; Supabase hosts authentication, database and storage.
This is one logical backend for all clients, NOT one physical server.

## Recovered and verified lineages

| Lineage | Observed source | Integration status |
| --- | --- | --- |
| Production web/PWA | `main` at `e9ccf5b62b432998fae924a0c7e81ce681135e83` | Starting point; retains fluid tree changes already merged through PR #4 |
| Fluid tree gestures | `6f1be0f514eace01ad95efd74c15b47aa99ed3bb` | Already included in production main |
| Apple SwiftUI/WebKit | `apple/GENEAI`; `com.genaia.app` | Existing sources preserved; configuration aligned |
| macOS packaging repair | `9c1cc7cbb09facff4527a882fc71393b2e6f96b2` | Merged into this integration branch without conflicts |
| Local Tauri lineage | Local base `5a3bb6a`, working package version `0.3.3`; `com.geneai.geneai` | Inspected, not merged or replaced |
| Local library/AI-team/VS Code work | Uncommitted changes in the original local working directory | Remains intact in its original location; not published |
| Alternate web deployments | `geneai-exclusivo` and `geneasearch-ai` | Located; no redirect, deletion or migration performed |

The old shared Supabase project also supports unrelated applications. Do not merge it wholesale, disable it, or import its unrelated migrations.
The local Tauri source advertises a different public origin. Resolve OAuth, CORS, deep links, update manifests and account ownership before changing its active connection.

## Implemented here

`config/geneai-product.json` now declares product identity, canonical origin, dedicated project, version/build, API contract, Apple identity and release readiness.
`scripts/sync-product.mjs --write` generates package/release metadata, public runtime metadata and Swift constants from that contract.
`--check` is read-only and fails on drift. It refuses a different product, legacy origin, shared database, changed native identities and secret client keys.
Web production builds check the contract before invoking Vite. The service worker revision includes the runtime contract.
Apple web views, OAuth callback host validation and release polling now use generated `ProductContract` constants.
The public runtime metadata contains no authentication tokens or private keys.
Candidate `3.0.3` is explicitly marked `integration` with `nativeDistributionReady: false`.
The existing SwiftUI identity and the historical Tauri identity are recorded separately: changing an identifier is not an installer migration.

## Local verification

- New Node product-contract tests: 13 passed.
- Portable Apple configuration and DMG CLI tests: 12 passed.
- No database rows, user accounts, production deployments or installed applications were changed.
- Native compilation was not run: the inspected Mac selects Command Line Tools, not a full Xcode installation.
- An IPA/DMG is not supplied or claimed by this checkpoint.
- Full application test/build outcomes are recorded below after execution.

## Remaining release gates

1. Compare and recover local uncommitted features individually; do not overwrite the main application with the older working tree.
2. Reconcile legacy photo/portrait references and binary attachments using ownership, object paths and checksums; preserve old copies until reads succeed.
3. Compare person/relationship/event records by stable IDs and source provenance, not by record counts or display names alone.
4. Adapt the Tauri client to the common contract without changing `com.geneai.geneai` or blindly copying stored sessions.
5. Decide the supported Apple distribution lineage and test a migration on an existing installation before retiring any installer.
6. Compile and test macOS and iOS/iPadOS with full Xcode; complete signing and distribution checks.
7. Verify real-device login, editing, offline recovery, simultaneous edits, logout and photo access against the same account.
8. Verify legacy OAuth callbacks, links and API consumers before redirecting old web domains.
9. Promote the release only after these checks. Keep rollback and separate preview environments.

## Development priorities
First stabilize data ownership, storage reconciliation, release identity and regression tests.
Then measure before optimizing: initial download, route load time, tree frame time, query latency and error rate.
Use route-level loading, viewport-limited tree rendering and image thumbnails; move expensive graph work off the main interaction thread where profiling supports it.
Sync should use stable identifiers, revision/conflict checks, a durable offline queue and explicit user-visible status.
Research results should retain source URL, archive/reference, exact excerpt, date, confidence and reviewable change proposals.
AI research needs bounded jobs, cancellation, incremental results, deduplication, caching and spending limits; do not treat generated hypotheses as verified facts.
Keep family records private by default; test actual per-account access policies, not merely whether RLS is enabled.
Add device coverage for Safari/WebKit, touch and trackpad gestures, reduced motion, keyboard navigation and text scaling.

## Commands

```sh
node scripts/sync-product.mjs --check
node --test scripts/sync-product.test.mjs
python3 -m unittest discover -s apple/GENEAI/tests -p 'test_*.py'
npm test
npx tsc -b --pretty false
node scripts/build-shared-backend.mjs
```

The portable contract workflow does not require production credentials.
This checkpoint does not claim that all historical files have been recovered, all data have been merged, or the app is investor/distribution ready.
