# REUSE.md — StarNet reuse audit for station-office (Phase 0)

Audit date: 2026-10-16. Read-only inspection of `C:\Users\marks\projects\Virtual-workers`. Nothing was written there, no StarNet endpoint was called, no browser was opened. Route list comes from the sidecar source, not from probing.

Classification key used throughout:

| Class | Meaning |
|---|---|
| **(a)** | read directly as a live data source (file or, later, a read-only route) |
| **(b)** | reuse as shared types / schemas / config (shapes, names, paths, stage order) |
| **(c)** | reuse code by importing or copying (your own code only; third-party noted with licence) |
| **(d)** | not reusable, with the reason |

---

## 1. What the build is

Three parts under `Virtual-workers/`:

| Part | What it is | Who wrote it | Licence |
|---|---|---|---|
| `starnet/` | Upstream StarNet clone, v0.13.2, pinned commit `54899e5` (androoAGI/starnet). Two working-tree edits: `sidecar/index.js` and `sidecar/tools/builtin/image.js`, which are your `station/patches/starnet-openrouter-media-key.patch`. | Andrew Sims (third party) | MIT for the code. README states the StarNet name, logo, station artwork and sprites are **not** licensed. `NOTICE.md` lists third-party skill recipes (MIT / Apache-2.0). |
| `station/` | Your own code: 30 scripts, 23 lib modules, 15 tests, config, 8 agent prompt sources, 14 skill files, 5 room definitions, 4 OFL fonts, the StarNet patch. | You | Yours. Only dependency is `sharp` 0.34.5 (Apache-2.0). Fonts are SIL OFL with the licence file beside each. |
| `station-workspace/` | Runtime data (gitignored): StarNet's data root `starnet/`, the three blessed project folders, approval queue, rejected, tracker, logs. | Produced by StarNet and your scripts | Data, not code. Contains agent prompts, job files, prices and margins. No guest or client PII; it is a personal venture with no Stellar data in it. |

Runtime facts: StarNet runs as `node --env-file=../.env sidecar/index.js` from `starnet/`, one Node process on `127.0.0.1:8787`, serving HTTP plus SSE. Node on this machine is v24.16.0. Your `.env` holds `SKYNET_WORKSPACES`, `SKYNET_API_TOKEN`, `PORT`, budget caps and the idle-cost switches; provider keys live in StarNet Settings under `station-workspace/starnet/.secrets/` (never read). StarNet was not running during the audit. A `print-check --watch` Node process was running (it writes to `station-workspace/logs/`).

---

## 2. Inventory and classification

### 2.1 Agent roster

**Where:** `station-workspace/starnet/agent.roster.json` is StarNet's server-side roster mirror (`{version, updatedAt, agents[]}`; each agent has `agentId, name, model, provider, role, approvalMode, executionProfile, skills, reasoningEffort, track, system`). The frontend owns the roster and pushes it with `POST /api/roster`. `agent.save.json` (`doc.agents[]`, `doc.agent` = the hero record) is the frontend's save mirror.

| agentId | name (StarNet form) | model | provider |
|---|---|---|---|
| `openclaw` | DEMAND-RESEARCHER | claude-haiku-5-5 | anthropic |
| `openclaw-2` | EVIDENCE-CHECKER | claude-haiku-5-5 | anthropic |
| `openclaw-3` | DESIGNER | claude-haiku-5-5 | anthropic |
| `openclaw-6` | QA-DESIGN | claude-sonnet-5-5 | anthropic |
| `openclaw-4` | LISTER | claude-haiku-5-5 | anthropic |
| `openclaw-7` | QA-LISTING | claude-sonnet-5-5 | anthropic |
| `openclaw-5` | REJECTS-DESK | claude-haiku-5-5 | anthropic |
| `openclaw-8` | STATION-OVERSEER | claude-sonnet-5-5 | anthropic |
| `agent` | BRIDGE (hero, retired) | anthropic/claude-haiku-5.5 | openrouter (see discrepancy D1) |

**Class: (a)** read `agent.roster.json` live. **(b)** the `agentId → name` map and the name normalisation rule (StarNet hyphenates imported names: "QA LISTING" becomes "QA-LISTING"; your `cost.mjs` compares on letters and digits only). **(c)** copy `rosterNames()` / `idsForNames()` from `station/scripts/lib/cost.mjs` and `isHero` / `activeAgents` from `station/scripts/lib/retire-bridge.mjs` (three one-liners). The `system` field (8–18k chars per agent) is the prompt: **(d)** for display, not needed.

### 2.2 Departments (rooms)

**Where:** StarNet's own save, `agent.save.json` → `doc.station.rooms` and `doc.station.props`. Rooms are named rectangles in tile units; `desk` props carry an `agentId`; a desk is in the room whose rect contains its `x,y`:

| Room (StarNet) | Rect | Desks (agent) |
|---|---|---|
| r1 RESEARCH | (0,0)–(17,10) | p20 DEMAND-RESEARCHER, p19 EVIDENCE-CHECKER, p15 unassigned |
| r12 DESIGN | (6,11)–(12,15) | p21 DESIGNER, p22 QA-DESIGN |
| r13 OFFICE | (18,3)–(25,8) | p24 LISTER, p23 QA-LISTING, p25 REJECTS-DESK, p26 STATION-OVERSEER, p27 BRIDGE (retired) |
| r32 HAB-32 | (26,3)–(63,24) | no desks: holds the Room 1 line's five `bay` props (docks) |

That is exactly the department split in the spec. Your `station/config/station.config.json` `floorRooms` declares the same split (RESEARCH / DESIGN / OFFICE with desk lists) and `verify-floor.mjs` proves the live floor matches it.

**Class: (a)** derive membership from the save (rooms + desk props, point-in-rect; no StarNet code needed). **(b)** `floorRooms` in your config as the cross-check; if the two ever disagree, show the disagreement rather than pick one. Room colours, floor materials and sprites in the save are StarNet's visual layer: **(d)**, we use our own palette.

Note: `routing.plan.json` `dockBays` gives the same props in a second coordinate frame (offset by +3,+3 from the save). Use the save for rooms, the plan for the line.

### 2.3 Job model and stages

**Where:** `station-workspace/starnet/routing.plan.json` is StarNet's compiled line. One line, `p33`, project root `room1-etsy`, limits `maxHops 12, maxUsdPerMessage 1, maxUsdPerDay 10`:

```
intake p33 ─► p34 DESIGNER ─► p35 QA-DESIGN ─┬─(approved)─► p41 LISTER ─► p42 QA-LISTING ─► outbox p37
                 ▲               │ loop max 2 │                   ▲            │ loop max 1
                 └── back ───────┘            └─ esc ─► p38 REJECTS-DESK ─► outbox p40 (rejects)
                                                            (back ◄────────────┘ to LISTER)
```

`dockChains` gives `dock → next docks`, `junctions` the two loop gates (max passes, `backTo`, `escTo`, `when: approved`), `lines[].agents` the five line agents. The research stage (DEMAND-RESEARCHER → EVIDENCE-CHECKER → `research-lab/briefs/`) is **not** a StarNet line: it runs as chat sessions or the two paused routines and lands as files. Packaging (`collect-outbox.mjs` → `approval-queue/`) and the owner's decision (tracker) are your scripts, outside StarNet.

Human stage labels live in `station/rooms/etsy-pod/room.json` (`designer, qa-design, lister, qa-listing, outbox, rejects-desk`) and the pipeline summary in `station/README.md`.

