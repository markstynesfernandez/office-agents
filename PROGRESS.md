# PROGRESS

Last updated: 16/10/2026, about 21:05 Irish time (E4 in progress). Plan: `ENGINE-PLAN.md` (approved). Decisions: `DECISIONS.md`. Port record: `PORTED.md`.

## Phases done

| Phase | Status |
|---|---|
| Phase 0 (reuse audit) and Phase 1 (read-only 3D viewer) | Done before the engine plan |
| **E1** Rename and jail | Done. StarNet removed from the UI and identifiers; `data/` root, `dataJail`, write-guard v2; `starnet-api.mjs` and the write adapter deleted; NOTICE.md. Screenshots in `screenshots/e1/`. |
| **E2** Engine core | Done. Store (`node:sqlite`), append-only ledger, event bus, e-stop (page button, CLI, HALT file), spend guard, scheduler (croner), mock providers, engine and SSE server. |
| **E3** Port, line and dry run | Done, and **approved by the owner** (16/10/2026). Agent runtime, tools, line orchestrator and package. Job A reaches the approval queue after one QA-DESIGN rework; job B is blocked by originality ("garfield"). Screenshots in `screenshots/e3/01`–`13`. |
| Post-E3 re-port | Done (16/10/2026). The keyword-source rule was ported at a 3rd moment and the enclosed-background change (packaged products) at a 4th. Dry run re-verified. See below. |
| Demo mode | Done (16/10/2026). `npm run demo`, presenter view, `npm run demo:record`. Demo hardening done at the start of E4 (see below). |
| E4 Import | **In progress** (owner go-ahead 16/10/2026). Item 0 (demo hardening) done. Importer built and tested; first import into `data/` reconciled ($8.5000719, 162 rows); second run changed nothing. Next: the legacy rows in the office view, screenshots. |
| E5 Live UI | Not started |
| E6 First real job | Not started. Blocked on owner answers Q1 (billing), Q2 (caps) and Q3/§4.3 (products). |
| E7 Routines and cut-over | Not started |

Everything so far ran on the mock provider: $0, with no API keys read.

### Demo hardening (E4 item 0, 16/10/2026)

- **Demo values stay in the demo engine.** `createEngine` now refuses to start when its config holds any DEMO value (the word DEMO in capitals anywhere in the station config or a product, or a `demo-` product key; `demoMarkers()` in `src/engine/config.mjs`), unless it is started with `demo: true`. Only `scripts/demo.mjs` passes that flag, and a demo engine refuses the station data root (`data/` or `STATION_DATA_ROOT`). A new test checks this statically (only `scripts/demo.mjs` names the demo patch, reads `demo/products.json` or passes `demo: true`) and at runtime (the demo overrides, a DEMO value copied into `station.config.json` and the demo product copied into `products.json` are each refused before the store opens; the real config has no marker).
- **Research desks show "working".** Checked on the real page at 4x: DEMAND-RESEARCHER and EVIDENCE-CHECKER show `working · brief pass 1` while their runs are live (a few samples lag by one debounced refresh at the edges). No status change was needed; a new test asserts the desk status at every research `run.start` and `run.end`.
- **End caption.** With the side panel open the caption now wraps to two lines (balanced) instead of being cut off with an ellipsis (`src/web/styles.css`). Checked at 1600x1000: the end caption shows in full on two lines.
- Tests: 177/177.

### Demo mode (16/10/2026)

- **`npm run demo`** (`scripts/demo.mjs`) starts the real engine on the mock provider on `data-demo/`, which is wiped and rebuilt on each start and restart. Its jail roots are `data-demo/` and `logs/` only. It refuses to start with provider keys in the environment or a non-mock `STATION_PROVIDER`, and it does not read `.env`. Port 8791. The day starts when a page connects.
- **The scripted day** (`demo/script.mjs`, timing in `demo/pacing.json`) lasts 176 s of demo time at 1x:
  - The research batch: DEMAND-RESEARCHER drafts the brief, EVIDENCE-CHECKER verifies it, and the brief check moves it to `research/briefs/`.
  - Job B runs at the same time on the Room 1 line. The image prompt naming the character is refused, the prep originality screen trips, the job goes back once, the screen trips again, and the job ends blocked at prep with the reason.
  - Job A follows straight after: one QA-DESIGN rework, then approved, LISTER, QA-LISTING approved, the package gate passes, and the job lands in the approval queue.
  - The ledger has 71 rows, all mock, $0.
