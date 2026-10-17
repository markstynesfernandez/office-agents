# PROGRESS

Last updated: 17/10/2026 (pre-E6 housekeeping; E4, R1, R2 and E5 approved by the owner). Plan: `ENGINE-PLAN.md` (approved). Decisions: `DECISIONS.md`. Port record: `PORTED.md`.

## Phases done

| Phase | Status |
|---|---|
| Phase 0 (reuse audit) and Phase 1 (read-only 3D viewer) | Done before the engine plan |
| **E1** Rename and jail | Done. StarNet removed from the UI and identifiers; `data/` root, `dataJail`, write-guard v2; `starnet-api.mjs` and the write adapter deleted; NOTICE.md. Screenshots in `screenshots/e1/`. |
| **E2** Engine core | Done. Store (`node:sqlite`), append-only ledger, event bus, e-stop (page button, CLI, HALT file), spend guard, scheduler (croner), mock providers, engine and SSE server. |
| **E3** Port, line and dry run | Done, and **approved by the owner** (16/10/2026). Agent runtime, tools, line orchestrator and package. Job A reaches the approval queue after one QA-DESIGN rework; job B is blocked by originality ("garfield"). Screenshots in `screenshots/e3/01`–`13`. |
| Post-E3 re-port | Done (16/10/2026). The keyword-source rule was ported at a 3rd moment and the enclosed-background change (packaged products) at a 4th. Dry run re-verified. See below. |
| Demo mode | Done (16/10/2026). `npm run demo`, presenter view, `npm run demo:record`. Demo hardening done at the start of E4 (see below). |
| **E4** Legacy import | Done (16/10/2026), **approved by the owner** (17/10/2026). `npm run import-legacy`; the legacy history imported into `data/` and reconciled with the source ($8.5000719, 162 ledger rows); a second run changes nothing. Legacy jobs on the board (Blocked, Rejected, Parked lanes), in the job panel and the calendar; legacy notebooks and ledger in the memory-core viewer. Screenshots in `screenshots/e4/`. See below. |
| **Redesign R1** Office scene look | Done (16/10/2026), **approved by the owner** (17/10/2026). Cutaway department rooms, lounge with walking idle agents, atrium with the memory core, server closet; light and dark looks. 60+ fps full quality in headed Chrome on the iGPU in every view. Screenshots in `screenshots/redesign-r1/`, demo video re-recorded. See below. |
| **Redesign R2** Office look, people, UI polish | Done (17/10/2026), **approved by the owner** (17/10/2026). Follow-ups done at the start of E5 (below). Atrium about 40% smaller with props, polished concrete, smaller core glow, light-mode contrast, low-poly people with typing/relaxed/walking poses, lounge seats on the cushions (tested), UI polish. 60+ fps full quality in every view, walking included. Screenshots in `screenshots/redesign-r2/`, demo video re-recorded. See below. |
| **E5** Live UI | Done (17/10/2026), **approved by the owner** (17/10/2026). Task box, scheduler, approval queue, desk and job controls, E-STOP with typed resume, live spend vs caps; every write same-origin, token, idempotency key and expectedVersion. Mock provider only. Screenshots in `screenshots/e5/`. See below. |
| Pre-E6 housekeeping | Done (17/10/2026). Line endings fixed; port drift measured (not ported); port-step items planned; E6 readiness checklist below. |
| E6 First real job | Not started. Blocked: see the E6 readiness checklist below. |
| E7 Routines and cut-over | Not started |

Everything so far ran on the mock provider: $0, with no API keys read.

### Pre-E6 housekeeping (17/10/2026)