**Class: (a)** read `routing.plan.json` for the line order, gates and limits; the stage label is the agent name at that dock (from the roster), so no stage list is duplicated. **(b)** `room.json` for the labels of the two non-StarNet stages (brief, approval queue) and the gate semantics. Board columns for the spec's "brief → design → QA → listing → approval queue" become: `brief` (research-lab), `design` (p34), `qa-design` (p35), `listing` (p41), `qa-listing` (p42), `approval queue` (your folder), plus `rejects` (p38) as a side lane. See §4 for the single-source-of-truth answer.

**Job identity:** the listing id `YYYY-MM-DD--slug[-rN]` (`LISTING_ID_RE` in `common.mjs`) is the job key everywhere: brief file name, `work/<id>/`, `outbox/<id>/`, `approval-queue/<id>/`, tracker row. StarNet's own `line-jobs` (`GET /api/line-jobs`, `lineJobs` store) and `streamId` (`trigger-…`, `steptest-st_…`) are the runtime view of the same work; runs carry `lineId` and `dockId`.

### 2.4 `station-workspace/room1-etsy/work/<job-id>/` (and `outbox/<id>/`)

Per job (13 job folders now, plus `_aborted-trigger-20261015/`):

| File | Written by | Use in the office |
|---|---|---|
| `brief.md` | run-line / Designer | title, niche, price range (front-matter: id, date, status, product_type, design_style) |
| `design-vN.md`, `design-vN.png` | DESIGNER (typeset script for text-led) | design notes; the print file (4500×5100 for text-led) |
| `illustration-vN.png`, `design-vN.slogan.json` | DESIGNER (text-led) | the model's illustration; slogan options and the pick |
| `derived/design-vN.check.json`, `.typeset.json`, `.padded.png` | print-check / typeset | print-readiness result, ink-contrast colours, typeset record |
| `qa/design-passN.json` | QA-DESIGN | verdict per pass (`approved` / `revise`), checks, reasons |
| `qa-listing/passN.json` | QA-LISTING | verdict per pass |
| `owner-approvals.json` | you | owner approvals carried into the listing |
| `REJECTED.md` | REJECTS-DESK or you | why it stopped |
| `rerun-archive-<stamp>/` | rerun-listing | archived listing files |
| `outbox/<id>/listing.json`, `listing.md`, `qa-design.json`, `qa-listing.json` | LISTER / QA agents | the latest listing and the final verdicts |

**Class: (a)** read directly. **(b)** the JSON shapes (`{stage, listingId, pass, verdict, designFile, checks{…}, reasons[], reviewer}`; `listing.json` with `title, tags[], description, altText, ownerTodo[], priceSuggestion, listingPriceEur, variantPricesEur[], marginEstimate`). **(c)** copy `designPasses(workDir)` and `briefUsdRange(text)` from `lib/gates.mjs` and `latestIllustration()` from `lib/design-prep.mjs` (pure, small). Job stage can be inferred from which files exist (brief only → design; `qa/design-passN` → qa-design; `outbox/listing.json` → listing; `outbox/qa-listing.json` → qa-listing; `approval-queue/<id>` → approval queue; `REJECTED.md` → rejected) and from the tracker status.

Design images for the DESIGNER and QA-DESIGN monitors: `design-vN.png` / `illustration-vN.png` are 1024 px to 4500×5100 (up to 26 MB in the queue). The office server should serve downscaled thumbnails from its **own** cache folder, never by writing into `station-workspace/`. `sharp` (Apache-2.0) is the obvious tool; it goes into ASSETS.md if used.

### 2.5 Approval queue, rejected, tracker

`station-workspace/approval-queue/<id>/` (1 package now): `MANIFEST.json` (`collectedAt, gates{qaDesign,qaListing,designPasses,etsyLimits,blocklist}, costUsd, upscale{…}, variantPrices[], allowedShirtColours, ownerTodo, inputHash`), `cost.json` (ledger rows with workings, `aiPerAgentUsd`, production costs), `listing.json/md`, `qa-design.json`, `qa-listing.json`, `qa-history/`, `print-check.json`, `print-<product>.png`, `design-original.png`, `variant-prices.json`, and for text-led designs `illustration-original.png`, `slogan.json`, `typeset.json`.

`station-workspace/rejected/<id>/` (3 now): the same package plus `REJECTED.md`.

`station-workspace/tracker/listings.csv`: one row per listing id, 21 fixed columns, status one of `packaged | blocked | approved | rejected_by_owner | published | retired`, plus `status_reason`, `cost_usd`, dates. Today: 11 rows (7 blocked, 3 rejected_by_owner, 1 approved).

**Class: (a)** read directly. "Approval queue size" = folders with a `MANIFEST.json` whose tracker status is `packaged` (owner decision pending). **(c)** copy `readTracker()` and its CSV parser from `lib/tracker.mjs` (pure); **not** `upsert`/`writeTracker`. `package-report.mjs` is read-only and shows how the package files combine; reuse its reading logic, not its console output.

### 2.6 Research lab

`station-workspace/research-lab/`: `drafts/<date>/*.md` (candidate briefs), `briefs/*.md` (verified; 14 now), `rejected/` (empty), `products.json`. Brief front-matter: `id, date, status (candidate|verified), product_type, design_style`, body sections `# Niche`, `## Buyer persona`, `## Keywords`, `## Price range`, `## Seasonality`, `## Design direction`, `## Risks`, `## Evidence check`.

**Class: (a)** briefs count = "briefs produced"; "evidence checks passed" = files in `briefs/` with `status: verified` (and `rejected/` for failures). **(b)** the front-matter shape. Note that `briefs/` is also the **line trigger** when StarNet runs with the folder trigger enabled; the office must only ever read it.

### 2.7 Cost and spend

| File | Shape | Use |
|---|---|---|
| `starnet/ledger.jsonl` (147 rows) | one line per finished run or sub-call: `{runId, agentId, turns, usd, tokens, model, unmetered, ts, entryId}` | today's spend per desk and department; hub entry count; per-job cost by time window (as `cost.json` does) |
| `starnet/runs.jsonl` (101 rows) | one line per finished run: `runId, agentId, provider, reason, turns, tokens, usd, title, streamId, projectRoot, model, artifacts[], toolsOk, surface, toolTrace[], failureStage, failureCode, completionEvidence, startedAt, endedAt, durationMs, ts, lineId, dockId, stepTest` | recent jobs per desk, last output (artifacts with paths), elapsed time, errors (`reason` ≠ `done`, `failureCode`), activity lines (tool names: `web_search`, `web_fetch`, `image_generate`, `image_analyze`, `fs_*`) |
| `starnet/line-spend.json` | `{lines:{p33:{day, usd}}}` (day = days since epoch) | line spend today vs `maxUsdPerDay` |
| `starnet/budget.json` | `{caps:{perRun 1, perAgent 0, perDay 10, global 0}}` | cap display |
| `starnet/.spend-pending/` | dispatch receipts for runs in flight (empty when idle) | **likely** a file-only "working" signal; verify in Phase 2 |
| `starnet/diag.errors.json` | `[{ts, message, runId}]` | error status per desk via `runId → agentId` |

Ledger `ts` is epoch ms; the ledger is token cost only (image generation is billed on OpenRouter and is not in it, per `USAGE.md`). StarNet's own "day" for caps is a trailing 24 h window; your scripts use the owner's calendar day. Show the calendar day and label it.

**Class: (a)** all of the above. **(c)** copy `readLedger()` and `costInWindow()` from `lib/cost.mjs`. StarNet's `sidecar/ledger.js` and `runstore.js` (MIT) are not worth importing: they need StarNet's injected IO and the files are plain JSONL.