- **Deviation from the spec, by the owner's decision:** job B ends **blocked at prep**, not at REJECTS-DESK. This is the real line's routing, with no change. "In parallel" means the research line runs alongside job B, with one job per line (Q12). See DECISIONS.md.
- **Page:**
  - The presenter view (`src/web/ui/presenter.js`; P toggles it, and it is on by default in demo mode) has a camera tour with a 3 s hold, a caption strip built from engine events, and money hidden. Money goes through `format.money()`/`price()` and a DOM scrub as a safety net.
  - There is a "DEMO · simulated data" badge and a pause/speed chip. The keys are Space, 1/2/4 and R.
  - The job panel now shows the approval-queue row.
  - The snapshot gained `lastStage` and `productFiles`. The engine server gained an `ext` hook (demo actions behind the same origin, token and JSON checks) and `handler`/`dispose`.
- **`npm run demo:record`** (`scripts/demo-record.mjs`) records headed Chrome at 1600x1000 to `screenshots/demo/station-demo.webm` and takes 4 stills. The 1x take on 16/10/2026 runs 3:07 (186.7 s, 35.9 MB): the demo day is 167 s, then the closing views of the board, calendar and approval queue. No .mp4 is made, because no pinned, licence-checked converter can write MP4 (ASSETS.md).

### Post-E3 re-port (16/10/2026)

- **3rd moment, 2026-10-16T18:58:15Z (19:58 Irish time):** `scripts/check-briefs.mjs`, `scripts/lib/demand-evidence.mjs`, `skills/brief-format.md` and `tests/digital.test.mjs`. These add the owner's keyword-source rule: a brief fails with fewer than 5 sourced keywords, each written `- <phrase> — <source>`. `brief-check` (the line's intake and the research brief check) runs it after demand evidence, as the source does, and the intake stage now says "keyword sources". Both dry-run fixture briefs now list 5 keywords. Each has a placeholder Etsy search URL under `## Sources`, marked "FIXTURE placeholder keyword source … (not opened, no real figures)".
- **4th moment, 2026-10-16T19:04:02Z (20:04 Irish time):** at 20:02 the legacy session changed `scripts/lib/digital-build.mjs`, `scripts/lib/digital-gate.mjs` and `config/station.config.json`. This is an owner change for packaged products: an enclosed background-like region, such as a mug's handle hole, is made transparent and re-checked. On the ported read side of digital-build, only `BUILD_VERSION` changed (2 to 3). digital-gate gained the matching package-gate check. The config was copied unchanged. Packaged products still fail closed at prep in the engine, so this changes nothing in the dry run.
- **`npm run port-drift` afterwards: no drift, all 50 sources match.** When checked, nothing in the legacy station folder had changed after the 4th moment. The legacy session is still active, so drift may come back; run port-drift before each phase.

## Git

The repository was initialised on 16/10/2026 on branch `main`. Each milestone gets a commit.

- `8d55a57`: E1–E3 complete (mock engine, dry run passing)
- The next commit: the keyword-source re-port and the re-verified dry run, including this file

`.gitignore` excludes `data/`, `data-demo/`, `dry-run/`, `fixtures/`, `screenshots/`, `.cache/`, `logs/`, `*.log`, `.env` and `node_modules/`. `core.autocrlf` is false in this repository, so files are committed byte for byte. Before the first commit, the staged files were scanned: they contained no ignored paths, no key or token patterns and no email addresses.

**Open point for the owner:** because `fixtures/` is ignored, the repository does not hold `fixtures/engine/`. That folder contains the synthetic dry-run fixtures: the FIXTURE product, the config patch, the briefs and the scripted mock replies. A fresh clone therefore cannot run `tests/engine-line.test.mjs` or `npm run dry-run`. The legacy snapshot (`fixtures/station-root/`, `SNAPSHOT.json`) should stay out. If the owner agrees, un-ignore only `fixtures/engine/`.

## Half-built

- **Packaged digital products** fail closed. Only the read side of `digital-build` is ported. The clean-up (now including the enclosed-background step), Real-ESRGAN and the zip build are not, and `src/` allows no child process. This affects `pngtuber-prop-pack`, and fixing it needs an owner decision.
- **Style-reference workflow** fails closed. Only `styleRefProblems` is ported; there is no first-file run mode and no `reference_image` in `image_generate`.
- **Approve and reject** exist in `orchestrator.decide()`, but no server route or page button calls them. The server's only write actions are halt and resume (E5).
- **The page's "New task" box** is disabled, and jobs start only from code or the dry run (E5).
- **Routines**: `engine.runRoutine` supports only `line:research`. The research line config exists, but no test or dry run covers it.
- **Live providers** are locked (`ProviderLocked`). The Anthropic SDK is not installed and the effort mapping is not written (E6).
- **Web search and fetch** return canned text in the mock, and the `anthropic-web` price is unset, so a live web call would be refused (E6).
- **Legacy import** (transcripts and task-briefs as a read-only archive, Q10) has not been started (E4).