- **Approval recorded:** the owner approved E5 (17/10/2026).
- **Line endings:** `.gitattributes` (`* text=auto eol=lf`, image, video, audio, font, archive and database types `binary`) and the renormalise are in `39b48c8` "Normalise line endings"; every tracked file was already LF, so only `.gitattributes` changed. Re-checked today: `git add --renormalize .` changes nothing, `git ls-files --eol` shows every tracked file `i/lf` (no binary file is tracked yet), and `git diff` and `git diff -w` are both empty against the index and against HEAD.
- **Port drift (read only, nothing ported):** `npm run port-drift` shows **10 of 50** sources changed since their port moment, all on 17/10/2026 (Irish time):

  | Source (station/) | Modified | Ported as |
  |---|---|---|
  | `scripts/lib/style-ref.mjs` | 06:57 | `src/engine/lib/style-ref.mjs` (read side) |
  | `tests/style-ref.test.mjs` | 06:59 | `tests/ported/listing-notice.test.mjs` (last test only) |
  | `scripts/lib/digital-build.mjs` | 08:16 | `src/engine/lib/digital-build.mjs` (read side) |
  | `scripts/lib/digital-gate.mjs` | 08:16 | `src/engine/lib/digital-gate.mjs` |
  | `scripts/lib/digital-files.mjs` | 08:16 | `src/engine/lib/digital-files.mjs` |
  | `config/station.config.json` | 08:34 | `config/station.config.json` (copied unchanged) |
  | `scripts/lib/originality.mjs` | 08:56 | `src/engine/lib/originality.mjs` |
  | `scripts/lib/digital-prep.mjs` | 08:57 | `src/engine/lib/digital-prep.mjs` |
  | `tests/originality.test.mjs` | 08:58 | `tests/ported/originality.test.mjs` |
  | `agents/src/qa-design.md` | 09:00 | `prompts/agents/qa-design.md` (had 14 characters of headroom to its 12,000 target; re-check at the port) |

  At the start of E5 it was 5 files; the legacy job has since touched 5 more and changed the first 5 again. port-drift only hashes the 50 sources already ported: a new legacy file (for example the recolour or outline steps) does not show here, so the batch is the drift list plus the "To port to office-agents" log in Virtual-workers (not read in this step). The port happens in one go once the owner's job `2026-10-16--pngtuber-cosy-desk-props-r2` is done.
- **Port-step items planned** in ENGINE-PLAN.md §9, "Port step before E6": owner override of a QA verdict (per file, with date, reason and owner, on the job and in the manifest); the recolour and outline-colour normalise steps as tested pipeline steps; ZIP delivery for multi-file packs. Nothing built.

### E6 readiness checklist (17/10/2026)

Every item still blocking E6. **Candidate first product and parity reference:** the PNGTuber job `2026-10-16--pngtuber-cosy-desk-props-r2` in the legacy station (the `pngtuber-prop-pack` product). The engine's first real job should be judged against what that job produced.

| # | Item | Status | Where it stands |
|---|---|---|---|
| 1 | Q1 billing confirmation (Anthropic Console credits; finance and the founder) | **open** | DECISIONS.md Q1. `config/station.config.json` still says "approved by Finance", which conflicts with Q1 being open. |
| 2 | Q2 caps for digital jobs | **open** | Per-job cap $1.00 including images; a clean digital job is estimated at $0.76–1.13 (ENGINE-PLAN.md §9). No cap changed. |
| 3 | Q3 product spec | **open** | `pngtuber-prop-pack` is the only entry and is DRAFT; 12 files against Etsy's 5 (ZIP planned, see above). |
| 4 | Licence and download-notice wording | **open** | DRAFT in `config.digital`; the gate requires the approved text word for word. The legacy `station.config.json` changed today; check at the port whether it carries an owner decision. |
| 5 | Image model commercial terms | **open** | "UNCONFIRMED: owner checks the provider terms"; `opaqueModelApproved: false`. |
| 6 | Market and spelling (US or UK/IE) | **open** | §4.3 item 7. |
| 7 | AI-disclosure wording in listings | **open** | §4.3 item 8. |
| 8 | Price approach | **open** | The fill still proposes the top-5 high (EUR 13.90 on the draft); the floor is EUR 6.42. Prices are the owner's. |
| 9 | Provider price verification | **open** | The `anthropic-web` price is unset (a live web call would be refused); image prices are estimates until read from the provider's response; text model prices to be checked against the providers' current lists. |
| 10 | Separate API keys (a station-engine key in the Anthropic Console workspace and a new OpenRouter key) | **open** | ENGINE-PLAN.md §7.2 step 4. None created or read. |

