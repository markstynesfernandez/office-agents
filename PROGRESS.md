# PROGRESS

Last updated: 16/10/2026, about 20:00 Irish time (E3 re-checked for the owner). Plan: `ENGINE-PLAN.md` (approved). Decisions: `DECISIONS.md`.

## Phases done

| Phase | Status |
|---|---|
| Phase 0 (reuse audit) and Phase 1 (read-only 3D viewer) | Done before the engine plan |
| **E1** Rename and jail | Done. Removed StarNet from the UI and identifiers. Added the `data/` root, the `dataJail` write guard and write-guard v2. Deleted `starnet-api.mjs` and the write adapter. Added NOTICE.md. Screenshots in `screenshots/e1/`. |
| **E2** Engine core | Done. Added the store (`node:sqlite`), the append-only ledger, the event bus, the e-stop (page button, CLI and HALT file), the spend guard, the scheduler (croner), the mock providers, the engine and the SSE server. |
| **E3** Port, line and dry run | Done. Ported the owner's station code at two fixed moments (PORTED.md). Added the agent runtime, tools, line orchestrator and package. Dry run: job A reached the approval queue after one QA-DESIGN rework; job B was blocked by originality ("garfield"). Screenshots in `screenshots/e3/01`–`13`. |
| E4 Import | Not started |
| E5 Live UI | Not started |
| E6 First real job | Not started. Blocked on owner answers Q1 (billing), Q2 (caps) and Q3/§4.3 (products). |
| E7 Routines and cut-over | Not started |

Everything so far ran on the mock provider: $0, with no API keys read.

## Half-built

- **Packaged digital products** fail closed. Only the read side of `digital-build` is ported; the clean-up, Real-ESRGAN and zip build are not, and `src/` allows no child process. This affects `pngtuber-prop-pack`, and fixing it needs an owner decision.
- **Style-reference workflow** fails closed. It was added upstream at 19:26 on 16/10. Only `styleRefProblems` is ported; there is no first-file run mode and no `reference_image` in `image_generate`.
- **Approve and reject** exist in `orchestrator.decide()`, but no server route or page button calls them. The server's only write actions are halt and resume (E5).
- **The page's "New task" box** is disabled, and jobs start only from code or the dry run (E5).
- **Routines**: `engine.runRoutine` supports only `line:research`. The research line config exists, but no test or dry run covers it.
- **Live providers** are locked (`ProviderLocked`). The Anthropic SDK is not installed and the effort mapping is not written (E6).
- **Web search and fetch** return canned text in the mock, and the `anthropic-web` price is unset, so a live web call would be refused (E6).
- **Legacy import** (transcripts and task-briefs as a read-only archive, Q10) has not been started (E4).
- **The port is behind the legacy source.** The legacy session changed 4 ported sources after E3 ended (19:50–19:52 Irish time), so they now differ from PORTED.md: `scripts/check-briefs.mjs`, `scripts/lib/demand-evidence.mjs`, `skills/brief-format.md` and `tests/digital.test.mjs`. Together they add a new owner rule: a brief needs at least 5 sourced keywords (`- <phrase> — <source>`), checked by `keywordSourceProblems`. None of this has been re-ported. Both dry-run fixture briefs list their keywords without sources, so they would fail the new rule once it is ported.

## Test status

`npm test`: **167 passed, 0 failed**, 12 suites, at the end of E3.

| Suite | Passed |
|---|---|
| engine-line | 9/9 |
| engine-server | 4/4 |
| guard | 11/11 |
| estop | 8/8 |
| store-backend | 7/7 |
| write-guard | 19/19 |
| model | 15/15 |
| ported/originality | 57/57 |
| ported/etsy-fees | 16/16 |
| ported/digital | 14/14 |
| ported/vat-fees | 6/6 |
| ported/listing-notice | 1/1 |

`npm test` was re-run at 19:54 on 16/10: still 167 passed, 0 failed, with each suite run on its own as above.

`npm run port-drift` (19:54 on 16/10): **4 of 50 sources drifted** (see Half-built). At the end of E3 (19:48) there was no drift. `npm run dry-run` (19:48): exit 0, 0 errors, 56 ledger rows (36 for job A, 20 for job B), all mock, $0.

## Files changed (E1–E3)

There is no git repository, so this list comes from file modification times.

- **Docs and config:** `README.md`, `DECISIONS.md`, `PORTED.md` (new), `PROGRESS.md` (new), `NOTICE.md` (new), `ASSETS.md`, `WRITE-PATH.md`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`
- **Engine:** `src/engine/` is all new: `engine`, `orchestrator`, `runtime`, `guard`, `ledger`, `halt`, `bus`, `scheduler`, `config`, `prompts`, `time`, `tools/index`, `providers/{index,mock}`, `store/{jail,db,active}`, and `lib/` (13 ported modules plus the hand-written `common` and `brief-check`).
- **Server:** `src/server/engine-server.mjs` and `engine-model.mjs` are new. `index.mjs`, `log.mjs`, `model.mjs` and `sources/{files,synthetic}.mjs` changed.
- **Readers:** `src/lib/legacy-readers/` was renamed from `starnet-readers`, and `tracker.mjs` changed.
- **Page:** `src/web/main.js`, `index.html`, `styles.css`, `config/palette.js`, `ui/{board,calendar,format,sidepanel,taskpanel}.js`.
- **Deleted:** `src/server/starnet-api.mjs` and `src/write-adapter/`.
- **Config:** `config/engine.json`, `agents/*.json` (8), `lines/{room1-digital,research}.json`, `office.json`, plus `station.config.json`, `products.json` and `blocklist.txt` copied from the legacy build.
- **Prompts:** `prompts/agents/*.md` (8) and `prompts/skills/*.md` (16), copied unchanged.
- **Fixtures:** `fixtures/engine/products.json`, `station-config-patch.json`, `briefs/*.md` (2) and `mock-script.mjs`.
- **Scripts:** `scripts/dry-run.mjs`, `port-drift.mjs` and `estop.mjs` are new. `screenshots.mjs` and `snapshot-fixtures.mjs` changed.
- **Tests:** `tests/engine-line`, `engine-server`, `guard`, `estop`, `store-backend` and `helpers/engine` are new. `write-guard` and `model` changed. `tests/ported/` holds five ported test files.
- **Generated output:** `dry-run/e3/` (gitignored), `screenshots/e1/` and `screenshots/e3/`.

## Exact next step

Wait for the owner's review of the E3 dry run. On the owner's go-ahead, start **E4 Import**: build `import-legacy` (read-only from `Virtual-workers`, idempotent, backup first) into `data/`, then produce the reconciliation report (counts, and a $ total reconciling with the source). Before starting, the owner should decide whether to re-port the 4 drifted sources at a third moment. Doing so means updating PORTED.md, adding the keyword rule to `brief-check`, giving the fixture briefs sourced keywords and re-running the dry run. Then run `npm run port-drift` and `npm test`.