## Test status

`npm test`: **175 passed, 0 failed** in 13 suites, after demo mode (16/10/2026, about 20:45 Irish time). Before demo mode it was 168/168, and `npm run port-drift` showed no drift.

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
| ported/digital | 15/15 (one more: the keyword-source test) |
| ported/vat-fees | 6/6 |
| ported/listing-notice | 1/1 |
| demo | 7/7 (new: key refusal in-process and as `node scripts/demo.mjs`, mock only, jail, clock, the scripted day, token-checked controls and restart) |

`npm run dry-run` (after the 4th moment): exit 0, 0 errors, 56 ledger rows (36 for job A, 20 for job B), all mock, $0.
- Job A, `2026-10-16--dry-run-mushroom-stickers`: state `approval`, approval `pending`. QA-DESIGN asked for a revise on pass 1 and approved pass 2. The package gate passed. `cost.json` has 36 rows, mock, `totalUsd` 0.
- Job B, `2026-10-16--dry-run-astronaut-cat-stickers`: state `blocked` at prep. Reason: `prep failed again after one retry: ORIGINALITY HARD FAIL in set-v2/design.md: design.md: "garfield" matches characters "garfield"`.

## Files changed (E1–E3)

Git history starts at `8d55a57`, which holds everything from E1–E3. There was no repository before that.

- **Docs and config:** `README.md`, `DECISIONS.md`, `PORTED.md`, `PROGRESS.md`, `NOTICE.md`, `ASSETS.md`, `WRITE-PATH.md`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`
- **Engine:** `src/engine/` is all new: `engine`, `orchestrator`, `runtime`, `guard`, `ledger`, `halt`, `bus`, `scheduler`, `config`, `prompts`, `time`, `tools/index`, `providers/{index,mock}`, `store/{jail,db,active}`, and `lib/` (13 ported modules plus the hand-written `common` and `brief-check`).
- **Server:** `src/server/engine-server.mjs` and `engine-model.mjs` are new. `index.mjs`, `log.mjs`, `model.mjs` and `sources/{files,synthetic}.mjs` changed.
- **Readers:** `src/lib/legacy-readers/` was renamed from `starnet-readers`, and `tracker.mjs` changed.
- **Page:** `src/web/main.js`, `index.html`, `styles.css`, `config/palette.js`, `ui/{board,calendar,format,sidepanel,taskpanel}.js`.
- **Deleted:** `src/server/starnet-api.mjs` and `src/write-adapter/`.
- **Config:** `config/engine.json`, `agents/*.json` (8), `lines/{room1-digital,research}.json`, `office.json`, plus `station.config.json`, `products.json` and `blocklist.txt` copied from the legacy build.
- **Prompts:** `prompts/agents/*.md` (8) and `prompts/skills/*.md` (16), copied unchanged.
- **Scripts:** `scripts/dry-run.mjs`, `port-drift.mjs` and `estop.mjs` are new. `screenshots.mjs` and `snapshot-fixtures.mjs` changed.
- **Tests:** `tests/engine-line`, `engine-server`, `guard`, `estop`, `store-backend` and `helpers/engine` are new. `write-guard` and `model` changed. `tests/ported/` holds five ported test files.
- **Local only (gitignored):** `fixtures/engine/` (the dry-run fixtures), `dry-run/e3/`, `screenshots/e1/` and `screenshots/e3/`.

The post-E3 re-port changed:
- `PORTED.md`
- `src/engine/lib/{demand-evidence,brief-check,digital-build,digital-gate}.mjs`
- `src/engine/orchestrator.mjs` (the intake stage label)
- `prompts/skills/brief-format.md`
- `config/station.config.json`
- `tests/ported/digital.test.mjs`
- local only: `fixtures/engine/briefs/*.md`

## Exact next step

1. **The owner reviews demo mode** (the video and stills in `screenshots/demo/`).
2. **E4 Import:** build `import-legacy` into `data/`. It reads `Virtual-workers` only, is idempotent and takes a backup first. Then produce the reconciliation report: counts, and a $ total that reconciles with the source.

Before each, run `npm run port-drift` and `npm test`, and commit at the milestone.