Also needed before a real job on the candidate product (added here; not in the owner's list):

| # | Item | Status | Where it stands |
|---|---|---|---|
| 11 | Port batch from the PNGTuber job (the 10 drifted files, the logged fixes, the three planned items) | **open** | Waits for the owner's job to finish. |
| 12 | Packaged-product build in the engine (clean-up, enclosed background, upscale) | **open** | Fails closed at prep today; Real-ESRGAN needs a child process, which `src/` does not allow. Needs an owner decision on how the build runs. |
| 13 | Style-reference workflow | **open** | Fails closed at the package gate; no reference image in `image_generate`. |
| 14 | Parity check against the legacy job (§7.2 step 3) | **open** | Not done in E4. |

### E5 Live UI (17/10/2026)

The office's controls are live (ENGINE-PLAN.md §6), on the mock provider: $0, no API key read. Every write goes through the server into `data/` through `dataJail`. Choices for the owner are in DECISIONS.md, "E5 build record".

**Controls built**
- **Task box:** "Research this" (text -> a research job on the research line), "Start line on brief" (a verified brief from `research/briefs/` that has no job yet -> a job on the Room 1 line), "Re-run listing" (a QA-approved design -> LISTER and QA-LISTING again; the old listing, its QA records and the package move to `rerun-archive-*`). The "preview · not connected" label is gone; the legacy view says "read only".
- **Scheduler** (the calendar's routine list): New routine (or click a day), Edit, Enable (a confirmation that says what runs, when and within which caps), Disable, Delete. Created disabled; an edit disables it again; enabling is the only approval. Legacy routines read only.
- **Approval queue** (job panel and board cards): Approve (sends nothing anywhere), Reject (reason required), Mark published (date + Etsy URL); the package path with a copy button.
- **Desk panels:** on/off duty, tier and effort from the lists in `config/engine.json`; applies at the next run with no restart. Off duty: the agent's steps wait and its line's routines skip.
- **Job panel and board:** Stop job (aborts this job's call in flight), Restart (from the stopped or blocked step, within the caps), Archive (files moved to `jobs/<id>/rerun-archive-*`, never deleted).
- **Top bar:** E-STOP with a confirmation; resume needs the typed word `RESUME` and the current e-stop state; live spend against the day cap with a meter; a cap chip and notices from 80% of any cap and at 100%.
- **Unchanged:** prompts are not editable in the page, and caps are config only.

**Write safety on every request:** same-origin check, per-launch action token, idempotency key (required header; a repeat returns the first answer), expectedVersion on every existing record (a stale tab gets "Not saved: ... changed since you loaded it. The page has been refreshed; check it and try again." and nothing is written). Every write and every refusal is logged and emitted (`action.done`, `action.refused`). Exceptions, both safety actions: the E-STOP press never checks a version, and Stop accepts an older version while that job is still running (DECISIONS.md).

**Tests** (`tests/live-ui.test.mjs`, 9 tests, through the real HTTP server on a temp data root, mock provider, dry-run fixtures):
- a stale tab's write is refused (409, the message, the routine row unchanged; also for an agent and the e-stop resume);
- a double click creates one job (same key sent twice at once: one research job, one line job, one `job.created`);
- a cross-origin request, no Origin, another local port, a missing or wrong token, a missing idempotency key and a non-JSON body are all refused, and nothing is created;
- while the E-STOP is on no job starts (research, brief, restart: 423) and no routine fires (`e-stop is on`; scheduler disarmed), and an agent put back on duty starts nothing; resume needs the typed word;
- routines are created disabled whatever the request says; an edit disables; caps above config, unknown targets and bad cron are refused; legacy routines cannot be enabled or deleted;
- approve, reject and mark published write only the approvals and tracker rows (every other table and every file under the data root, except the event log, fingerprinted before and after);
- every control end to end on the mock provider (research, start on brief, reject, re-run listing back to the queue, approve, publish, archive, tier/effort at the next run, off duty waits and on duty resumes, routine create/enable/fire, e-stop and resume), with every file-system write the process makes recorded: none lands outside the data root (or the logs folder);
- Stop aborts a running job mid-call (no further provider call or ledger row) and Restart runs it again from that step;
- the top bar's spend: each cap's use, a warning from 80%, "reached" at 100%.

Also: `tests/people-looks.test.mjs` (2, item 0c) and the Legacy-lane check in `tests/import-legacy.test.mjs` (item 0b).

**Captures** (`node scripts/screenshots-e5.mjs`, headed Chrome, 1600x1000, `screenshots/e5/`): 01–03 the task box (Research this, Start line on brief, Re-run listing); 04 scheduler create; 05 the enable confirmation; 06 enabled; 07 the approval queue on the board with its buttons; 08 the job panel's approval box; 09 the reject-with-reason dialog; 10 desk panel controls (DESIGNER effort set to medium); 11 job panel with Stop while LISTER works; 12 Restart after the stop; 13 E-STOP on (the job it stopped, Restart refused until resume); 14 the typed resume confirmation; 15 the stale-tab refusal; 16–17 the overview in light and dark on the station's own data root. All engine states are real (a fresh mock data root for 01–15; nothing set on the page only).

**fps** (`screenshots/e5/fps-headed.json`; headed Chrome, Intel UHD iGPU, 1600x1000, engine mode on the station data root):

| View | Camera moving | Full quality | Frame avg / p95 |
|---|---|---|---|
| 16-overview-light | 73.5 | 73.2 | 13.55 / 15.3 ms |
| 17-overview-dark | 71.6 | 71.2 | 13.95 / 16.2 ms |

**Found and fixed while capturing:** a Stop sent from a page one step behind a running job was refused as stale (now accepted while the job runs); an open panel could miss its last refresh, or reopen after being closed, when refreshes resolved out of order; a stopped job's pill said "blocked"; the e-stop notice printed a UTC ISO time (now dd/mm/yyyy HH:MM, Dublin). Line endings: Python edits had written CRLF into LF files (whole-file diffs in the "R2 follow-ups" and E5 milestone commits); normalised back to LF in the "E5 live UI" commit.

**Files changed in E5:** `src/engine/{bus,engine,orchestrator,runtime,scheduler,time}.mjs`, `src/engine/store/db.mjs`; `src/server/{engine-model,engine-server}.mjs`; `src/web/index.html`, `main.js`, `styles.css`, `ui/{board,calendar,format,sidepanel,taskpanel}.js`, new `ui/controls.js`; new `scripts/screenshots-e5.mjs`; new `tests/live-ui.test.mjs`; `tests/{engine-server,demo,write-guard}.test.mjs`; `DECISIONS.md`, `PROGRESS.md`. Item 0: `src/web/scene/{office.js,looks.js (new)}`, `scripts/screenshots.mjs`, `tests/{import-legacy,people-looks (new)}.test.mjs`.

### R2 follow-ups (E5 item 0, 17/10/2026)

- **Approvals recorded:** the owner approved E4, Redesign R1 and Redesign R2.
- **Legacy jobs** (`src/server/engine-model.mjs`, `src/web/ui/board.js`, `taskpanel.js`): no imported legacy job is in the board's stage columns or its Blocked, Rejected and Parked lanes any more; they are all in a new **Legacy** lane (count, the 3 most recent, "show all"). The task list has a **Legacy** chip (off by default); Active, All and the status chips count engine jobs only, so an unfinished legacy job is never shown as in progress. (An **Archived** chip was added with it for E5's archived jobs.) `tests/import-legacy.test.mjs` checks the lanes and that no legacy job is in a stage column.
- **Shirts** (`src/web/scene/looks.js`, new; `office.js`): a shirt is the agent's colour unless that colour is in the skin-tone range (hue 0–50°, saturation 0.1–0.65) or within a set distance of a skin tone or of another agent's shirt; then a spare colour from a fixed non-skin set is used. EVIDENCE-CHECKER's and OVERSEER's tan `#d99a5a` was the one in the skin range; agents sharing a colour now get different shirts. Desk, monitor and label colours are unchanged. `tests/people-looks.test.mjs` (2 tests).
- **Screenshots never use page-only states:** `scripts/screenshots.mjs` no longer sets QA-DESIGN to working on the page for `07-people-closeup.png`; it was recaptured headed with the fixtures' tagged synthetic overlay states (DESIGNER working, tagged SYNTHETIC; QA-DESIGN idle): 71.5 fps full quality. `redesign-r2/fps-headed.json` row 07 updated with a note. (The walk bench still sets agents to working on the page for an fps measurement only; it takes no screenshot.)

### Redesign R2: look, people, UI polish (17/10/2026)

- **Layout** (`src/web/scene/layout.js`): the atrium is about 40% smaller (band 6.8 -> 4.3 deep, gap 9.3 -> 5.4 wide; open floor 316 -> 180 square units). The server closet turned a quarter turn so its cabinets face the core. Props: printer, water cooler, five benches, a meeting table with stools, an easel, two clocks, art and a shelf on bare walls, trailing shelf plants (third plant type), plants in every room, the lounge and the atrium. Walkers go straight to the lounge when the line is clear, else round the core.
- **Atrium floor**: polished concrete (dark grey in dark mode). Core plinth, plaza disc, glow pool and glow sprite about half their R1 size.
- **Light mode** (`src/web/config/palette.js`, `office.js`): stronger department wall tint, warmer wood, dark rugs, a lower and stronger sun with a weaker sky fill, softer shadow edges.
- **People** (`office.js`): low-poly figures with four hair styles, hands, two-part arms and legs, shoes; shirt in the agent's colour. Typing at the desk, relaxed on the sofa, walking. Lounge seats sit on the cushion centres; `tests/scene-layout.test.mjs` asserts hips and knees are on the cushion, at cushion height, facing the coffee table.
- **UI**: prompt-like roles (starting "You are", or over 80 characters) become "department · duty" in both views and the desk panel (`src/web/ui/role.js`); an "Active" chip first and default; the Rejected lane shows its count and the 3 most recent with "show all"; the Research card says "verified"; top-bar services show a glyph, a short name and the status dot.
- **fps** (`screenshots/redesign-r2/fps-headed.json`; headed Chrome, Intel UHD iGPU, 1600x1000, full quality = camera still, AO on):

| View | Camera moving | Full quality | Frame avg / p95 | Note |
|---|---|---|---|---|
| 01-overview-light | 71.2 | 68.8 | 14.43 / 16.8 ms | engine mode |
| 02-overview-dark | 70.9 | 71.5 | 13.85 / 16.1 ms | engine mode |
| 03-research-room | 62.2 | 62.4 | 15.94 / 18 ms | legacy fixtures view (zoomed) |
| 04-design-room | 70.9 | 68.2 | 14.54 / 16.3 ms | legacy fixtures view (zoomed) |
| 05-office-room | 68.7 | 60.2 | 16.49 / 21 ms | legacy fixtures view (zoomed) |
| 06-lounge-idle | 61.5 | 70.2 | 14.1 / 16.1 ms | engine mode (zoomed) |
| 07-people-closeup | 69.4 | 65.2 | 15.18 / 18.2 ms | legacy fixtures view (zoomed; QA-DESIGN set to working on the page) |
| 08-desk-panel | 72.7 | 71.5 | 13.85 / 16.5 ms | legacy fixtures view |
| 09-board | 165.1 | 165.1 | 6.06 / 6.2 ms | (3D scene paused behind the overlay; page frame rate) |
| walk (engine mode, overview, dark, 8 agents walking lounge to desk) | 62.3 | 62.3 | 16.12 / 18.3 ms | animation on; 8 still walking at the end of the bench |

- **Cut for performance** (details in DECISIONS.md, "Redesign R2 build record"): the AO is cached (people, the crystal and its ring left out of the AO pre-pass; AO is recomputed only when the camera stops or the scene or theme changes); the people's limbs are low-poly prisms and boxes; the bench slats are plain boxes. Kept: 4x MSAA, AO quality 6/4/1, PBR materials. The PC measured slower on 17/10 than on 16/10 (R1's own code: 63 against 72 fps on the overview), so the margins are thin: the Office room view is at 60.2 and walking at 62.3.
- **Captures:** `screenshots/redesign-r2/01`–`09` plus `fps-headed.json` (01, 02, 06, 09 in engine mode on the mock provider; 03 to 05, 07, 08 in the legacy fixtures view; in 07 QA-DESIGN is set to working on the page only, to show two desks in use). `npm run demo:record` re-run on the final code: `screenshots/demo/station-demo.webm` (2:46 demo day) and 4 stills, problems: none. `screenshots/demo/station-demo.mp4` is still the stale 16/10 file (no pinned MP4 encoder).
- **Files changed in R2:** `src/web/scene/layout.js`, `rooms.js`, `textures.js`, `office.js`; `src/web/config/palette.js`; `src/web/styles.css`; `src/web/main.js`; `src/web/ui/board.js`, `sidepanel.js`, `taskpanel.js` and the new `role.js`; `src/server/model.mjs`, `engine-model.mjs`; `tests/scene-layout.test.mjs`, `tests/model.test.mjs`; `scripts/screenshots.mjs` (`--set r2`); `ASSETS.md`, `DECISIONS.md`, `PROGRESS.md`.

### Redesign R1: office scene look (16/10/2026)

- **Scene** (`src/web/scene/layout.js`, `rooms.js`, `textures.js`, `office.js`): one floor slab with three cutaway department rooms (two back walls, open front, no ceiling): Research at the back (library wall with procedural spines, no titles; reading nook with lamp), Design on the right (pinboard, framed procedural abstract art, credenza), Office on the left (desk floor, one rug per desk row, lockers, whiteboard). Desks have wood tops on dark metal legs, monitors, lamps and chairs; the first desk column is L-shaped. Plants in every room. A lounge in the front corner, the memory core in a central atrium, and the services rack as a small server closet with status lights.
- **Walking:** idle agents walk to lounge seat k and sit; when their status leaves idle they walk back. Paths are precomputed polylines (desk, lane, aisle, a ring round the core, the lounge gate, the seat), tweened at 2.9 units/s: no physics, no pathfinding library. `tests/scene-layout.test.mjs` checks the paths miss every obstacle and that no wall hides a desk, chair, seat, the core or a cabinet.
- **Light and dark:** light has warm white walls with a soft department tint, light wood and daylight from one side; dark has charcoal walls, warm wood, warm LED strips (emissive lines plus additive glow quads, no bloom), glowing monitors and lamps, and one warm accent (`#e9a95c`) shared with the UI.
- **Kept working:** department cards, desk labels, leader lines, collision avoidance and the monitor status glow are unchanged.
- **Assets:** all procedural Three.js and canvas textures; no kit, so no third-party licence file (ASSETS.md, R1 table).
- **fps** (`screenshots/redesign-r1/fps-headed.json`; headed Chrome, Intel UHD iGPU, 1600x1000, full quality = camera still, AO on):

| View | Camera moving | Full quality | Frame avg / p95 |
|---|---|---|---|
| 01 overview light | 80.0 | 69.8 | 14.19 / 16.7 ms |
| 02 overview dark | 79.2 | 69.1 | 14.37 / 16.7 ms |
| 03 research room (zoomed) | 70.5 | 63.1 | 15.73 / 18.1 ms |
| 04 design room (zoomed) | 76.7 | 68.2 | 14.55 / 16.9 ms |
| 05 office room (zoomed) | 75.1 | 65.2 | 15.19 / 17.6 ms |
| 06 lounge, idle agents seated (zoomed) | 79.7 | 68.8 | 14.45 / 16.7 ms |
| 07 desk panel | 82.0 | 71.8 | 13.84 / 16 ms |
| 08 board (scene paused behind it) | 165.2 | 165.2 | 6.05 / 6.2 ms |
| walk: overview dark, 5 agents walking | 64.5 | 64.5 | 15.57 / 17.5 ms |

- **Cut for performance** (first build: 53 to 58 fps, 48 while walking; details in DECISIONS.md, "Redesign R1 build record"): the full-screen backdrop and ground shadow catcher (now a CSS gradient and one drop-shadow quad), the AO frame copy, AO quality 8/8/2 to 6/4/1, two-segment bevels to one, small details left out of the AO pre-pass, and people casting into the baked shadow map (blob shadows instead).
- **Captures:** `screenshots/redesign-r1/01`–`08` plus `fps-headed.json`; `npm run demo:record` re-run on the final code (`screenshots/demo/station-demo.webm` and 4 stills, problems: none). `screenshots/demo/station-demo.mp4` is an older file from 20:37 and was not remade (no pinned MP4 encoder).

- **Files changed in R1:** new `src/web/scene/layout.js`, `rooms.js`, `textures.js` and `tests/scene-layout.test.mjs`; rewritten `src/web/scene/office.js` and `src/web/config/palette.js`; changed `src/web/styles.css` (charcoal dark tokens, warm accent), `scripts/screenshots.mjs` (`--set r1`, `--only`, the walk fps row), `.gitignore`, `ASSETS.md`, `DECISIONS.md`, `PROGRESS.md`; `fixtures/engine/` now committed.

### E4 legacy import (16/10/2026)

- **`npm run import-legacy -- --from C:\Users\marks\projects\Virtual-workers`** (`scripts/import-legacy.mjs`; all logic in `src/engine/import/legacy.mjs` and `backup.mjs`), as ENGINE-PLAN.md §7.1 and §7.3 describe:
  - **Read only on the source.** Every read goes through `openSource().abs()`, which refuses anything outside `station-workspace/` and refuses `.secrets/`, `.env*`, provider keys and `.git/` by name (never opened; listed in the report). The roster is read for its agentId to name pairs only and is not copied. The §7.1 "Not imported" list is skipped and listed.
  - **Every write through the data jail**, with the engine lock held (an import refuses to run while an engine is on the data root).
  - **The backup comes first**, every run: `data/.backups/<stamp>/` (the database by SQLite `VACUUM INTO`; ledger, events, import record and the engine's job folders copied; `data/legacy/` hard-linked) with `BACKUP.json`. Restoring means swapping the folder back by hand.
  - **Staging, then a swap.** The run builds `data/.import-staging-<stamp>/legacy/` starting from what is already imported and merges by source id (ledger `entryId`, run `runId`, listing id, cron id, file path). It then verifies every staged file's sha256, the row counts and the ledger total. If nothing differs, it discards the staging folder. Otherwise it swaps the folder in for `data/legacy/` and upserts the legacy jobs, tracker rows and routines in one transaction; a failed transaction puts the old folder back.
  - **`data/import/IMPORT.json`**: every source path read, with its size, sha256 and mtime; every imported file with its size and sha256; row counts; refusals; the incident record. Each run also writes `data/import/runs/<stamp>.json` and `.md` (the reconciliation report with workings).
  - **Legacy rows are tagged.** Ledger and run rows carry `source: "legacy"`; jobs, tracker rows and routines carry `legacy = 1` in the store. Legacy jobs are on the line `legacy:room1-etsy` with `room: etsy-pod`. Routines are imported **disabled** (one was enabled in the source).
- **Where it lands:** `data/legacy/` (`jobs/<id>/{work,outbox,rejected,package}/`, `research/`, `notebooks/`, `archive/` (transcripts, task briefs), `incidents/`, `routines/`, `tracker/`, `room1-etsy/`, `ledger.jsonl`, `runs.jsonl`, `agents.json`, `jobs.json`) and the store.
- **Disagreements are not resolved.** Where the tracker and `rejected/` disagree, both are imported as they are. The job's state follows its tracker row, and the disagreement is a warning on the job, so 8 jobs carry one: 7 tracker "blocked" jobs, and the "parked" camping r5, all of which `rejected/` also holds ("pre-originality-gate brief, archived 2026-10-16").
- **Reconciliation on 16/10/2026** (the source as it stood; it has grown since the plan: 153 to 162 ledger rows, 105 to 108 runs, 97 to 98 task briefs, 6 to 7 drafts):

  | Source | Source | Imported |
  |---|---|---|
  | `starnet/ledger.jsonl` | 162 rows, $8.5000719 | 162 rows, $8.5000719 (match) |
  | `starnet/runs.jsonl` | 108 | 108 |
  | `tracker/listings.csv` | 11 (7 blocked, 3 rejected_by_owner, 1 parked) | 11 |
  | `*.notebook.json` | 21 records in 4 files | 21 (memory-core viewer) |
  | `cron.jobs.json` | 2 | 2, both disabled |
  | `transcript-history-v2/` | 1,319 rows, 2 files | archive |
  | `task-briefs.json` | 98 briefs | archive |
  | job folders | work 13 (160 files), outbox 7 (28), rejected 15 (79), approval-queue 1 (14) | 16 legacy jobs: 7 blocked, 3 rejected_by_owner, 4 rejected, 1 parked, 1 unfinished |
  | research-lab | 11 files (1 brief, 7 drafts, 1 scouting, 1 rejected, products.json) | `data/legacy/research/` |
  | `_aborted-trigger-20261015` | 1 folder | incident record |

  **Ledger workings:** every amount is summed as integer nano-dollars (exact). By Dublin day: 14/10 $1.4483402, 15/10 $6.1821201, 16/10 $0.8696117. By model: anthropic/claude-haiku-5.5 $0.7305996, anthropic/claude-sonnet-5.5 $2.0211921, claude-haiku-5-5 $0.8886839, claude-sonnet-5-5 $4.8595964, openai/gpt-5-mini $0.0000000. Each breakdown, and the breakdowns by agent and by job, sums to $8.5000719. Attributed to a job: 131 rows, $8.2075351; unattributed: 31 rows, $0.2925369. A run is attributed only where an artifact path or its title names one known legacy job id. Image cost is not in the legacy rows and stays unknown.
- **Idempotency:**
  - Run 1 (20261016T195941264Z) imported everything: 162 ledger rows, 108 runs, 313 files and 29 store rows.
  - Run 2 (20261016T200005961Z) reported "nothing changed: 0 rows added, 0 rows upserted, 0 files added or changed, 0 store rows inserted or updated". The tree hash of `data/legacy/` and the bytes of IMPORT.json were identical.
  - Run 3 (after the job record's system label was changed to "legacy station", to keep the old system's name out of the UI) updated the 16 job rows, with before and after values logged, and added 0 rows and 0 files.
  - Run 4 (20261016T200456338Z) changed nothing again.
  - Each run took a backup first. A stat of all 2,348 non-secret files in `station-workspace/` before the first run and after the last run shows no file added, removed or changed.
- **The office on the engine (`data/`, mock provider):**
  - The board has Blocked (7), Rejected (7) and Parked (1) side by side; the unfinished pngtuber job sits in the design column.
  - Legacy jobs show a LEGACY tag, their warnings, a "Legacy record" box (each source folder, the tracker status, attributed runs), the legacy runs as hops, QA passes, designs (thumbnails from `data/legacy/`), the listing and the attributed legacy cost.
  - The memory-core viewer shows the 21 legacy notebook records (read only, never fed to agents, Q9) and the legacy ledger beside the engine's, which is still empty.
  - Legacy spend is never in the engine's totals, caps or "Today". Department counts and metrics count engine work only.
- **Screenshots** (`node scripts/screenshots.mjs --engine --out e4`, 1600x1000): `screenshots/e4/01-overview.png`, `02-board.png`, `03-calendar-month.png`, `04-memory-core.png`, `05-legacy-job-panel.png` (outdoors-dad-camping-tee-r5: parked, with its disagreement warning).
- **Port drift:** none, before and after (all 50 sources match).

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
- `df26478`: the keyword-source re-port and the re-verified dry run
- `3a075d8`: demo mode
- `63e18bd`: demo hardening (E4 item 0)
- `939385e`: E4 milestone: the importer, backup and tests
- `5db312e`: E4 legacy import
- `8f307ce`: Housekeeping (R1 item 0)
- `cd74ce6`: R1 milestone: cutaway rooms, lounge walking, warm dark mode
- `7cf2865`: Redesign R1
- `ca7eca4`, `39ab7a2`, `91734ae`: R2 milestones 1 to 3 (layout and light mode, people, UI polish and cached AO)
- `5ea8cc9`: Redesign R2
- `e357600`: R2 follow-ups (E5 item 0)
- `4f3e076`, `286be16`: E5 milestones 1 and 2 (engine and server write path; the page's controls)
- `6181a87`: E5 live UI (fixes from the captures, line endings, docs)
- `39b48c8`: Normalise line endings (`.gitattributes`)
- The next commit: "Pre-E6 housekeeping" (E5 approval, drift list, port-step items, E6 readiness checklist)

`.gitignore` excludes `data/`, `data-demo/`, `dry-run/`, `fixtures/*` (except `fixtures/engine/`), `design-refs/`, `screenshots/`, `.cache/`, `logs/`, `*.log`, `.env` and `node_modules/`. `core.autocrlf` is false in this repository, so files are committed byte for byte. Before the first commit, the staged files were scanned: they contained no ignored paths, no key or token patterns and no email addresses.

**Housekeeping (Redesign R1 item 0, 16/10/2026):** `fixtures/engine/` is now committed (the owner's order). Before un-ignoring it, every file was checked: it holds only synthetic FIXTURE data (FixtureShop1–5, placeholder listing ids 1000000001–5, made-up USD 7.50–9.99 brief prices, the FIXTURE product and config patch, the scripted mock replies) and nothing from the real snapshot, so nothing had to be moved out. `.gitignore` now ignores `fixtures/*` except `fixtures/engine/`, so the legacy snapshot (`fixtures/station-root/`, `SNAPSHOT.json`) and `fixtures/synthetic/` stay local. `design-refs/` (the owner's mood references) is ignored; `git rev-list --all` + `ls-tree` confirms no `design-refs` file was ever in a commit.

## Half-built

- **Packaged digital products** fail closed. Only the read side of `digital-build` is ported. The clean-up (now including the enclosed-background step), Real-ESRGAN and the zip build are not, and `src/` allows no child process. This affects `pngtuber-prop-pack`, and fixing it needs an owner decision.
- **Style-reference workflow** fails closed. Only `styleRefProblems` is ported; there is no first-file run mode and no `reference_image` in `image_generate`.
- **Routines** run `line:research` and `line:room1-digital` (E5). With the mock replies the research line ends "no drafts" (the fixture script has no researcher replies), so no test runs a research batch that verifies a brief; the demo's script does.
- **The package folder** cannot be opened from the page (the server starts no process); the page shows its path with a copy button.
- **Live providers** are locked (`ProviderLocked`). The Anthropic SDK is not installed and the effort mapping is not written (E6).
- **Web search and fetch** return canned text in the mock, and the `anthropic-web` price is unset, so a live web call would be refused (E6).
- **Legacy archive** (Q10): the transcripts and task briefs are imported to `data/legacy/archive/`, but no page shows them yet (E5, if wanted).
- **Parity check** (§7.2 step 3), which replays every legacy job folder through the ported gates and compares the results: not done in E4.

## Test status

`npm test`: **198 passed, 0 failed**, after E5 (17/10/2026); new: `live-ui` 9/9, `people-looks` 2/2; changed: `import-legacy` (the Legacy lane), `engine-server` and `demo` (idempotency key, resume version), `write-guard` (the E5 capture script's own jail). After Redesign R2: 187 passed; new: `scene-layout` 5/5 (the lounge-seat test), `model` 15/15 (role labels). After Redesign R1: 186 passed (16/10/2026, about 22:00 Irish time). After E4: 182 passed, 0 failed in 14 suites (16/10/2026, about 21:10 Irish time). New in E4: `import-legacy` 4/4, `demo` 9/9 (2 new) and `write-guard` 20/20 (1 new: the importer's writes and source refusals). The table below is from demo mode (175/175).

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

1. **Wait for the owner's legacy job** `2026-10-16--pngtuber-cosy-desk-props-r2` to finish.
2. **Port step, one batch:** run `npm run port-drift` again, read the "To port to office-agents" log in Virtual-workers (read only), port the drifted files and the logged fixes at a new moment in PORTED.md, and build the three planned items (ENGINE-PLAN.md §9, "Port step before E6"). Mock only.
3. **E6** starts when every row of the E6 readiness checklist above is done.

Re-run `npm run import-legacy` at any time to pick up legacy deltas; it backs up first and changes nothing when there is nothing new.

Before each, run `npm run port-drift` and `npm test`, and commit at the milestone.