### 2.8 Routines, triggers, hooks

- `starnet/cron.jobs.json`: 2 routines ("Research Lab: demand researcher (manual run)", "… evidence checker (manual run)"), `schedule.expr "0 9 * * 1"`, `enabled false`, `state paused`, `nextRunAt null`, `workdir` = research-lab, `agentId`, `lastRunAt`, `lastStatus`, `lastUsd`. **(a)** this is the calendar's "routines" sidebar: schedule, owner agent, next run. "Waits for my OK" = `enabled:false` (never armed). Created by your `create-research-routines.mjs` through `POST /api/cron`.
- `starnet/triggers.json`: 1 folder trigger on `research-lab/briefs` for line p33, `enabled false`, `fires 12`, `lastError`, `lastOutcome{usd, agentId, source}`. **(a)** show as disabled; it is the thing that bit you on 2026-10-15.
- `starnet/hooks.json` + `hooks-allowed.json`: two `pre_llm_call` shell hooks (`station-price-fill` → `scripts/price-hook.mjs`, `station-design-compose` → `scripts/design-hook.mjs`), both approved 2026-10-15. **(a)** read for a "hooks live" indicator. The hook scripts themselves are **(d)** for the office (they run inside StarNet's agent path), but note they write into `work/<id>/` during runs, so file mtimes change while a job is in flight.

### 2.9 Memory, transcripts, checkpoints (the "hub")

StarNet has no single shared ledger that agents read. What exists:

- Per-agent notebooks `starnet/<agentId>.notebook.json` (DEMAND-RESEARCHER, EVIDENCE-CHECKER, DESIGNER have records; others empty or absent). Each record: `{id, kind, title, body, scope, projectRoot, sourceRunId, createdAt, lastUsedAt, useCount, trust, pinned}`. `lastUsedAt`/`useCount` are StarNet's own reduction of `memory.used` events.
- `starnet/transcript-history-v2/` (`manifest.json` + `segment-000001.jsonl`, about 1,200 turns `{streamId, agentId, role, content, ts, rowId}`): the last `assistant` turn per agent is the "last output summary".
- `starnet/.checkpoints/<agentId>/index.json`: fs-mutation snapshots per run (git commits of the work tree).
- `starnet/task-briefs.json`: settled task briefs with assumptions and sources.

**Proposal for the hub:** "Station memory" = all notebook records across agents (entry count) with "last recalled by DESIGNER at 21:18" from the newest `lastUsedAt`, plus the ledger row count and last entry. Clicking opens a viewer over the notebooks and the ledger. **Class (a)**; none of it needs StarNet code. Flag: the spec's "last read by <agent>" for a *shared* file cannot be derived for arbitrary files because `runs.jsonl` tool traces record read sizes, not paths (writes do carry paths).

### 2.10 Logs

`station-workspace/logs/<YYYY-MM-DD>/<script>/run-HHMMSS-<pid>.log`, JSON lines `{ts, level, script, msg, data}` (token redacted), plus `print-check-watch.out`. **(a)** optional activity feed for the station scripts. **(c)** copy the `makeLogger` pattern from `common.mjs` but **re-root** it to station-office's own log folder (as written it logs into `station-workspace/logs/`, which the office must never write).

### 2.11 Config and shared types in `station/`

| Item | Class | Notes |
|---|---|---|
| `config/station.config.json` | **(b)** | `paths.*` (every folder the office reads), `caps`, `models` (ids, tiers, list prices), `agents[]` (key, name, tier, room, gear), `floorRooms`, `fx`, `providerSwitchedAt`, `imagePolicy`, `market`. Read it live rather than copying values; it is your declaration layer over StarNet. |
| `rooms/etsy-pod/room.json`, `products.json`, `blocklist.txt` | **(b)** | stage labels and gate semantics; product keys and print sizes; blocklist not needed in the viewer |
| `rooms/affiliate-blog|game-assets|thumbnails/room.json` | **(d)** | scaffolds, "not wired, no agents" |
| `agents/src/*.md`, `agents/import/*`, `skills/*.md` | **(d)** | prompts; the viewer shows `role` from the roster and could list skill names from the `skills:` front-matter **(b, optional)** |
| `docs/*`, `HANDOFF.md`, `README.md`, `USAGE.md`, `PUBLISH-SHEETS.md` | **(d)** | reference only; they hold prices and margins (internal) |
| `fonts/*` (Anton, Bebas Neue, Alfa Slab One, Archivo Black, OFL) | **(d)** for v1 | usable later for monitor canvas text if wanted; OFL allows it, but Three.js needs no specific font |
| `patches/*`, `tools/realesrgan/*` | **(d)** | StarNet patch and the local upscaler binary |

### 2.12 Code in `station/scripts` and `station/tests`

| Module | Class | What to take |
|---|---|---|
| `lib/common.mjs` | **(c)** partial | `loadEnv`, `readJson`, `writeIfChanged` (for the office's own cache), `LISTING_ID_RE`/`isListingId`, `today()`. **Not** `api()`: it is a token-bearing client that can POST; the office server gets its own GET-only client. `ROOT`/`STATION` path constants must be replaced by an env-configured root. |
| `lib/cost.mjs` | **(c)** | `readLedger`, `rosterNames`, `idsForNames`, `costInWindow` (pure reads) |
| `lib/tracker.mjs` | **(c)** | `readTracker`, `COLUMNS`, `STATUSES`, CSV parsing. Not the writers. |
| `lib/gates.mjs` | **(c)** partial | `designPasses`, `briefUsdRange`. `checkPackage` drags in fees, ink-contrast, text-led and slogan modules and `config`; v1 reads gate results from `MANIFEST.json`/tracker instead. |
| `lib/retire-bridge.mjs` | **(c)** | `HERO_ID`, `isHero`, `activeAgents`, `rosterList` |
| `lib/design-prep.mjs` | **(c)** | `latestIllustration` |
| `lib/text-routing.mjs`, `scripts/verify-floor.mjs` | **(c)** optional | read-only checks for a "routing OK / patch present / floor OK" badge. `verify-floor` requires `starnet/sidecar/capability/saved-placement.js` (MIT, Andrew Sims); importing StarNet code couples the office to the pinned clone, so prefer re-reading the save as in §2.2. |
| `lib/run-line.mjs`, `lib/rerun-listing.mjs`, `scripts/run-line.mjs`, `scripts/rerun-listing.mjs` | **(d)** in v1; **reference for WRITE-PATH.md** | state-changing: `POST /api/routing/steptest`, writes `work/<id>/brief.md`. This is the job-creation mechanism (§5). |
| `lib/research-routines.mjs`, `scripts/create-research-routines.mjs` | **(d)** in v1; **reference for WRITE-PATH.md** | `planRoutines` is pure and builds the `POST /api/cron` body with `enabled:false`; the routine-creation mechanism (§5) |
| `collect-outbox.mjs`, `fill-variant-prices.mjs`, `typeset.mjs`, `upscale.mjs`, `print-check.mjs`, `price-hook.mjs`, `design-hook.mjs`, `install-price-hook.mjs`, `seed.mjs`, `set-caps.mjs`, `sync-agent-prompts.mjs`, `switch-provider.mjs`, `retire-bridge.mjs`, `smoke-test.mjs`, `guardrail-test.mjs`, `update-tracker.mjs`, `build-price-floor.mjs` | **(d)** | all write into `station-workspace/`, `station/`, or call state-changing routes |
| `package-report.mjs`, `check-briefs.mjs`, `price-ladder.mjs` | **(c)** optional | read-only reporters; their file-reading is the model for the office's package and brief views |
| `tests/*.test.mjs`, `tests/helpers/room.mjs` | **(c)** pattern | `node --test` + `node:assert/strict`, temp dirs for fixtures. The write-guard test will follow this pattern. |

### 2.13 Existing UI

- StarNet's frontend (`starnet/frontend/`, ~250 files, canvas pixel-art station, `deskscreen.js`, `world.js`): **(d)**. The code is MIT but the artwork and sprites are not licensed, the spec wants our own design, and the frontend owns the roster (opening it is what overwrote your prompts).
- `station/` has no UI of its own; its outputs are CLI reports and markdown. **(d)** beyond the reading logic noted above.

### 2.14 StarNet code (`starnet/sidecar`, `starnet/shared`)

MIT, third party. Candidates would be `shared/events.js` (event names such as `agent.run.start`, `agent.tool_call`, `agent.run.end`, `budget.threshold`, `cron.fire`, `permission.prompt`) for a future SSE consumer, `sidecar/capability/saved-placement.js` and `station-store.js` for room scoping. **Recommendation: (b) only.** Note the event names as a schema; do not import StarNet modules into station-office. Reasons: `index.js` is 26k lines of composition root, the modules need StarNet's injected IO, and a dependency on the pinned clone would break on upgrade. Every fact we need is in plain JSON/JSONL files.

---

## 3. StarNet API routes

Source: the route table in `starnet/sidecar/index.js` (lines ~10990–11455), 361 unique method+path entries, plus 9 regex or direct-match families named from their handlers. Full list in Appendix A.

**Auth (from `sidecar/apiauth.js`):** every `/api/*` call needs the per-launch token in the `x-starnet-token` header (legacy `x-skynet-token` accepted); exempt: `/api/key`, `/api/channels/token`, `/api/health`, `/api/spotify/callback`, `/api/connectors/oauth/callback`. Host must be loopback; cross-origin browser calls are refused; the token in a query string is refused everywhere. A Node process with the header (your `common.mjs api()` pattern) is a first-class client. The token is in your `.env` as `SKYNET_API_TOKEN`; the office server would read it from its own env file and never pass it to the page.

**Counts:** 124 read-only (R), 13 unsure (W?, POST but preview/scan/probe), 233 state-changing (W).

**Routes the station scripts actually use** (all W unless noted): `GET /api/cron` (R), `POST /api/cron`, `POST /api/cron/update`, `GET /api/hooks` (R), `POST /api/hooks/allow`, `POST /api/routing/steptest`, `GET /api/routing/steptest/<id>` (R), `POST /api/routing/steptest/<id>/continue|stop`, `GET /api/budget/status` (R), `POST /api/budget/caps`, `POST /api/run`, `POST /api/personalization`.

**Read-only routes the office could use in Phase 2, if you approve live reads** (otherwise files only):

| Route | Gives | Why it beats the file |
|---|---|---|
| `GET /api/health` | `ok` / 503 text, token-exempt | "StarNet online" light |
| `GET /api/version` | build surface | runtime label |
| `GET /api/state/snapshot` | runs in flight `{runId, agentId, startedAt, source, stoppable}` | the only clean "working now" signal; files show finished runs |
| `GET /api/runs?agent=*&limit=…` | run history with children | same as `runs.jsonl`, paged |
| `GET /api/budget/status` | caps, spent today, pools | StarNet's own day window |
| `GET /api/line-jobs`, `GET /api/routing/lines/stats`, `GET /api/routing/steptest`, `GET /api/routing/triggers` | line jobs, per-line stats, latest step-through, triggers | live line view |
| `GET /api/cron`, `GET /api/cron/history?id=` | routines and their run history | same as `cron.jobs.json` plus history |
| `GET /api/providers` | provider list with `configured` booleans, no keys | service status icons |
| `GET /api/channels/status`, `GET /api/hooks`, `GET /api/projects`, `GET /api/halt` | booleans | top-bar status |
| `GET /api/notebook?agent=`, `GET /api/memory/records?agent=`, `GET /api/transcript?agent=&stream=`, `GET /api/task-briefs` | memory and transcripts | same as files |
| `GET /api/channels/events` (SSE) | the live event bus (`agent.run.start`, tool calls, `budget.threshold`, …) | push instead of polling; read-only, holds a connection |

Flags: `GET /api/runtime/agent` answers for provider `openrouter` only and must not be used as "the runtime". `GET /api/model-tiers`, `/api/models/<provider>`, `/api/credits*`, `/api/update/status`, `/api/skill-market` reach the network or StarNet's cloud even though they are GETs. `GET /api/spotify/callback` and `GET /api/connectors/oauth/callback` are GETs that change state (OAuth redirects). `POST /api/save` is the route a stale browser tab uses to push old state; the office never calls it.

---

## 4. Single source of truth: agents, departments, stages

Yes, it is possible, with one explained exception.

| Entity | Source of truth | Read how | Duplicated list needed? |
|---|---|---|---|
| Agents | StarNet roster `agent.roster.json` | ids, names, models, providers, roles | No. `station.config.json agents[]` (keys, tiers, rooms, gear) is your declaration and is only used to cross-check names and to label models "cheap"/"strong". |
| Departments | StarNet save `agent.save.json doc.station.rooms` + `desk` props with `agentId` | point-in-rect | No. `floorRooms` is the cross-check. Department display names come from the room names (RESEARCH / DESIGN / OFFICE), which match the spec. |
| Job stages (line) | StarNet `routing.plan.json` (`dockChains`, `junctions`, `lines[].agents`, limits) | walk from the intake | No. Stage label = agent name at the dock. |
| Job stages outside StarNet | `brief` (research-lab folder) and `approval queue` / `rejected` (your folders and tracker) | file existence + tracker status | **Yes, two names**, because these stages are your scripts' concept, not StarNet's. They are defined once, in your `rooms/etsy-pod/room.json` (`outbox`) and `config.paths`, and the office reads those rather than hard-coding. |

The only hard-coding the office keeps is the spec's board column order; everything inside each column is derived.

---

## 5. Job-creation mechanism (for WRITE-PATH.md, not wired in v1)

Three mechanisms exist in your build. All are state-changing and all need StarNet running.

1. **Step-through run of a line:** `POST /api/routing/steptest {line, startAt, pause[], text}` then `GET /api/routing/steptest/<id>` and `POST …/<id>/continue|stop`. This is what `lib/run-line.mjs` and `lib/rerun-listing.mjs` do, with pauses at the two edges where your hooks fill prices and typeset, and `reviewBeforeLister:true` to stop before LISTER for your review. Pre-requisite: a verified brief file in `research-lab/briefs/` and no existing `work/<id>`. **Recommended for the adapter**, by importing `runLine` from `station/scripts/lib/run-line.mjs` (your code) rather than re-implementing it; "needs my OK" maps to `reviewBeforeLister: true` and never auto-continuing past the review pause.
2. **Folder trigger:** writing a verified brief into `research-lab/briefs/` fires line p33 when the trigger is enabled. Currently disabled after the 2026-10-15 incident. **Not recommended** for the adapter: it runs with whatever prompts are live and has no pause.
3. **Ad-hoc run:** `POST /api/run` (used by `smoke-test.mjs`, `guardrail-test.mjs`). Bypasses the line. **Not recommended**.

Routines: `POST /api/cron` with `enabled:false` (and `POST /api/cron/update` to patch), as `lib/research-routines.mjs planRoutines()` builds them. The adapter must never call `POST /api/cron/run` or `POST /api/cron/arm`; "needs my OK" = created paused.

Env flag, default off, in the office's own env file; the write-guard test fails if any file outside the adapter imports `run-line.mjs`, calls a W or W? route, or opens a path under `station-workspace/` or `Virtual-workers/station/` for writing.

---

## 6. Services and runtime for the top bar

| Service | How it is used | Status source (read-only) |
|---|---|---|
| Anthropic (direct) | all agent text, and vision via your patch | `GET /api/providers` `configured` flag when live; otherwise "unknown while StarNet is offline". Never read `.secrets/`. |
| OpenRouter | image generation only (`openai/gpt-5-image-mini`, guardrailed, $2/day) | same; plus `textRoutingAllowedRuns` and `providerSwitchedAt` from config for the routing check |
| Etsy, Printify | manual, no keys, no API anywhere in the build | show as "manual" (no status) |
| StarNet channels (Telegram, Discord, …) | none connected | `channels/status` when live; else "none" |
| MCP connectors | no connector state file found in the data root | "none" |
| Real-ESRGAN (local, RTX 5060) | upscaling in `collect-outbox` | presence of the binary path from config |
| Runtime | StarNet sidecar v0.13.2 on Node (`node --env-file=../.env sidecar/index.js`, port 8787), Windows 11; `print-check --watch` as a second Node process | `GET /api/health` + `/api/version` when live; `starnet/package.json` version from the file |

---

## 7. Discrepancies and gaps found (flagged, not fixed)

- **D1. BRIDGE is still in the roster and the save.** `HANDOFF.md` says `retire-bridge.mjs` removed it from `doc.agents[]` and the roster on 2026-10-15, but `agent.roster.json` still lists `agentId "agent"` (provider `openrouter`, model `anthropic/claude-haiku-5.5`) and `doc.agents[]` lists BRIDGE on `anthropic`. Your `verify-floor` passes because `activeAgents()` filters the hero by id. Possibly the stale-tab re-post you describe. For the other session to confirm.
- **D2.** `USAGE.md` says the ledger is at `station-workspace/ledger.jsonl`; it is at `station-workspace/starnet/ledger.jsonl` (config is right).
- **D3.** `toolsets.json` is `{"disabled":{"comms":false}}`, while `station/README.md` and the config say COMMS was switched off in TOOLSETS. Either the file means something else or COMMS is on.
- **D4.** Agent names differ by form: config "QA DESIGN", StarNet "QA-DESIGN". Normalise on letters and digits (as `cost.mjs` does).
- **D5.** `routing.plan.json` and `agent.save.json` place the same docks in two coordinate frames (plan = save + 3,3). Use the save for rooms.
- **D6.** `overseer/reports/` and `overseer/metrics/` are empty: STATION-OVERSEER has never produced a report. The office should say "no report yet", not invent one.
- **D7.** BBQ r6 passed both QAs (`outbox/…-r6/qa-listing.json` approved) but the package gate failed on a UK spelling in the tags (`run-line-bbq-r6.json`), so it is in `work/` and `outbox/` with no tracker row and no package. The board must handle "QA passed, gate failed" as a state.
- **D8.** `transcript-history-v2/manifest.json` counts 1,152 rows; the segment file has 1,204 lines. Minor; read defensively.
- **D9.** "Last read by <agent>" for shared files is not derivable from tool traces (sizes only, no paths). See §2.9.
- **D10.** Three folders under `station-workspace/` are git repos with 0 commits (`research-lab`, `room1-etsy`, `overseer`): StarNet's project bless created them. The office must not run git in them either.

---

## 8. What the office server will need (for Phase 2, listed now)

Own env file in `office-agents/` (never committed): `STATION_OFFICE_STARNET_ROOT=C:\Users\marks\projects\Virtual-workers` and, only if you approve live reads, `STATION_OFFICE_STARNET_API=http://127.0.0.1:8787` plus `STATION_OFFICE_STARNET_TOKEN` (same value as your `SKYNET_API_TOKEN`, read by the server only). Thumbnail cache and logs under `office-agents/.cache/` and `office-agents/logs/`. Reads are `fs.readFile`/`readdir` only; the write-guard test enforces it.

---

## Appendix A. Every StarNet API route

Class: **R** read-only; **W** state-changing; **W?** POST whose effect is a preview, probe or scan (unsure). Match: `exact` full path, `prefix` path prefix, `qsplit` path with query, `rx` regex family. Generated from the sidecar source; hand-annotated notes.

| Method | Path | Match | Class | Note |
|---|---|---|---|---|
| POST | `/api/activity` | exact | **W** | activity beacon (frontend presence) |
| GET | `/api/agent-skills` | prefix | R |  |
| POST | `/api/agent-skills/allow` | exact | **W** |  |
| GET | `/api/agent-skills/goldens` | prefix | R |  |
| POST | `/api/agent-skills/manage` | exact | **W** |  |
| POST | `/api/agent/delete` | exact | **W** |  |
| GET | `/api/agents/affinity` | exact | R |  |
| GET | `/api/apps` | exact | R |  |
| POST | `/api/apps` | exact | **W** |  |
| POST | `/api/apps/delete` | exact | **W** |  |
| POST | `/api/apps/rename` | exact | **W** |  |
| POST | `/api/apps/schedule` | exact | **W** |  |
| POST | `/api/apps/store` | exact | **W** |  |
| POST | `/api/attachments` | exact | **W** |  |
| GET | `/api/auth/claude-cli/accounts` | exact | R | claude-cli accounts |
| POST | `/api/auth/claude-cli/add` | exact | **W** |  |
| POST | `/api/auth/claude-cli/cancel` | exact | **W** |  |
| POST | `/api/auth/claude-cli/code` | exact | **W** |  |
| POST | `/api/auth/claude-cli/poll` | exact | **W** |  |
| POST | `/api/auth/claude-cli/remove` | exact | **W** |  |
| POST | `/api/auth/claude-cli/start` | exact | **W** |  |
| GET | `/api/auth/claude-cli/status` | qsplit | R | claude-cli auth status |
| POST | `/api/auth/codex/account-poll` | exact | **W** |  |
| POST | `/api/auth/codex/account-start` | qsplit | **W** |  |
| GET | `/api/auth/codex/accounts` | exact | R | OAuth accounts |
| POST | `/api/auth/codex/add` | exact | **W** |  |
| POST | `/api/auth/codex/logout` | exact | **W** |  |
| GET | `/api/auth/codex/models` | exact | R | OAuth-backed model list |
| POST | `/api/auth/codex/poll` | exact | **W** |  |
| POST | `/api/auth/codex/remove` | exact | **W** |  |
| POST | `/api/auth/codex/start` | exact | **W** |  |
| GET | `/api/auth/codex/status` | exact | R | OAuth status, may refresh |
| POST | `/api/auth/grok/account-poll` | exact | **W** |  |
| POST | `/api/auth/grok/account-start` | qsplit | **W** |  |
| GET | `/api/auth/grok/accounts` | exact | R | OAuth |
| POST | `/api/auth/grok/add` | exact | **W** |  |
| POST | `/api/auth/grok/logout` | exact | **W** |  |
| GET | `/api/auth/grok/models` | exact | R | OAuth |
| POST | `/api/auth/grok/poll` | exact | **W** |  |
| POST | `/api/auth/grok/remove` | exact | **W** |  |
| POST | `/api/auth/grok/start` | exact | **W** |  |
| GET | `/api/auth/grok/status` | exact | R | OAuth |
| POST | `/api/auth/kimi/account-poll` | exact | **W** |  |
| POST | `/api/auth/kimi/account-start` | qsplit | **W** |  |
| GET | `/api/auth/kimi/accounts` | exact | R | OAuth |
| POST | `/api/auth/kimi/add` | exact | **W** |  |
| POST | `/api/auth/kimi/logout` | exact | **W** |  |
| GET | `/api/auth/kimi/models` | exact | R | OAuth |
| POST | `/api/auth/kimi/poll` | exact | **W** |  |
| POST | `/api/auth/kimi/remove` | exact | **W** |  |
| POST | `/api/auth/kimi/start` | exact | **W** |  |
| GET | `/api/auth/kimi/status` | exact | R | OAuth |
| GET | `/api/autonomy/ledger` | prefix | R |  |
| GET | `/api/autonomy/posture` | exact | R |  |
| POST | `/api/autonomy/posture` | exact | **W** |  |
| POST | `/api/autonomy/write` | exact | **W** |  |
| GET | `/api/away/briefing` | exact | R |  |
| POST | `/api/away/briefing/deliver` | exact | **W** |  |
| POST | `/api/budget/caps` | exact | **W** | sets caps (set-caps.mjs) |
| POST | `/api/budget/resume` | exact | **W** |  |
| POST | `/api/budget/settle` | exact | **W** |  |
| GET | `/api/budget/status` | exact | R |  |
| POST | `/api/cancel` | exact | **W** |  |
| POST | `/api/channels/discord/connect` | exact | **W** |  |
| POST | `/api/channels/discord/disconnect` | exact | **W** |  |
| GET | `/api/channels/discord/status` | exact | R |  |
| POST | `/api/channels/discord/sync` | exact | **W** |  |
| GET | `/api/channels/events` | qsplit | R | SSE hold-open event stream (read-only; header token or ticket) |
| POST | `/api/channels/handoff` | exact | **W** |  |
| POST | `/api/channels/notify` | exact | **W** |  |
| GET | `/api/channels/status` | exact | R |  |
| POST | `/api/channels/telegram/bots/connect` | exact | **W** |  |
| POST | `/api/channels/telegram/connect` | exact | **W** |  |
| POST | `/api/channels/telegram/disconnect` | exact | **W** |  |
| POST | `/api/channels/telegram/owner/pair` | exact | **W** |  |
| POST | `/api/channels/telegram/owner/revoke` | exact | **W** |  |
| GET | `/api/channels/telegram/status` | exact | R |  |
| POST | `/api/channels/telegram/sync` | exact | **W** |  |
| POST | `/api/channels/token` | exact | **W** |  |
| POST | `/api/channels/webhook/` | prefix | **W** |  |
| GET | `/api/checkpoint` | prefix | R |  |
| POST | `/api/checkpoint/restore` | exact | **W** |  |
| GET | `/api/computer-control` | exact | R |  |
| POST | `/api/computer-control` | exact | **W** |  |
| POST | `/api/config/export` | exact | **W** |  |
| POST | `/api/config/import` | exact | **W** |  |
| POST | `/api/config/reset` | exact | **W** |  |
| GET | `/api/connectors` | exact | R |  |
| POST | `/api/connectors` | exact | **W** |  |
| GET | `/api/connectors/catalog` | exact | R |  |
| GET | `/api/connectors/oauth/callback` | prefix | **W** | GET but an OAuth redirect: state-changing |
| POST | `/api/connectors/oauth/cancel` | exact | **W** |  |
| POST | `/api/connectors/oauth/client` | exact | **W** |  |
| POST | `/api/connectors/oauth/device/poll` | exact | **W** |  |
| POST | `/api/connectors/oauth/start` | exact | **W** |  |
| POST | `/api/connectors/refresh` | exact | **W** |  |
| POST | `/api/connectors/remove` | exact | **W** |  |
| POST | `/api/consent` | exact | **W** |  |
| POST | `/api/consent/ack` | exact | **W** |  |
| POST | `/api/consent/answer` | exact | **W** |  |
| GET | `/api/consent/args` | qsplit | R | reads pending consent args |
| GET | `/api/credits` | qsplit | R | StarNet Credits cloud read |
| POST | `/api/credits/link/poll` | exact | **W** |  |
| POST | `/api/credits/link/start` | exact | **W** |  |
| GET | `/api/credits/linkable` | qsplit | R | StarNet cloud |
| POST | `/api/credits/unlink` | exact | **W** |  |
| GET | `/api/cron` | exact | R |  |
| POST | `/api/cron` | exact | **W** | creates a routine (create-research-routines.mjs) |
| POST | `/api/cron/arm` | exact | **W** | arms the scheduler |
| POST | `/api/cron/degraded/clear` | exact | **W** |  |
| GET | `/api/cron/history` | qsplit | R |  |
| POST | `/api/cron/preview` | exact | W? | schedule preview; probably no persist |
| POST | `/api/cron/remove` | exact | **W** |  |
| POST | `/api/cron/run` | exact | **W** | fires a routine NOW |
| POST | `/api/cron/update` | exact | **W** | patches a routine |
| GET | `/api/deliverables` | qsplit | R |  |
| POST | `/api/deliverables/cleanup` | exact | **W** |  |
| POST | `/api/deliverables/cleanup-preview` | exact | W? | preview only; probably no persist |
| POST | `/api/deliverables/cleanup-undo` | exact | **W** |  |
| POST | `/api/dev/fault` | exact | **W** |  |
| POST | `/api/dev/inbound` | exact | **W** |  |
| GET | `/api/dev/replies` | qsplit | R | dev only |
| GET | `/api/diagnostics` | exact | R | inert, secret-free report |
| POST | `/api/diagnostics/live` | exact | **W** | spends a tiny model call; needs a consent bit |
| GET | `/api/discovery` | exact | R |  |
| POST | `/api/discovery/decide` | exact | **W** |  |
| POST | `/api/discovery/scan` | exact | **W** |  |
| GET | `/api/discovery/sources` | exact | R |  |
| POST | `/api/discovery/sources` | exact | **W** |  |
| POST | `/api/dossier` | exact | **W** |  |
| GET | `/api/execution` | exact | R |  |
| GET | `/api/execution-profiles` | exact | R |  |
| POST | `/api/execution/cleanup` | exact | **W** |  |
| POST | `/api/execution/policy` | exact | **W** |  |
| POST | `/api/execution/ssh` | exact | **W** |  |
| POST | `/api/execution/sync` | exact | **W** |  |
| GET | `/api/fallback/chain` | exact | R |  |
| POST | `/api/fallback/chain` | exact | **W** |  |
| GET | `/api/fs/dirstat` | qsplit | R | stats a directory (jailed) |
| POST | `/api/goals` | exact | **W** |  |
| GET | `/api/groups` | qsplit | R |  |
| POST | `/api/groups` | exact | **W** |  |
| POST | `/api/growth/ratings/correction` | exact | **W** |  |
| GET | `/api/halt` | exact | R |  |
| POST | `/api/halt` | exact | **W** | E-STOP |
| POST | `/api/halt/resume` | exact | **W** | resume after E-STOP |
| POST | `/api/harness/detect` | exact | W? | scans disk |
| POST | `/api/harness/scan` | exact | W? | scans disk |
| GET | `/api/health` | exact | R | token-exempt liveness (plain text ok / 503) |
| GET | `/api/hooks` | exact | R |  |
| POST | `/api/hooks/allow` | exact | **W** | approves a hook (owner only) |
| POST | `/api/hooks/create` | exact | **W** |  |
| POST | `/api/hooks/delete` | exact | **W** |  |
| POST | `/api/hooks/revoke` | exact | **W** |  |
| GET | `/api/insights` | prefix | R |  |
| POST | `/api/key` | exact | **W** |  |
| GET | `/api/lifecycle/armed` | exact | R |  |
| POST | `/api/lifecycle/quit` | exact | **W** |  |
| GET | `/api/limits` | exact | R |  |
| GET | `/api/line-jobs` | qsplit | R |  |
| GET | `/api/lineage` | exact | R |  |
| POST | `/api/lineage/recover` | exact | **W** |  |
| GET | `/api/lineage/report` | exact | R |  |
| POST | `/api/lineage/start-fresh` | exact | **W** |  |
| GET | `/api/local-voice/status` | exact | R | media |
| POST | `/api/local-voice/stream` | qsplit | **W** |  |
| POST | `/api/local-voice/transcribe` | exact | **W** |  |
| POST | `/api/local-voice/warm` | qsplit | **W** |  |
| GET | `/api/loops` | exact | R |  |
| POST | `/api/loops` | exact | **W** |  |
| POST | `/api/loops/control` | exact | **W** |  |
| POST | `/api/loops/detect` | exact | **W** |  |
| POST | `/api/loops/remove` | exact | **W** |  |
| POST | `/api/loops/testcheck` | exact | **W** |  |
| POST | `/api/loops/update` | exact | **W** |  |
| POST | `/api/loops/verdict` | exact | **W** |  |
| GET | `/api/memory/config` | exact | R |  |
| POST | `/api/memory/config` | exact | **W** |  |
| GET | `/api/memory/declined` | prefix | R |  |
| POST | `/api/memory/declined/restore` | exact | **W** |  |
| POST | `/api/memory/edit` | exact | **W** |  |
| POST | `/api/memory/forget` | exact | **W** |  |
| GET | `/api/memory/pending` | prefix | R |  |
| POST | `/api/memory/pin` | exact | **W** |  |
| GET | `/api/memory/proposals` | prefix | R |  |
| GET | `/api/memory/records` | prefix | R |  |
| POST | `/api/memory/reset` | exact | **W** |  |
| POST | `/api/memory/turnin` | exact | **W** |  |
| GET | `/api/model-tiers` | qsplit | R | fetches the StarNet cloud tier list |
| GET | `/api/models/` | qprefix | R | may query the provider for its model list |
| POST | `/api/nightshift/beat` | exact | **W** |  |
| GET | `/api/nightshift/drafts` | prefix | R |  |
| GET | `/api/nightshift/status` | exact | R |  |
| GET | `/api/notebook` | prefix | R |  |
| POST | `/api/notebook/restore` | exact | **W** |  |
| GET | `/api/overseer` | exact | R |  |
| GET | `/api/permissions` | exact | R |  |
| POST | `/api/permissions/bypass` | exact | **W** |  |
| POST | `/api/permissions/grant` | exact | **W** |  |
| POST | `/api/permissions/revoke` | exact | **W** |  |
| POST | `/api/pickpath` | exact | W? | opens a native folder dialog |
| GET | `/api/plugins` | exact | R |  |
| POST | `/api/plugins/allow` | exact | **W** |  |
| POST | `/api/plugins/call` | exact | **W** |  |
| POST | `/api/plugins/create` | exact | **W** |  |
| POST | `/api/plugins/delete` | exact | **W** |  |
| POST | `/api/plugins/revoke` | exact | **W** |  |
| POST | `/api/plugins/store` | exact | **W** |  |
| GET | `/api/projects` | exact | R |  |
| POST | `/api/projects/bless` | exact | **W** |  |
| POST | `/api/projects/discover` | exact | W? | scans disk |
| POST | `/api/projects/forget` | exact | **W** |  |
| POST | `/api/projects/pickfolder` | exact | W? | opens a native folder dialog |
| GET | `/api/projects/workspace` | qsplit | R |  |
| POST | `/api/projects/workspace` | exact | **W** |  |
| GET | `/api/providers` | exact | R |  |
| POST | `/api/providers/engine-key` | exact | **W** |  |
| POST | `/api/providers/probe` | exact | W? | outbound provider round-trip, no persist |
| POST | `/api/providers/validate` | exact | W? | outbound key check |
| GET | `/api/quests` | qsplit | R |  |
| POST | `/api/quests/confirm` | exact | **W** |  |
| POST | `/api/quests/dismiss` | exact | **W** |  |
| POST | `/api/quests/disposition` | exact | **W** |  |
| POST | `/api/quests/mint` | exact | **W** |  |
| GET | `/api/quests/refresh` | qsplit | R | refresh status |
| POST | `/api/quests/refresh/northstar` | exact | **W** |  |
| POST | `/api/quests/refresh/run` | exact | **W** |  |
| POST | `/api/quests/report` | exact | **W** |  |
| POST | `/api/quests/update` | exact | **W** |  |
| POST | `/api/realtime/session` | qsplit | **W** |  |
| GET | `/api/realtime/status` | qsplit | R | realtime voice |
| GET | `/api/recipes/drift` | qsplit | R |  |
| GET | `/api/recommendations` | qsplit | R |  |
| POST | `/api/recommendations` | exact | **W** |  |
| GET | `/api/recommendations/eval` | qsplit | R |  |
| GET | `/api/remote` | exact | R | remote status |
| POST | `/api/remote/device` | exact | **W** |  |
| POST | `/api/remote/enable` | exact | **W** |  |
| POST | `/api/remote/pair` | exact | **W** |  |
| GET | `/api/remote/recent` | exact | R | remote |
| POST | `/api/remote/revoke` | exact | **W** |  |
| GET | `/api/remote/view` | exact | R | remote view |
| POST | `/api/remote/view` | exact | **W** |  |
| POST | `/api/remote/view/crew` | exact | **W** |  |
| POST | `/api/roster` | exact | **W** | frontend roster push (server mirror) |
| POST | `/api/routing` | exact | **W** |  |
| GET | `/api/routing/chain` | qsplit | R |  |
| POST | `/api/routing/fix-suggest` | exact | **W** | may call a model |
| POST | `/api/routing/line-draft` | exact | **W** | may call a model |
| GET | `/api/routing/lines/stats` | qsplit | R |  |
| GET | `/api/routing/sample` | exact | R |  |
| POST | `/api/routing/sample` | exact | **W** |  |
| POST | `/api/routing/sample/stop` | exact | **W** |  |
| GET | `/api/routing/steptest` | qsplit | R |  |
| POST | `/api/routing/steptest` | exact | **W** | starts a step-through run (run-line.mjs, rerun-listing.mjs) |
| GET | `/api/routing/triggers` | qsplit | R |  |
| POST | `/api/routing/triggers` | exact | **W** | creates a trigger |
| POST | `/api/run` | exact | **W** | starts an ad-hoc run (smoke-test, guardrail-test) |
| GET | `/api/run-recoveries` | qsplit | R |  |
| POST | `/api/run-recoveries/continue` | exact | **W** |  |
| POST | `/api/run-recoveries/resolve` | exact | **W** |  |
| POST | `/api/run/steer` | exact | **W** |  |
| GET | `/api/runs` | prefix | R |  |
| GET | `/api/runtime/agent` | exact | R | answers for provider openrouter only; not usable here |
| GET | `/api/runtime/knobs` | exact | R |  |
| POST | `/api/runtime/knobs` | exact | **W** |  |
| GET | `/api/save` | prefix | R |  |
| POST | `/api/save` | qsplit | **W** | frontend save push: the route a stale tab uses to overwrite prompts |
| POST | `/api/save/recovery-ack` | exact | **W** |  |
| GET | `/api/scout` | exact | R |  |
| POST | `/api/scout/context` | exact | **W** |  |
| POST | `/api/scout/decide` | exact | **W** |  |
| POST | `/api/scout/telemetry` | exact | **W** |  |
| GET | `/api/servicekeys` | exact | R |  |
| POST | `/api/servicekeys` | exact | **W** |  |
| POST | `/api/servicekeys/autonomy` | exact | **W** |  |
| GET | `/api/servicekeys/catalog` | exact | R |  |
| POST | `/api/servicekeys/remove` | exact | **W** |  |
| POST | `/api/servicekeys/toggle` | exact | **W** |  |
| POST | `/api/session` | exact | **W** | creates or attaches a session |
| POST | `/api/skill-exchange/check` | exact | W? | checks a package |
| POST | `/api/skill-exchange/discover` | exact | W? | discovery |
| POST | `/api/skill-exchange/export` | exact | **W** |  |
| POST | `/api/skill-exchange/generations` | exact | **W** |  |
| POST | `/api/skill-exchange/import` | exact | **W** |  |
| POST | `/api/skill-exchange/inspect` | exact | W? | inspects a package |
| POST | `/api/skill-exchange/install` | exact | **W** |  |
| GET | `/api/skill-exchange/metrics` | exact | R | exchange metrics |
| POST | `/api/skill-exchange/publish-handoff` | exact | **W** |  |
| GET | `/api/skill-exchange/registries` | exact | R | registry list |
| POST | `/api/skill-exchange/registries` | exact | **W** |  |
| POST | `/api/skill-exchange/registry` | exact | **W** |  |
| POST | `/api/skill-exchange/rollback` | exact | **W** |  |
| GET | `/api/skill-market` | qsplit | R | may fetch the market catalog |
| POST | `/api/skill-market/install` | exact | **W** |  |
| POST | `/api/skill-market/uninstall` | exact | **W** |  |
| GET | `/api/skills` | prefix | R |  |
| POST | `/api/skills/toggle` | exact | **W** |  |
| GET | `/api/slash/catalog` | prefix | R |  |
| POST | `/api/slash/dispatch` | exact | **W** |  |
| POST | `/api/spotify/auth/start` | exact | **W** |  |
| GET | `/api/spotify/callback` | prefix | **W** | GET but an OAuth redirect: state-changing |
| POST | `/api/spotify/disconnect` | exact | **W** |  |
| GET | `/api/spotify/status` | exact | R | spotify |
| GET | `/api/state/snapshot` | exact | R |  |
| POST | `/api/station/ack` | exact | **W** |  |
| POST | `/api/stt` | qsplit | **W** |  |
| POST | `/api/stt/native` | exact | **W** |  |
| GET | `/api/stt/native/status` | exact | R | media |
| GET | `/api/stt/status` | exact | R | media |
| GET | `/api/study/pending` | exact | R |  |
| GET | `/api/study/proposals` | prefix | R |  |
| POST | `/api/study/resolve` | exact | **W** |  |
| GET | `/api/subagents` | prefix | R |  |
| POST | `/api/subagents/interrupt` | exact | **W** |  |
| POST | `/api/subagents/steer` | exact | **W** |  |
| POST | `/api/summon/ack` | exact | **W** |  |
| GET | `/api/task-briefs` | prefix | R |  |
| GET | `/api/threads` | prefix | R |  |
| GET | `/api/threads/proposals` | prefix | R |  |
| POST | `/api/threads/turnin` | exact | **W** |  |
| GET | `/api/toolsets` | prefix | R |  |
| POST | `/api/toolsets/` | prefix | **W** |  |
| GET | `/api/transcript` | prefix | R |  |
| POST | `/api/tts` | exact | **W** |  |
| POST | `/api/update/cancel` | exact | **W** |  |
| POST | `/api/update/prepare` | exact | **W** |  |
| GET | `/api/update/status` | exact | R | may check the release host |
| GET | `/api/userprops` | qsplit | R | list |
| POST | `/api/userprops/delete` | exact | **W** |  |
| POST | `/api/userprops/generate` | exact | **W** |  |
| GET | `/api/userprops/image` | qsplit | R | serves a generated prop image |
| GET | `/api/userprops/job` | qsplit | R | job status |
| GET | `/api/userprops/preview` | qsplit | R | preview read |
| POST | `/api/userprops/preview` | exact | W? | generates a preview |
| POST | `/api/userprops/scale` | exact | **W** |  |
| POST | `/api/userprops/side` | exact | **W** |  |
| GET | `/api/version` | exact | R |  |
| GET | `/api/widgets` | exact | R |  |
| POST | `/api/widgets/configure` | exact | **W** |  |
| POST | `/api/widgets/remove` | exact | **W** |  |
| POST | `/api/widgets/request` | exact | **W** |  |
| GET | `/api/widgets/sources` | exact | R |  |
| GET | `/api/workshop/backlog` | qsplit | R |  |
| POST | `/api/workshop/decide` | exact | **W** |  |
| POST | `/api/workshop/grant` | exact | **W** |  |
| POST | `/api/workshop/implement` | exact | **W** |  |
| POST | `/api/workshop/open` | exact | **W** |  |
| GET | `/api/workshop/pending` | qsplit | R |  |
| POST | `/api/workshop/queue` | exact | **W** |  |
| POST | `/api/workshop/remove` | exact | **W** |  |
| POST | `/api/workshop/shift` | exact | **W** |  |
| POST | `/api/workshop/undo` | exact | **W** |  |
| GET | `/api/workspace/dir` | prefix | R | lists a workspace dir |
| POST | `<GENERIC_CHANNEL_RX.connect>` | rx | **W** |  |
| POST | `<GENERIC_CHANNEL_RX.disconnect>` | rx | **W** |  |
| POST | `<GENERIC_CHANNEL_RX.ownerPair>` | rx | **W** |  |
| GET | `<GENERIC_CHANNEL_RX.status>` | rx | R |  |
| POST | `<GENERIC_CHANNEL_RX.sync>` | rx | **W** |  |
| POST | `<TG_BOT_RX.act>` | rx | **W** |  |
| POST | `<TG_BOT_RX.owner>` | rx | **W** |  |
| GET | `/api/routing/steptest/<id>` | rx | R | handleStepTestId: one step-through session |
| POST | `/api/routing/steptest/<id>/{continue, rerun, rewind, stop, pause}` | rx | **W** | handleStepTestId: drives a run |
| GET | `/api/line-jobs/<id>` | rx | R | handleLineJobId: one line job |
| POST | `/api/line-jobs/<id>/note` | rx | **W** | handleLineJobId: writes a note on the job |
| GET | `/api/channels/<id>/status` | rx | R | generic channel status (booleans only) |
| POST | `/api/channels/<id>/{connect, sync, disconnect, owner/pair}` | rx | **W** | generic channel control |
| POST | `/api/channels/telegram/bots/<id>/...` | rx | **W** | telegram bot owner / action routes |
| GET / HEAD | `/api/file?...` | direct | R | serves a file from a jailed path (ticket or header token) |
| POST | `/api/hooks/<webhook-id>` | prefix | **W** | inbound webhook trigger (hookBase in /api/routing/triggers) |
