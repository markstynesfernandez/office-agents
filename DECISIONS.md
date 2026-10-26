# DECISIONS.md — station-office

Record of the owner's decisions for the station-office project (the clean-room 3D agent office
viewer for the StarNet station in `C:\Users\marks\projects\Virtual-workers`). Claude drafts and
flags; the owner decides. Every entry below was decided by the owner on 2026-10-16 unless a later
date is given. REUSE.md (Phase 0 audit) was approved as written on 2026-10-16.

## Answers to the Phase 0 questions (2026-10-16)

| # | Question | Decision |
|---|----------|----------|
| 1 | Approve REUSE.md? | Approved as written, with the decisions below. |
| 2 | Phase 2 data: files only, or files plus read-only routes? | Files plus a strict allow-list of read-only routes (decision 1). The token lives in office-agents' own env file, is read by the server only, and is never sent to the page. |
| 3 | Hub definition | "Station memory" = notebooks plus the ledger, labelled "last recalled by" (decision 5). |
| 4 | Design thumbnails | Yes, use `sharp` into office-agents' own cache (decision 9). |

## Decisions

### 1. Data sources
Files first, as REUSE.md §2 lists. In Phase 2, live reads from StarNet are allowed, but only
through a hard-coded allow-list of GET routes in one module, `src/server/starnet-api.mjs`:

- `/api/health`, `/api/version`, `/api/state/snapshot`, `/api/budget/status`
- `/api/line-jobs`, `/api/line-jobs/<id>` (GET only)
- `/api/routing/lines/stats`, `/api/routing/triggers`
- `/api/cron`, `/api/cron/history`
- `/api/providers`, `/api/channels/status`, `/api/hooks`, `/api/halt`
- the `/api/channels/events` SSE stream

Never call the GETs REUSE.md flags as reaching the network or changing state: `/api/model-tiers`,
`/api/models/*`, `/api/credits*`, `/api/update/status`, `/api/skill-market`, `/api/runtime/agent`,
`/api/spotify/callback`, `/api/connectors/oauth/callback`. If StarNet is offline, fall back to
files and show "StarNet offline".

*Implementation note:* the allow-list is the exported constant `ALLOWED_GET_ROUTES` in
`src/server/starnet-api.mjs`; `tests/write-guard.test.mjs` fails on any StarNet route outside it
anywhere in the codebase (except the disabled write adapter, which is itself checked separately).
In Phase 1 the module exists with the allow-list and a fetch helper but nothing calls it.

### 2. Station code reuse
Copy the pure read functions listed in REUSE.md §2 into `src/lib/starnet-readers/`:
`readLedger`, `costInWindow`, `rosterNames`, `idsForNames`, `readTracker` + CSV parser +
`COLUMNS`/`STATUSES`, `designPasses`, `briefUsdRange`, `latestIllustration`, `isHero`,
`activeAgents`, `LISTING_ID_RE`, `readJson`. Each file carries a header comment naming the source
file in `Virtual-workers/station`. Do not import from Virtual-workers at runtime, and do not copy
`api()` or any writer.

*Implementation note:* the copies take the station root as a parameter instead of reading the
station's own `config` module, so the same code runs against `fixtures/station-root/` (Phase 1)
and `C:\Users\marks\projects\Virtual-workers` (Phase 2).

### 3. Desks
Show the 8 active agents only. Hide BRIDGE using the `activeAgents()` logic. Skip the unassigned
desk `p15` and the HAB-32 bay room in v1.

### 4. Departments
Departments come from the StarNet save (rooms + desk props, point-in-rect), cross-checked against
`station.config.json floorRooms`. If they disagree, show a warning badge rather than picking one.

### 5. Hub = "Station memory"
All notebook records across agents (entry count), "last recalled by <agent> at <time>" from the
newest `lastUsedAt`, plus the ledger row count and latest entry. Do not show "last read by".

### 6. Board columns
`brief → design → qa-design → listing → qa-listing → approval queue → done (approved/published)`.
Side lanes: **rejected** (REJECTS-DESK, `rejected/`, `rejected_by_owner`) and **blocked**. Blocked
includes the "QA passed, gate failed" case (REUSE.md D7) with `status_reason` shown. Stage is
derived per REUSE.md §2.4 (files + tracker status).

### 7. Spend
Show the calendar day and label it as such. Where StarNet's trailing-24h figure is shown, label
that too.

### 8. STATION-OVERSEER
Show "No report yet" when `overseer/reports/` is empty. Never invent content.

### 9. Design thumbnails (Phase 2)
Generated with `sharp` into `office-agents/.cache/thumbs/` only. Add `sharp` to ASSETS.md.

### 10. Discrepancies D1–D10
Being fixed in a separate StarNet session. Leave StarNet and station-workspace untouched. Where
they affect display, handle them defensively in the readers: D4 name normalisation (compare on
letters and digits), D5 coordinate frames (the save's room/prop frame is the one the office uses;
the routing plan's frame is offset by +3,+3 and is only used for stage order), D8 transcript counts
(never shown as an exact figure without the source named).

### 11. Write adapter (still not wired in v1)
The StarNet session is making the human review pause before LISTER a config flag that defaults
to off. WRITE-PATH.md must not rely on that pause. "Needs my OK" in the office means a task or
routine is created but not started, and routines are created with `enabled:false`, until the
owner confirms in the office UI. The only human gate in the pipeline itself is the approval queue
before the owner publishes to Etsy.

## Phase 1 instructions (static mock)

- Build the mock as specified in the original prompt. All fake data uses the real shapes from
  REUSE.md: roster entries, room rects, routing plan, ledger/runs rows, tracker rows with the real
  statuses, MANIFEST.json, notebook records, cron jobs. It lives in `fixtures/` so Phase 2 only
  swaps the data source.
- Realistic states across the 8 desks: idle, working, waiting for approval, error, plus at least
  one blocked job and one rejected job on the board.
- The write-guard test exists from day one and covers the allow-list in decision 1. Any route not
  on the list fails the test, as does any write to `Virtual-workers/` or `station-workspace/`.
- Screenshots: Playwright as a pinned dev dependency; start the mock locally; capture 4 views at
  1600×1000 into `office-agents/screenshots/phase1/` as `01-overview.png`, `02-desk-panel.png`,
  `03-calendar.png`, `04-dark-mode.png`; `npm run screenshots` re-runs it. Stop for review after.

## Standing rules carried over (set 2026-10-16, still in force)

- Inspect StarNet by reading files only. Never call a StarNet endpoint until a phase that allows
  it (Phase 2, decision 1), and then only the allow-listed GETs.
- Never open the StarNet UI (http://127.0.0.1:8787) in any browser, headed or headless.
- Never start, stop, restart or modify StarNet, its save, roster, hooks, `.env` or
  `provider-keys.json`. Write nothing inside `Virtual-workers`. Run no git commands there.
- Clean room: nothing from ajsahni/agents-office or any non-permissive repo. CC0 or procedural
  assets only, pinned licence-checked dependencies, all recorded in ASSETS.md.

## Phase 1 review, round 1 (owner, 16/10/2026)

Fix, re-capture, stop for review. Still no live wiring; nothing written to `Virtual-workers/` or `station-workspace/`.

1. Data accuracy: fixtures rebuilt from a read-only snapshot of the real files (`npm run snapshot-fixtures`, reads only
   from Virtual-workers, writes only into `office-agents/fixtures/`, image files as downscaled thumbnails; listed in the
   write-guard test). Missing test states go in a separate `fixtures/synthetic/` overlay with a "synthetic" tag in the UI.
   Model, provider and role per agent from the roster; never the system prompt (role truncated to one line). Routines
   only from `cron.jobs.json`; paused ones are not projected, listed as "paused · waits for my OK" with the schedule in
   words, plus an off-by-default toggle "show where paused routines would run" (ghosted). Overseer: "No report yet".
2. Performance: 60 fps target on the Intel iGPU in headed Chrome at 1600×1000. Render on demand, low-tick idle
   animation paused when hidden, DPR ≤ 1.5, AO at half resolution, baked static shadows, instancing, merged static
   geometry, fps/frame-time overlay on F, average fps per view in the screenshot output.
3. Scene look: cooler lighter gradient backdrop; department floor tint and darker bevelled edge; stronger drop shadow;
   darker walkways; a recognisable memory core that pulses on a new ledger row; a services rack on its own mini
   platform (status lights configured / manual / offline / unknown); shadows attached; monitors glow in status colour
   at overview, canvas text only when zoomed in or selected; cards with collision avoidance and leader lines, ~20%
   smaller, above the far edge of the platform; desk labels hidden below a zoom threshold except selected/working;
   dark mode on deep blue-charcoal with a rim; camera pans so the selected desk sits left of the panel.
4. UI: one-line top bar (service icons + status dots with tooltips; runtime in the StarNet badge tooltip; "Today $x /
   $cap cap · n runs"); task titles ellipsised with tooltips; Blocked and Rejected chips so counts add up to All;
   pills + status_reason for blocked/rejected, progress % only for active stages; one date format (dd/mm/yyyy, 24h,
   relative time in brackets); calendar without dead space, one entry per job on the day of its latest stage change
   with a stage chip, clickable, "today" the same size as the other controls.
5. Re-capture 6 views into `screenshots/phase1-r2/`, report fps per view and every file changed, then stop.

Implementation notes (for the owner's review, not decisions):
- Source conflicts are flagged on the job, never silently resolved: an owner decision in the tracker
  (approved / published / retired / rejected_by_owner) wins over `rejected/`; a newer `rejected/` entry wins over a
  stale tracker "blocked". Each case adds a warning to the job panel and a count to the notice box.
- Job titles are the listing-id slug ("Funny Bbq Dad Tee R7"); the tracker niche sentence is kept as detail.
- Text quoted from source files (status_reason, REJECTED.md) is shown verbatim, including its own date format.

## Engine plan approved (owner, 16/10/2026)

ENGINE-PLAN.md is approved. Build E1, E2 and E3 back to back, stopping early only if a test fails or a decision is
needed that is not covered here. Stop at the end of E3 with the dry-run job for review. E1–E3 run on the mock provider
only: zero model spend, and no real API keys are loaded.

### Answers to ENGINE-PLAN.md §10

| # | Question | Decision |
|---|----------|----------|
| Q1 | Billing on Stellar's Anthropic Console credits | **Verbal approval from finance (Lorena), 17/10/2026**, for the engine to run on the station workspace's Console credits; written confirmation to follow. See "E6 readiness: owner decisions". |
| Q2 | Caps for digital jobs | **Set by the owner 17/10/2026:** USD 5.00 per job (images included), 10.00 per day, 10.00 per line per day, 0.50 per scout run. See "E6 readiness: owner decisions". |
| Q3 | Products and the other §4.3 items (licence wording, image terms, market/spelling, AI disclosure, pricing) | **Partly decided (17/10/2026, port batch):** the `pngtuber-prop-pack` spec (12 files, one ZIP), its licence and notice wording, US English, the AI-disclosure wording and the price approach are owner decisions, ported (see "Port batch before E6: owner decisions"). Still open: the image model's terms in the engine, other products. |
| Q4 | Listing loop exhausted | **Yes:** it goes to REJECTS-DESK, so every stopped job gets a `REJECTED.md`. |
| Q5 | `saturated` originality list | Keep it, for all text. |
| Q6 | Researchers' web backend | Anthropic's server-side web search and fetch tools, counted in the caps. Price confirmed at E6. |
| Q7 | Where caps are edited | Config only. |
| Q8 | Where prompts are edited | Files only. |
| Q9 | Agent memory | None beyond the prompt and the job folder. |
| Q10 | Transcripts and task-briefs | Imported as a read-only archive. |
| Q11 | Tracker statuses | Keep all seven (`packaged, blocked, approved, rejected_by_owner, published, retired, parked`). Parked items go in a Parked lane, not the approval queue. |
| Q12 | Concurrency | One job per line at a time. |
| Q13 | Starting a verified brief | Needs the owner's click, until the owner enables a line routine. |
| Q14 | Brand | "Station" placeholder. |

### Build notes

- **E1:** rename sweep per Appendix C, `data/` root, `dataJail`, write-guard v2, delete `starnet-api.mjs` and the
  write adapter, NOTICE.md. Re-capture the 6 views into `screenshots/e1/`.
- **E2:** decide `node:sqlite` vs `better-sqlite3` by test and record the result. The spend guard and the e-stop are
  the most-tested modules: reservation, refusal at each cap, restart mid-run, HALT file, CLI e-stop.
- **E3:** port at a fixed moment and record each source file's sha256 in PORTED.md. Add `npm run port-drift`
  (read-only). If the StarNet session has changed a source file since the snapshot, port the current version and list it.
- **E3 dry run:** a fixture digital brief with a 5-file product spec (so it can pass the Etsy file limit) goes through
  every stage, including one QA-DESIGN rework and the package gate, and lands in the approval queue. A second fixture
  brief trips the originality gate and must end blocked or rejected, with the reason.
- **At the end of E3:** test output for all suites; screenshots of the office at each stage of the dry-run job
  (`screenshots/e3/`) plus the job folder path, MANIFEST.json and cost.json (mock $0.00 rows); the originality-trip
  job's result and reason; PORTED.md and any port drift; files changed. Then stop.

Decision 1 (live reads from StarNet's API) and decision 11 (the write adapter) are superseded by ENGINE-PLAN.md §8:
the engine makes no StarNet HTTP calls at all, and the write adapter is removed.

## E1–E3 build record (16/10/2026)

These are choices made inside the approved plan and the answers above, plus the open points the owner should see. None of them changes a cap, a price, a licence or a product.

### Choices made in the build

- **Store (E2): `node:sqlite`.** It was tested against the plan's needs on Node 24.16 (SQLite 3.53.0): a crash mid-transaction leaves no partial write, WAL works, it opens across versions, and there is no ExperimentalWarning. `better-sqlite3` is not installed (one less native dependency). `tests/store-backend.test.mjs` records the result.
- **Port (E3): two fixed moments.** Everything was staged and hashed at 2026-10-16T18:16:46Z. The legacy build kept changing during E3, because another session was working in Virtual-workers. At 18:42:21Z, 9 ported sources had changed and `style-ref.mjs` was new, so their current versions were re-staged and ported again, as the build note asks. PORTED.md marks each row "1st" or "2nd". `npm run port-drift` showed no drift at the end of E3.
- **Not ported, failing closed:** the packaged-product build (clean-up, Real-ESRGAN through a child process, zip) and the new style-reference workflow (file 1 drawn alone, the owner's approval, then a reference image). A packaged product is blocked at prep. A style-reference product is refused at the package gate. Today that covers `pngtuber-prop-pack`. Running it in the engine needs an owner decision on how the build runs: the engine allows no child process yet, and image_generate has no reference image. This blocks that product only, not E4–E5.
- **Observer hooks:** the dry run's screenshot hooks are observers. A failing hook is logged and never changes a job.
- **Prompt budgets:** the engine test enforces the owner's caps (lister and qa-listing 13,000) and targets (lister, qa-listing and qa-design 12,000). Agents without an owner budget keep the legacy 16,000-char clamp. demand-researcher (14,895) and evidence-checker (14,867) are under that clamp but over 12,000.
- **Dry-run fixtures:** the dry run uses `fixtures/engine/`: a FIXTURE 5-file sticker product, plus a config patch marking the notice and the personal-use licence FIXTURE-approved, with an AI disclosure that does not claim a clean-up. These apply to the dry run's own data root only. `config/` keeps the real DRAFT statuses.

### For the owner (open; nothing decided here)

- **Q1:** `config/station.config.json` (copied unchanged) says the text models run on "Anthropic Console credits approved by Finance" (owner, 14–15/10/2026). That reads as already settled, while Q1 is still being confirmed with finance. Please reconcile the two before E6.
- **qa-design** is now 11,986 characters against the 12,000 target (the 2nd-moment prompt grew), which leaves 14 characters of headroom.
- `imagesPerDay` is 0 (no count cap); image spend still counts in every USD cap (Q2).
- The effort mapping and the Anthropic SDK install are deferred to E6. In the mock, web search and fetch return canned text.

## Demo mode (owner, 16/10/2026)

The owner specified demo mode (`npm run demo`, presenter view, `npm run demo:record`). Asked about two points where the spec and the approved line differ, the owner answered:

- **Job B's ending:** keep the real line. Job B ends **blocked at prep**, with its originality reason, after the one retry. It does not go to REJECTS-DESK, because only an exhausted QA loop reaches it (ENGINE-PLAN.md §3.1, Q4). There is no routing change, and the deviation from the spec ("ends at REJECTS-DESK") is reported.
- **"In parallel":** keep one job per line (Q12) and leave the concurrency setting unchanged. Job B runs first, so it trips the originality gate early in the demo, and job A follows straight after. The research batch that verifies job A's brief runs on the research line at the same time as job B.

Choices made in the build (inside the spec; no cap, price, licence or product changed):
- **Demo data:** `demo/products.json` (a 5-file DEMO sticker product), `demo/station-patch.json` (notice and licence marked as approved DEMO values, the same three keys as the dry-run patch) and `demo/briefs/` apply only to the demo engine. These are DEMO values, not owner decisions; `config/` keeps the real DRAFT statuses. They are committed, unlike `fixtures/`, so a fresh clone can run the demo.
- **Key refusal:** the demo refuses any non-empty `ANTHROPIC_*`, `OPENROUTER_*` or `OPENAI_*` variable ending in KEY or TOKEN, plus the engine's own secret names. Error messages name the variable and never the value.
- **MP4:** not produced. The only pinned, licence-checked converter is Playwright's ffmpeg (build 1013, LGPL-2.1), and it writes WebM only. A GPL-3.0 ffmpeg 8.1.2 on PATH is not pinned or licence-checked here, so it is not used. For an .mp4, the owner would need to approve a converter and its licence.

## E4 build record (16/10/2026)

Choices made inside ENGINE-PLAN.md §7.1, §7.3 and §8 and the owner's E4 instructions. None changes a cap, a price, a licence or a product. For the owner to confirm or change:

- **One imported folder, `data/legacy/`.** The plan's table names `data/jobs/<id>/` and `data/research/`. All imported files go under `data/legacy/` instead (`jobs/<id>/{work,outbox,rejected,package}/`, `research/`, `notebooks/`, `archive/`, ...). The staging folder is then swapped in with one rename, and legacy files never mix with the engine's own job folders. Each job keeps every source folder side by side, so `work/`, `rejected/` and the approval queue (`package/`) can hold the same file names without overwriting one another.
- **Legacy spend has its own file.** The legacy ledger rows (`source: "legacy"`) are in `data/legacy/ledger.jsonl`, not in the engine's `data/ledger/ledger.jsonl`. Legacy spend was on the legacy station's keys (§7.2 step 4: the two systems' spend is never mixed), so it must not count towards the engine's daily, line or job caps or its "Today" figure. The memory-core viewer shows both ledgers, labelled.
- **Job attribution on explicit evidence only.** The plan matched runs to jobs by line, dock and time. The importer attributes a run (and its ledger rows) to a job only when an artifact path or the run title names exactly one known legacy job id, and otherwise leaves it as `jobId: null` ("unattributed legacy"). On 16/10/2026 that gave 131 rows ($8.2075351) attributed and 31 rows ($0.2925369) unattributed. No time-window guessing.
- **Disagreements: the state follows the tracker row; nothing is resolved.** A legacy job's state is its tracker status where it has a tracker row; without one, `rejected/` gives "rejected", and a work folder alone gives "legacy-open" (shown as "unfinished"). Where `rejected/` also holds a job the tracker does not call `rejected_by_owner`, both are imported as they are and the job carries a warning (8 jobs on 16/10/2026). This differs from the Phase 1 legacy view, which showed the newer of the two.
- **Imported history is never dropped.** A key or file the source no longer has stays imported, and the run report lists it. A changed key is upserted, and its before and after values are logged.
- **Not imported, as listed in §7.1.** In addition: the folders' own `.git/` (research-lab, overseer) is refused by name like the secrets, and `overseer/` holds no reports, so nothing comes from it. `room1-etsy/products.json` and `fx.json` are copied for reference.
- **Agent mapping.** The roster's agentId to name pairs are read, not copied, and matched to engine agent keys on letters and digits (D4). The legacy BRIDGE id `agent` has no engine agent and stays unmapped ($0.0010153).

## Redesign R1 build record (16/10/2026)

The owner's R1 brief: the office scene look only, one phase. Choices made inside it, for the owner to confirm or change. No cap, price, licence or product changed.

- **Procedural only, no kit.** Everything is procedural Three.js plus canvas textures; no Kenney or other kit was downloaded, so no third-party asset or licence file was added (ASSETS.md). The design references in `design-refs/` were used for mood only and are git-ignored.
- **One slab, four corners.** The department rooms sit in three corners of one floor slab (Research at the back, Design on the right, Office on the left) with the lounge in the front corner, round a central atrium with the memory core. The server closet sits at the back between Research and Design. The room assignment follows the server's department order, as the platform slots did. Only three department rooms are drawn: a fourth department would be left out with a console warning (there are three today).
- **Cutaway rule, tested.** Every room has two full-height back walls and an open front. The atrium's outer edge is walled too, so the back of the slab reads as one building. The closet has a full back wall and a low (1.1) partition on its left, so it does not hide the Research room. `tests/scene-layout.test.mjs` checks that no wall hides a desk, a chair, a lounge seat, the core or a server cabinet from the isometric camera.
- **Who goes to the lounge.** Only the `idle` status sends an agent to the lounge; `working`, `waiting` and `error` keep (or bring) the agent at the desk, where the monitor and status light are. Agent k (department order, then desk order) always gets lounge seat k; the lounge has 8 seats (two three-seat sofas, two armchairs). An agent beyond the eighth would stay at the desk when idle. On page load agents are placed without walking; status changes walk them (2.9 units/s, about 12 s desk to lounge). The desk labels, monitors and cards stay at the desk.
- **Captures.** The room and lounge close-ups (03 to 06) are in dark mode, the main look; the overviews come in both modes; the desk panel and the board are in light mode (the default theme). Data is the fixtures legacy view with the synthetic test states, as in earlier rounds.
- **Performance cuts (to hold 60 fps full quality in headed Chrome on the iGPU at 1600x1000).** The first build ran at 53 to 58 fps (48 while agents walked). Cuts, all measured one by one:
  - The backdrop is now a CSS gradient behind a transparent canvas, and the full-screen ground shadow catcher is replaced by one soft drop-shadow quad under the slab (together about 3.8 ms a frame).
  - The GTAO pass multiplies AO straight onto the frame instead of copying the frame first (about 1 ms).
  - AO quality 8/8/2 to 6/4/1 samples (GTAO / denoise / rings), about 1 ms; no visible change at this scale.
  - Furniture bevels use one segment instead of two (triangles halved to about 55k per pass); small details (keyboards, desk lamps and bulbs, status lights, screens, wall pictures, LED strips) are left out of the AO pre-pass.
  - People cast no shadow into the baked shadow map (it would need re-baking every frame they walk); they have soft blob shadows instead.
  - Tried and not kept: Lambert instead of PBR materials (no measurable gain, so the PBR material stays) and 2x MSAA (a small gain; 4x is kept).

## Redesign R2 build record (17/10/2026)

The owner's R2 brief: light-mode contrast, a tighter layout with props, new people, UI polish, one phase. Choices made inside it, for the owner to confirm or change. No cap, price, licence or product changed.

- **Atrium about 40% smaller.** The band between the back and front rows is 4.3 deep (R1 6.8) and the gap between the left and right columns 5.4 wide (R1 9.3); the rooms move in round it. The core plinth radius is 1.5 (R1 2.5) and its walking ring 1.95 (R1 3.3). Measured on the fixtures layout, the open floor outside the rooms, the lounge and the closet is 179.7 square units against R1's 316.1 (43% less); the slab is 26.0 x 18.2 (R1 29.9 x 20.7).
- **The server closet turned a quarter turn.** Its five cabinets stand in a row along the back gap's left side, against the open right side of the Research room behind the low partition, and face the core. In R1's row along the back wall the gap could not be narrower than about 7.1. The cutaway test checks every cabinet front and status light is seen.
- **Props, and where they cannot go.** Printer and water cooler against the atrium's back wall (with a clock, a picture and a shelf with a trailing plant above), five benches (atrium left wall, beside the core, in front of the Design room, at the slab's right edge, at its front edge), a round meeting table with two stools in the Office, an easel in the Design room, and plants in every room, the lounge and the atrium. Two parts of the floor are hidden from the camera and are left almost empty: the right half of the back gap (behind the Design room's left wall; anything within about 2 units of that wall is hidden up to the wall's height) and the left end of the atrium band (behind the Office's back wall). The layout test checks that no prop is hidden and that no walking path passes through one.
- **Walking paths.** When the straight line from a room's exit to the lounge gate is clear of the core, the closet, the lounge, other rooms, props and plants, the agent walks straight; otherwise round the core's ring, as in R1.
- **Atrium floor.** Polished concrete in both themes (a light warm grey in light mode, a dark grey in dark mode) in place of the mottled stone. The plaza disc under the core and the core's glow pool are about half their R1 radius, and the glow sprite is about half its size.
- **Light mode.** Crisper walls with a stronger department tint (42% of the accent, R1 15%), a warmer honey wood floor, dark grey rugs under the desk clusters, a lower sun from the front right (direction 22, 17, 11; R1 20, 30, 3), a stronger sun with a weaker sky fill (3.5 and 0.6; R1 2.0 and 1.2) so the shadows read, and softer shadow edges (shadow radius 6, R1 4).
- **People.** Stylised low-poly figures, one instanced mesh per part: head with hair (four styles), torso, two-part arms, hands, two-part legs, shoes. The shirt takes the agent's colour; skin tone, hair colour, hair style and trousers are picked from the agent's id (a fixed hash), so each agent always looks the same. Poses come from joint angles: typing at the desk (hands on the keyboard, small finger and head motion while working; waiting and error agents sit in the same pose without the motion), leaning back with the hands on the lap in the lounge, walking with swinging arms and legs. Seated people's hips rest on the seat, and the shin angle is solved so the feet are on the floor.
- **Lounge seats.** Each seat is the centre of a sofa cushion or an armchair cushion (layout.js builds the seat positions from the same furniture sizes that rooms.js draws), facing the way the furniture faces. `tests/scene-layout.test.mjs` asserts that each seat's hips (centre and both sides) and knees lie inside its cushion, at cushion height, facing the coffee table, and that no two seated people overlap.
- **Role labels.** A role that reads like a prompt (starts with "You are", or is over 80 characters) is never shown. The page gets "department · duty" instead, where the duty comes from the agent's name (DEMAND-RESEARCHER becomes "Research · demand researcher"). `model.mjs` is pure (it reads no files), so it does not look up the engine's agent configs. The rule (`src/web/ui/role.js`) runs on the server in both the legacy view and the engine view, and again in the desk panel. In the fixtures every legacy roster role is prompt text, so all eight now show a label. The engine configs' roles are short and are shown unchanged.
- **Task list.** An "Active" chip comes first and is the default: in progress, waiting for my OK, backlog and blocked. "All" and the status chips are unchanged.
- **Board.** The Rejected lane shows its count and the 3 most recent jobs (by the time of their last stage change), with "show all" and back.
- **Research card.** "evidence checks passed" (legacy view) and "verified briefs" (engine view) both read "verified".
- **Top bar services.** A small glyph, a short name (Anthropic, OpenRouter, ESRGAN, Etsy, Mock) and the status dot, in place of the letter chips. The glyphs are generic shapes drawn for this project, not company logos.
- **Captures.** 01, 02, 06 and 09 are in engine mode (the engine on the mock provider, as `npm start` runs it). With no job running, every agent is idle, so all eight sit in the lounge. 03 to 05, 07 and 08 are in the legacy fixtures view, whose labelled synthetic states put some agents at their desks. For 07 only, QA-DESIGN (idle in the fixtures) is set to working on the page so that both Design desks are occupied. Nothing is written, and its monitor shows the synthetic badge; its desk label does not, because labels come from the server snapshot. Rooms: Research in light mode, Design and Office in dark mode.
- **Performance.** The fps conditions changed between sessions: on 17/10/2026 the R1 code itself measured 63 fps full quality on the overview against 72 on 16/10/2026, on the same PC and settings. Run back to back, R2 before the cuts measured the same as R1 (62.5 and 63). To hold 60 fps on the slower day:
  - The AO is cached. People, the core crystal and its ring are left out of the AO pre-pass (with screens, glows, lines and small details as before), so the AO depends only on the static scene and the camera. It is computed again only when the camera stops, the canvas is resized or the static scene or theme changes. Every other frame (idle animation, people walking) only multiplies the cached AO onto the image. This was the big gain: full quality went from 51 to 61 fps (headed, five views measured before the cache) to 60 to 72 fps in the final capture run (66 to 75 in a run earlier the same day; the PC slows as it warms).
  - The people's limbs are six-sided prisms and boxes, not rounded boxes (about 900 triangles a person), and the bench slats are plain boxes.
  - Tried and not kept: 2x MSAA (about 1.7 ms, not needed after the AO cache, so 4x stays), AO 4/2/1 (within the noise), and a 1024 shadow map (no gain).

## E5 build record (17/10/2026)

The owner's E5 brief: the live office (ENGINE-PLAN.md §6) on the mock provider, plus four R2 follow-ups. Choices made inside it, for the owner to confirm or change. No cap, price, licence, prompt or product changed.

- **Legacy jobs (item 0b).** Every imported legacy job is in a new **Legacy** lane on the board (count, the 3 most recent, "show all"), and no longer in the Blocked, Rejected or Parked lanes, where E4 had put the blocked, rejected and parked ones. In the task list they are only under the **Legacy** chip; Active, All and the status chips count engine jobs only. An **Archived** chip was added the same way for jobs the owner archives.
- **Shirts (item 0c).** A shirt keeps the agent's colour unless the colour is skin-like (hue 0–50°, saturation 0.1–0.65), close to a skin tone, or close to another agent's shirt; then it takes the next free colour from a fixed set of ten non-skin colours (`src/web/scene/looks.js`). Desk, monitor and label colours are unchanged.
- **Every write, one path.** Same origin, the per-launch action token, JSON, an idempotency key (`x-idempotency-key`, required on every POST), and for an existing record the version the page loaded. A repeat key returns the first answer and does nothing again; two requests with the same key at once share one answer. The page builds the key from the intent (the action, the record and its version, or the create form's text), so a double click is one write. Refusals are HTTP 403 (origin, token), 400 (no key, bad input), 409 (stale) and 423 (e-stop on); every write and every refusal is logged and emitted (`action.done`, `action.refused`).
- **Two version exceptions, both safety actions.** Pressing the **E-STOP** never checks a version (stopping must never be refused). **Stop job** accepts a version the job has since moved past *while that job is still running*, because a running job's version changes at every step and a Stop cannot overwrite anything; once the job is no longer running, an old version is refused as stale. Resuming from the e-stop does check the version (the e-stop state the page loaded).
- **Approval decisions write only the approvals and tracker rows.** The job row stays `approval`; the board and the panels show the decision from the approvals row (approved and published under Done, rejected by the owner in the Rejected lane). The test fingerprints every other table and every file under the data root (except the event log) before and after each decision. Approve and reject need a pending row; Mark published needs an approved one, a date not in the future and an `etsy.com/listing/<number>` URL. The package "opens as a folder" as its path with a copy button: the server starts no process (no child process in `src/`).
- **Routines.** Created disabled whatever the request says. **Editing an enabled routine disables it**: enabling is the approval, so a changed routine needs a new one. Targets are the lines the engine can run: `line:research` (a research batch) and `line:room1-digital` (new: the oldest verified brief in `research/briefs/` with no job yet; nothing waiting = a logged skip). Max runs a day 1–24; an optional per-run cap above 0 and at most the engine's per-run cap (it can only lower it; it is passed to every run of the job). Imported legacy routines are read only (no enable, edit or delete; a re-import would bring a deleted one back). A routine skips, and logs why, while its line's first agent is off duty.
- **Off duty.** An agent step whose agent is off duty puts the job back to `queued` at that step ("waiting: X is off duty"), which frees the line; putting the agent back on duty starts its waiting jobs (not while the e-stop is on). Tier and effort come only from `config/engine.json` (`tiers`, `effortLevels`) and apply at the next run.
- **Stop, Restart, Archive, Re-run listing.** Stop aborts the job's call in flight through its own abort signal (other jobs carry on; the call is charged at its reserved maximum, $0 on the mock). Restart runs a blocked or stopped job again from the step it stopped at, refused while the e-stop is on or once the job's spend has reached the per-job cap; the guard still checks every call. Archive (blocked, stopped, rejected, owner-rejected or finished research jobs) moves everything in `jobs/<id>/` except `brief.md` into `jobs/<id>/rerun-archive-<UTC stamp>/` and takes the job off the board. Re-run listing (a QA-approved design that is in the approval queue, rejected, blocked or stopped, and not yet approved or published) moves the listing, its QA-LISTING records, the package and any `REJECTED.md` to `rerun-archive-*`, marks the approval row `superseded`, and runs LISTER again; the new package puts the row back to pending. Legacy jobs take no control.
- **Top bar.** E-STOP and resume use in-page dialogs (resume needs the typed word, `RESUME`). The spend shows a meter against the day cap; a chip appears from 80% of any cap that applies today (station day, each line's day) and turns red at 100%, with the same notices in the warning box. Caps are read from config only.
- **Captures.** `node scripts/screenshots-e5.mjs` runs the real engine on the mock provider on a fresh data root in the OS temp folder (`station-e5-capture`), never `data/`, with the dry-run FIXTURE briefs waiting in `research/briefs/`. Two set-up writes (job B, one routine) go through the server's write path; every other state is reached by clicking the page. The fps rows are the overview on the station's own data root (engine mode).
- **Port drift (not ported).** At the start of E5, `npm run port-drift` showed 5 legacy files changed on 17/10/2026 05:55–06:27Z: `config/station.config.json`, `scripts/lib/digital-build.mjs`, `digital-gate.mjs`, `style-ref.mjs` and `tests/style-ref.test.mjs` (the packaged-product and style-reference areas, which fail closed here). E5 is the live UI only, so they were not ported; a port is a separate step for the owner to schedule.

## R3 spike build record (17/10/2026)

The owner's R3 brief: a spike only, the baked-lighting look for the Design room behind a flag, then stop for a decision
on the whole office. Choices made inside it, for the owner to confirm or change. No cap, price, licence or product changed.

- **Unlit baked surfaces.** Every baked surface is a `MeshBasicMaterial`: albedo (texture or vertex colour) times the lightmap on the second UV set. The glb's PBR materials are replaced on load. The room then needs no real-time light, shadow or specular, which is what keeps it inside the frame budget; the cost is no gloss or reflections on the wood. People, monitors, keyboards, screen pools and status lights stay as they are (real-time, PBR).
- **Dark walls in both themes.** The brief's style (dark walls, warm wood) is used in light mode too, with the day lightmap, so in light mode the Design room is much darker than the white-walled rooms around it. If the office were rolled out, the light theme would need a decision: dark rooms throughout, or a lighter albedo set for light mode (a second texture set, or a second bake with different wall colours).
- **The spec guard.** The bake is built for one floor plan (the Design room's 2 desks give a 9.7 x 5.2 room). The page uses it only while `bakedRoomSpec` of the live layout equals the manifest's spec; any change (a desk added or removed, a department moved, the atrium resized) falls back to the procedural room with a console warning until `npm run build-design-room` is run again (41 s). Tests check that the engine and fixtures layouts both match the committed bake.
- **The easel.** It is a layout prop inside the Design room (paths avoid it), so the bake models its own easel at the same place, with an abstract picture of coloured blocks. The procedural easel is left out in baked mode.
- **Lightmap storage.** Baked diffuse light (direct + indirect, no colour) is divided by k (the 99.5th percentile of each map's luminance / 0.92), sRGB-encoded to 8 bits and saved as WebP at quality 90; the page multiplies back by k. The evening map clips a few texels right at the LED strips. No denoiser: at 1024 samples on the GPU no noise was visible in the captures at zoom 2.3.
- **Evening level.** The evening ambient was raised (world strength 0.8, blue-grey) until the room sat near the brightness of the procedural dark rooms; at the first setting (0.06) the walls and floor were near black. The LEDs (16 W/m under the shelves, 14 W/m cove) and lamps (25 W) are warm accents on top.
- **The glow.** Half resolution, threshold on HDR pixels above 1.15 (only the baked LED strips and bulbs exceed 1.0 in this scene), 9-tap Gaussian each way, additive. Dark mode and the baked room only. Measured cost about 0.9 ms a frame (77.1 -> 71.8 fps in the Design room view on the iGPU), so it stays.
- **AO.** GTAO still runs over the baked room, so contact areas are darkened twice (baked occlusion plus screen-space AO); the real-time monitors and keyboards keep their contact shading that way. The alternative was not captured or measured: `?bakedao=0` leaves the baked room out of the AO pre-pass for a look.
- **fps measured in headed Chromium.** Windows has `chrome.exe` set to "High performance", so headed Chrome runs on the RTX 5060. The setting was not changed; headed Playwright Chromium (no per-app setting, so the Intel iGPU) gives the budget figure. Same harness, same 1600x1000, renderer checked.
- **Reproducible build.** Seeded modelling; the glb is byte-identical between rebuilds. Lightmaps differ only by GPU sampling noise (well under 1/255 on average). Blender 5.2.1 is pinned (`build-design-room.mjs` refuses another version unless `--any-blender`); 5.2.2 is the latest 5.2 patch and would need a re-pin. `Material.use_nodes` and `World.use_nodes` are deprecated (removed in Blender 6.0); the script still works on 5.2.

### For the owner (answered 17/10/2026: see "R3a build record" below)

- **Roll out to the whole office?** What it would involve, from this room: about 40 s of build and about 1.4 MiB for one room of this size. Six such areas (three rooms, lounge, atrium, closet) at that rate would pass 6 MB unless the textures are shared and the lightmaps go into fewer, larger atlases; not measured. One lightmap pair per room, or one atlas for the static office; every layout change (desks, departments, services) needs a rebuild on a PC with Blender and an NVIDIA GPU (CPU baking works but is slower; not measured). The atrium's moving parts (the core, walkers) and all people would stay real-time.
- **Light mode:** keep the dark-wall look in light mode, or bake a light version?
- **Chrome's GPU setting:** `chrome.exe` on "High performance" in Windows graphics settings: keep it, or set it back so headed Chrome measures the iGPU as in R1 and R2?

## R3a build record (17/10/2026)

The owner's R3a brief: the baked look, phase 1 of 2. Choices made inside it, for the owner to confirm or change. No cap,
price, licence or product changed.

### The owner's decisions on the spike (17/10/2026)

- Roll out the baked look in two phases. Phase 1 (R3a): fix the Design room, build a shared material and texture
  library, convert the Office room. Phase 2 (later): Research, lounge and atrium.
- Keep `chrome.exe` on High performance for the owner's viewing; fps checks stay on the Intel iGPU through headed
  Playwright Chromium, as in the spike.
- Asset budget: 10 MB compressed for the whole office, with shared textures and packed lightmaps.
- Design room: readable in dark mode (no darker overall than the procedural version, warm LED mood kept); the mood board
  and framed abstract art back (procedural, no copies), readable at overview zoom; warm-white walls for the day bake,
  dark walls for the evening bake only; one mid-tone oak floor in every room, procedural rooms included.
- Make the baked scene the default if both rooms pass; `?scene=procedural` stays.

### Choices made in the build

- **One atlas for every baked room.** All rooms' lightmap UVs are packed together into one day and one evening atlas
  (3072 px), so every room has the same texel density and the page loads two lightmaps whatever the number of rooms.
  The cost: a change to any room re-bakes all of them (about 2 minutes now; with phase 2's three more areas, roughly
  4–5 minutes, an estimate, not measured). Each room is still baked on its own: the rooms sit 60 units apart during the
  bake, so they do not light or shade each other.
- **glTF with separate textures, not a glb.** `office.gltf` + `office.bin` + `textures/*.jpg`: each shared texture is one
  file, used by every room, and the procedural rooms load the same `textures/floor.jpg`. One file per texture also lets
  phase 2 add rooms without duplicating anything.
- **Decals from the page's own atlas.** The mood board, the whiteboard and the framed pictures in the glTF carry UVs into
  the page's procedural atlas (`textures.js` `ATLAS`: seeded abstract shapes, swatches and wavy lines, no text, not
  copies of any artwork); the page assigns that canvas texture at load. No new artwork file, and baked and procedural
  rooms show the same pictures. In the bake those surfaces are a flat stand-in colour (only their bounce light matters).
- **Themed materials from the palette.** Walls (one material per room, for the department tint), caps and skirting are
  flat themed colours: the light palette's wall tinted 42% towards the department accent for the day bake and the light
  theme (exactly the procedural rooms' colour), the dark palette's wall tinted 8% for the evening bake and the dark
  theme. The bake uses the matching colours, so the bounce light fits each theme. The manifest stores them and
  `tests/baked-room.test.mjs` fails if the palette or the atlas changes without a rebuild. Note: the spike's evening walls
  were its own neutral charcoal (`#34373d`); they are now the palette's dark walls with the department tint (Design a
  lavender grey `#534c5b`, Office a green grey `#4d5650`), a little lighter.
- **Readability in dark mode.** Two levers, both measured: the evening bake's cool sky fill 0.8 -> 1.5 (it lifts the
  floor, the desks and the walls evenly; the LEDs and lamps stay the warm accents), and the page's evening lightmap gain
  1.0 -> 1.15 (`baked.js` `LM_GAIN`, the "exposure" of the unlit baked surfaces). Before the gain both rooms measured 2%
  darker than the procedural rooms; after it, 6–8% brighter (PROGRESS.md, R3a brightness table). The measure: mean luma
  of the screenshot inside each room's projected outline, baked vs `?scene=procedural`, same camera; the capture script
  records a problem if a dark-mode room is darker.
- **Design room layout.** The mood board (3.8 x 1.35) hangs on the oak slat panel over the desks with a warm LED strip
  along its top; the spike's long shelf over the desks went to make room. The left wall has three framed pictures
  (1.05 x 1.3, 0.8 x 1.0, 0.7 x 0.9) over a dark credenza; the spike's ten fabric pads went. The two binder shelves,
  the cove LEDs, the walnut desks, chairs, lamps, fig, small plant and easel stay.
- **Office room.** The R2 Office's pieces, from the library: two lockers, a framed picture and a lit wall shelf with a
  trailing plant on the left wall; the whiteboard with a marker tray and two lit book shelves on the back wall; rugs per
  row; the meeting table with two stools; a fig and a small plant. Desk tops are oak (Design's are walnut), so the two
  rooms share every model but read differently. Lockers are a mid grey in both themes (the procedural ones change colour
  with the theme). Rugs are the oatmeal hessian in both baked rooms (the procedural rooms' rugs are dark grey).
- **The oak floor.** The Poly Haven plank floor photo shifted to a mid-tone oak (`#a47f58` on average), 2.2 units a tile,
  grain along z, in every baked room. The procedural rooms and the lounge now load the same texture at the same scale;
  the palette's `wood` colour is white in both themes so the texture shows as it is. The old canvas planks only show
  until the JPEG has loaded, or if it cannot load.
- **Default on, per-room fallback.** `?scene=procedural` is the only switch (any other value, or none, draws the baked
  rooms). Each room is compared with the live layout on its own: a stale Office falls back to procedural while the
  Design room stays baked, and the console says which room. Desks, chairs, lamps and plants of a baked room are hidden
  in the instanced meshes; monitors, keyboards, status lights, screen glows and people stay real-time.
- **The glow pass** (half resolution, dark mode only) now covers both rooms' LED strips. The dark overview costs about
  1.4 ms a frame more than the procedural one (71.4 against 79.8 fps on the iGPU); every view stays above 60.
- **Budget counting.** 10 MB = 10,000,000 bytes, counted as served (JPEG and WebP are already compressed; the glTF JSON
  and `office.bin` are not), for every file in `src/web/assets/office/`, manifest included. Phase 1 uses 2.76 MB
  (27.6%). `office.bin` (1.06 MB of geometry) is the easiest saving for phase 2 if needed: the exporter can write
  meshopt-compressed buffers (the page would then need three's MeshoptDecoder); not done now.
- **Build tidiness.** Blender writes into a staging folder; only a successful build replaces the published assets. The
  driver turns off Python's bytecode cache (no `__pycache__` next to the library), and `.gitignore` ignores it anyway.
  `*.bin` is marked binary in `.gitattributes`.

### For the owner (answered 17/10/2026: see "R3b build record" below)

- **Light-mode Design room.** It measures about 10% darker than its procedural version (the dark slat backing, walnut
  desks and dark credenza; its walls are the same warm white as the other rooms). Keep, or lighten it (a pale backing
  behind the slats, oak desks)?
- **Evening walls.** Now the palette's dark walls with the department tint (Design slightly lavender, Office slightly
  green), like the procedural rooms. Keep, or a neutral charcoal for every baked room?
- **Rugs.** Oatmeal hessian in the baked rooms, dark grey in the procedural Research room and the lounge. Pick one
  for phase 2?
- **Phase 2 bake time.** With one shared atlas, any room change re-bakes every room (estimated 4–5 minutes once
  Research, the lounge and the atrium are in). Fine, or one atlas per phase?

## R3b build record (17/10/2026)

The baked look, phase 2 of 2: the Research room, the lounge and the atrium baked, so every area is baked. Milestone
`052f2b1`; the frame-rate fix and the docs in the R3b commit. No cap, price, licence or product changed. Mock data only.

### The owner's answers to the R3a questions (17/10/2026)

- **Light-mode Design room:** brighten it to within about 10% of the other rooms; the evening look stays as it was.
- **Evening walls:** keep the department tints.
- **Rugs:** dark grey everywhere.
- **Bake time:** one lightmap atlas per room, plus one shared by the atrium and the lounge;
  `npm run build-office -- --room <name>`; the whole office under 10 MB.

### Choices made in the build

- **Four bake units.** Research, Design, Office, and the atrium with the lounge (they light each other, so they share
  an atlas). Each atlas is sized for one texel density across the office (100 texels a unit: Research 2432 px, Design
  1984, Office 2176, atrium 3008). `--room lounge` builds the atrium unit. A one-unit build refuses to run if the shared
  look or the bake settings changed since the last full build.
- **Light-mode Design room.** By day the slat backing and the credenza are pale (`#e3dbce`, `#e8e1d6`) and the desk tops
  oak; by evening they are dark and walnut, as in R3a (`bakedlook.js` `THEMED_TEX`, `DESIGN`). Measured on the light
  overview: Design 0.991 x the mean of the other two rooms (Research 1.028 x, Office 0.957 x), inside the 10% target.
- **Rugs and upholstery.** The rug and fabric photos are shifted to a light neutral average and tinted per material:
  rugs dark grey in both themes, baked and procedural (palette `loungeRug` now equals `rug`); task chairs charcoal;
  lounge sofas beige by day, grey by evening.
- **The atrium.** Its concrete is the page's own canvas concrete (`textures.js` `tileTexture`); no new texture file.
  The server closet is fixed at five slots, so the engine view and the fixtures view share one baked atrium.
- **Frame rate (the R3b tail).** The iGPU is limited by memory bandwidth, so two full-screen passes were folded into
  the output pass:
  `OfficeOutputPass` (`office.js`) does the cached AO multiply and adds the LED glow before tone mapping, so the frame
  is read and written once instead of three times. The glow's blur now runs at quarter resolution (was half); its
  threshold reads all 16 full-resolution pixels of each quarter pixel, so a strip one pixel wide still glows, and the
  blur step is halved, so the glow keeps its width. If three's output shader ever changes shape, the passes fall back to
  their own blends. The page's stats show which path is active (`post: 'fused'` or the fallback), and the capture
  script reports a problem if a baked view is not fused. The link field is `fusedInto` (GTAOPass already has an
  `output` field for its debug view; the first draft reused that name and worked only because `Default` is 0).
- **Capture robustness.** Headed Chromium is launched with its occlusion throttling off
  (`--disable-features=CalculateNativeWinOcclusion`, `--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding`), and `screenshots-r3b.mjs` repeats a bench whose p95 frame is 500 ms or more (a
  covered window), up to four tries. The retries are recorded with each fps row. In the final run no bench needed one.

### Measured (17/10/2026)

Headed Playwright Chromium on the Intel UHD iGPU (`ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11`),
1600 x 1000, 3 s benches; `screenshots/r3b/fps-headed.json`. The fused output path was active in every view; the
fallback did not trigger.

| View | Moving | Full quality |
|---|---|---|
| Overview, light | 76.4 | 72.5 |
| Overview, dark | 71.0 | 74.2 |
| Research, light | 68.8 | 75.4 |
| Research, dark | 70.3 | 69.2 |
| Lounge, light | 80.0 | 80.1 |
| Lounge, dark | 76.6 | 75.4 |
| Atrium, light | 71.0 | 69.8 |
| Atrium, dark | 66.4 | 66.1 |
| Design, light | 79.1 | 79.1 |
| Overview, dark, all 8 agents walking | — | 66.2 |
| Overview, light, all 8 agents walking | — | 70.8 |
| For comparison: overview, procedural (light / dark / dark, 8 walking) | 71.4 / 77.3 / — | 73.1 / 73.5 / 69.7 |

- **Assets:** 6,877,262 bytes as served, 68.8% of the 10 MB budget (gzip 4.88 MB, brotli 4.67 MB). Per unit: Research
  2.26 MB, Design 1.04 MB, Office 1.47 MB, atrium with lounge 1.79 MB; shared textures 0.28 MB; manifest 0.03 MB.
- **Rebuild times** (OptiX on the RTX 5060, 1024 samples): full build 261.8 s; one unit: Research 91.0 s, Design 43.2 s,
  Office 44.9 s, atrium with lounge 82.7 s (`screenshots/r3b/build.json`). R3a's estimate for a full build was 4–5 minutes.
- **Brightness** (`screenshots/r3b/brightness.json`): in dark mode every baked area is brighter than its procedural
  version (1.05–1.33 x), as required. In light mode the baked rooms are 3–10% darker than their procedural versions
  (Design 0.90, Research 0.93, Office 0.97); the lounge and atrium are 4–7% brighter. Only dark mode has a target.

### Cut or not done

- Nothing in the owner's R3b answers was cut.
- Meshopt-compressed geometry (R3a's suggested saving) is not done: the office is well under budget without it.
- The fps before the frame-rate fix was not recorded in the tracked docs, so this record does not give a before/after
  figure.

### For the owner (answered 17/10/2026)

- **Light-mode baked rooms vs procedural.** The baked rooms read 3–10% darker than the procedural ones in light mode
  (no target was set for light mode). Keep, or set a target?
  **Owner, 17/10/2026: target set. In light mode every baked area stays within 10% of its procedural version's
  brightness (all met it at R3b).** `scripts/screenshots-r3b.mjs` now lists any light-mode row outside 0.90–1.10 as a
  problem; re-checked after the genre-scout re-bake (see "Genre-trend scouting").

**R3b (`dc403fb`) and the importer label fix (`db18e5a`) approved by the owner, 17/10/2026.**

## Port batch before E6: owner decisions (17/10/2026)

The legacy job `2026-10-16--pngtuber-cosy-desk-props-r2` is finished and live on Etsy (https://www.etsy.com/listing/4597311033,
published 2026-10-17, EUR 9.00, SKU DESK-PROPS-01): the first real product and the parity reference. The owner's decisions for
the port (17/10/2026), as applied:

1. **Owner overrides apply only to QA judgement verdicts** (QA DESIGN, QA LISTING), recorded per file with the date, the reason
   and the owner, shown on the job (job panel, "Owner decisions") and in `MANIFEST.json` (`overrides`, each with the file's
   sha256, the stage, the QA pass and words, the owner's reason, the date and who decided). An owner set approval can stand in
   for further QA passes after the pass limit, tied to the exact file hashes (the ported `composeSetApproval`; the gate
   re-composes it, so a changed byte makes it stale). **Originality hard fails are never overridden:** an override naming the
   originality or trademark check is refused, and so is any override or listing approval while the set's or the listing's
   originality screen is a hit. They are fixed only by an exact-word allow-list entry or by rewording.
2. **Originality allow-list, exact whole words only:** chucky: chunky; chanel: channel, channels; bowser: browser, browsers
   (`config.sloganScreen.nearMissAllow`, copied unchanged from the legacy config; these are every entry in the log). Tested:
   the words pass; "chunkys" still hits Chucky; Chanel, Bowser and their other one-typo variants still fail, in brief and
   listing text (`tests/ported/originality.test.mjs`).
3. **Originality screening covers what the legacy fix covers:** all of design.md except the Designer's self-check section,
   the deliverable file names, the whole brief and the listing text (`screenDigitalSet`; tested per field).
4. **Price fill keyed to the job,** never "the most recently changed listing": the engine's price-fill step calls the fill with
   its job's id. Test: the legacy bug's shape (another job's listing newer than its QA record, with a design file a fill would
   fail on) leaves the other job untouched (`tests/port-batch.test.mjs`); the parity replay checks it on the real data too.
5. **Real-ESRGAN as a local child process:** pinned binary path under `office-agents/tools/` and its sha256 (and the DLL's and
   the model's) checked before every run; execFile, never a shell; its cwd and every file inside the job's set folder (the
   data jail); a minimal environment; killed at once by the E-STOP or the owner's Stop. `src/engine/lib/esrgan.mjs` is the
   only module in `src/` allowed a child process (`tests/write-guard.test.mjs`). Licences in ASSETS.md. **Network:** the
   binary has no network code path and the engine gives it nothing (no proxy, no keys); there is no OS-level firewall rule.
   An outbound block for that one exe in Windows Firewall would make it certain; that is the owner's call (it needs admin).
6. **qa-design.md and qa-listing.md budgets:** as ported they build to 11,970 and 11,996 characters, under the 12,000 target:
   no trim and no budget raise was needed.
7. **Licence and download-notice wording:** the owner-approved wording is ported unchanged with its approval date: licence
   `commercial-content` ("owner-approved 2026-10-16 (owner wording, for the PNGTuber prop pack ...)") and the prop pack's own
   notice ("owner-approved 2026-10-16 (wording by the owner)"). `personal-use` and `commercial-standard` stay DRAFT and fail
   closed at the gate.
8. **Product spec:** `pngtuber-prop-pack` (12 transparent 2000x2000 PNGs, one ZIP download, the preview as a listing photo
   only) is ported as owner-approved, per the legacy record (`products.json` status, owner 2026-10-16; HANDOFF "evening 3":
   the download is the ZIP alone).
9. **Market: US English for listings** (owner decision for this product), enforced by the gate's spelling check. The owner's
   word list of the deterministic text fix (Cosy->Cozy, cosy->cozy, colour->color, colourway->colorway) now joins the
   config's pairs in that check: "colourway" was not in `config.usSpelling.pairs`, and only QA LISTING caught it on the live
   job (`src/engine/lib/spelling.mjs`; test in `tests/port-batch.test.mjs`).

## Port batch build record (17/10/2026)

- **One batch, one frozen moment.** The legacy session was still writing HANDOFF.md, so all 44 sources were copied (read
  only) into a staging folder at 2026-10-17T11:34:23Z with their sha256s and ported from there; after the port none had
  changed. PORTED.md "5th moment" lists every file; `npm run port-drift` now tracks 69 sources (19 new) and shows no drift.
- **The build runs in the engine.** For a packaged product, the prep step builds `files/<zip>` and the listing preview from
  the Designer's `raw/` with the ported build (BUILD_VERSION 5), then prepares the set. A Designer problem (raw names, count,
  no transparency) is a prep failure (one retry through the Designer, as before); an infrastructure failure (the upscaler
  pin, the binary failing) blocks the job at once and is never paid for again through the Designer; the e-stop stops it.
  Temp files live in `set-vN/.tmp-build-<pid>/`, never the OS temp. The GPU probe picks the NVIDIA device over the iGPU as
  the legacy code does.
- **QA pass numbers** come from the job's own counter (`data.qaPasses`), never the count of files in `qa/` (item 20); a file
  already on disk under a number is never overwritten.
- **Owner records.** The owner's decisions are an append-only log, `jobs/<id>/owner-decisions.jsonl` (never edited in place);
  `owner-review.json` is derived from it in the legacy shape so the ported `composeSetApproval` reads it unchanged. The
  approvals (`owner-set-approval.json`, `owner-listing-approval.json`) are written only when the ported composition passes.
  Every action checks the job's version (a stale tab or terminal is refused), refuses legacy history, a running job and the
  e-stop, is logged and emitted (`owner.action`). Routes: `/api/owner/*`, `/api/jobs/qa-only`, `/api/jobs/listing-only`,
  `/api/jobs/package`; from a terminal, `npm run owner -- <action> <job-id> '<json>'` (the engine lock refuses it while the
  server runs). The page shows the decisions; it has no buttons for them yet.
- **Run modes.** QA-only (item 23): one QA DESIGN pass on a set as it stands, the owner's overrides in its start text
  verbatim and tied to the file bytes, the Designer not run, stopped after the verdict; the owner's cap is the run cap
  (checked before every call). It is refused once 3 design passes are on disk: a 4th could never be packaged (the gate's
  limit), so the owner set approval is the route there. Listing-only (item 27): LISTER, price fill, QA LISTING on the design
  sign-off, one rework only if its estimate fits; the cap is checked before every hop against the dearest of the agent's last
  10 runs; refused when listing files exist (nothing overwritten); never packages. The package step is a separate owner
  action (gate, package, approval queue).
- **The digital package** (item 28) is `jobs/<id>/package/`: the ZIP byte for byte, listing.json, listing.md, MANIFEST.json,
  cost.json; no timestamps; idempotent; an earlier package is moved to `package-replaced-<sha12>/`, never deleted. cost.json is
  the job's ledger rows by jobId with workings (the legacy used a time window). Non-ZIP products keep the E3 package.
- **Listing photos** (item 32) are rendered from the packaged ZIP (each PNG checked against `zipEntries`) into
  `jobs/<id>/listing-photos/` with `photos.json`, outside the package, never a download; the PNGTuber plan is the owner's,
  word for word, in `config/listing-photos/pngtuber-prop-pack.json`.
- **Mark published** records the final title, the final price and the SKU as set on Etsy (approvals row `published`, the
  tracker's status_reason), as the legacy approval record does; the package is not rebuilt for them.
- **Delta import:** `npm run import-legacy` added 104 files, changed 11, added 14 ledger rows and 8 runs (ledger 176 rows,
  $12.4899616 on both sides); the PNGTuber job is imported as `published` with its approval records, listing photos and
  package. A second run adds 0.
- **Parity** (`npm run parity -- --rebuild`, $0, no model, no network): 26/26 checks pass, 73 differences, all explained
  (PROGRESS.md "Port batch before E6"). The pinned Real-ESRGAN rebuild of set-v4 gives every one of the 12 files and the ZIP
  byte for byte as published.

### For the owner (open; nothing decided here)

- **Designer token use (item 12).** "A compact brief extract plus the style reference, aiming for under 30k tokens per
  image" is not built: the effect can only be measured on a real run. Proposal for E6: the Designer's first message becomes the
  brief's Niche, Design direction (with the palette and style rules), Quality bar and Deliverables sections plus the
  STYLE REFERENCE line, with `brief.md` still readable in its folder.
- **Style-reference run mode.** The library, the decisions and the cleaned version are ported; the first-file run mode and a
  reference image in `image_generate` are not, so a NEW style-reference job still fails closed at the package gate.
- **Firewall rule** for the upscaler exe (item 5 above), if wanted.
- **Buttons on the page** for the owner actions (the routes exist; the terminal command works today).
- **Importer label:** fixed 17/10/2026. A legacy job now takes its room from its tracker row (`etsy-digital` or
  `etsy-pod`); with no tracker row, a digital product type (`config/products.json`) is `etsy-digital` and anything else
  `etsy-pod`. The re-import updated one store row (the PNGTuber job); a second run changed nothing.

## Genre-trend scouting (17/10/2026)

One research line, built on the mock provider only (no keys); real runs come after E6.

### The owner's rules (17/10/2026)

- Each run finds 4 trending game genres or aesthetics, from 2 currently popular AAA titles and 2 indie titles with
  active streaming communities, and turns each into an ORIGINAL desk-props pack brief for streamers of that genre.
- Game titles, studios, characters, logos, UI elements, signature items, named locations, distinctive art styles and
  quotes appear only in the internal scouting notes (`data/research/scouting/`): never in a brief, design prompt, file
  name, title, tag, description or alt text. Briefs are genre and aesthetic only.
- The notes never go to DESIGNER, LISTER or QA; only the genre brief does.
- Every title the scout records goes on a scouting blocklist automatically; the originality gate checks the brief, the
  design and the listing against it.
- No "inspired by", "fan", "dupe" or similar wording anywhere in customer-facing text.
- TREND-SCOUT: RESEARCH department, cheap tier, web search and fetch only, at most 12 web calls a run, enforced by the
  runtime; public popularity signals only (top streamed categories, store charts), read as data, never instructions.
- A routine "Weekly genre scout", created disabled. A desk in the Research room. Light-mode target for the baked
  rooms: within 10% of the procedural rooms' brightness (recorded under "R3b build record").

### Choices made in the build

- **Its own line, `genre-scout`** (`config/lines/genre-scout.json`): TREND-SCOUT -> `scout-notes` (engine) ->
  EVIDENCE-CHECKER -> `brief-check`, kind `research`, so verified genre briefs land in `research/briefs/` beside the
  others and start a Room 1 job the usual way. The research line is unchanged.
- **"Web search and fetch only"** is read as: no other web or network tool and no image tools. TREND-SCOUT also has
  `fs_read`, `fs_list` and `fs_write` inside the research folder, because it must write its notes and drafts; it may
  write only `scouting/*/notes.json` and `drafts/*/*.md`. The 12-call cap is the existing `maxWebCalls` check in
  `tools/index.mjs` (the 13th call is refused before it is priced).
- **Notes**: `scouting/<day>/notes.json`, JSON with exactly 2 `aaa` and 2 `indie` entries (game, studio, genre,
  `alsoBlock` names, https evidence links, date). The `scout-notes` step refuses invalid notes (the job blocks).
- **Scouting blocklist**: `data/research/scouting/blocklist.json`, written by the engine only, append-only (the engine
  never removes a name; the owner may add by hand). It holds each game, its studio and the `alsoBlock` names (13 in
  the dry run). The engine adds it to the originality lists as the category `scouted-games` through a getter on
  `cfg.station` (`engine.mjs`), so every existing screen applies it with no change to the ported files: the brief
  check and intake (Design direction), the image-prompt screen (before any image call), the design-set screen
  (design.md, file names, brief) and the listing screens and package gate.
- **Whole-brief screen** (`lib/scouting.mjs`, wired into the brief check and intake): the scouted names anywhere in a
  brief (id, persona, keywords, sources and the rest), not only its Design direction.
- **Derivative wording**: added `fan`, `fandom`, `fanbase`, `fan favourite`, `fan favorite`, `homage`, `tribute`,
  `dupes` (category `derivative-wording`) on top of the station's own derivative list, which already has "inspired
  by", "dupe", "fan art", "in the style of", "homage to", "unofficial" and more. It applies everywhere the station
  screens (all lines, not just this one) and to the whole text of a genre-scout brief.
- **Stricter than asked, flagged:** the notes are hidden from EVERY agent except TREND-SCOUT, EVIDENCE-CHECKER and
  DEMAND-RESEARCHER included (the tools refuse `scouting/` and leave it out of folder listings; agent config
  `scoutingNotes: true` is the only key). A genre draft that names a scouted game is moved to
  `scouting/blocked/<day>/` (not `rejected/`, which research agents read), before EVIDENCE-CHECKER runs. A blocked
  file name that itself names a game is masked in the job record the office page shows.
- **Genre brief format**: the existing research brief format plus `origin: genre-scout` and a `## Genre trend
  evidence` section (genre-level pages only, never a page about one game). Product: the desk-props pack
  (`pngtuber-prop-pack`), named in the routine input.
- **Routine**: `config/routines.json` (new) seeds "Weekly genre scout" (Mondays 09:00 Dublin, 1 run a day, engine
  caps) once per data root, always disabled. A seed the owner deletes stays deleted.
- **Desk and re-bake**: TREND-SCOUT's desk gives the Research room a second desk row. That deepens the back row, so
  Research, Design and the atrium were re-baked (`npm run build-office -- --room research,design,atrium`, 206.8 s;
  7,135,513 bytes, 71.4% of the 10 MB budget; light mode 0.952–1.069 x procedural, inside the 10% target). The legacy fixtures view keeps the legacy roster's two research desks, so there those
  three areas fall back to procedural (tested); the R3b captures gained `--engine` to run on the engine view.
- **Lounge seats**: the lounge has 8 seats and the office now has 9 agents. An idle agent without a seat stays at
  its desk (layout.js, as designed): REJECTS-DESK, the last in order. The capture check now expects
  min(agents, seats) walkers and names the one who stays.
- **Fixture**: `fixtures/engine/scout-script.mjs` uses four INVENTED game titles and FIXTURE pages (one carrying a
  prompt-injection line, read as data). No real game name is in the repository.

### Flags (answered by the owner 17/10/2026: see "Scouting decisions" below)

- **"fan" is a whole word, so it also blocks a "desk fan" prop** and phrases such as "fans of". It fails closed;
  an allow-list would need a code change (the near-miss allow-list does not cover exact matches).
- **Scouted names match exactly** (with the station's normalising: case, punctuation, plurals, compounds, digit
  swaps), without the one-typo tolerance that brands and characters get: that list lives in the ported module.
- **A game whose title is an ordinary word** would block that word everywhere once scouted. Fails closed; the
  owner may prune the blocklist by hand.
- **Sources' terms**: the streaming-site and store-chart pages' terms of use must be checked before the first real
  run (E6). The web price per call is still unset, so real web calls are refused until then anyway.
- **GDPR**: the notes hold games, studios and aggregate public figures only; the scout's orders forbid recording any
  person's name, handle or channel. Retention of `scouting/` is not set (kept indefinitely for now).
- **Two research lines on one day** share `drafts/<day>/`: each line's EVIDENCE-CHECKER and brief-check would also
  handle the other batch's candidates. Harmless in the mock; one research line at a time is simplest.
- **A ninth lounge seat** (so REJECTS-DESK walks too) would change the lounge and need its re-bake.

## Scouting decisions (owner, 17/10/2026)

**The genre-trend scouting line (`b75cfac`, `cc9a5cc`) is approved by the owner, 17/10/2026**, with these decisions on
the flags above. Built on the mock only (no keys, $0); commit "Scouting decisions".

1. **Derivative wording.** Bare "fan" is removed. The scouting list (`DERIVATIVE_WORDING` in `lib/scouting.mjs`,
   category `derivative-wording`) is now exactly the owner's whole phrases: "fan art", "fanart", "fan-made", "fan made",
   "fandom", "fanfic", "inspired by", "homage", "tribute", "dupe", "knockoff", "alternative to". Matching is whole words
   and phrases (with the station's plural, compound and punctuation readings), so "desk fan" and "fans of cozy games"
   pass and "fan art" fails (tested).
   *Build notes:* the earlier extras "fanbase", "fan favourite" / "fan favorite" and bare "fan" are no longer blocked
   by this list (the owner's list replaces it). "dupe" also catches "dupes" (plural). The station's own `derivative`
   list is unchanged and already holds "knock off", "fan made", "fanmade" and more; "knockoff" also matches "knock off"
   and "knock-off" (compound reading), so an everyday "knock off" in text fails too, as does "an alternative to
   plastic". Both fail closed.
2. **Scouted names: exact plus one-letter misspelling matching.** `scouted-games` now gets the station's near-miss rule
   (one typo, swap or doubled letter, same first letter; single-word names of 6+ letters, multi-word names of 10+
   letters). This is one line in the ported `originality.mjs` (`FUZZY_CATEGORIES`), recorded in its header and in
   PORTED.md; the next re-port must keep it. Shorter names (for example a 5-letter title) still match exactly only; the
   station's `nearMissAllow` list can exempt an ordinary word the owner names. Tested ("Parsnip Holow", "Cinderpyne",
   "Chromhold 2091" hit; two letters off does not).
   *Reading flagged:* the flag said scouted names were exact-only, so "keep exact plus one-letter misspelling" was
   read as "add the misspelling match". Say if the opposite was meant.
3. **Common-word titles.** In the notes, an entry gets `"tags": ["common-word"]` when its title is an ordinary
   dictionary word (TREND-SCOUT's prompt says so; any other tag is refused). Its *bare word* is the title without a
   leading "The/A/An" and without a subtitle after ":" or a dash. The blocklist entry keeps `commonWord`. Then:
   - the bare word is **not** a hard-fail name: the brief check (`scout-notes`, `brief-check`) and the listing step
     (`price-fill`) **warn** (logged, and shown in the step note);
   - **QA-LISTING is told** in its run input (both the normal and the listing-only run) which listing fields use the
     word and to ask for a revise if it reads as the game in any way (as a title, next to "game", with the game's
     characters, places, items or look). It is given the bare word only, never the full title;
   - the **full title** (when it differs from the bare word) and **"<bare word> game"** (and "games") still hard-fail
     everywhere, with the misspelling match.
   *Build notes:* for a one-word title with no article or subtitle the full title *is* the bare word, so only
   "<word> game" hard-fails. The image-prompt and design-set screens do not warn (only the brief and the listing were
   asked for). A title already on the blocklist without the tag stays a hard fail if a later run tags it (fails
   closed; the owner may edit the list by hand). Tested with an invented title, "Lantern: Moss and Mile".
4. **Sources for real runs: official public APIs before page scraping.** The candidate sources, each with a link to
   its terms, are listed in ENGINE-PLAN.md ("Genre scout: sources for real runs") for the owner to check before E6.
   No source is approved yet. Using an API needs a key, so it needs an engine tool that holds the key (environment
   variable) and counts against the 12 calls; TREND-SCOUT has only web search and fetch today. That is E6 work.
5. **Retention.** A new first step, `scout-retention` (engine, mechanical), runs at the start of every scout run and
   deletes `scouting/<day>/` and `scouting/blocked/<day>/` once the day is more than 90 days before the run's day (day
   90 is kept). Each deletion is logged ("scouting notes deleted (retention 90 days)", with the folder), and the step's
   note lists them. `scouting/blocklist.json` is never deleted, and its entries keep blocking. Folders that are not a
   date are left alone. Tested (91 days deleted, 90 kept, blocklist kept, logged, a second run deletes nothing).
   *Reading flagged:* the blocked drafts in `scouting/blocked/<day>/` are counted as scouting notes (they name games),
   so they go after 90 days too. Retention runs only when a scout run runs (the routine is weekly once enabled), so a
   folder can be up to a week past 90 days, longer if the routine is off. The deletion uses the jail's `remove`, so it
   stays inside the data root.
6. **The scout's own drafts folder: `research/scout-drafts/<day>/`.** The line config names it (`"drafts":
   "scout-drafts"`); TREND-SCOUT may write only there (and its notes); EVIDENCE-CHECKER may also write there. The
   engine tells each research agent its batch folder in the run input, and the genre scout's EVIDENCE-CHECKER is told
   to read "drafts/<today>/" in its (ported, unchanged) orders as `scout-drafts/<today>/`. `scout-notes` and
   `brief-check` read only their own line's folder. Tested: the research line and the scout line on the same day each
   handle only their own drafts.
7. **Lounge seats: left as is** (8 seats, 9 agents; REJECTS-DESK stays at its desk when idle). **For the next lounge
   re-bake: add a ninth seat** (noted in ENGINE-PLAN.md and PROGRESS.md).

Tests: `npm test` 273/273 (`genre-scout` 15/15: 5 new, 3 changed for the decisions). `npm run dry-run:scout`: same
result as before (4 verified, 1 blocked and refused at intake, 13 names, 12 web calls, USD 0.00), now with the
retention step first and the drafts in `scout-drafts/`.

## E6 readiness: owner decisions (17/10/2026)

The owner approved the scouting decisions build (`fd10911`) and settled the E6 readiness items below. Recorded and
built on the mock only: no model was called, and no key value was read, printed, logged or copied. Commit "E6 readiness".

1. **Scouting decisions approved.** `fd10911` is approved by the owner. The two readings flagged there stand as built
   unless the owner says otherwise.
   **Scout sources for v1:** Anthropic web search over public articles and chart write-ups only. No page scraping, and
   no Twitch, Steam or itch.io APIs yet. **Later phase:** the official Twitch and YouTube APIs, keeping derived
   conclusions only (genre, date, source name) and never raw API data; their terms need the owner's check first.
   ENGINE-PLAN.md "Genre scout: sources for real runs" now says so.
   *Reading flagged:* web fetch is read as still allowed for a public article or chart write-up that a search found.
   Fetching a store chart, browse or streaming page itself (Steam, itch.io, Twitch, YouTube) counts as scraping and is
   out. TREND-SCOUT's prompt still says it reads "store best-seller and top-played charts". A one-line prompt change
   (and, if wanted, an engine refusal of those sites in `web_fetch`) is proposed before the first scout run (PROGRESS.md
   "Exact next step", step b). Nothing is changed yet.
2. **Q1 billing:** verbal approval from Lorena (finance) on 17/10/2026 for the engine to run on the station
   workspace's Anthropic Console credits. Written confirmation is to follow; record its date here when it arrives.
   `config/station.config.json` ("Console credits approved by Finance", ported) now agrees with the verbal approval; it
   is not edited.
3. **Q2 caps** (`config/engine.json` caps): USD 5.00 per job (images included), USD 10.00 per day, USD 10.00 per line
   per day, USD 0.50 per scout run. The owner sets the outer limits outside the engine: the Anthropic Console monthly
   workspace limit, and the OpenRouter key limit of USD 2 a day.
   *Build:* `perJobUsd` 5 (was 1). New key `perJobUsdByLine: { "genre-scout": 0.5 }`: a scout run is one research
   job, so the guard checks it against the lower of the two caps, named `perJob[genre-scout]` in the refusal. The other
   lines keep 5.00. `perDayUsd` and `perLineDayUsd` were already 10. `perRunUsd` (one agent run) stays at USD 1.00:
   the answer did not mention it (open question below). The page's snapshot carries the line caps (`perJobByLine`).
   *Note:* OpenRouter's USD 2 a day is lower than the engine's USD 10 a day. A day of images stops at OpenRouter's
   limit first (25 images at the USD 0.08 reservation, more at the real cost), and that comes back as a provider
   error, not a cap.
4. **Prices**, verified by the owner 17/10/2026 against https://platform.claude.com/docs/en/about-claude/pricing.
   They are in `config/engine.json`, each with its source and date (`verified`); the old `confirmBeforeE6` flags are gone.
   - `claude-haiku-5-5`: USD 0.10 in / 0.50 out per million tokens for prompts up to 100,000 tokens, and 0.50 / 2.50
     above that. Cache hits 0.01 / 0.05; 5-minute cache writes 0.125 / 0.625. A request over 100,000 prompt tokens
     (cache reads and writes included) pays the higher prices for the whole request.
   - `claude-sonnet-5-5`: 2 in / 10 out; cache hits 0.10; 5-minute cache writes 2.50. No prompt-size tier was given.
   - Web search: USD 0.01 a search, plus tokens. Web fetch: tokens only.
   - Images (`openai/gpt-5-image-mini` on OpenRouter, priced by tokens): the guard reserves USD 0.08 an image, then
     settles to the cost OpenRouter reports for the call, marked estimated if none is reported.
   *Build (`src/engine/guard.mjs`):* `priceTier` picks the tier from the prompt (input + cache writes + cache reads;
   over `longPrompt.overTokens` means the long-prompt prices for input, output and both cache prices). `textCost`
   prices a response that way, and the ledger row carries `priceTier` for a tiered model. `textMax` (the reservation)
   takes the tier from the runtime's estimate (about 3 characters a token, which is above the real count for text) and
   reserves every input token at that tier's dearest input price (the cache write) plus the full output allowance. If
   a call ever costs more than its reservation, `settle` logs a warning. The two models' cache prices now come from
   config, not from the 1.25x / 0.1x fallback. Web search reserves USD 0.01 and web fetch USD 0 a call. Their tokens
   are priced on the Anthropic call that carries the results, which the live web backend must add (not built: step
   b). `image_generate` already settled to the provider's reported cost and marked it estimated otherwise; the
   reservation is now 0.08 (was an estimated 0.043).
   *Tests:* `tests/e6-prices.test.mjs`, 8 tests: the config values; Haiku at 99,999, 100,000 and 100,001 tokens with
   no cache; with cache just under (99,999) and just over (100,001, where the uncached input alone is 10,000); cache
   reads alone pushing a request over; Sonnet at any size; reservations at 100,000 and 100,001; ledger rows with
   `priceTier`; the web fees; the image reservation settled to a reported cost and to the estimate; the scout run cap
   in the guard and on the whole scout line on a priced mock.
5. **Image models:** only `openai/gpt-5-image-mini` is allowed (`image.allowedModels`). The opaque model stays
   disabled by the owner's decision (`opaqueModelApproved: false`, so opaque images are refused, as tested). E6
   checklist row 5 is closed. The earlier listing to-do "skim OpenRouter's terms" has no recorded outcome; the owner
   closed the item, so it is noted here only.
6. **Keys** (checked 17/10/2026, names and yes/no only): `office-agents/.env` holds `ANTHROPIC_API_KEY` and
   `OPENROUTER_API_KEY` (both non-empty), `STATION_PROVIDER=mock` and `STATION_PORT`. `.env` is ignored (`.gitignore`
   line 6) and not tracked. No commit on any branch has ever held a `.env` file: every tree in `git rev-list --all` was
   listed by file name, and only `.env.example` appears. Demo mode still refuses keys: run with `.env`'s variables in
   its environment, `node scripts/demo.mjs` exited 2 with "demo did not start: real API keys are present in the
   environment (ANTHROPIC_API_KEY, OPENROUTER_API_KEY)", and its output held no key value. The demo never reads
   `.env`, so `npm run demo` in a clean shell never sees the keys. `npm start` does load `.env`; on the mock no key is
   read, and the logger redacts both values. The check ran from a script in the session's scratch folder (not in the
   repository) that printed names and yes/no only. Whether these are the separate station-engine keys (§7.2 step 4)
   cannot be checked from here; that is the owner's word.

### For the owner (open; nothing decided here)

- **Per-run cap.** `perRunUsd` is still USD 1.00 (StarNet era). The legacy PNGTuber job's DESIGNER spent USD 2.746
  over three passes, about USD 0.92 a pass, so one DESIGNER run can reach USD 1.00 and stop. Keep it, or set it (for
  example, equal to the per-job cap)?
- **Image token estimate.** The runtime estimates a prompt as its JSON length ÷ 3, and `image_analyze` sends the image
  as base64 text, so its reservation is far above the real cost. A 1 MB PNG estimates at about 445,000 tokens, which
  reserves about USD 1.1 on Sonnet (over the USD 1.00 per-run cap), and on Haiku it now falls in the long-prompt
  tier. Proposed before step c: count each image at the figure Anthropic documents for image tokens, read from the
  docs at the time (not built).
- **Style reference.** `pngtuber-prop-pack` has `styleReference.ownerOk`, so a NEW job of it fails closed at the
  package gate until the first-file run mode and the reference image in `image_generate` are built (E6 checklist row
  13). Step c would spend money and then stop at the gate, so the first-file mode needs building first.
- **Web fetch reading** (item 1) and the TREND-SCOUT prompt line.

## E6 step a0 build record: live Anthropic text provider (17/10/2026)

The owner approved the official Anthropic SDK and billing for E6. No call was made in a0: every test stubs the SDK
client, with a fake key; no key value was read, printed, logged or copied; nothing was written to Virtual-workers.

### Choices made in the build

- **SDK:** `@anthropic-ai/sdk` **0.131.0**, pinned exactly (published 30/09/2026, 17 days before the build; the newest
  release at least 14 days old; MIT). It brings `json-schema-to-ts` 3.1.1, `@babel/runtime` 7.29.10, `ts-algebra`
  2.0.0, `standardwebhooks` 1.1.1 and `@stablelib/base64` 1.0.1, all MIT (ASSETS.md). Its optional peer `zod` is not
  installed. `npm audit` reports only the existing sharp/libvips advisories, nothing from the SDK.
- **Where:** `src/engine/providers/anthropic.mjs`; `providers/index.mjs` builds it for `live` only. It refuses to be
  built unless STATION_PROVIDER=live is in the process's own environment (exact, lower case), in demo mode, without
  `ANTHROPIC_API_KEY`, or without `live.timeoutMs`. Web and images on the live provider refuse with "not built" (steps
  b0 and c0); an unknown mode is still `ProviderLocked`.
- **The key:** read once from the environment when the provider is built and kept in its closure. The SDK client gets
  it as `apiKey`, with `authToken: null`, the base URL fixed to `https://api.anthropic.com` (so `ANTHROPIC_BASE_URL` or
  `ANTHROPIC_AUTH_TOKEN` in the environment cannot redirect it or add a second credential) and the SDK's own logging
  off. Every error message leaving the module passes a redactor (the key itself, anything shaped `sk-ant-...`, and
  `x-api-key` / `authorization` values). 400, 401 and 403 get a fixed, key-free hint instead of the server's text.
- **Models:** only the models config/engine.json gives an anthropic tier and a price (`claude-haiku-5-5`,
  `claude-sonnet-5-5`); any other model is refused before a call (the guard also refuses an unpriced model).
- **One choke point for retries:** the SDK's retries are off (`maxRetries: 0`). The runtime's model call is now
  `guardedTextCall` (runtime.mjs), shared with the smoke script: reserve -> call -> settle, and on a 429, a 5xx or a
  network error it waits and tries again up to `live.retries` times, **reserving again for each attempt** (a refused
  reservation or the e-stop ends it with no further call). The mock path is unchanged (no retries).
- **Billing of failed attempts** (unchanged rule from E2): an HTTP error is released (not charged); a network error or
  timeout has no usage report, so it is charged at its reservation, marked estimated (the request may have run).
- **Ledger row:** the guard's row now also carries `requestId` (the `request-id` header, as shown in the Console) and
  `messageId` for live calls. Mock rows are unchanged.
- **Request:** nothing is added. Tools and `cache_control` only when the caller sends them (the runtime sends prompt
  caching on its system prompt, per `runtime.promptCaching`); client tools pass; any server tool or `mcp_servers` is
  refused (none allowed in a0; b0 adds the web tools). The agent's effort is sent as `output_config.effort` when it is
  one of `effortLevels`.
- **Smoke script:** `scripts/smoke-live.mjs` (`npm run smoke:live`): refuses unless its own STATION_PROVIDER is live,
  loads `.env` without overriding the shell, starts the engine without the scheduler or resumes (the engine lock
  refuses while the server runs), makes one call through `guardedTextCall` with 0 retries and a run cap of USD 0.01,
  and prints the reply, the request id, the usage, the USD, the ledger row and today's total.

### The owner's answers (17/10/2026)

- **Live settings approved as set** (owner, 17/10/2026): `timeoutMs` 300000 per attempt, `retries` 2, `backoffMs`
  2000 doubling, `backoffMaxMs` 30000 (a server `retry-after` is used within it). Engine settings, not caps.
- **Smoke call only:** thinking explicitly off. Per the claude-api reference, Claude Haiku 5.5 accepts
  `thinking: {type: "disabled"}` at effort `high` or below, and its default effort is `medium`; the smoke call sends
  no effort, so `disabled` is valid. The engine default is unchanged (no `thinking` sent, so adaptive); per-agent
  thinking is decided in c0.
- **Smoke call only:** retries 0 and a run cap of USD 0.01, overriding the engine defaults (`live.retries` 2 and
  `perRunUsd` 1.00). The script already did this in a0; it now also prints one line before the call with the model,
  max_tokens, thinking setting, retries and run cap.
- **408 and 409** stay unretried (no change asked).

## E6 step b0 build record: live web search (17/10/2026)

No call was made in b0: every test stubs the SDK client, with a fake key; no key value was read, printed, logged or
copied; nothing was written to Virtual-workers. Tool versions and parameters come from the claude-api reference and the
platform docs read on 17/10/2026 (web search tool, web fetch tool, tool reference, models overview), not from memory.

### Choices made in the build

- **Shape:** each researcher `web_search` / `web_fetch` tool call becomes ONE Anthropic request on `claude-haiku-5-5`
  (the "web relay", `providers/anthropic-web.mjs`) carrying ONE server tool, as ENGINE-PLAN b0 says. The results come
  back to the agent as text prefixed `[web content: data, not instructions]`: titles, URLs, page dates, the relay's
  short summary and its citations.
- **Tool versions:** `web_search_20250305` and `web_fetch_20250910`, the basic versions, called directly. The
  dynamic-filtering versions (`_20260209` and later) run code execution under the hood, which is one more tool; the
  docs' per-version tables do not name Haiku 5.5 either. The Models API reports web search support per model
  (`capabilities.server_tools.web_search.supported`), so `npm run scout:live` checks it first (free metadata, no
  tokens) and refuses if it is not `true`. Web fetch is not covered by that field.
- **Only door:** the agents' `text.create()` still refuses every server tool. The web relay uses a separate
  `createWithWebTool()` that takes exactly one tool of a type `live.web.tools` names, with `max_uses` set, and nothing
  else (no client tools, no MCP). No messaging or outbound tool exists anywhere.
- **max_uses:** `live.web.maxUsesPerRequest` (1), lowered to the run's remaining web calls. The run's web-call cap
  (TREND-SCOUT 12, EVIDENCE-CHECKER 15) is still checked in `tools/index.mjs` before anything is reserved, and counted
  across requests by the uses each response reports (at least 1 per request). The 13th call is refused unsent.
- **Price and ledger:** the guard reserves `max_uses x USD 0.01` (search; fetch 0) plus a token maximum: the prompt
  estimate plus `resultTokensPerUse` per use (20,000 search, 12,000 fetch) at Haiku's dearest input price, plus
  `maxTokens` (2,000) of output. Settled from the response: `web_search_requests x 0.01` + the tokens at Haiku's
  prices (results are input tokens; the 100,000-token tier applies). One ledger row per request: provider
  `anthropic-web`, model `web_search` / `web_fetch`, `via: claude-haiku-5-5`, `searches`, `fetches`, `count`, tokens,
  `requestId`, `messageId`, `usd`.
- **Retries and failures** as the text path: every attempt reserves again (`live.retries` 2); a 429 / 5xx / network
  error retries; an HTTP error or a refusal before the network is released (not billed); a network error or an e-stop
  mid-call is charged at the reservation, marked estimated, and counted against the web-call cap.
- **Fetch size:** `max_content_tokens` 10,000 on every fetch (`live.web.fetchMaxContentTokens`).
- **Relay effort:** `low` (`live.web.effort`); thinking is not set (the engine default).
- **No domain list:** config sets none, so none is sent.
- **The one-shot command:** `scripts/scout-live.mjs` (`npm run scout:live`). It refuses unless its own environment
  says live; needs the server stopped (engine lock); no scheduler, no resumed jobs; refuses unless the scout run cap
  is USD 0.50; prints one pre-run line; runs one genre-scout job; prints a key-free report. Blocked briefs are checked
  against intake's scouting screen in memory, never offered to intake (no job can be created).

Tests: `tests/live-web.test.mjs`, 13 tests. `npm test` 308/308. Port drift: none (69 files). `npm run dry-run:scout`
(mock): 4 verified, 1 blocked and refused at intake, 13 names, 12 web calls with the 13th refused, USD 0.00, as before.

### For the owner (open; nothing decided here)

- **Engine settings to approve:** `live.web` (relay model Haiku, effort low, maxTokens 2000, maxUsesPerRequest 1,
  result headroom 20,000 / 12,000 tokens, fetch cap 10,000 tokens).
- **The v1 source rule is still open:** TREND-SCOUT's prompt still says it reads "store best-seller and top-played
  charts", and nothing stops a `web_fetch` of a Steam, itch.io, Twitch or YouTube page (no domain list is set). A
  `blocked_domains` list on `web_fetch` and the one-line prompt change are proposed, not built.

## E6 step b0: owner decisions and the source rule (17/10/2026)

The owner answered the b0 questions above. Built on the stubbed SDK and the mock only: no call was made, no key value
was read, printed, logged or copied. Commit "E6 b0: source rule enforced".

1. **Source rule enforced before the first scout run (owner-approved).** The blocked sites are the four recorded under
   "E6 readiness" item 1: Steam, itch.io, Twitch and YouTube, written in `config/engine.json`
   `webSources.blockedDomains` as `steampowered.com`, `itch.io`, `twitch.tv`, `youtube.com`. Nothing else was added.
   - They go as `blocked_domains` on BOTH `web_search` and `web_fetch` on every relay request. The relay is shared, so
     this covers every agent with web tools: TREND-SCOUT and EVIDENCE-CHECKER (the scout line) and also
     DEMAND-RESEARCHER (the research line).
   - The engine also refuses a `web_fetch` to those hosts or any subdomain before anything is reserved, counted or
     sent, on the mock as on the live provider (`src/engine/lib/web-sources.mjs`, `tools/index.mjs`). An unparsable
     URL is refused too (fails closed).
   - TREND-SCOUT's prompt no longer reads store best-seller, top-played or streaming pages. Its sources are trend
     articles, editorial roundups and community discussion found by web search, and it never reads a store, sales
     chart, game listing or streaming-platform page. Its genre trend evidence is now a trend article, roundup or
     discussion about the genre as a whole (it was "a tag or category page, a chart of the genre"). The IP rule lines
     are unchanged, word for word (tested).
   - Twitch and YouTube data come later, through their official APIs only.
   *Deviation from the wording, flagged:* the owner's examples included `*.itch.io`. The API rejects wildcards in a
   domain with a 400 (platform docs, server tools, "Domain filtering"), and a bare domain already covers every
   subdomain. So `itch.io` is written bare; it blocks `someone.itch.io`, as `steampowered.com` blocks
   `store.steampowered.com`, `twitch.tv` blocks `www.twitch.tv` and `youtube.com` blocks `m.youtube.com` (tested).
   *Not blocked, because not listed:* other domains of the same services, e.g. `steamcommunity.com`, `youtu.be`,
   `twitch.com`. Say if any should be added.
2. **EVIDENCE-CHECKER live web search, with its own 15-call cap: approved.** The run cap of USD 0.50
   (`perJob[genre-scout]`) stays the hard stop for the whole run.
3. **`live.web` settings approved:** relay effort low, `maxTokens` 2000, 12,000 result-token headroom per fetch,
   10,000-token page cap. *Not named in the approval:* the 20,000-token result headroom per search and
   `maxUsesPerRequest` 1 (the plan's "one search a call"). Both stay as built; they only size the reservation and the
   per-request limit.

Tests: `tests/live-web.test.mjs` now 17 (4 new: the four bare domains and the rejection of wildcard or malformed
entries; the list on both tools for every agent with web tools; a blocked fetch refused before it is reserved, counted
or sent, for each web agent and on the mock; the prompt). `npm test` 312/312. Port drift: none (69 files).
`npm run dry-run:scout` (mock): 4 verified, 1 blocked and refused at intake, 13 names, 12 web calls with the 13th
refused, USD 0.00, unchanged.

## E6 step b2: owner decisions (17/10/2026)

The owner's decisions after the b1 rerun (0 verified briefs), recorded as given. Built on the mock only, $0.

- **D1. Etsy demand evidence, short term.** Agents never fetch etsy.com pages (Etsy's terms restrict automated
  scraping). Evidence comes from web search results only: listing titles, prices and keywords as shown in the results,
  plus fetches of non-marketplace pages (articles, roundups, community posts) whose URLs appeared in those results.
  Agents never construct URLs. The competitor count is recorded as "not measured" and the brief's evidence level as
  "indicative" until the Etsy Open API is in place (the owner is applying; a later step, terms check first).
  EVIDENCE-CHECKER verifies every cited source against the job transcript (the URL or snippet must actually have been
  returned) and accepts "indicative" evidence when the keywords and a price range are each supported by at least 3 cited
  results.
- **D2. A "cannot produce" outcome for the output contract:** a `report_blocked(reason)` tool. Calling it satisfies the
  contract and ends the job "incomplete" with that reason, non-zero exit, no downstream steps. Nudges fire only when an
  agent ended its turn with neither its required outputs nor report_blocked; the forced choice offers exactly those two
  (fs_write or report_blocked).
- **D3. One scout brief schema,** validated when the draft is written. An invalid draft returns a validation error to the
  agent (counted as a turn, within caps) so it can fix and rewrite it. The screen uses the same schema. Draft path and id
  naming: keep the existing brief convention; if there are two, pick the one the screen and intake use, and report which.
- **D4. Blocklist:** remove the "UNKNOWN — needs owner check" entry. Only name-like strings are ever auto-added;
  placeholders (UNKNOWN, TBD, N/A, "needs owner check", empty or under 3 characters) are rejected and logged. The
  customer-facing check must come back clean once the placeholder is gone.

## E6 step b2a build record (17/10/2026)

Mock only, $0: no call made, no key value read. Caps, the 4 blocked domains, the IP rule and the originality checks are
unchanged. Commit "E6 b2: scout evidence, blocked outcome, schema, blocklist hygiene".

### As built
- **D1.** `config/engine.json` `webSources.fetchRefusedDomains: ["etsy.com"]`: `web_fetch` to etsy.com or a subdomain is
  refused by the engine before anything is reserved, counted or sent (like the blocked domains), but it is not sent to the
  API, so etsy.com results still come back from `web_search` (`buildRequest` still sends only the owner's four). A
  `web_fetch` must also name a URL that a `web_search` of the same job returned (this run's own results, or any earlier
  run's in the job transcript); anything else is refused before reserve. The runtime now writes every URL a web call
  returned, in full, to the transcript line (`returnedUrls`, `searchUrls`), so the 2,000-character excerpt limit does
  not hide one.
- **Citations.** EVIDENCE-CHECKER's run input lists the URLs the job's web calls returned (`returnedSources` on its line
  step). The engine enforces the rule as well: at brief-check every URL anywhere in a genre brief must be in the job's
  transcript, or the brief goes to `rejected/` ("citations not returned by any web call in this job"). A verified genre
  brief gets a `## Station brief check` record (citation count, job id, "evidence level: indicative"); intake checks the
  citations again against that job's transcript and refuses an indicative brief with no record or no transcript (fails
  closed).
- **Indicative evidence** (`src/engine/lib/scout-brief.mjs`): `evidence level: indicative`, `competitor count: not
  measured`, `checked:` within 30 days, the search queries, a table of at least 3 search results (title, price as shown,
  result URL); keywords (at least 5 sourced, the owner's 2026-10-16 rule) citing at least 3 distinct results; the price
  range citing at least 3; every cited URL listed under Sources. After that, the same checks as the ported brief check:
  digital product, originality of the Design direction, image policy, price floor. The ported Etsy demand-evidence check
  is unchanged and still applies to research-line briefs.
- **D2.** `report_blocked(reason)` is offered to any agent whose line step has an output contract (TREND-SCOUT,
  EVIDENCE-CHECKER). It ends the run at once (no further model call, no nudge); the job ends `incomplete` with
  "<AGENT> reported blocked: <reason>", nothing downstream, scout-live exits 1. A nudge now offers exactly fs_write or
  report_blocked. **tool_choice** (claude-api skill, read 17/10/2026): `any` means "at least one of the request's tools"
  and `tool` names one tool, so the API has no "one of these two" choice. The nudge uses `any` on the Haiku tier and the
  engine refuses any other tool in the reply (a tool error, not run). Claude Sonnet 5.5 returns a 400 for `any` and
  `tool`, so that tier (forcedToolChoice false) gets `auto` plus the instruction. Per the skill, a forced call on Claude
  Haiku 5.5 skips thinking. Narrowing the request's `tools` instead would need the mid-conversation tool-changes beta,
  which the skill does not list for Haiku.
- **D3. Naming: the brief-format and intake convention**, `YYYY-MM-DD--<slug>` (a–z, 0–9, hyphens, at most 60
  characters; `isListingId`), file `scout-drafts/<day>/<id>.md`, date = the folder's day. The screen and intake never
  used the other convention: the `--genre-` file-name prefix was only a filter in scout-live's report and the mock
  fixtures, and is why b1's report was empty. scout-live now selects genre briefs by the `origin: genre-scout` line. The
  schema is checked in `fs_write` (an invalid draft is NOT written; the problems go back to the agent), at the
  scout-notes screen (an invalid draft goes to `rejected/` with "## Station brief schema") and at brief-check and intake.
  The screen now screens EVERY draft in the scout drafts folder for scouted names and derivative wording (b1's drafts
  were skipped because their origin line was malformed). A rejected brief needs only its front matter and its Evidence
  check, so the checker can always record a rejection.
- **D4.** `addToBlocklist` adds only name-like strings: empty, under 3 characters, no letter or digit, or a placeholder
  (unknown, TBD, TBA, N/A, none, null, "needs owner check", "to be confirmed", "??", ...) is refused, logged and recorded
  on the job by kind and reason. The engine still never removes a name; the b1 entry was removed by the owner's one-off
  `node scripts/blocklist-hygiene.mjs --apply` (engine lock, data jail, each removal logged; idempotent). On the real
  data: 11 → 10 entries (the placeholder only), a second run removed nothing, and the customer-facing check of b1's 4
  drafts (`--check-day 2026-10-17`) came back clean (before: all 4 matched the placeholder only).
- **Prompts.** TREND-SCOUT: the DEMAND EVIDENCE and RESEARCH BRIEF FORMAT skills (which say to open etsy.com) are
  replaced by a new GENRE BRIEF FORMAT skill (`prompts/skills/scout-brief-format.md`); new lines: never build a URL,
  never fetch etsy.com, indicative evidence from search results, 3+ results each for keywords and price range,
  `report_blocked` when no draft can be evidenced. The IP-rule lines are word for word (tested). EVIDENCE-CHECKER: one
  paragraph appended for genre-scout briefs (PORTED.md notes it); its standing orders are 15,843 of the 16,000-character
  limit.

### For the owner (open; nothing decided here)
1. **b1's diagnosis, corrected from the transcript:** the Etsy fetch came back `url_not_allowed` with "You don't have
   permission to access this domain", a domain-level refusal, not only the "URL not in the conversation" rule. D1
   covers both.
2. **Intake now accepts an indicative genre brief** (with the station's citation record), so step c could start from
   one. It has no competitor count, review counts or bestseller badges. Should c need your explicit go-ahead per brief?
3. **Partial drafts and report_blocked:** if TREND-SCOUT writes 2 of 4 drafts and, when nudged, calls report_blocked,
   the job ends incomplete and the 2 drafts are not checked (D2 as written). Without report_blocked, a partial set
   continues with the shortfall recorded.
4. **EVIDENCE-CHECKER's legacy step 5** says to write `briefs/` or `rejected/`, but its config allows only the drafts
   folders (b1 tried `rejected/` and was refused). The genre-scout paragraph says to write back to the draft; the
   research line's orders are unchanged.
5. **Under 3 characters:** a real 2-character game title would now be refused from the blocklist (your D4 rule), logged.
6. **Transcripts become evidence:** intake of an indicative brief needs its scout job's `data/jobs/<id>/transcript.jsonl`.
   No retention rule deletes transcripts today; if one is added, those briefs would be refused at intake.

Tests: new `tests/scout-b2.test.mjs` 10/10; changed for the new behaviour: `live-web` (fetches follow a search that
returned the URL; the live-shaped scout uses the fixture's search results), `genre-scout` (intake uses a verified brief
with its citation record and refuses one without; "(evidence indicative)" in the note; the research-line draft uses the
research-format fixture), `output-contract` (the nudge's `any` and two-tool offer). `npm test` 326/326. Port drift:
none (69 files). `npm run dry-run:scout`: 4 verified, 1 blocked and refused at intake, 13 names, 12 web calls with the
13th refused, USD 0.00, as before (the bad brief's intake refusal now also names the missing citation record).
`npm run parity`: 22/22 (baseline 22/22); `npm run parity -- --rebuild`: 26/26, 73 differences, 0 unexplained, as
recorded.

## E6 step b2: owner decisions, part 2 (owner-approved, 17/10/2026)

The owner's answers to the six points under "E6 step b2a build record", recorded as given and built the same day (mock
only, $0). Commit "E6 b2: partial blocked, short-name log, transcript retention".

1. **Diagnosis correction noted;** D1 already covers it. No change.
2. **No per-brief go-ahead for c.** The only human gate stays the approval queue before Etsy publish. The approval card
   must show the brief's evidence level ("indicative") prominently.
   *Built:* the job model carries `evidenceLevel` (from the brief's Demand evidence, `lib/scout-brief.mjs`
   `evidenceLevelOf`); the job panel's approval box shows a banner under its heading, above the decision buttons:
   "Evidence: INDICATIVE — demand from web search results only (titles, prices and keywords as the results showed
   them); competitor count not measured; no Etsy page was opened" (`src/web/ui/evidence.js`, orange border).
3. **report_blocked after a partial set:** if at least 1 valid draft was written, report_blocked records the shortfall
   and its reason, and the line continues with the drafts that exist (as decided in b1). Only report_blocked with 0
   valid drafts ends the job "incomplete".
   *Built:* in the runtime, report_blocked with a partial-allowed contract and at least 1 output (drafts are
   schema-checked on write, so each is valid) ends the run with a shortfall carrying `reason`; the step note reads
   "TREND-SCOUT shortfall: n of 4 outputs (reported blocked: <reason>)". With 0 outputs, or on a contract without
   partials (EVIDENCE-CHECKER's verdicts), it ends incomplete, exit 1.
4. **Keep the under-3-character rule.** Refused short names go to an owner-review list (internal only); never
   auto-added.
   *Built:* `research/scouting/short-names-review.json` (inside scouting/, so only TREND-SCOUT's folder rules apply:
   no other agent can read it), one entry per kind and name with the day and job, no duplicates, logged. Placeholders
   are not short names and are not listed. The owner adds a real name to `blocklist.json` by hand.
5. **Transcript retention follows the brief:** never delete a scout transcript while any brief citing it is open; once
   all its briefs are closed (published, rejected or archived), it may be cleaned up after 90 days. No cleanup existed,
   so the rule is recorded here and in code: `src/engine/lib/transcript-retention.mjs` `cleanupTranscripts()` is the
   only way a transcript may be deleted. It finds the citing briefs from the station citation record (job briefs: open
   unless the job is published, rejected, rejected by the owner or archived; verified briefs not yet taken in: open;
   rejected briefs: closed). It keeps a transcript while any is open or until 90 days after the last one closed (and after
   its own job ended), and throws `RetentionRefusal` when asked to delete one an open brief cites. Nothing calls it on a
   schedule yet.

Tests: new `tests/scout-b2-owner.test.mjs` 4/4 (partial + report_blocked continues with the shortfall and reason; short
names on the review list only; retention refuses while a brief is open, keeps for 90 days after the last closes, then
allows; the approval card's banner). `tests/scout-b2.test.mjs`: the report_blocked test now says "with 0 drafts"; the
blocklist test counts the review-list log line.

## E6 step b2: product key as data (owner-approved, 17/10/2026)

After the b2 rerun stopped on "the desk-props pack key": **the product key is data, never prose.**
1. The scout run input and the weekly genre-scout routine carry product_key explicitly (default: pngtuber-prop-pack,
   from products.json). The engine validates it against products.json before any model call or reservation; an unknown
   or missing key ends the job "incomplete" with reason "unknown product key: <key>" at USD 0, exit 1.
2. TREND-SCOUT's step 1 uses the injected key and no longer describes it in words. The "desk-props pack key" wording is
   removed. The IP-rule lines are unchanged word for word.
3. Sweep every prompt, skill, routine, line config, fixture and mock scout script for legacy product names or keys, and
   make every reference use the injected key or the products.json key. The customer-facing SKU DESK-PROPS-01 stays where
   it is a SKU, not a key.
4. Tests: unknown key; missing key defaults only via config; no product description used as a key in a prompt; the mock
   dry run uses the same input path as live.

### As built
- `config/lines/genre-scout.json`: `requiresProductKey: true`, `productKey: "pngtuber-prop-pack"` (the default).
  `createResearchJob({ productKey })` stores the key on the job (`product_key`, with its source: "given" or "line
  config"); with no key given, only the line config supplies one. `runSteps` checks it against `config/products.json`
  before the first step (scout-retention included), so an unknown or missing key ends the job incomplete, "unknown
  product key: <key>", with no stage, no reservation, no model call and USD 0; scout-live exits 1.
- The key reaches TREND-SCOUT as one data line in the run input, `product_key: <key>`. Every genre draft's
  `product_type` must equal it: checked on write (schema), at the screen and at brief-check.
- `scripts/scout-live.mjs`: optional `-- --product-key <key>`, else the line default; the pre-run line now starts
  `product_key=<key> (<source>, in products.json | NOT in products.json)`, and the report's job record shows the key.
- The routine: `config/routines.json` gives the seed `productKey`; `engine.runRoutine` passes a shipped routine's
  `productKey` to the job (any other routine uses the line default). No database change.

### The sweep: every reference changed
| File | Was | Now |
|---|---|---|
| `prompts/agents/trend-scout.md` step 1 | "Use the product key the routine prompt names (default: the desk-props pack key); if it is not listed, reply `NO PRODUCT` and stop." | "Your run input has a line `product_key: <key>`; the station has already checked that key against `products.json`. Read `products.json` and use the entry with exactly that key: what the product is (its kind and the files it delivers) comes from that entry. Every brief's `product_type` is exactly that key." |
| `prompts/agents/trend-scout.md` SOUL | "an ORIGINAL desk-props pack brief" | "an ORIGINAL brief, for the product your run is given" |
| `prompts/agents/trend-scout.md` step 4 | "the desk-props demand for that genre … search for that genre's desk props, stream props or overlays" | "the demand for that product in that genre … search for the genre together with what the product entry delivers" |
| `config/agents/trend-scout.json` role | "…into original desk-props briefs" (and "public popularity signals") | "…into original genre briefs for the product key its run is given" (and "public trend coverage") |
| `config/routines.json` weekly scout input | "…for the desk-props pack (product key pngtuber-prop-pack)…, from public popularity signals only…" | no product in the text ("…for the product_key in this run input", sources as the b0 rule); `productKey: "pngtuber-prop-pack"` as data |
| `fixtures/engine/scout-script.mjs` | the mock scout wrote `product_type: pngtuber-prop-pack` into every draft, whatever the run input said | it reads `product_key:` from the run input (and stops without one, as the live model would); `FIXTURE_PRODUCT_KEY` is used only by tests that build a brief directly |

Kept, because they are not keys: the brief id slugs `…-desk-props` (fixture and the format skill's example id), the
genre-brief rule's "original props" (an IP-rule line, unchanged), `productKey` fields in listing records (they hold the
products.json key), the demo's `demo-sticker-pack-5` and the dry run's `dry-run-sticker-pack-5` (their own products files).
No prompt, skill, line config or fixture uses DESK-PROPS-01 (it appears only as the SKU in the published job's records).

**The mock dry run and the live run now share the input path.** Both call `createResearchJob` without a key, so both get
the line config default and the same `product_key:` line. The mock passed before only because the fixture hard-coded
the key in its drafts and never read the run input; that is why the dry run could not catch b2's failure.

**Not changed (for the owner):** the routine row already seeded in `data/station.db` still has the old input text
("…for the desk-props pack (product key pngtuber-prop-pack)…"). It is the owner's record (disabled); the engine no
longer takes the key from it (the seed's `productKey` is passed). Edit or re-seed it from the page if wanted.

Tests: new `tests/product-key.test.mjs` 5/5 (an unknown key: incomplete, USD 0, no model call, no stage, exit 1;
missing: the config default only, and with no default incomplete the same way; the routine seed's key; no prompt or skill
describes a product as its key; the mock takes the key from the run input, a draft with another key refused on write).

## E6 step b3: blocklist on every outcome, per-job notes (owner-approved, 17/10/2026)

Two gaps found in rerun 4 (job `2026-10-17--genre-scout-4`): TREND-SCOUT noted 4 games, then called report_blocked, so
(1) its names never reached the blocklist (the scout-notes step that adds them runs only after a normal TREND-SCOUT
finish), and (2) it overwrote the day's shared `scouting/2026-10-17/notes.json`. The owner's two fixes:

1. **Blocklist on every outcome.** The names in a job's notes go on the scouting blocklist whenever the job ends, whatever
   the outcome: done, research-done, incomplete, report_blocked, failed, cap hit, E-STOP, crash on restart recovery. It
   runs once per job, is idempotent, and uses the existing name-like filter (placeholders refused, short names to the
   review list). Backfill: run it over all existing scouting notes in data/, run 4's included.
2. **Notes never overwritten.** Each job writes its own notes file, keyed by job id: `scouting/<day>/<jobId>/notes.json`.
   Anything that reads notes reads all jobs for the day. The existing `scouting/2026-10-17/notes.json` moves into run 4's
   job folder (it holds run 4's notes).

Unchanged, as the owner said: caps, blocked domains, the IP rule, the name-like filter and the short-name review list.

### As built
- `lib/scouting.mjs`: `blocklistFromNotes` is the one pass over one notes file (validate, take every entry's names, the
  existing `addToBlocklist` with its filter). **Fails closed:** names are taken even from notes that fail validation (a
  wrong count, a missing link); only the name-like filter refuses a term. Unreadable notes add nothing and are logged.
- `orchestrator.mjs`: `blocklistOnEnd(jobId)` runs when a job has ended: in `startJob`'s `finally` (every end of
  `runSteps`: research-done, incomplete, blocked, stopped by the e-stop or the owner, and a crash), after the owner's Stop
  of a queued job, and at engine start for a job that restart recovery blocked (`engine.mjs`). Only research jobs on a
  line with a `scoutingNotes` agent; it never throws (an error is logged). **Once per job:** the job record keeps the
  sha256 of the notes it passed (`data.scoutBlocklist`: when, counts, refused kinds and reasons, never a name), so
  scout-notes and the job end do not pass the same notes twice. The scout-notes step still adds the names before the
  screen (it must, to block a draft naming a scouted game).
- **Restart or resume of the TREND-SCOUT step:** if this job's notes file already exists (an earlier attempt), its names
  are passed first and the file is moved aside to `notes-replaced-<stamp>.json` in the same job folder (never
  overwritten, never deleted; retention removes it with the day). Not asked for by name; it closes the same gap within one
  job.
- **Per-job path:** the run input names `scouting/<day>/<jobId>/notes.json`; `fs_write` refuses any other path in
  `scouting/` (another job's file or the old day file), and the role's `writes` is `scouting/*/*/notes.json`.
  `prompts/agents/trend-scout.md` step 3 now says "the notes file your run input names
  (`scouting/<today>/<job id>/notes.json`, this run's own file)". The IP-rule lines are unchanged.
- **Readers:** `readDayNotes(researchDir, day)` returns every job's notes for a day (and any pre-b3 day file, and any
  moved-aside attempt). scout-notes validates its own job's notes and passes every other notes file of the day through
  the same step. Retention is unchanged (it deletes the whole day folder after 90 days, job folders included).
- **The backfill** (`node scripts/blocklist-hygiene.mjs --backfill [--apply]`, `backfillScouting`): a pre-b3 day file moves
  into the job whose transcript holds the last `fs_write` to that path with byte-for-byte the same content; no such job,
  or that job already has its own notes, and it stays where it is, reported (never guessed). Then every notes file in
  data/ goes through the pass. Report-only unless `--apply`; idempotent; it takes the engine lock like any engine process.

### Backfill run (17/10/2026, mock only, no model call)
- **Moved:** `scouting/2026-10-17/notes.json` -> `scouting/2026-10-17/2026-10-17--genre-scout-4/notes.json`, identified
  from run 4's transcript (its notes write is byte for byte the file; sha256 `74c552cd…ba35dc52` before and after).
- **Added:** 4 names from run 4's notes, 2 games and 2 studios (the notes had no `alsoBlock` names); its other 2 games
  and 2 studios were already listed from earlier runs. Refused: none. Blocklist 10 -> 14 entries. Short-name review
  list: none. A second `--apply` moved nothing and added nothing. The names are on the internal blocklist only and were
  reported to the owner; none is written here.
- **The earlier runs' notes were lost to the overwrite** (b, job `-1`; b1, job `-2`; rerun 3 wrote none). Checked
  against the blocklist, not assumed: job `-1`'s 4 games and 4 studios are listed with its job id (b ran before the job
  transcripts, so its notes cannot be compared); job `-2`'s notes survive in its transcript (`data/jobs/2026-10-17--genre-scout-2/transcript.jsonl`,
  the full `fs_write` input): all 12 of its entries are on the blocklist except 4 copies of the b1 placeholder
  "UNKNOWN — needs owner check", which D4 removed on purpose. Every real name from the earlier runs is listed.
- Customer-facing check for 17/10/2026 (`--check-day`): 4 files, clean.

## R4a build record: warm office prototype and quality tiers (17/10/2026)

The owner's R4a brief: a visual pass on one room (the main office room) plus quality tiers, then stop for review; R4b
(the other rooms) later. No engine, provider, guard, ledger, data, prompt, engine config or line config file changed;
STATION_PROVIDER stayed mock (the captures and the demo check ran the engine on the mock provider in throwaway data
roots); no live call. No new dependency; three.js stays 0.186.1 (AgX is in it). Owner's style direction (17/10/2026):
02.png as the base, 01-main.png for the light wood edge band and plinth deck, desk and wall lamps and wall shelves.

### Choices made in the build (for the owner to confirm or change)

- **The room.** "The main office room" was read as the Office room (the `office` bake unit, 4 desks in two rows). The
  other four areas are untouched: their glTF, buffers and lightmaps are byte-identical to R3b.
- **The reference images.** `design-refs/01-main.png` and `02.png` are not tracked (`git ls-files` lists neither;
  `design-refs/` is in .gitignore); left as they are. Used as style guidance only: nothing traced, sampled or copied.
- **One rug per department.** The Office's single department gets one charcoal rug under its whole desk cluster (both
  rows), as the brief says; the layout's per-row clusters (`layout.js`) are unchanged and still drive the procedural rooms.
- **Pendants.** A dome pendant over each desk. A linear pendant along each row was tried first: in the isometric view
  it read as a dark beam across the monitors. The domes sit mostly behind the desks' labels at overview zoom and show
  when zoomed in; their warm pools land on the desks.
- **Window wall.** The Office's left wall (the slab edge, the outside) has three tall windows with light wood frames.
  Panes are unlit on the page (bright by day, dusk blue by evening) and left out of the bake. The daylight is one soft
  spot per window, 5 units outside, aimed down at 45 degrees with a cone the window's size, so the wall masks it and
  window-shaped patches (with the frame's shadows) fall across the tile. Two earlier set-ups were measured and dropped:
  a panel just outside burnt out the sills and reveals (day lightmap scale 13.6, the other rooms about 1.05), and a
  large panel further out lit the wall tops (there is no ceiling in the bake; scale 30.6). Final day scale 4.68.
- **Thick walls.** The visible wall thickness is 0.32 (the layout's 0.18): the inner faces move into the room, so the
  room's outline, the atrium and every path stay as they are. Caps are chamfered (3 cm) and catch the light.
- **The plinth deck.** Along the slab's front edge under the Office: a light wood fascia over a dark base, 4 cm proud of
  the slab, so it covers the atrium unit's slab face there. The step where the deck ends (the Office's right edge) is
  visible until R4b gives the rest of the slab the same edge.
- **Materials on the unlit page.** Baked surfaces stay unlit (lightmap x albedo, as since the R3 spike), so roughness
  cannot show; the floor's "roughness variation" is a per-tile tone, soft clouding and speckle in the tile's colour. The
  tile (0.9 m, 14 mm grout, exaggerated so it reads at overview zoom) and the plaster are made in the build (seeded numpy,
  no download); the light wood is the CC0 oak photo shifted.
- **Compressed textures.** The pipeline's JPEG and WebP stay; KTX2/Basis would need a new encoder tool (not pinned or
  licence-checked here) and saves GPU memory rather than download at these sizes. Not added.
- **Lightmap resolution.** Office atlas 3072 px (132 texels per unit; R3b 2176 px, 103). One Cycles bake at 6144 px for
  the high tier; the default atlas is that bake halved in linear light. 512 samples (the 6144 px bake at 1024 would take
  about 10 minutes more); the halved default map averages four baked texels each.
- **Bevels.** `Kit.fbox` chamfers furniture boxes by 12 mm when an area sets a bevel (only the warm Office does; every
  other area builds exactly as before, the same random draws). Office triangles 11,273 (R3b 5,916).
- **Tone mapping.** AgX for the whole scene (the renderer's operator is global), exposure 1.32 light / 1.30 dark from
  `config/warm-office.js`. The other rooms change a little with it (slightly softer, less saturated); their
  brightness against the procedural rooms was not re-measured. Plaster's brightest channel 213 of 255, caps 217 (247 in
  the high tier): no clipping.
- **Default tier = no post-processing at all**, as the brief says: the scene is drawn straight to the canvas. That
  also drops what R3b had in its post chain, for every room: 4x MSAA (edges are no longer anti-aliased), the cached AO
  (the bake's own occlusion stays) and the dark-mode LED glow. The status lights, screens and LEDs are drawn untoned in
  this path (their own colours, unaffected by AgX).
- **High tier** = the R3b post chain plus: 4x MSAA, the cached half-resolution AO (kept: it gives the real-time
  monitors and people contact shading), a selective bloom (only the lamp and LED meshes and the screens, drawn on their
  own layer at half resolution; a threshold bloom also caught the sunlit floor), the 6144 px lightmaps (loaded lazily,
  only the current theme's), pixel ratio up to 2. By day only the warm rooms' lamps bloom (the other rooms' LED strips
  are unlit profiles in light mode, as R3b decided).
- **Auto-select.** `quality.js` `pickTier`: high only for a recognised discrete GPU (GeForce, RTX, GTX, Quadro, Radeon
  RX/Pro, Arc) with a texture limit of at least 8192 and not a phone; anything else, or an unreported GPU, gets default.
  The top bar's Quality control (Auto / Default / High) is remembered in this browser (`office-quality`);
  `?quality=` sets one page without changing the remembered choice. On this PC: Playwright Chromium (Intel) picks
  default; the owner's Chrome (RTX, High performance) would pick high.
- **Readability.** A dark ring under every desk status light (the idle grey was weak on light wood). A phone layout
  (up to 640 px wide): before R4a the 340 px task panel left the 3D stage about 120 px wide at 390 px, so nothing in
  the scene was readable; now the stage takes the full width, the task panel moves under it and scrolls, the side panel
  covers the stage, the key hints hide, and the department cards show name and agent count only (they overlapped).
  The agents and the desk labels needed no change against the charcoal rug: oatmeal chairs and light wood desks frame
  the people.
- **Measuring at the vsync cap.** Both tiers render faster than this panel's 165 Hz, so the fps rows read about 164
  (the frame interval, 6.06 ms). The harness cannot show the headroom above that; as an upper bound on cost, the high
  tier on the Intel iGPU still runs 76.7-84.1 fps.
- **GPU choice in the captures.** Headed Playwright Chromium once came up on the RTX this session (it usually gets the
  Intel). The R4a capture script now records the page's own GL renderer on every fps row and flags any row not on the
  expected GPU; the budget run's rows all say Intel UHD.

### Measured (17/10/2026)

Same harness and method as R3b (fresh page per view, 3 s benches, headed, the throttled-bench retry; engine view on the
mock provider), 1600 x 1000; `screenshots/r4a/fps-*.json`. Office room camera: R3a's (the room focused at zoom 1.8),
overview: R3b's.

| View | R3b (before), Intel UHD | Default tier, Intel UHD | High tier, RTX 5060 Laptop | High tier, Intel UHD (reference) |
|---|---|---|---|---|
| Office, light (moving / full) | 75.3 / 78.1 | 165.2 / 163.6 | 165.2 / 164.0 | — |
| Office, dark | 71.5 / 75.4 | 165.0 / 163.8 | 165.0 / 163.9 | — |
| Overview, light | 80.0 / 79.8 | 165.2 / 163.6 | 165.2 / 163.9 | 82.0 / 84.1 |
| Overview, dark | 74.4 / 73.4 | 165.2 / 163.6 | 165.2 / 163.9 | 82.4 / 83.9 |
| All agents walking, dark | 64.8 | 165.0 | 165.5 | 76.7 |
| All agents walking, light | 71.4 | 164.8 | 165.2 | 79.4 |

Default tier on the Intel iGPU: min 163.6, mean 164.1 fps at full quality (vsync-capped; frame p95 6.2-6.3 ms).

Download per tier (bytes as served, `src/web/assets/office/`): R3b 7,135,513; **default tier 8,143,195** (81.4% of the
10 MB budget; brotli 5,377,902); **high tier 11,550,869** (the default set plus `high/`, 3,407,674: day 1,556,752,
evening 1,850,922, loaded only when high is on). The Office unit: atlases 536,368 (day) and 556,126 (evening),
`office.bin` 1,217,668, `office.gltf` 19,939; new textures tile 78,952, lightwood 48,227, plaster 18,820.
Rebuild of the Office unit: 353.1 s (day bake 164.6 s, evening 152.2 s; 512 samples at 6144 px, OptiX).

### For the owner

- **Anti-aliasing in the default tier.** As briefed it has none, and edges are visibly stepped next to R3b (which had
  4x MSAA). The default tier is far inside the budget (vsync-capped on the iGPU), so the canvas's own MSAA could likely
  be turned on without missing 60 fps; it is not post-processing, but it is not measured. Turn it on?
- **The dark-mode LED glow** is a post pass, so the default tier no longer has it in any room (the high tier does).
  Keep, or allow that one cheap pass in the default tier?
- **AgX everywhere** changes the four R3b areas slightly ahead of R4b. Keep, or hold them on ACES until R4b?
- **One rug for the whole department** (as briefed) covers both desk rows; 02.png's look has a rug per desk zone. Keep,
  or one per row?
- **Default-tier budget headroom:** 8.14 MB now; R4b adds the warm textures to the other rooms (shared, already in) and
  bigger atlases. At the Office's density and bevels the other three units would add roughly 3 MB (an estimate, not measured): over 10 MB unless they stay at
  R3b's density or `office.bin`-style buffers are compressed (meshopt; three's decoder is in the pinned package).

## E6 step c0: owner decisions (17/10/2026)

Recorded as the owner gave them (17/10/2026):

- **D1. Price floor for `pngtuber-prop-pack`: USD 3.50** (was USD 7.19, the fee-model digital floor: Etsy fees incl. VAT +
  the EUR 5 minimum margin). It is a minimum; agents may price higher when evidence supports it. Configured once, in
  `config/products.json` (`priceFloorUsd`), and read by every check that reads the floor (below).
  Workings at the floor: USD 3.50 × 0.893256 = EUR 3.13 (rounded up). Etsy fees on EUR 3.13 = 0.18 listing + 0.20
  transaction + 0.43 processing + VAT 0.04 + 0.05 + 0.10 = EUR 0.99, so the margin at the floor is **EUR 2.14**, below the
  EUR 5 minimum margin the fee model uses for every other digital product (flagged, not changed).
- **D2. Thinking is disabled for every agent in the first full live run**, recorded per agent in config so it can be turned
  on one agent at a time later.
- **D3. Check the note "Sonnet 5.5 rejects forced tool calls with a 400".** With D2 in place, use forced tool choice
  wherever the claude-api skill says it is valid, and record the finding.

Also decided by the owner in this session, before the build (17/10/2026, answers to the three conflicts the build found):

- **Upscaling: keep the pinned local Real-ESRGAN as it is.** The brief said "no upscaling (ESRGAN stays disabled)", but the
  owner enabled it on 17/10 (DECISIONS.md "Port batch"), `products.json` asks for it (`prep.upscale`), the owner-approved
  notice promises 2000×2000 and gpt-5-image-mini draws 1024×1024. Nothing changed: digital build only, $0, killed by the E-STOP.
- **File 1: QA first, then the owner.** QA-DESIGN checks file 1 (redrawn on a fail before any other file), then the job
  waits for the owner's decision on file 1 (`styleReference.ownerOk`, unchanged), then continues as the same job. Step c's
  "one job through the whole line" therefore has one planned pause.
- **DESIGNER's maxImages stays 8:** files 2–12 are drawn in DESIGNER runs of at most 6 (8 less 2 spare for regenerations),
  each image with file 1 as the reference.

### D3 finding (claude-api skill, read 17/10/2026)

The note was about **Sonnet 5.5, not thinking**. Forced `tool_choice` (`any` or `tool`) returns a 400 on Claude Sonnet 5.5
(also Opus 5.5 and Fable 5.1) whatever the thinking setting: "a model-specific restriction, not a consequence of always-on
thinking". Claude Haiku 5.5 accepts a forced choice, with thinking on or off (with thinking on, the forced call skips the
thinking block). So the existing tiers were already right and stay: `cheap` (Haiku) forces the nudge's tool call, `strong`
(Sonnet) sends `auto` with the instruction in the message (the skill's own advice for Sonnet 5.5: `auto` plus the prompt,
`strict: true` for schema-valid arguments). Recorded in `config/engine.json` (`$tiersComment`).

### D2 as built: what "off" means per model

D2 cannot be sent literally on Sonnet: `thinking: {type: "disabled"}` returns a 400 on Claude Sonnet 5.5. Its lowest
setting is `{type: "between_tools"}` (no extended thinking; the short progress notes between tool calls come back as
thinking blocks; effort high or below; no other field allowed). Claude Haiku 5.5 accepts `{type: "disabled"}` at effort
low, medium or high. So each agent's file says `thinking: "off"` and `config/engine.json` `thinking.off` maps it per model
(Haiku `disabled`, Sonnet `between_tools`); `"default"` sends no thinking field. A model without an entry refuses an "off"
agent before any call. Every agent's effort is `low` and the page offers only low/medium/high, all valid with
`between_tools`. The web relay (not an agent) is unchanged.

## E6 step c0 build record: OpenRouter images, vision pricing, the style-reference run (17/10/2026)

No spend: everything below is tested against stubs (no network, no key read).

### As built
- **`providers/openrouter.mjs`** (new): the live image client behind the existing image interface (same `generate()` as
  the mock). OpenRouter chat completions with `modalities: ["image","text"]` (the legacy route), one image per call, the
  image returned as a base64 data URL (a hosted URL is never downloaded). Only `image.allowedModels`
  (openai/gpt-5-image-mini) and only priced; key `OPENROUTER_API_KEY` from the environment only, in a closure, redacted in
  every message; live only (`STATION_PROVIDER=live` in the process), never demo. No usage parameter is sent: OpenRouter
  reports `usage.cost` on every response (its usage-accounting page, read 17/10/2026; `usage.include` is deprecated).
  Errors sorted from OpenRouter's errors page (read 17/10/2026): **hard stop** for 401, 402 (except an in-flight budget,
  retried), 403 without moderation metadata (the key's own limit, i.e. the owner's USD 2 a day, a budget or a guardrail),
  404 and other 400s; **content refusal** for 403 with moderation metadata, a 400 naming the safety system, and a 200
  without an image; **retry** for 408, 429, 5xx, a 200 carrying an error, network and timeouts. Transparency is asked in
  the prompt and measured in the returned bytes (alpha channel and clear pixels).
- **`tools/index.mjs` image_generate**: strict arguments (a string `"true"` for the boolean, a wrong type or an unknown
  argument is a tool error back to the agent: one turn, nothing called or charged); the e-stop before every attempt;
  USD 0.08 reserved before every attempt and settled to `usage.cost` (estimated at 0.08 when none is reported); one ledger
  row per image with the generation id, model, size, cost and job id (`guard.settle` takes `generationId` and `size`);
  retries per `live.retries`, each reserved again; a hard stop ends the run refused (`ImageStop`) and the job blocked with
  the key-free reason; a content refusal is a tool error and a failed attempt for that file (job data `imageAttempts`,
  limit = the design loop's 1 + 2). Refusals before the network are never billed (also in `guardedTextCall`).
- **Style reference** (`orchestrator.mjs`, owner decisions above): the designer step of a `styleReference.ownerOk` product
  runs DESIGNER in `[RUN MODE: FIRST FILE ONLY]` (image_generate may draw only `set-vN/raw/01-<subject>.png`), builds file 1
  as delivered and flattens it on white and dark (`makeReviewImages`, the pinned Real-ESRGAN), then QA-DESIGN checks it
  (`[RUN MODE: FILE 1 CHECK]`, verdict kind `file1`, written to `qa/file1-pass<k>.json`). A revise, no file 1 (e.g. a
  content refusal) or a file 1 that cannot be built is a failed attempt: file 1 is drawn again in a new set, before any
  other file, up to 3 attempts, then REJECTS-DESK. Approved: the job waits (`queued`, `waitingFor: owner-style-ref`,
  never started by itself); the owner decides with `npm run owner -- style-ref <id> '{"set":N,"status":"approved"}'` (or
  rejected with a reason, which goes into the next first-file run) and resumes (`npm run line:live -- --resume <id>`, or
  the page's Restart). After the approval DESIGNER draws files 02–12 in `[RUN MODE: REST OF SET]` batches of at most 6; the
  engine sends the approved file 1 (checked against its sha256) with every call as the style reference and refuses file 1
  and any file outside the batch. Prep copies file 1 into raw/ and builds as before (`ensureStyleRefInSet`).
- **Vision pricing** (row 20): `image_analyze` reserves the image as visual tokens from its pixel size,
  ceil(w/28) × ceil(h/28), scaled to the long-edge limit and capped (`lib/vision.mjs`, `config/engine.json vision`: Haiku
  5.5 and Sonnet 5.5 are high-resolution, 2576 px, 4784 tokens; from the vision docs, read 17/10/2026), plus the text
  estimate of everything else; the settle is the response's usage. A 1024×1024 image reserves 1,369 tokens (USD 0.0027 on
  Sonnet), not the base64 length.
- **Packaging** at parity with DESK-PROPS-01: unchanged (transparent PNGs checked for an alpha channel and clear pixels,
  sizes from the product, the deterministic ZIP, the product's file names).
- **D1** in `lib/etsy-fees.mjs` (`ownerFloor`, `productFloor`; ported file, change recorded in its header): the brief check,
  intake, the scout's brief check, the price fill and the package gate all read the product's floor through
  `variantLadder` / `briefPriceCheck`. `prompts/skills/price-floor.md` (EVIDENCE-CHECKER, the researchers) names it. LISTER
  writes no price and QA-LISTING checks presence only (their skills say so); the price fill and the gate carry the floor.
- **`scripts/line-live.mjs`** (`npm run line:live`): the one-shot live command for step c (`--brief <id>`, `--resume <id>`,
  `--plan` for the pre-run line only); `scripts/owner.mjs resume` refuses a job with live ledger rows on the mock.
- **Parity check**: the price-fill check now allows exactly one difference, the margin workings' floor figure (EUR 6.42 in
  the legacy listing, 3.13 now under D1); price EUR 9.00 and margin EUR 7.25 must be unchanged. Listed as explained.

### For the owner (open; nothing decided here)
- ~~D1 margin~~ and ~~row 19, the per-run cap~~: decided by the owner, see "E6 step c0: owner decisions, part 2".
- **Thinking off and quality:** D2 is for the first full live run; the skill recommends adaptive thinking at low effort
  over thinking off for quality. Per agent in config when the owner wants to turn it on.
- **The web relay** keeps its default thinking (it is not an agent); say if D2 should cover it too.

## E6 step c0: owner decisions, part 2 (owner-approved, 17/10/2026)

1. **Per-run cap USD 2.00** (owner spend rule; config said 1.00, carried over from the StarNet era). Job cap USD 5.00 and
   daily USD 10.00 unchanged. `config/engine.json` caps.perRunUsd = 2; E6 checklist row 19 closed; pinned in tests
   (`e6-prices`, `e6-c0`). No test pinned 1.00 from the config (`tests/helpers/engine.mjs` has its own test caps).
2. **The margin at the USD 3.50 floor (EUR 2.14 after fees) is intended.** Checked: no separate minimum-margin rule makes
   the effective floor higher. The EUR 5 minimum margin lives only in the fee-model floor (`variantFloor`), which the owner
   floor replaces in `variantLadder` and `briefPriceCheck`; the brief check, intake, the scout's brief check, the price fill
   and the package gate all read that. The gate checks the margin estimate's figures, never a minimum. Changed: the wording
   only, so no agent reads the EUR 5 margin as binding: `prompts/skills/price-floor.md` ("except an owner floor below (it
   binds; no margin rule raises it)") and the note on `products.json` priceFloorUsd. Also tested: with no brief price the
   pack lists at the floor + 15% (EUR 3.60, margin EUR 2.55), not at a margin-based price.
3. **Fallback:** if the scout rerun verifies no brief, stop and report. DESK-PROPS-01 (already published) is not a fallback.

Checks after the change: `npm test` 371/371; the mock dry run and `npm run parity -- --rebuild` (26/26) unchanged; port
drift none. EVIDENCE-CHECKER's built prompt is 15,962 chars, 38 under StarNet's 16,000 clamp (flagged: little room left).

## E6 step c: price and seasonality formats (owner-approved, 17/10/2026)

After scout run 5 (`2026-10-17--genre-scout-5`, below in PROGRESS.md): TREND-SCOUT reported blocked because the genre
brief format took only a single price per row and refused UNKNOWN seasonality. The owner's decisions:

1. **Prices as shown.** A Demand evidence price is the raw string the search result showed, in one of three forms: one
   price (`USD 4.99`); a sale, the current price with the original kept alongside (`USD 7.49 (was 9.99)`); a range, both
   ends kept (`USD 4.50–18.75`). The floor and the price-range checks use the current price; for a range, the low end is
   used for the floor. EVIDENCE-CHECKER verifies each raw price string against the job transcript.
2. **Seasonality** `not measured (no source)` is a valid value, as the competitor count is "not measured". A season may be
   claimed only when a cited result supports it.
3. **The .env metadata check** is dropped from reports: the deny rule (`Read(./.env)` in `.claude/settings.json`) is the
   guarantee now.

### As built
- `lib/scout-brief.mjs`: `parsePrice` (the three forms; a sale's original must be above its current price, a range runs low
  to high, one currency); the Price range must be the lowest and highest CURRENT prices of the USD rows (a range at its
  ends, never a "was" price), so the floor check (on the Price range low, as before) uses the current price or a range's
  low end; Seasonality is `not measured (no source)` or carries a URL (listed under Sources and, at brief-check and
  intake, returned by the job's web calls like every citation); `priceStringProblems`: every number in every price must be
  one the job's web calls showed. `checkScoutBrief` takes `returnedPrices`.
- `lib/web-sources.mjs` `pricesIn` / `returnedPrices`; `runtime.mjs` keeps each web call's price figures in full on its
  transcript line (`returnedPrices`, like `returnedUrls`; the transcript's result excerpts are cut at 2,000 chars).
- `orchestrator.mjs`: the scout-notes screen, brief-check and intake check the prices against the job transcript (a
  transcript without price figures, i.e. before this change, fails closed); EVIDENCE-CHECKER's input gets a PRICES
  RETURNED list next to SOURCES RETURNED.
- Prompts: `skills/scout-brief-format.md` (the three price forms, the Price range rule, Seasonality), TREND-SCOUT step 4
  (one sentence; the IP-rule lines unchanged word for word, test passes), EVIDENCE-CHECKER's genre-brief paragraph.

### EVIDENCE-CHECKER trimmed first: 15,962 -> 13,972 chars (at most 14,000, owner)
Merged duplicated rules; the IP rules (ORIGINALITY RULES, ORIGINALITY SOURCES) are unchanged word for word:
- The `brief-format` skill (2,389 chars) is no longer inlined for EVIDENCE-CHECKER: it is the Researcher's writing template.
  Its two rules the checker uses (the brief's front matter and headings, and the Evidence check's line format) are now
  one paragraph in its orders. Keyword sourcing, the id rules and the UNKNOWN rule it also carried are in DEMAND EVIDENCE /
  DATA HYGIENE and enforced by station code (brief-check). DEMAND-RESEARCHER still has the skill.
- The source check (OPENED / NOT REACHABLE; YES / PARTLY / NO) was stated in step 2 and in the template: once now.
- The owner-recorded rule was in step 2 and in DEMAND EVIDENCE: one short line in step 1 now (the skill keeps the full rule).
- The floor in step 4 ("the lowest price clears the BRIEF FLOOR (or the owner price line does: BRIEF PRICE RULES)") is now
  "the BRIEF PRICE RULES pass" (the rule itself is in those skills).
- The 15-call limit and the reply line are stated once (they were per run and at the end).

## E6 step c: the floor rule corrected (owner decision, 17/10/2026)

Replaces decision 1's floor wording of "E6 step c: price and seasonality formats" (`74da080`), after scout run 6. **The floor
is our minimum listing price, not a requirement that the market has no cheaper listings.**
- Price range: the full range exactly as shown, listings below the floor included. Cheap rows are never dropped or hidden.
- Floor check for a brief: passes when at least 3 cited listings show a current price at or above USD 3.50 (a sale price
  counts as current). The low end of the range is no longer used for the floor check.
- LISTER and QA-LISTING still never price below USD 3.50 (unchanged: the price fill and the package gate hold the floor).

### As built (genre-scout briefs)
- `lib/scout-brief.mjs`: `floorRows` counts the Demand evidence rows with a result URL whose USD current price is at or
  above the product's floor (a sale at its current price; a range counts only when its low end clears the floor, i.e. when
  every option it sells is at or above it: my reading, flagged); `MIN_FLOOR_ROWS` 3. `checkScoutBrief` uses it instead
  of the Price range's low end (the owner price line keeps its own rule). The Price range must still be the rows' full
  current range (unchanged since `74da080`), so cheap rows show in it.
- "Never hide a cheap row": `hiddenRowProblems` — every price under the floor that the brief's own searches (its
  `search queries:` line, matched to the job's web_search calls) returned must appear in a Demand evidence price, and every
  named query must be one a web search of the job ran. The transcript now keeps each web_search's price figures with its
  query (`searchPrices`). Applied at the scout-notes screen, brief-check and intake (checked against the job transcript).
  Known limit: the figures are read from the result text, so a non-listing figure under the floor in a result (a shipping
  fee, say) would count as a result to record.
- Prompts: `skills/scout-brief-format.md` (the full range; the FLOOR rule replacing BRIEF PRICE RULES' lowest-price rule for
  genre briefs; record every cheaper result; exact query names), EVIDENCE-CHECKER's genre paragraph (13,974 chars, under
  14,000). TREND-SCOUT reads the rule from its skill; its prompt and IP-rule lines are unchanged.
- **Not changed (flagged):** the research line's Etsy briefs (DEMAND-RESEARCHER, `checkBrief`, `price-rules-brief.md`) still
  need the lowest top-5 price at or above the floor. The correction named the genre-scout pieces; say if it applies there too.

## E6 step c: owner brief path, research floor, scout paused (owner-approved, 17/10/2026)

After scout run 7 (`2026-10-17--genre-scout-7`, PROGRESS.md), the owner's decisions:

1. **The research line uses the genre-scout floor rule.** DEMAND-RESEARCHER's Etsy briefs record the full range honestly and
   pass when 3 or more cited current prices are at or above USD 3.50 (the product's BRIEF FLOOR). Tests to match.
2. **Ranges** count toward the 3 only if their low end is at or above USD 3.50: approved as read.
3. **Hidden-row false positives** (a non-listing figure under the floor in a search result, such as a shipping fee, read as a
   result the brief must record): parked with scout tuning until the Etsy Open API is in. An E6 open item; no change now.
4. **Scout tuning is paused** until the Etsy Open API key arrives (the owner is applying). Scout run 7 recorded; checklist
   row 21 "blocked on data: Etsy Open API".
5. **Step c proceeds on an owner brief** instead of a scout brief. Owner briefs go through intake with evidence level
   "owner" (no demand evidence claimed), shown on the approval card as "Evidence: OWNER BRIEF — no market evidence". Every
   originality, IP, blocklist and format check still applies in full. The first owner brief: Cozy Autumn Desk Props
   (`2026-10-17--cozy-autumn-desk-props`, product pngtuber-prop-pack); LISTER proposes a price between USD 3.50 and USD 9.00
   with its reason, and the owner sets the final price at approval; AI use disclosed as on DESK-PROPS-01.

### As built
- **Research floor** (`lib/brief-check.mjs`, ported file, change line in its header): without an owner price line,
  `floorRowsResearch` counts the top-5 rows whose current price in USD (a EUR row at fx.usdToEur, to the cent; another
  currency not counted) is at or above the floor; `MIN_FLOOR_ROWS` 3 (one constant for both lines, re-exported by
  `scout-brief.mjs`). The Price range must be the rows' full range (within a cent), so a cheap row cannot be left out. The
  owner price line still replaces the rule (DESK-PROPS-01 unchanged, parity unchanged). Prompts: `skills/price-rules-brief.md`
  (BRIEF FLOOR, DEMAND RESEARCHER, EVIDENCE CHECKER bullets), `skills/price-floor.md` line 7, `agents/demand-researcher.md`
  PRICE, EVIDENCE-CHECKER's genre paragraph shortened to "Floor: the BRIEF FLOOR rule (cheaper rows stay)" (13,991 chars),
  `skills/scout-brief-format.md` (the floor named as BRIEF PRICE RULES' for both lines).
- **Owner brief** (`lib/owner-brief.mjs`, new): front matter `status: owner`, `origin: owner` (never "verified": the
  Evidence Checker has not seen it, and a line routine, which takes verified briefs only, never starts one); headings
  `# Niche`, `## Demand evidence`, `## Design direction`, `## Price range`; Demand evidence `evidence level: owner` with no URL,
  price, table, Etsy evidence field or owner-recorded marker; `owner bounds: USD <min>–<max> (owner brief, YYYY-MM-DD)` with
  the minimum at or above the floor; no UNKNOWN/TBD/TODO. Checked: the schema, a digital product, the originality screen of
  the WHOLE brief in every category (as the prep step screens brief.md), the image policy, the bounds; then the scouting
  blocklist screen like every brief (`checkBriefAll`). The listing blocklist and every downstream gate apply as always.
- **Intake** accepts an owner brief with status `owner` (other briefs still need `verified`); its intake stage says
  "owner brief checked (evidence level owner: no market evidence) ...".
- **Saving**: `orchestrator.saveOwnerBrief` / `npm run owner-brief -- --file <brief.md> [--check]` writes
  `research/briefs/<id>.md` only when the brief passes the intake checks; once (other text under the same id, or a job with
  that id, is refused); the same text again changes nothing.
- **Approval card**: `ui/evidence.js` level "owner" -> "Evidence: OWNER BRIEF — no market evidence" (own style).
- **Price** (`digital-prices.mjs` and `digital-gate.mjs`, ported files, change lines in their headers): for an owner brief
  without an owner price line, LISTER writes `priceProposal: { usd, reason }` in listing.json (one paragraph in
  `skills/price-rules-lister.md`; LISTER 11,703 of 12,000 chars). The price fill lists every variant at it (USD x
  fx.usdToEur, rounded UP to the cent like the owner floor, so a proposal at USD 3.50 lists at EUR 3.13, never below);
  priceSuggestion is the bounds in EUR with LISTER's reason in its source line. A missing or out-of-bounds proposal fails
  the fill (nothing written) and the gate re-checks the same. The owner still sets the final price at approval ("confirm
  price" stays on the to-do list). Other briefs are priced as before.
- **Not changed (flagged):** `products.json` for pngtuber-prop-pack still describes DESK-PROPS-01: files 11 and 12 are
  "colour variant" purposes and the styleReference note names "the steaming mug". The engine does not pass either to an
  agent (checked: no code reads them), and the owner brief lists 12 distinct props with the pumpkin as file 1. The owner brief
  has no Keywords section (none were given); LISTER's prompt says to use the brief's keywords, so it writes tags from the
  title idea and the props, and QA-LISTING checks them.

## E6 step c: product spec defines format, brief defines files (owner decision, 18/10/2026)

During step c's line run on the owner brief `2026-10-17--cozy-autumn-desk-props`, QA-DESIGN pass 1 sent set-v2 back, chiefly
because `products.json` listed files 11–12 as colour variants of props 1–10 while the brief lists a ghost plush and a desk
lamp. The owner pressed the e-stop (pass 2 halted) and decided:

- **For pngtuber-prop-pack, products.json defines the format only**: 12 transparent PNGs, sizes, naming, alpha, packaging.
  **The file list and the subjects come from the brief.** The "files 11–12 are colour variants" rule is removed from
  products.json and from every QA-DESIGN check or prompt that enforced it; QA-DESIGN grades file subjects against the brief.
- Test: a brief with 12 distinct props passes the spec check; a set that does not match its brief's list fails.
- Next (not done; no further live spend before the owner's go): re-run QA-DESIGN on the existing set-v2 images under the
  corrected spec, then redraw only the files QA still fails for reasons other than the spec.

Recorded with it: **the owner's file-1 approval** (18/10/2026) of `set-v1/raw/01-small-pumpkin.png`, "reviewed on white and
dark: edges clean, no fringe, style accepted as reference" (the style-ref decision itself was recorded without the reason
text: a reason with spaces does not survive PowerShell 5.1's argument passing; see PROGRESS.md).

### As built
- `config/products.json` (pngtuber-prop-pack): every file's purpose is now "file N of 12: a transparent prop; its subject is
  the brief's item N" (file 1: the style reference); no colour variant anywhere. The `$schema` line for `deliverables.files`
  says the spec is the format only. The styleReference note names file 1 as the brief's item 1 (the steaming mug was
  DESK-PROPS-01's).
- `lib/brief-files.mjs` (new): `briefFileList` reads the brief's first numbered list in Design direction;
  `briefFileProblems` checks, when that list has exactly as many items as the spec has files, that every item N has a set file
  `NN-<subject>.png` whose subject shares a word with item N (singular and plural match). A brief without such a list is not
  checked by the station (DESK-PROPS-01's lists 10 props and 2 variants in prose: not checked, parity unchanged).
- `orchestrator.mjs`: the check runs at prep (fail closed: a mismatch is a prep failure, back to DESIGNER once) and before a
  QA-only run (refused on a mismatch). set-v2 of the job passes it (all 12 files match).
- Prompts: DESIGNER step 3 (the spec's list is the exact format; subjects from the brief's file list); QA-DESIGN step 2,
  `complete` (every file the brief lists, by subject) and `matchesSpec` (the spec's format: count, format, pixel size; never
  subjects). QA-DESIGN 11,995 of 12,000 chars.

## E6 step c: redraw-only mode, cleanup pass, mock guard (owner decisions, 18/10/2026)

1. **Mock guard.** Refuse any mock run mode (the owner script's qa-only included) on a job that has live spend. Tested.
2. **No live QA-only re-run of set-v2.** QA DESIGN's pass-1 findings stand; the spec finding is covered by the station's
   deterministic brief-match check (`lib/brief-files.mjs`), which set-v2 passes.
3. **Redraw-only mode**: a new set from set-v2's passing files plus the approved file 1; DESIGNER draws only the named files,
   with file 1 as the reference. Before any redraw, files 02, 04 and 09 get a stricter deterministic clean-up at $0 (disconnected
   regions whose alpha or luminance marks them as faint smudges, specks or fragments outside the main part are removed), with the
   pixels removed per file reported and new review images; a file that still shows its QA finding afterwards joins the redraw
   list. 07 (the flame), 08 (clearly cream ceramic or clear glass with a readable shape, not a grey-white slab) and 10 (no soft
   shadow under the base) are redrawn, each with QA's finding passed to DESIGNER as the brief for that file.
4. **Then one QA-DESIGN pass on the complete new set: design loop 2.** Approved: packaging, LISTER and QA-LISTING as briefed.
   Revise: the Rejects Desk as designed; no loop is added.

### As built
- **Guard** (`orchestrator.mjs` `mockOnLive` / `mockGuard`): on the mock provider, a job with any ledger row from another
  provider is refused for qa-only, listing-only, redraw-only and restart (`MOCK_ON_LIVE`); `runSteps` also stops any other
  start (a server resume, a routine) before its first agent step, with no call made. The package step runs no agent and is
  not refused.
- **Strict clean-up** (`lib/strict-cleanup.mjs`): pixels under alpha 12 (the build's own floor) cleared; 8-connected parts;
  the part with the most solid pixels (alpha >= 200) is kept; any other part is removed when its mean alpha is under 115
  ("faint"), it has fewer than 150 solid pixels ("small"), or it is near-white (mean luminance >= 235) with under 10% of the
  main part's solid pixels ("pale"). A glow or smudge attached to the drawing is never touched. Records per file: pixels
  floored and removed, the regions removed with their reason and box.
- **Redraw-only** (`orchestrator.mjs`): `prepareRedraw` ($0, no model, allowed under the e-stop; `npm run owner --
  prepare-redraw <job> '<plan>'`) writes the new set: file 1 (the approved bytes), the reused files byte for byte, the
  cleaned files with `cleanup.json` and before/after review images, `design.md` copied, `redraw.json` (the plan with each
  file's brief item and QA finding). The same plan again changes nothing; another plan moves the undrawn set to
  `redraw-replaced-<stamp>/` (never deleted). `redrawOnly` (`npm run line:live -- --redraw <job>`, live only) is the next
  design loop: one DESIGNER run draws only the named files (the image tool refuses every other number), then prep (no retry
  to DESIGNER from prep on a redraw set: it blocks), QA DESIGN (told which files are reused, cleaned and redrawn) and the line
  on. A revise past the loop limit goes to the Rejects Desk; a loop is never added.

### Applied to `2026-10-17--cozy-autumn-desk-props` (18/10/2026, $0, e-stop on)
- Strict clean-up of set-v2's 02, 04 and 09: 02 removed 34 px (18 regions), 04 1,354 px (373 regions), 09 507 px (109
  regions). Checked on the review images (before/after, on white and dark): **all three still show their QA finding** (02:
  a soft fringe under the bottom book's lower-left edge, attached to the drawing; 04: the speckled glow either side of the
  flame, thinner; 09: the smudge under the left acorn, fainter; the speck by the leaf stem is gone), so they joined the
  redraw list. The cleaned set is kept in `redraw-replaced-20261018T144502Z/set-v4/` with its review images.
- **Prepared set-v4**: 01 (approved file 1), 03, 05, 06, 11, 12 from set-v2 byte for byte; to draw: 02, 04, 07, 08, 09, 10.
  Not run: it waits for the owner's "go redraw" (e-stop off, then the live redraw).

## E6 step c: owner amendment to brief item 4 (18/10/2026)

Owner brief `2026-10-17--cozy-autumn-desk-props`, item 4, amended by the owner during the redraw-only run (design loop 2):
"beeswax candle with a lit flame; the warmth is painted into the flame and wax, with no glow, halo or light around it". It
supersedes "with a soft glow" (which conflicted with the owner's direction for every redrawn file: no glow, halo, bloom,
sparkle or light rays around flames or lamps).

### How it was applied
- **The brief itself.** QA DESIGN reads `work/<id>/brief.md` from disk at the start of its own run (its orders, step 2); the
  station's QA input does not carry the brief. The amendment was written while DESIGNER's redraw run was still drawing,
  before QA DESIGN started, into the job's `jobs/<id>/brief.md` (through the data jail), so QA DESIGN grades file 04 against
  the amended wording. The same text went into the owner brief record `research/briefs/<id>.md` and its repo copy
  `fixtures/engine/owner-brief.md`; all three are identical. Item 4 is replaced in the numbered list and an "Owner
  amendment (18/10/2026)" line follows the list.
- The running process was not interrupted or restarted. DESIGNER's run had started with the original wording in its input,
  alongside the owner's direction for every redrawn file (no glow around flames), which already says the same.
- Checked after the change: the owner brief check passes (format, originality of the whole brief, scouting screen, bounds),
  and the station's brief-match check still matches all 12 file subjects.

## E6 step c: design.md from the current spec and brief (bug fix, 18/10/2026)

**The bug.** QA DESIGN's pass 2 on set-v4 of `2026-10-17--cozy-autumn-desk-props` said "products.json lists files 11-12 as colour
variants". products.json had not said so since `7509770`; the engine gave QA DESIGN the current file. The text came from
set-v4/design.md line 6, a note DESIGNER wrote in set-v1 while products.json still described DESK-PROPS-01. DESIGNER carried it
into set-v2's design.md (it read set-v1's to copy file 1's prompt), and `prepareRedraw` copied set-v2's design.md into set-v4
verbatim; DESIGNER kept the line when it rewrote the file. QA DESIGN read the note as the spec.

**The fix** (owner: "make design.md come from the current spec and brief at job start"), `lib/design-plan.mjs`:
- `stationPlan`: a "## Station plan" section written by the station from the CURRENT products.json (the format: count, format,
  size, transparency, packaging) and brief.md (each file's subject: its numbered list when it numbers the spec's files).
- At the start of every DESIGNER run (first file, rest of set, redraw, any designer pass) the plan is in DESIGNER's input, with
  the rule to start design.md with it word for word and carry no notes from an earlier set's design.md, only each file's own
  prompt and analysis.
- At prep, before the set is measured and screened, the station writes the current plan into design.md (`withStationPlan`:
  replaced, or inserted under the title; idempotent), so the plan in design.md is never older than the spec and brief the set
  is measured against.
- `prepareRedraw` no longer copies the earlier design.md: the new one is the station plan plus only the kept and cleaned files'
  own "### NN-..." sections (`keptSections`); the earlier set's notes are never carried.
- Tests: `tests/e6-c-designmd.test.mjs` (3), and `e6-c-redraw` now starts from a set-v2 design.md carrying the stale note and
  checks it never reaches the new set, and that prep restores the plan after DESIGNER rewrites the file.

Not changed: set-v4/design.md of the rejected job still holds the old note (job data, not rewritten); a later prep of that set
writes the station plan into it, and the stale note line stays in DESIGNER's text unless the owner removes it.

## E6 step c: owner fix tools, post-fix approval rule (owner decisions, 18/10/2026)

For the rejected job `2026-10-17--cozy-autumn-desk-props` (QA DESIGN pass 2 revise on set-v4):

1. **File 10, region A** (546 px; the build's "enclosed background-like region", also near-white fill D; it is a painted
   highlight on the lid, not the handle opening): fill with the surrounding lid cream, sampled from the lid next to it, not
   transparent. **Amended the same day (before any fix was applied):** recolour A to the *lightest* lid cream that passes the
   near-white rule (sample the lid around it, then lighten to just under the rule's threshold) so a soft highlight stays; not
   flat lid cream, not transparent. The region edit gets an optional lighten/darken of the sampled colour for this.
2. **File 10, steam B and C** (11,876 and 6,292 px near-white fills): recolour to the steam colour of this set's cider mug file
   (sampled from that file), so it passes the palette rule and stays visible on white and dark; shape and alpha unchanged.
3. **New rule (post-fix):** after a $0 deterministic owner fix that only addresses build-check findings, the owner may approve
   the set without another QA DESIGN pass, if (a) originality passed on the previous QA pass, (b) the rebuilt set has no build
   warnings and no limit problems, (c) all 12 files still match the brief, and (d) the owner has reviewed the after previews.
   Originality and build warnings can still never be overridden. Tests for each condition.
4. **File 12: keep** (owner reviewed it on white and dark at 100%; no glow outside the shade).
5. **The owner script takes its JSON from a file** (`--from <path>`) as well as inline; files from now on.

### As built
- **Region edit** (`lib/region-edit.mjs`; `prop-edit.mjs` op `region`, through `npm run owner -- edit-set`): a region is
  selected exactly as the build check finds it (`enclosed` or `near-white`, by its box, on the Designer's original); actions
  `fill` (the sampled colour, with a feather of lighter neighbours), `recolour` (each pixel = sample + its own luminance offset
  from the region's mean: shading, shape and alpha kept; `spread` adds the connected light, low-colour soft edge, on by
  default, off for a region inside a light fill) and `clear`. Samples: `{ around: true, ringPx }` (median of the opaque ring
  around the region) or `{ file, box }` (median of opaque pixels in a box of another raw file, its sha256 recorded); `adjust`:
  `{ lighten: f }`, `{ darken: f }` or `{ lighten: "max-under-near-white" }` (the lightest blend towards white whose channel
  spread stays above the rule's maxChroma 24; e.g. lid 214,150,96 -> 246,233,221, blend 0.789). Every region must quote a
  build warning of its file (`addresses`); edit-set refuses one that is not in the set's manifest and records the full warning
  (`addressesWarning`). The Designer's original stays in `raw-original/`.
- **Rebuild and check** (`npm run owner -- rebuild <job> --from <file>`, orchestrator `rebuildSet`): $0, no model, no job
  state change: the build (pinned upscaler), the station plan into design.md, the measurement and originality screen, the
  brief match, and the owner's after previews of every fixed file in `set-vN/review-after/` (on white and dark, a crop per
  region on each, `<file>.preview.json` tied to the built bytes).
- **Post-fix rule** (`owner-approval.mjs` `postFixProblems`; set approval with `"rule": "post-fix"` and `reviewedPreviews`):
  passes on disk may be under the limit; edits.json must hold region fixes of build-check findings only; (a) the last QA DESIGN
  record's `checks.originality` is "pass"; (b) every fixed file was rebuilt from its edited bytes (build.json input sha256),
  and the usual checks (no build warnings, no limit problems, originality clear) still apply; (c) the brief-match check applies
  and passes; (d) every fixed file's preview record is listed as reviewed, is for the current built bytes, and its images are
  unchanged. The package gate re-composes the approval from disk, so the rule holds there too.
- **Live run modes** (`scripts/line-live.mjs`): `--listing-only <job> --max-usd <USD>` and `--qa-only <job> --set <N> --max-usd
  <USD>`, live only, within the owner's cap.
- Tests: `tests/e6-c-fixtools.test.mjs` (6: the region ops, the lighten/darken, rebuild and edit-set, the rule passing and the
  gate accepting it, each condition refusing on its own, --from and the live-mode arguments).

## E6 step c: correction to the owner's set-approval wording (owner, 18/10/2026)

The owner's internal worthThePrice line on the set approval of `2026-10-17--cozy-autumn-desk-props` said "12 cohesive cozy
autumn props in one hand-painted style"; the owner corrected it to "**painted-look style**" ("hand-painted" is on the listing
blocklist, and the listing never claims hand-painted work; the line is internal and was never in the listing). Applied as a new
set-approval entry in the append-only decision log (`owner-decisions.jsonl` keeps both), from which `owner-review.json` and
`owner-set-approval.json` are re-derived; the design sign-off still checks valid. The package's MANIFEST.json, written before the
correction, keeps the earlier wording until the next package step (internal, not a buyer file).

## E6 wrap-up: frozen inputs, file-1 QA gate, allow-list, prompt trim (owner decisions, 18/10/2026)

The first full live line (E6 step c, USD 3.826728, in the approval queue) showed the fixes below. The owner's decisions, built on
the mock provider only ($0, no live call), with tests (`tests/e6-wrapup.test.mjs`, 8):

1. **Allow-list: "apple cider"** is owner-approved as an exact phrase (`station.config.json` `sloganScreen.phraseAllow`:
   `"apple": ["apple cider"]`). The listed brand "apple" does not hit where it stands inside "apple cider" word for word, after case
   and punctuation ("Apple-Cider" too). Everything else still hits: "apple" alone, "apple pie", "apple juice", "apple ciders",
   "apples cider", and "apple cider beside an apple" (the second "apple"). Note for the owner: the screen also reads digit and symbol
   swaps, so "4pple cider" reads as "apple cider" and is clear like it; say if that should hit.
2. **Frozen job inputs** (`lib/job-inputs.mjs`). At intake the station writes `jobs/<id>/inputs/brief.md`, `inputs/products.json`
   (the job's own product entry) and then `inputs/SNAPSHOT.json` (both sha256). From then on:
   - the data jail refuses every write into `inputs/` (code FROZEN): put, append, copy, remove, a direct `dataJail(` write, and
     moving a file out. Only the whole folder may be moved away (archiving an ended job);
   - agents read only the snapshot: `fs_read` of `brief.md` and `products.json` is served from `inputs/`, and the orchestrator's own
     reads of the job's brief and spec (the designer input, the station plan, prep, the build, the price fill, the package gate,
     QA-only, rebuild) use it;
   - before every step of a line job the snapshot is checked against SNAPSHOT.json, and the top-level `brief.md` (read by the ported
     gates) must equal the frozen brief. An edit made around the station blocks the job ("frozen inputs: ...") before anything
     is called;
   - a line job created before this change is frozen at its first run, from its brief.md as it stands then (recorded in
     SNAPSHOT.json `note`). `2026-10-17--cozy-autumn-desk-props` has no snapshot yet; it is in the approval queue, so none is taken
     unless it runs again.
   - **Owner amendments** are separate dated records: `npm run owner -- amend <id> --from <file.json>` with
     `{"text": "...", "date": "YYYY-MM-DD"}` writes `jobs/<id>/amendments/NNN-<date>.md` (numbered, created once, never overwritten;
     the job must not be running) and an entry in `owner-decisions.jsonl`. Every line agent (DESIGNER, QA DESIGN including the
     file-1 check, the redraw run, LISTER, QA LISTING, REJECTS-DESK) gets each amendment in full in its input, after the snapshot,
     with the rule that an amendment overrules the snapshot on the point it names. Every QA record (design passes, file-1 passes,
     listing passes and the outbox copies) carries `inputs: { snapshot: { brief, products, frozenAt }, amendments: [{ file, date,
     sha256 }] }`.
3. **File-1 gate.** For routine jobs a QA DESIGN pass on file 1 is file 1's approval: the station records it in `style-ref.json`
   (`decidedBy: "qa-design"`, `qaPass`) and the rest of the set is drawn in the same DESIGNER step, with no pause. `"ownerFile1":
   true` keeps the owner's manual pause; it is set by the brief's front matter (`ownerFile1: true`, owner brief or research brief) or
   by a shipped routine (`config/routines.json` `ownerFile1`). The default is no pause. The package gate (`styleRefProblems` via
   `approvedRef`) accepts either an owner approval or a QA DESIGN file-1 approval, the latter only while
   `qa/file1-pass<k>.json` on disk is an approval of the same set and the same bytes. The owner may still decide on top of a QA
   approval (approve or reject); the latest decision counts. The two older style-reference tests now set `ownerFile1` (they test
   the owner's pause).
4. **DESIGNER prompt.** Step 2 no longer tells it to write the brief to `work/<id>/brief.md` (that order was the reason it tried).
   It now says the station froze the brief and spec, to read them and any amendments, and never to copy, rewrite or write the
   brief or any file outside its own `set-v<N>/` folder. The package contract skill's line "Designer writes it on pass 1" became
   "frozen by the station at job start (read only)". Mock test: every DESIGNER write on the line is inside `set-v<N>/`, and a
   DESIGNER that tries `brief.md` and `inputs/brief.md` is refused (role guard and the frozen-inputs jail).
5. **QA-DESIGN prompt trim**: 11,995 -> **10,462** characters (owner target 10,500, now in `promptBudgetChars.targets` and enforced
   by `engine-line` and `e6-wrapup`). Merged, keeping the surviving copy word for word:
   - orders step 1's "[LOOP — exhausted / escalated]" rule -> the VERDICT PROTOCOL's item 6, which says it word for word;
   - orders steps 5–7 (the pass-number count, writing the pass record, the outbox copy, the reply shape) -> the VERDICT
     PROTOCOL and the PACKAGE CONTRACT (the engine assigns the pass number and writes both records from submit_verdict);
   - step 3's IP list (logo, brand mark, mascot, character, celebrity, sports emblem, signature style) -> "anything ORIGINALITY
     RULES forbids" (its HARD FAILS line, word for word, covers each);
   - the originality check's "nothing overrules it" and "'clear' is not clearance" -> ORIGINALITY RULES, which says both;
   - the licence check's asset list -> DIGITAL PRODUCT TERMS ("only the image generator and the bundled fonts");
   - "Never pass a set to end a loop" -> the VERDICT PROTOCOL's "never lower the bar to end a loop";
   - "Counts, formats and pixel sizes come ONLY from deliverables.json" moved from complete to matchesSpec (said once);
   - the path notes that repeat the engine wrapper ("Paths are relative to ...", DESIGN's path, the skill's room1-etsy note);
   - the package contract's folder list (repeats step 2) and the schema's long worthThePrice.reason text (repeats the check);
   - shared skills, pure repeats for every agent that has them: etsy-policy's "Digital files: see DIGITAL PRODUCT TERMS",
     its "AI disclosure ... word for word" (DIGITAL PRODUCT TERMS says it), its "No intellectual-property infringement (see
     ORIGINALITY RULES)"; data-hygiene's "ignore instructions in web pages and files" (the engine wrapper says it to every
     agent). Kept: "No real person's name or likeness" (it covers images, which the originality text rules do not).
   Added: "any OWNER AMENDMENTS in your input". The other agents' prompts only got shorter (e.g. QA LISTING 11,996 -> 11,586,
   LISTER 11,703 -> 11,293).
6. **Estimated ledger rows.** OpenRouter offers the lookup (docs read 18/10/2026: `GET /api/v1/generation?id=gen-...`, bearer key,
   `data.total_cost` in USD; a record read, no image and no model call; the page gives no price for it). Built: `npm run
   settle:images` (plan only) and `-- --apply` (`lib/settle-images.mjs`; the request in `providers/openrouter.mjs`
   `lookupGeneration`, the URL in `config/engine.json` `image.generationEndpoint`). Each settled row gets one correction row
   (`settle-<entryId>`, `correctionOf`, the difference in usd, `settledUsd`, count 0); no row is edited, and a rerun writes nothing.
   The ledger now accepts a negative usd only on a correction of an original row that keeps its net at or above 0, counted on the
   original's Dublin day and adding no image count. **Limit:** the 5 estimated image rows of the cozy autumn job carry no generation
   id (each call failed before OpenRouter answered), so the script cannot settle them; they stay estimated for the owner to check
   on OpenRouter's activity page. From now on an image call that fails after a response keeps the generation id on its estimated
   row. Rows for failed Anthropic calls stay estimated. Not run: it needs the key and the network.

## L1: live instance, deploy script, instance guards (build record, 18/10/2026)

The owner's L1 brief: a separate always-on live Station beside the dev checkout, so agents can work on the real data while
Claude Code keeps building. Built and tested on the mock provider only ($0, no live call, no `.env` read or written; nothing
written to Virtual-workers). The owner makes the first live start. Tests: `tests/l1-instance.test.mjs` (11),
`tests/l1-deploy.test.mjs` (5).

1. **Two checkouts.** Live is a git worktree, `..\office-agents-live`, on branch `live` (created at `51273e9`); dev stays
   `office-agents` on `main`. Dependencies by `npm ci` (sharp loads; npm's allow-scripts warning about sharp's install check is
   harmless, its prebuilt binary is in place). The git-ignored `tools/realesrgan/` (4 files) was copied by hand; all four sha256s
   match `config/engine.json` `upscale`. Nothing else git-ignored is needed by the live server (`fixtures/station-root` is for the
   legacy view and the tests, `.cache/` was empty).
2. **Data move.** With no Station process running and the engine lock free: the store's WAL checkpointed with the engine's own
   store code (`PRAGMA wal_checkpoint(TRUNCATE)`, lock held; the `-wal` was 0 bytes before and gone after; the `-wal`/`-shm` pair
   had been created by a read-only count, and no database file was deleted), the counts re-checked, then `data/` copied to
   `..\office-agents-data-backup-L1` (3,211 files, 2,022,195,217 bytes, 1,182 folders, 0 sha256 mismatches) and moved into the
   live checkout. Verified there with the live checkout's store code: 247 ledger rows (USD 4.443632; mirror 247), 30 jobs (same
   states), the approval queue's one item (`2026-10-17--cozy-autumn-desk-props`, pending), 3 routines, all disabled.
3. **Instance identity** (`src/engine/instance.mjs`, pure). `STATION_INSTANCE` live | dev; **unset is dev**, so a forgotten
   setting never goes live. `STATION_DATA_ROOT` default `./data`, now resolved against the checkout (the jail did it against the
   working directory). Guards:
   - dev refuses `STATION_PROVIDER=live`, port 8790, a data root overlapping the live checkout (`STATION_LIVE_ROOT`, default the
     sibling `office-agents-live`) and a data root inside an `office-agents-data-backup-*` folder;
   - live refuses: no git state (it must start through `npm start`), a checkout other than the live one, a branch other than
     `live`, uncommitted changes to tracked files (untracked and ignored files do not count), an unreadable commit, a port other
     than 8790, a data root outside its own checkout. It logs the commit (log line "station instance", the console line, the
     health route, the badge's tooltip);
   - each data root is stamped `INSTANCE.json` (instance, first start, checkout, commit) on its first start, with the lock held;
     the other instance refuses a stamped root. Together with the fixed ports, the two can never share a data root or a port;
   - the live providers (`providers/anthropic.mjs`, `providers/openrouter.mjs`) build only with `STATION_INSTANCE=live` (code
     `NOT_LIVE_INSTANCE`), so no script in the dev checkout can make a live call. The stubbed live tests now set it.
   - **Choice for the owner to review:** the git checks run in `scripts/start.mjs` (now `npm start`) and `scripts/git-state.mjs`,
     not in `src/`, because the write guard allows no child process in `src/` outside the pinned upscaler (owner decision
     17/10/2026). Running `node src/server/index.mjs` directly starts the dev instance only.
4. **Top bar and ledger.** A badge, **LIVE · real data** (red) or **DEV · scratch data** (green), with the commit in its tooltip;
   the memory-core ledger panel says "DEV ledger · scratch data, not the station's spend" on dev. Health adds `instance`, `commit`
   and `jobsRunning`; the snapshot adds `instance`. Engines not started by `npm start` (demo, dry runs) show no badge.
5. **Dev scratch data.** The dev data root starts empty: the first start makes a fresh store (the seeded routine, disabled, and
   nothing else). Demo mode is the scripted alternative (`start-dev.ps1 -Demo`). No live data is copied to dev.
   - **Parity** read the imported legacy job from `data/legacy/` of its own checkout; dev now has none, so it reads it read-only
     from the live checkout's `data/legacy/` (`STATION_PARITY_DATA` overrides). Its replay copy is still written under
     `dry-run/parity/` as before. Flagged: this is dev reading live's folder (read only); the owner may prefer another source.
6. **Deploy** (`scripts/deploy-live.mjs`, `npm run deploy:live`, run from dev):
   - "tested on dev" = a row in `logs/test-passes.jsonl` for the exact commit, written by `npm run test:record`
     (`scripts/record-tests.mjs`: refuses a dirty tree, runs `node --test`, records pass/fail counts and whether the tree stayed
     clean). Deploy needs exit 0, fail 0, cancelled 0, pass > 0 and clean. (The script is not named `test-*.mjs`: `node --test`
     would run it as a test file.)
   - busy = the live health route reports a job running or a call in flight, or the live engine lock is held by a running process
     that does not answer. Refused unless `--force`, and `--force` is refused unless the live e-stop is on;
   - stop = a `SHUTDOWN` file in the live data root, which the server (from L1 on) polls every second and then stops cleanly; if
     it has not stopped within 30 s the deploy fails and removes the request (a pre-L1 server must be stopped by hand);
   - move = `git checkout -B live <commit>` in the live worktree (refused if it has uncommitted tracked changes); `npm ci` only if
     `package-lock.json` differs between the two commits; start = `scripts/start-live.ps1` in its own window, with no `STATION_*`
     or key variable from the deploying shell; health = instance live and the target commit within 60 s;
   - every attempt past the refusals appends a row to `<live data>/deploys.jsonl` (at, action, from, to, by, forced, npmCi,
     stopped, started, health, ok, and the error if any); `by` is `--by` or the Windows user name;
   - `--rollback` goes to the `from` of the last successful deploy to the current live commit (so repeated rollbacks step back
     through the deploys) and needs no test record (its target already ran live). `--plan` shows the steps and changes nothing.
7. **Start scripts.** `scripts/start-live.ps1` (live, 8790, `<live>\data`) and `scripts/start-dev.ps1` (dev, 8792, `<dev>\data`,
   mock; `-Demo` for demo mode). Both clear the shell's `STATION_*`, `ANTHROPIC_*`, `OPENROUTER_*`, `OPENAI_*` variables for the
   server, run in the foreground, and restore the shell's environment on exit. Templates: `.env.live.example` (key names only;
   `STATION_INSTANCE=live`, `STATION_PROVIDER=live`, `STATION_PORT=8790`) and `.env.example` for dev (`STATION_INSTANCE=dev`,
   `STATION_PROVIDER=mock`, `STATION_PORT=8792`).
8. **Routines** stay disabled on live (all 3 verified disabled after the move); the owner enables them in the page. The e-stop is
   unchanged and per data root: the page's button, or `npm run estop` in the live checkout (tested on a live-stamped root).

**Points for the owner:**
- **Port 8791 is in use** by a non-Station program (`pythonw.exe ...\jarvis-wake\wake_listener.py`). **Owner decision
  (18/10/2026): the dev default port is 8792** (`PORTS.dev` in `src/engine/instance.mjs`, `start-dev.ps1`, `.env.example`, the
  tests). **Owner decision (19/10/2026): the demo's default port is 8793** (`DEMO_PORT` in `scripts/demo.mjs`;
  `STATION_DEMO_PORT` overrides); the demo now also refuses the instance ports 8790 and 8792, as well as 8787.
- `.env.live.example` lists `ETSY_API_KEY` and `ETSY_SHARED_SECRET` (names only, empty) for E7 (owner, 19/10/2026).
- The live line scripts (`line:live`, `scout:live`, `smoke:live`) now run only in the live checkout, still with the
  per-process `$env:STATION_PROVIDER='live'`, and only while the live server is stopped (one engine per data root). Running
  lines on the always-on server from the page is the natural next step; not built.
- The dev `.env` probably still says `STATION_PORT=8790` (the old template's default): the dev instance now refuses that port
  until the owner sets 8792 (the start script sets it anyway).

## L2: drive the live line from the Station page (build record, 19/10/2026)

The owner's L2 brief: start and steer work from the always-on live server's page while it runs, instead of the line scripts with the
server stopped. Built and tested on the mock provider only ($0, no live call, no `.env` read or written; nothing written to
Virtual-workers). Everything runs in the server's own engine (one engine per data root). Caps, the e-stop, the originality and IP rules,
the approval queue and the owner-only decisions are unchanged. Tests: `tests/l2-steer.test.mjs` (10).

1. **Owner brief form** (`lib/owner-brief-form.mjs`, `POST /api/tasks/owner-brief`). The page composes an owner brief in the existing
   format (front matter `status: owner`, `origin: owner`, `product_type`, `audience_segment`, `ownerFile1: true` only when the owner picks
   the pause; Niche; Demand evidence "evidence level: owner" with no figure; Design direction with the title idea, the theme and the
   numbered items; `owner bounds: USD <min>–<max> (owner brief, <date>)`; the AI disclosure note). The form checks only its own fields:
   a product from products.json, exactly as many items as the spec has files, bounds at or above the product's floor. Then
   `orchestrator.saveOwnerBrief` applies the same intake checks as `npm run owner-brief` (format, originality of the whole brief in every
   category, scouting blocklist, image policy, bounds against the floor); a refusal saves nothing and the form reopens with the reasons.
   The id is the Dublin date plus a slug of the title. Saving spends nothing; **Start line** is the spending step.
2. **Research this** queues a research job through `orchestrator.startResearch` as before. The pane and the dialog say: "Demand evidence
   from research is indicative until the Etsy API (E7)".
3. **Spend confirmation** (`src/engine/spend.mjs`, `POST /api/spend/quote`). The quote shows the line, each agent's model and effort
   (from the effective tier), the image model, the job cap, the per-run cap, today's spend + the remaining cap of every open job (running,
   or queued to start by itself) + this action's headroom against the daily cap, the same for the line's day cap, the Anthropic Console's
   monthly limit and what is left of it when configured, the OpenRouter key limit, and whether the job starts now or waits as next. On
   the mock it says "mock: $0". A quote with no refusal carries a token: random, single use, bound to the action and its parameters, valid
   10 minutes (`runtime.confirmTtlMs`), kept in memory (a restart drops it; the page asks again).
4. **Server-side refusals** on every spending endpoint, in this order, with nothing written: the e-stop (423, `HALTED`); no token, a token
   for other parameters, a reused or expired token (428, `CONFIRM_REQUIRED`); the daily or line-day cap would be exceeded in the worst case
   (422, `DAY_CAP`). Spending endpoints: research, start line, resume (restart), re-run listing, QA-only, listing-only, and an agent put
   back on duty while jobs wait for it (with nothing waiting it spends nothing and needs no token; under the e-stop nothing wakes). The
   guard still checks every call exactly as before.
5. **Job limit** (`runtime.maxRunningJobs`: 1). Applies to an engine started by `npm start` (live and dev: `createEngine({ limitJobs: true
   })`), across every line; demo, dry runs and the line scripts keep the one-job-per-line rule only. A further start waits in `queued` as
   **next** (`data.next`, reason "next: waiting for <id> (at most 1 job running at a time)") and starts when a running job ends, oldest
   first. After an e-stop, next jobs stay queued (as before: nothing restarts by itself); Resume starts them.
6. **Steering from the job panel**: Resume (spend-confirmed); Amend brief (`POST /api/owner/amend` -> `owner.amendJob`, the frozen-inputs
   amendment record); file 1 Approve/Reject with the review images when the job waits for the owner (`/api/owner/style-ref`, then Resume);
   Approve set (`/api/owner/set-approval`, unchanged: it still needs the owner's decision on every file first); **Reject set** (new,
   `POST /api/owner/set-rejection` -> `owner.rejectSet`: appended to `owner-decisions.jsonl` as `set-rejection`, the job ends `rejected`
   with the owner's words, nothing deleted; refused on a job in the approval queue, where Reject applies); the approval queue's
   Approve/Reject as before. Region fixes stay CLI; the panel shows `npm run owner -- edit-set ...` and `rebuild ...` and that they need
   the server stopped.
7. **Live status**: per job, the stage, the agent at work, spend so far against the job cap and the last 5 engine events (from the bus's
   ring buffer), re-rendered on every event. The 3D office already follows the engine's runs, so agents sit at their desks while working
   and go to the lounge when idle on live as on the mock.
8. **Design card fix**: sets are counted from `set-vN/files/` whatever it holds (a packaged product keeps its zip there, so the autumn job
   counted 0); a packaged set's thumbnails come from `set-vN/build/` (new image route `.../set-vN/build/<file>` and `.../review/<file>`).
   The QA pass rate covers every QA DESIGN verdict on disk, set reviews and file-1 checks, of all line jobs, shown with its counts.
9. **Real-ESRGAN pill: the finding.** The status was **hard-coded** `offline` in `src/server/engine-model.mjs`, with the note "not wired in
   the engine yet" from before the port batch; the pill was red on every instance whatever the upscaler's state. On live (read-only): the
   binary, `vcomp140.dll` and both model files match their sha256s in `config/engine.json`, the Vulkan loader
   (`C:\Windows\System32\vulkan-1.dll`) is present, and the autumn job's set-v4 build record says method realesrgan on GPU 1, NVIDIA
   GeForce RTX 5060 Laptop GPU. **Fix**: `lib/upscaler-status.mjs` reports the pin check (sha256s, cached on the files' size and time),
   the Vulkan loader and how the GPU is picked; red only when one fails, with the reason in the tooltip ("why: ...").
10. **127.0.0.1 only** as before (tested on the source). No auth yet; remote access later with Tailscale.

**Points for the owner:**
- **Console monthly limit**: `config/engine.json` `outerLimits.anthropicConsoleMonthlyUsd` is `null` (not configured), so the dialog says
  "not configured". Set it to the Console's limit to see what is left; the figure is that limit less this Dublin month's Anthropic rows in
  the station ledger (other use of the workspace is not seen). `outerLimits` is information only, never a cap.
- **The day-cap test is the worst case**: today's spend plus the remaining cap of every open job plus this one. With USD 5.00 a job and
  USD 10.00 a day, two jobs can be committed at once on a fresh day; a third start is refused until spend settles. Say if you want the
  estimate from past runs instead.
- **Enabling a routine** has no spend confirmation (it starts nothing now; each firing is held to the routine's per-run cap, the daily
  caps and the e-stop, and enabling is your approval as before). Say if you want the dialog there too.
- **QA pass rate** now counts file-1 checks with set reviews; say if you want them shown apart.
- **Reject set** is new: it ends the job `rejected` with your words. Approve set is unchanged.

## L2.1: Console limit in config, confirm on arming routines (owner decisions, 19/10/2026)

1. **Console limit.** The station workspace's monthly limit in the Anthropic Console is now USD 100 (the org limit raised to match).
   `config/engine.json` `outerLimits.anthropicConsoleMonthlyUsd` is 100, so the spend dialog shows what is left this month: the limit
   less this Dublin month's Anthropic rows in the station ledger, labelled "estimate from the station ledger; the Console is the
   authority". It is information only, never a cap.
2. **Arming a routine** goes through the spend confirmation. The dialog shows the schedule (in words and as cron), the line, the
   agents' models, the per-run cap, the station's daily cap and today's spend, and the worst case per firing (the per-run cap, never
   above the line's job cap; the job cap when no per-run cap is set), per day (the schedule's firings that Dublin day, at most
   maxRunsPerDay) and per week (the next 7 days). Server-side, `POST /api/routines/enable` with `enabled: true` needs a confirm token
   (`routine-arm`, bound to the routine's id) like the other spending actions: refused without one or with another routine's (428) and
   under the e-stop (423). Arming spends nothing at that moment, so a schedule whose day could reach the daily cap is flagged in the
   dialog, not refused: the scheduler still skips firings once a cap is reached. **Disarming needs no token.** Tests:
   `tests/l2-steer.test.mjs` "arming a routine (L2.1)".
3. **The daily-cap check counting the worst case of open jobs** stays as built (L2 item 4).

## L2 fix: owner brief id from the title (bug on live, 19/10/2026)

**The bug.** Saving a New owner brief titled "Cozy Winter Desk Props for PNGTuber and VTuber Streams" was refused with "owner brief
format: id must be YYYY-MM-DD--<slug> (a-z, 0-9, hyphens)". An id is at most 60 characters in all (`lib/common.mjs` `isListingId`), but
the form's slug was allowed 60 characters on its own; with the 12-character date prefix this title made a 66-character id.

**The fix.** `src/web/ui/brief-id.js` (pure, used by the page and by `lib/owner-brief-form.mjs`, so both always agree): the id is
`<Dublin date>--<slug>`, the slug lowercase a-z 0-9 with single hyphens, accents dropped, at most 48 characters (60 less the date part),
cut at a word boundary, no hyphen at either end. The server makes the id itself (any id a page sends is ignored) and refuses an id that
is still not valid with its own message. The form shows the id read-only, updated as the title is typed; a refused save reopens the
form with every field as entered and the reasons above it. Test: `tests/l2-steer.test.mjs` "owner brief id from the title" with the
exact title through the form's save path. For this title the id is `<date>--cozy-winter-desk-props-for-pngtuber-and-vtuber`.


## E7a: own-shop Etsy connection; Etsy data out of the scout (owner decisions, 19/10/2026; built 19–20/10/2026)

### Etsy's terms and docs, as read (19/10/2026)

Sources: the Etsy **API Terms of Use**, https://www.etsy.com/legal/api, "Last updated on Aug 18, 2026". etsy.com refuses automated
fetches (HTTP 403), so the text was read from the Wayback Machine copy of 12/10/2026
(https://web.archive.org/web/20261012174138/https://www.etsy.com/legal/api). The developer docs at developers.etsy.com
(Introduction, Authentication, Request Standards, Rate Limits, Quick Start) and **Etsy's Dev MCP server**
(https://mcp.api.etsycloud.com/mcp: `learn_etsy_api`, `get_guide`, `get_endpoint` for getMe, getShop, getListingsByShop,
tokenScopes, ping). No Etsy API answer here is from memory.
- **Prohibited (Terms section 5):** "Use or promote the use of automated systems or browser extensions to access, analyze, or
  scrape the Etsy Site, the Etsy API or any Etsy data, including but not limited to Etsy listings, shops, or user profiles, unless
  expressly authorized in writing by Etsy" and "Use the Etsy API to collect, scan, or otherwise request Etsy content for purposes of
  analytics, machine learning, training artificial intelligence models, licensing, or content removal, unless expressly authorized
  in writing by Etsy". Also: request no more than the minimum data needed; no unauthorised copying of members' designs; no
  diverting sales. **This blocked the planned E7a** (an AI scout searching other sellers' listings for counts and prices); stopped
  and reported on 19/10/2026.
- **Seller App (docs, Introduction):** "for your own shop use only"; "You will only be allowed to authenticate your app with your
  shop"; "It cannot be used to access other sellers' private shop data"; commercial use "Not permitted".
- **Caching (Terms section 5, "Display of Data"):** listing content not shown more than 6 hours older than on Etsy; other Etsy
  content not more than 24 hours older; nothing cached or stored "longer than is reasonably necessary".
- **Rate limits (docs, Rate Limits; Terms section 2):** per API key, QPS then QPD (a sliding 24 hours); no default figures are
  published (each app's are in its Developer Portal); over the limit: HTTP 429 with `retry-after` in seconds; exponential backoff
  recommended. One key per application; no extra keys to get round the limit.
- **Required notice (Terms section 1, "Etsy's Trademarks"):** "The term 'Etsy' is a trademark of Etsy, Inc. This Application uses
  Etsy's API, but is not endorsed or certified by Etsy." (The docs' Introduction words it slightly differently; the Terms' text is
  used.)
- **Credentials and data:** keep API credentials secure (security@etsy.com for a suspected compromise); a breach of Etsy member data:
  tell dpo@etsy.com and the seller within 24 hours.
- **OAuth (docs, Authentication):** authorization code grant with **PKCE required** (S256; verifier 43–128 characters of
  `[A-Za-z0-9._~-]`); `state` recommended (single use); authorize at `https://www.etsy.com/oauth/connect`; token at
  `https://api.etsy.com/v3/public/oauth/token` (form-encoded; refresh with `grant_type=refresh_token`); access token 1 hour,
  refresh token 90 days; the token is prefixed with the numeric user id. **The redirect URI must be registered and match exactly, and
  "must have the https:// prefix"**; the Quick Start's example uses `http://localhost:3003` (a discrepancy in Etsy's own docs).
  Every v3 request carries `x-api-key: <keystring>:<shared secret>`. Scopes: `shops_r` (getMe), `listings_r` (getListingsByShop);
  getShop needs the key only.

### The owner's decisions (19/10/2026)

1. **No Etsy data in the scout until Etsy authorises it in writing** (the owner emailed developer@etsy.com on 19/10/2026
   requesting written authorisation; no reply yet). etsy.com in
   blocked_domains for web_search and web_fetch for every agent; the engine-side etsy.com refusal kept; TREND-SCOUT,
   DEMAND-RESEARCHER and EVIDENCE-CHECKER: demand evidence from non-Etsy sources (trend articles, editorial roundups, community
   discussion) and the owner's own shop results, "indicative". The floor rule: a brief with no Etsy prices cites price evidence from
   non-Etsy marketplaces or roundups, or is marked "owner sets price" when none exists. Tests to match; IP-rule lines word for word;
   prompts under their caps.
2. **E7a cut down to the own shop:** the Etsy client with OAuth 2.0 PKCE for the owner's shop only, read scopes only; the owner
   pastes the returned code into the Station page (no local https server); tokens encrypted at rest in the live data root
   (`ETSY_TOKEN_KEY`), refreshed automatically, never logged; a rate limiter honouring Retry-After with backoff; caching within the
   6 h / 24 h limits; the required notice in the Station footer; read only the owner's shop and its listings, to confirm the
   connection and list live listings with their ids. No public listing search tool.
3. **Seller App use only for own-shop management**; anything beyond waits for Etsy's written answer.

### As built

- **Sources (decision 1):** `config/engine.json` `webSources.blockedDomains` gains `etsy.com` (sent as `blocked_domains` on both
  web tools, refused by the engine before a fetch); `fetchRefusedDomains` keeps `etsy.com` (its refusal message now says "no Etsy
  data until Etsy authorises it in writing").
- **One indicative brief schema for both lines** (`lib/scout-brief.mjs`): origin `genre-scout` (scout-drafts/) or `research`
  (drafts/, no `## Genre trend evidence`). No etsy.com URL anywhere (refused on write, with the reason). A result row's price is as
  shown or `no price`. Price range `USD <low>–<high>` with 3 cited results, or `owner sets price — no cited result shows a price`
  (no figure; refused while any row shows a price). The floor rule is unchanged for priced rows (3+ cited current prices at or above
  the BRIEF FLOOR; a EUR row now counts at the station rate, as on the research line before). `own shop: ... (recorded by owner,
  YYYY-MM-DD)` lines are the owner's own shop results; agents never write them. The research line's drafts are validated on write
  like the scout's, EVIDENCE-CHECKER gets the SOURCES/PRICES RETURNED lists (`research.json` `returnedSources`), and brief-check
  appends the station's citation record; a draft in the ported Etsy demand-evidence format is refused on write, and a
  non-indicative verified draft is rejected at brief-check.
- **"Owner sets price":** the price fill treats such a brief as one without a brief price (floor + the no-brief uplift, with the
  "confirm price" to-do); the approval card says "Price: OWNER SETS PRICE". Brief-check notes it in the brief's station record.
- **Approval card:** the INDICATIVE banner now reads "demand from non-Etsy web search results only (...); competitor count not
  measured; no Etsy data."
- **Prompts:** TREND-SCOUT (orders and step 4), DEMAND-RESEARCHER (rewritten to the indicative format; skills: the brief-format
  skill replaces `demand-evidence` and `brief-format`), EVIDENCE-CHECKER (one procedure for both lines; `demand-evidence` skill
  dropped), skills `scout-brief-format` (both lines, no Etsy, `no price`, `owner sets price`, own shop lines), `price-rules-brief`
  (cited prices, OWNER SETS PRICE), `data-hygiene` (no Etsy data of any kind; the shop-column exception gone). Built sizes:
  TREND-SCOUT 14,930, DEMAND-RESEARCHER 15,764 (cap 16,000), EVIDENCE-CHECKER 11,599 (cap 14,000); every other agent within its
  budget (qa-design 10,440 of 10,500). The IP-rule lines are word for word (tested). `demand-researcher.json` role text updated.
- **The Etsy client (decision 2):** `src/engine/providers/etsy.mjs`. OAuth: authorization code + PKCE (S256), a random single-use
  `state` kept in this process for `connectTtlMs` (10 minutes); scopes `shops_r listings_r` only, checked with tokenScopes after the
  exchange (a token with any other scope is deleted at once). **Callback: paste.** The redirect URI is
  `https://localhost/station/etsy-callback` (config, or `ETSY_REDIRECT_URI` in .env); nothing listens there, so after "Allow" the
  browser shows an error page whose address carries `code` and `state`; the owner pastes that address into the Station's dialog.
  The token request is form-encoded without the API key header, per the Authentication guide's example. Tokens: AES-256-GCM, the key
  from `ETSY_TOKEN_KEY` by scrypt with a random salt per write, in `<data root>/etsy/token.enc.json`; refreshed a minute before
  expiry and once on a 401; a refused refresh asks for a reconnect (never a loop); Disconnect deletes the file. Every token, code and
  verifier is registered with the logger's redaction, and the logger also redacts Etsy-token-shaped text; the three Etsy key names
  join the redacted env list. **Rate limiter:** at most `perSecond` 2 and `perDay` 1,000 (set low because Etsy publishes no default;
  check your app's figures in the Developer Portal); a 429 holds every call for its Retry-After, then backoff `backoffMs` x
  2^attempt (at most `backoffMaxMs`), `retries` 3. **Cache:** in memory only; listings 60 minutes (`listingsTtlMs`, refused above
  6 hours), the shop 6 hours (`shopTtlMs`, refused above 24 hours); the page never shows listings older than their TTL. **Ledger:**
  one row per HTTP call, kind `etsy`, USD 0, provider `etsy` (live) or `etsy-mock`, the operation and HTTP status; never a token.
  The real client builds only with `STATION_INSTANCE=live` and the three keys; the dev Station runs the mock Etsy
  (`etsy-mock.mjs`: FIXTURE shop and listings, PKCE and state checked as Etsy does, injectable 429/5xx/401).
- **The Station page:** a top-bar **Etsy** button (live: "Connect Etsy" -> the link to Etsy's permission page -> paste the address
  -> the shop name, scopes granted, live listings with ids and prices; then "Refresh listings" or "Disconnect"); on dev it shows the
  mock and no Connect button. The Terms' notice is in the footer, word for word. Server: `GET /api/etsy` (status, never a token),
  `POST /api/etsy/connect/start|connect/finish|listings|disconnect` behind the usual same-origin, action-token, JSON and
  idempotency checks. Nothing from Etsy reaches an agent; there is no listing search.
- **Row 21** (the verified genre brief for step c): stays paused, now "no Etsy data until Etsy authorises it in writing; the scout
  can run on non-Etsy evidence (indicative)". Routines stay disarmed.

### Points for the owner

- **Register the redirect URI** in your Etsy app exactly as `https://localhost/station/etsy-callback` (or set `ETSY_REDIRECT_URI`
  to the one you register). If Etsy will not accept a localhost URL, register an https URL on a domain **you control** (the code
  goes to whatever address you register; never one you do not control) and set `ETSY_REDIRECT_URI` to it.
- **Unconfirmed until the first live connect:** that Etsy accepts the localhost redirect, and the form-encoded token request (the
  Quick Start sends JSON; the Authentication guide shows form fields). A failure shows Etsy's error in the dialog; nothing loops.
- **Owner-recorded Etsy figures** (the ported "recorded by owner" demand evidence, read by you in a browser) are still accepted at
  intake, and briefs verified before 19/10/2026 in the ported format still pass intake (the dry-run and demo fixtures, DESK-PROPS-01).
  Agents can no longer write that format. Say if decision 1 should refuse those too. **Answered 20/10/2026: refuse them (owner
  decision 4, below).**
- **Disconnect** deletes the Station's stored token. Removing the app's access on Etsy's side is not covered in the docs read here.
- **Own-shop data** in E7a is the shop and its listings only (no `transactions_r`, so no buyer data). The token file is in the live
  data root (not in git). Etsy's breach rule (dpo@etsy.com within 24 hours) is recorded above.
- **Changed tests outside E7a:** `l2-steer` "arming a routine" expected 5 weekday firings in the next 7 x 24 hours; on a Tuesday
  after 08:00 before the October clock change the count is 4 (the window ends at 08:xx the next Tuesday). The test now counts the
  expected firings with croner; the engine is unchanged. `write-guard`'s outbound-host list allows the mock Etsy's FIXTURE etsy.com
  URLs (it never fetches).
- **The demo's research brief** is now in the indicative research format (DEMO non-Etsy results); the demo plays as before.
- Still parked: the hidden-row false positives (scout tuning).

### Owner decision 4 (20/10/2026): legacy Etsy-format briefs are refused (E7a.1)

The answer to the open point above. **A job starts only from an indicative brief (origin `genre-scout` or `research`) or an owner
brief (origin `owner`).** Any other brief is refused when a job starts, at Start line and at research-to-design intake. That covers
briefs verified before 19/10/2026 in the ported Etsy format and briefs carrying Etsy figures the owner recorded from a browser
("recorded by owner"). The refusal reason, word for word: "legacy Etsy-format brief: no Etsy data in the station until Etsy
authorises it in writing (owner, 20/10/2026); restate it as an owner brief".

As built:
- `lib/scout-brief.mjs`: `isLegacyBrief` (neither indicative nor an owner brief, judged by the front matter's `origin`) and
  `LEGACY_BRIEF_REASON`. Intake (`orchestrator.createJob`, used by Start line, the line routine, `npm run line:live` and the demo)
  refuses such a brief with that one reason before any other check; no job row and nothing under `jobs/` is written. A job that
  already exists is untouched (the approval queue, published and archived jobs included); no brief file is moved, edited or deleted.
- **The Start line picker** (`ui/taskpanel.js` `briefOptions`) lists such a brief as "legacy (refused) · <niche>", disabled, after
  the ones that can start; `GET /api/office/snapshot` carries `legacy` per brief. The **line routine** never picks a legacy brief (it took
  the oldest verified brief, so one legacy brief would have stopped it for good).
- **Fixtures restated as owner briefs:** the dry run's two briefs (`fixtures/engine/briefs/`, owner bounds USD 7.50–9.99; the mock
  LISTER now writes a `priceProposal` of USD 9.99) and the demo's job B brief. The old dry-run brief is kept as
  `fixtures/engine/legacy-etsy-brief.md` for the refusal tests. The `e6-c0` floor test checks the floor at intake on an owner
  brief's bounds (3.49 refused, 3.50 taken) and the legacy refusal before any price check.
- **Read-only check before building (20/10/2026):** no brief in `research/briefs/` of the dev data root (none there) or the live data
  root (two, both owner briefs: `2026-10-17--cozy-autumn-desk-props`, `2026-10-19--cozy-winter-desk-props-for-pngtuber-and-vtuber`)
  is refused by this rule, and no job in either root is built on a legacy brief (live's two line jobs are those two owner briefs; the
  rest are research and scout jobs). Read from the files and the live event log only; the live `station.db` was not opened.
- Tests: `e7a1-legacy` (the reason word for word; refused at intake and at Start line for both kinds, no job, nothing written; the
  picker label; the routine skips it; indicative briefs of both origins and an owner brief still start from Start line), and
  `e7a1-indicative-line`, so the indicative path keeps the coverage the legacy fixtures gave: a verified indicative brief of each
  origin (genre-scout, research) from Start line through intake and the whole design line (one QA DESIGN rework) into the approval
  queue, priced from its cited range, $0; and the 3-price floor at intake on an indicative brief (3 cited prices at or above
  USD 3.50 pass, 2 fail; a EUR row counts at the station rate, one cent under it does not).

## W2: cut design-line waste and finish the winter job (owner decisions, 20/10/2026; built 20/10/2026)

### What W1 found, and two corrections

The W1 report (20/10/2026) on job `2026-10-19--cozy-winter-desk-props-for-pngtuber-and-vtuber`: USD 4.982876 (text 3.084745,
image 1.898131, 41 images), blocked at QA DESIGN pass 2 by the job cap ("cap: perJob 5.00 reached (spent 4.98, next call up to
0.03)"). Read again for W2 from the live logs and the live `ledger.jsonl`, read-only (no live file written, `station.db` not opened):
- **The 16 failed calls total USD 0.624528, not USD 0.594.** USD 0.593985 is the 15 DESIGNER rows of run
  `run_20261019111207_3fafef` (12 x 0.022443 and 3 x 0.108223); the 16th is QA DESIGN's at 11:53 Irish time on 19/10/2026 (USD 0.030543;
  its retry went through). All 16 are code NETWORK (no HTTP response), estimated at their reserved maximum.
- **Dropped connections were already retried**, exactly like a 429 or a 5xx: both providers sort a connection failure as retryable
  (code NETWORK or TIMEOUT), and every caller retried it (`live.retries` 2: three attempts, 2 s then 4 s, each reserved again and
  logged). The waste came from where the retries ended: 4 of the 5 groups of three attempts were `image_analyze` calls, a tool. After
  its last retry a tool's failure went back to DESIGNER as a tool error, so the run carried on into the same dead connection; only the
  5th group (DESIGNER's own turn) ended the run. One outage cost 15 charged attempts instead of 3.
- **set-v3 held all 11 files (02–12) when the connection dropped** (the run failed while checking batch 2's images). The restart on
  20/10/2026 started set-v4 and drew all 11 again (16 images, two DESIGNER runs, USD 1.375571 together).

### The owner's decisions (20/10/2026)

1. **Redraw only what QA flagged:** a DESIGNER pass after a QA DESIGN revise redraws only the files the verdict lists, plus any file a
   build warning names. Every other file is carried into the new set unchanged (copied, same hashes). Batching applies to the files
   being redrawn only. The new set's build and QA review still cover all files.
2. **Resume continues the set in progress:** after a run fails mid-pass, Resume carries on the same set from the first file not yet
   done; files already finished in that set are kept.
3. **Retry dropped connections** with the same backoff and retry count as 429/5xx, log each attempt, block the job only after the last
   retry; never retry a 400 or 401.
4. **Failed calls in the ledger:** a call with no HTTP response is recorded as estimated at its reserved maximum with the reason
   "no response (connection failed)"; the owner settles such rows (to USD 0 or another amount) after checking the Anthropic Console,
   with appended adjustment rows only, each logged with who, when and the amount; dry run by default, `--apply` writes; it must handle
   the winter job's 16 rows.
5. **Job cap USD 6.00 for every job** (was 5.00): text is now paid from the Team plan's API credits; image spend stays bounded by the
   OpenRouter key's USD 2 a day. No other cap changes.
6. **Small fixes:** Mark published takes Etsy's country links; `outerLimits.anthropicConsoleMonthlyUsd` 100 -> 200 (the station
   workspace's Console limit; the org limit is USD 350; both raised by the owner on 20/10/2026); `.claude/` in `.gitignore`.

### As built

- **1. Flagged redraw** (`orchestrator.mjs` `restOfSet`, `flaggedPlan`, `carryFlagged`). The station reads the revise record (the
  job's latest `qa/design-passN.json`) and the reviewed set's `deliverables.json` `buildWarnings`. A file counts as named when its
  number appears as `NN-subject` (with or without `.png`) in a reason, in `worthThePrice.reason` or in a build warning; a date
  ("2026-10-19") or a size ("2000x2000") never matches. File 01 is the approved style reference and is never redrawn here (DESIGNER
  is told QA named it). A file missing from the reviewed set is drawn in any case. The new set gets the carried files copied byte for
  byte, a `design.md` from the station plan plus the carried files' own sections (as the redraw-only mode does), and
  `set-vN/rework.json` (the files redrawn with QA's words and the build warning for each, the carried files with their sha256, the
  reasons that name no file). DESIGNER's input names each file to draw with its findings and the reasons that name no file
  (`[RUN MODE: REDRAW FLAGGED FILES …]`); the image tool refuses any other number. Prep builds and screens the whole set; QA DESIGN is
  told which files were redrawn and which carried, and reviews every file. **A verdict that names no file 02–N** (set-wide reasons, or
  only file 01) redraws the whole set, as before. QA DESIGN's prompt is unchanged (10,440 of its 10,500-character target); its input
  on every style-reference review now says: "On revise, name each file to redraw by its file name (NN-subject.png) in your reasons:
  only the files you name, and any file a build warning names, are redrawn; every other file goes into the next set unchanged."
- **2. Resume** (`designSet` on the job). Before a style-reference DESIGNER pass draws anything, the set is recorded on the job
  (`data.designSet`: set, mode first-file / rest / flagged, the files planned, status `drawing`). A run that fails or is stopped
  mid-pass leaves it `drawing`. When the job runs again (Resume, or the engine's own restart recovery) and that set is still the
  newest and not built, DESIGNER carries it on: the planned files already in its `raw/` are kept, only the rest are drawn, in batches,
  and the input says which files are kept. A first-file attempt whose file 1 is already drawn goes straight to its check. `drawn` once
  every batch is done (or the file-1 verdict is recorded). Scope: the style-reference product (the only one on live); the single-run
  DESIGNER of other products still starts a new set on a Resume.
- **3. Dropped connections** (`providers/connection.mjs`). Both providers already retried them; added: a socket or DNS error raised
  outside the SDK's connection class (e.g. a body cut off mid-read: undici's "terminated") is now NETWORK/TIMEOUT too (Anthropic), and a
  connection dropped while OpenRouter's body is read is a retried connection failure, not "a response that is not JSON". **A connection
  failure that reaches a tool after its last retry now ends the run** (the job is blocked with the reason) instead of going back to the
  agent. Each attempt is logged (the provider's line, "retrying with a new reservation"), and the last one says "failed after the last
  retry". 400 and 401 are not retried (unchanged; tested). The retry count and backoff are unchanged (`live.retries` 2, 2 s then 4 s).
- **4. Ledger and settle** (`guard.settle` `reason`; `lib/settle-failed.mjs`, `scripts/settle-failed.mjs`, `npm run settle:failed`).
  A call with no HTTP response is charged at its reserved maximum, `estimated: true`, `reason: "no response (connection failed)"`
  (text, web and image rows; an image row with a generation id stays with `settle:images`). Another call that failed without a usage
  report gets "failed without a usage report (<code>)". `npm run settle:failed` lists every such row not yet settled; with `--job` or
  `--entry`, `--usd` and `--by` it plans the settlement (dry run); `--apply` appends one correction row per row (`settle-<entryId>`,
  `correctionOf`, the difference in usd, `settledUsd`, `settledBy`, `settledAt`, and a note with the workings), logs each with who,
  when and the amount, and reports each job's spend before and after. Rows written before W2 have no reason: they are matched by the
  runtime's and the toolbox's failure notes (no generation id). A row is never settled twice; an amount above a row's charge is
  refused; the engine lock refuses while the server runs.
- **5. Job cap** `caps.perJobUsd` 6 (its `$comment`), `scripts/line-live.mjs`'s cap check (it refused unless the cap was exactly the
  configured one), the README and the tests that expected 5.00. No other cap changed.
- **6.** `etsyListingUrl` in Mark published (`/ie/`, `/es/` and any two-letter segment; stored as `https://www.etsy.com/listing/<id>/...`,
  also for a link without `www.`); `anthropicConsoleMonthlyUsd` 200 and its `$comment`; the README line; `.claude/` ignored.
- Tests: `w2` 11/11 (flagged redraw through the line with a build-warning file and the carried bytes; the whole-set fallback; a mock
  connection failure mid-batch, then Resume drawing only the remaining 8 files into the same set; the Anthropic and OpenRouter
  classification, retries, the tool-path stop, 400/401; the settle library on the winter job's 16 rows and the script's dry run and
  `--apply`; the country links). Changed: `e6-prices` (USD 6.00), `l2-steer` (USD 200; USD 6.00 in the day-cap refusal; see below).

### Points for the owner

- **The daily cap now refuses a second job while one is open.** At USD 6.00 per job and USD 10.00 per day, the spend dialog's worst
  case for a second start is 6 + 6 = 12, over 10, so Start line / Research this / Resume are refused while another job is open (the
  "next" queue still works if the day cap fits two jobs; `l2-steer` now asserts the refusal under the real caps and tests the queue with
  a day cap of 12). The daily cap was not changed (decision 5: no other cap). Say if it should be USD 12.00.
- **"Named" means by file name.** A verdict that names a file only by its subject ("the sled") does not flag it; if no file is named
  at all, the whole set is redrawn. A file named in a "checked and fine" line is redrawn too (the station cannot tell praise from a
  finding): one extra image at most.
- **Build warnings flag their file**, every kind, including "enlarged over 4x: check it is not soft". At the image model's 1024 px this
  is rare (the winter job's set-v2 had one warning: the sled's near-white fill).
- **The retry window is short.** 2 retries at 2 s and 4 s ride out a blip, not an outage like 19/10/2026 (about 90 s). With Resume
  carrying on the set, a block now costs the failed attempts only. The count is unchanged (not part of W2).
- **The winter job once deployed:** it is blocked at QA DESIGN (pass 2) with set-v4 built (12 files). Resume (USD 4.982876 spent of
  6.00, so USD 1.017124 left) runs QA DESIGN on set-v4, all 12 files, and draws nothing. Approved: LISTER, price fill, QA LISTING, the
  package gate and the package, to the approval queue. Revise: DESIGNER pass 3 (design loop 2 of 2) redraws only the files QA names
  into set-v5, then QA DESIGN pass 3; a further revise goes to the Rejects Desk. Worst case: the job stops at USD 6.00 recorded (the
  guard refuses the call that would pass it). For scale: QA DESIGN pass 1 on this job cost USD 0.659491; LISTER and QA LISTING on the
  autumn job USD 0.153036. Settling the 16 failed rows to USD 0 first (after checking the Console) brings the recorded spend to
  USD 4.358348 and the headroom to USD 1.641652. Today's spend (USD 1.54 on 20/10/2026) leaves the daily cap clear for it.
- **Settling the winter job's 16 rows** (live checkout, server stopped; check the 16 calls in the Console first, 19/10/2026 11:53 and
  12:18–12:20 Irish time (10:53 and 11:18–11:20 UTC), model claude-sonnet-5-5):
  `cd C:\Users\marks\projects\office-agents-live; npm run settle:failed -- --job 2026-10-19--cozy-winter-desk-props-for-pngtuber-and-vtuber --usd 0 --by "<your name>"`
  (the dry run: it lists the 16 rows and the job's spend after), then the same with `--apply`. A call the Console shows at another
  amount: `--entry <entryId> --usd <amount>` instead of `--job`.
- The `settle:failed` script test writes `logs\settle-failed-<day>.log` in the dev checkout (git-ignored), as the script does.

## L3: parallel lines, QA names files, research tune (owner decisions, 20–21/10/2026; built 21/10/2026)

Built in the dev checkout only (mock provider, `STATION_INSTANCE=dev`, port 8792), $0, no real API call. Not deployed: a job is running
on live. The live checkout was read once, read only: the two drafts of job `2026-10-21--research-1` in
`data/research/drafts/2026-10-21/`.

### The owner's decisions

1. **Parallel lines** (20/10/2026): at most 1 running job per line (each line's `maxConcurrentJobs`) and at most 2 in total
   (`runtime.maxRunningJobs` 2). A start on a line whose job is running waits as "next" for that line; a start beyond the total waits
   as next as now. Every spend guard counts all running and queued jobs together (the daily cap check and the dialog's worst case of
   open jobs, the per-run and per-job reservations, the OpenRouter key's USD 2/day, the Console monthly estimate), and reservations
   stay safe when two jobs reserve at the same moment. The E-STOP halts every running job; Stop job stops only its own. The spend
   dialog shows the other running job. A routine firing while another line's job runs starts alongside it within these limits; on the
   same line it waits as next. In the office an agent working on either job sits at its desk; the lounge is for agents with no step in
   any running job.
2. **QA-DESIGN names the files** (21/10/2026): a revise carries the files to redraw as file ids (NN-subject) in the verdict's
   structured fields, checked by the engine against the set's files; none, or an id not in the set, is refused back once with the
   reason; still none: the job blocks with that reason instead of redrawing the whole set. W2's whole-set fallback is removed. The
   QA-DESIGN prompt stays within its target.
3. **Maintenance scripts never start the scheduler** (21/10/2026): settle:failed, settle:images and every other script that opens the
   engine run with the scheduler and routines off, so no job can start from a script.
4. **Research tune** (21/10/2026), from the first routine run on live (2 drafts, both rejected): EVIDENCE-CHECKER never records a
   source as OPENED or NOT REACHABLE unless it tried it in this run (it fetches, at most 6 a run, or writes "not re-opened; URL and
   price checked by the station against this job's search results"), enforced on write; the keyword rule is stated as the station
   applies it (at least 3 distinct cited results across the whole Keywords list); DEMAND-RESEARCHER's evidence is for the
   products.json product itself, from non-Etsy places that sell or discuss it, with no brief for a different product; a title cell
   with a price never has "no price" in its price cell. Prompts within their caps; the IP-rule lines word for word.

### What the two 21/10 drafts showed (read only)

- `2026-10-21--cozy-cocoa-desk-props-planner-crafters`: evidence for planner and Goodnotes sticker sets (its own Risks: "the buyer
  segment does not match the product"); rows 4 and 5 named prices in their titles (USD 1.99, USD 3.96) with "no price" in the price cell.
- `2026-10-21--stream-overlay-asset-buyers`: evidence for stream overlay packs (animated and themed bundles), not the prop pack; row 5's
  title said "packs from about USD 3 to 17" with "no price".
- EVIDENCE-CHECKER made no web call in the run, yet wrote "NOT REACHABLE in this run" (or "OPENED / NOT REACHABLE") for every source
  of both drafts, and applied the keyword rule per keyword (both drafts cite at least 3 distinct results across their Keywords lists:
  5 and 4). Its product-mismatch rejection of both was right.

### As built

- **1. Parallel lines.**
  - `config/engine.json` `runtime.maxRunningJobs` 2 (its comment); each line keeps `maxConcurrentJobs` 1. `orchestrator.startJob`
    queues a start on a busy line as next for that line (`data.nextFor` "line", reason "one job at a time on the <line> line") and one
    beyond the total as before (`nextFor` "total"); `startNext` starts each in queue order when a place frees on its line.
  - `spend.mjs` `startCheck` is the one check of a start, used by the dialog, the server-side gate and a routine's firing. It counts
    every open job (running, or queued to start by itself) at its worst case (its cap less its spend) in the daily cap, the line's day
    cap and the Console estimate (this month's Anthropic rows + open jobs + this one; the dialog now refuses a start whose Console
    worst case is over the limit). The quote carries `otherJobs` (id, line, running or next, step, spend so far, cap, worst case still
    open), `console.worstUsd`, the OpenRouter day of every job, and `queue.nextFor`; the dialog shows them ("other job", "waits as
    next for its line").
  - `guard.mjs`: every check already counted every job's spend and reservations; `reserve()` is synchronous, so two jobs reserving at
    once are checked one after the other (tested: three workers on two jobs, peak spent + reserved never over the day cap, every row
    counted once). New: the OpenRouter key's day (`outerLimits.openrouterDailyUsd`, unchanged at USD 2) is mirrored for image calls:
    every job's OpenRouter rows of the day plus the image reservations in flight; refused as `cap: openrouterDay`. The day is both the
    UTC day and the Dublin day, the higher counting.
  - The E-STOP's shared signal already reached every job; Stop job aborts only its own job's controller (both tested with two jobs).
  - Routines (`engine.runRoutine`): a firing runs `startCheck` first; if the caps would not hold with every open job counted it is
    skipped with the reason (logged on the routine); otherwise it starts alongside another line's job, or waits as next on its own line.
  - The office (`engine-model.mjs`, `office.js`): each agent carries `onStep` (it has the current step or a live run in any running
    job), `stepJobs`, `currentJobs` and `place`; the office seats `onStep` agents at their desks and every other agent in the lounge
    (the legacy view, without `onStep`, keeps the old idle rule). `jobLimit.perLine` in the snapshot.
- **2. QA DESIGN names the files.**
  - The record's new field `redraw`: a list of file ids (`10-wooden-sled`; a trailing `.png` or a path is dropped). For a set review of
    a style-reference product (the only product) the station gives QA DESIGN the set's ids (`setFileIds`: `set-vN/raw/NN-subject.png`;
    02–N may be named, 01 is the approved style reference). `submit_verdict` checks a revise: no `redraw`, an empty one, an id not in
    the set or file 01 is refused once with the reason and the ids it may name; a second bad revise is recorded with `redrawProblem`
    and the job blocks at QA DESIGN with the reason ("asked for a revise without naming the files to redraw (...): nothing is redrawn;
    the owner decides"). A QA run that ends with no verdict at all blocks the same way when a design loop is left. No loop is used.
  - `flaggedPlan` takes the files from `redraw` (plus any file a build warning names and any file missing from the reviewed set); the
    reasons still give each redrawn file its findings. `restOfSet` no longer falls back to the whole set: it blocks.
  - QA DESIGN's input now says: list each file to redraw in the record's "redraw" field by its file id, with the set's first and last
    id; refused once, then the job stops for the owner. Its prompt: the schema line `"redraw": [...]` and "each file to redraw in
    `redraw`" in step 5; "You sit after the Designer and before the loop gate." removed to stay within the target: 10,493 of 10,500.
- **3. Scripts.** `src/engine/script-engine.mjs` `openScriptEngine({ purpose, startsJobs })` is the only way a script opens the engine
  (a test fails on any `createEngine(` under `scripts/`). The scheduler is locked (never starts, an e-stop release included; a routine
  never fires: `fire` skips, `runRoutine` throws), restart recovery marks interrupted jobs but starts none, and the caller cannot turn
  `startScheduler` or `resume` back on. Maintenance scripts (`settle:failed`, `settle:images`, `owner-brief`, `blocklist-hygiene`,
  `smoke:live`) start no job at all (`startJob` refuses, code SCRIPT). Scripts that exist to run a job (`line:live`, `scout:live`,
  `owner` run modes, the dry runs, the demo, the screenshot scripts) start only the jobs they start themselves; a queued "next" job they
  did not start is never started when their job ends. `npm start` (the Station) is unchanged.
- **4. Research tune.**
  - `tools/index.mjs`: the URLs this run's `web_fetch` calls tried are kept (a refused fetch is not a try). A draft write (drafts/ or
    scout-drafts/) whose `## Evidence check` marks a URL OPENED or NOT REACHABLE that this run did not fetch is refused with the
    reason and the "not re-opened; ..." wording (`lib/scout-brief.mjs` `evidenceCheckProblems`). `limits.maxWebFetches` caps an agent's
    fetches a run: EVIDENCE-CHECKER 6 of its 15 web calls (`config/agents/evidence-checker.json`); it already had `web_fetch`.
  - `lib/scout-brief.mjs`, on an agent's write only (intake and older briefs unchanged): a research brief needs `product fit: same
    product — ...` in its Demand evidence, and is refused when its Niche, Buyer persona, Demand evidence or Risks say the evidence is
    for another product ("does not match the product", "different product", "product mismatch", ...); a row with "no price" whose title
    shows a price (USD/EUR/GBP/CAD/AUD, $, € or £ and a figure) is refused, both lines. The keyword rule is unchanged (it was already
    across the list).
  - Prompts: EVIDENCE-CHECKER (12,440 characters): 6 fetches; OPENED / NOT REACHABLE only for a URL fetched in this run, else the
    not-re-opened wording; fetch only SOURCES RETURNED URLs; a price in a title with "no price": REJECTED; PRODUCT FIT (a different
    product: REJECTED, naming it); "the Keywords list as a whole cites at least 3 distinct results (the station rule: across the whole
    list, not 3 per keyword; each keyword needs one cited result)". DEMAND-RESEARCHER (15,991 of 16,000): the PRODUCT FIT bullet in the
    owner's words; to fit, step 3 now points to the format skill instead of repeating it, and the front-matter placement lines the
    template already shows were dropped. GENRE BRIEF FORMAT (shared with TREND-SCOUT, now 15,072): "`no price` only when the result
    shows none ... A price the result shows goes in the price cell, never only in the title" and the `product fit:` line (research
    briefs). The IP-rule lines are unchanged, word for word (tested).
  - Fixtures: the research fixture brief and the demo's research brief carry a `product fit:` line.
- Tests: `tests/l3.test.mjs` 16 (the queue with a research and a design job running at once, a second design job next for its line, a
  genre-scout job next for the total, both starting by themselves; the office seats; the daily, line-day and Console worst cases and the
  dialog's other job; concurrent reservations; the OpenRouter day across jobs; E-STOP and Stop job; routines alongside, next and
  skipped; the `redraw` ids and the refusal; scripts; NOT REACHABLE refused then accepted after the fetch; the 6-fetch cap; the keyword
  rule; a mismatched-product draft not written; the title price; the prompts). `tests/w2.test.mjs`: the flagged-redraw test now names
  its files in `redraw`; the whole-set test now expects the block; 2 new (refused once, then only the named file redrawn; a wrong id
  twice, then blocked). `tests/l2-steer.test.mjs`: the Console line's new wording; the "next" queue test runs at a total of 1 (the
  config is 2), and the snapshot's `jobLimit.perLine`.

### Points for the owner

- **Under the real caps two jobs still cannot both be open.** At USD 6.00 per job and USD 10.00 per day the worst case of a second
  start is 6 + 6 = 12, so the dialog refuses it and a routine firing next to an open job is skipped with that reason. Parallel lines
  take effect with a day cap of USD 12.00 (or once the open job has spent more than USD 2.00). The day cap was not changed. Say if it
  should be USD 12.00. (Two jobs on different lines each have their own USD 10.00 line cap; two on the same line would also need it raised,
  but they wait for each other in any case.)
- **New refusal: the Console estimate.** The dialog now refuses a start whose worst case (this month's Anthropic rows + every open
  job's worst case + this one) would pass `anthropicConsoleMonthlyUsd` (USD 200). An open job's worst case counts in full, images
  included, so the estimate errs high. At USD 200 a month it bites only near the month's end.
- **New refusal: the OpenRouter key's day in the engine.** An image call that would take every job's OpenRouter spend of the day past
  USD 2.00 is now refused by the guard (`cap: openrouterDay`) instead of failing at OpenRouter. I did not check when OpenRouter resets
  the key's day; the guard counts the UTC day and the Dublin day and uses the higher, so it never lets through a call the key could
  refuse, but it may refuse one up to an hour before OpenRouter would allow it (21/10–25/10/2026 and in summer time).
- **QA DESIGN's prompt is 7 characters under its 10,500 target**, DEMAND-RESEARCHER's 9 under the 16,000 clamp. The next change to
  either needs a trim first.
- **Product fit is still a judgement.** The engine refuses a research draft that does not say `product fit: same product` or that
  admits another product in its own words; whether the cited results really sell the prop pack is DEMAND-RESEARCHER's call and
  EVIDENCE-CHECKER's check. The genre-scout line is not changed (TREND-SCOUT writes genre briefs for the line's product key).
- **"Tried" means the fetch was made**: a fetch the station refused (not a searched URL, a blocked domain, over the limit) is not a try,
  so it cannot be recorded as NOT REACHABLE.
- **The redraw ids apply to the style-reference product** (the only product). A product without a style reference has one design mode
  (the whole set), so its revises need no ids.
- **The office's lounge rule changed for one case**: an agent whose last run ended in an error but who has no step in a running job now
  sits in the lounge (before: at its desk). Its desk light still shows the error colour.
- **Not deployed.** Ship with `npm run deploy:live` once the job running on live has ended (the checks are in PROGRESS.md "L3").

### L3.1: the research line's job cap (owner decision, 21/10/2026; built 21/10/2026)

- **Decision:** `caps.perJobUsdByLine` gets `"research": 1.00`. A research job has cost about USD 0.11. The line cap only lowers the
  job cap, as the guard applies it (`perJob[research]`; the guard ignores a line cap at or above `perJobUsd`), and the spend checks count an
  open research job at it. With a design job open at its worst case of 6.00, a research job beside it is 7.00 worst case, within the
  USD 10.00 day cap, so the weekday research routine can start next to an open design job. `caps.perJobUsd` 6.00, the day cap 10.00
  and genre-scout 0.50 unchanged. Mock only, $0; tests in `l3` ("L3.1").
- **What still does not fit:** a second design job beside an open design job and an open research job: 6 + 1 + 6 = 13.00 worst case,
  so the dialog refuses it and a design routine firing is skipped (on the engine's own path it waits as next for its line). The
  open point above (two design-sized jobs at once) would now need USD 13.00 while a research job is open, USD 12.00 otherwise.
- **What counts as an open job** (the worst case in `spend.startCheck`): a running job, and a queued job that starts by itself (next
  for its line or the total, or resumed after a restart), at its cap less what it has spent. Not counted: a job in the approval queue
  and a blocked or stopped job (their spend so far is in today's spend; any further spend needs the owner's click, which is checked
  then: Re-run the listing or Resume counts that job at its cap less its spend, and a job at its cap is refused "job cap reached"), and a
  queued job waiting for an off-duty agent (checked when the agent is put back on duty).

## W4: carry-over by the station, missing files in the same set, set-approval fixes, job cap USD 7.00 (owner decisions, 21/10/2026; built 21/10/2026)

Built in the dev checkout only (mock provider, `STATION_INSTANCE=dev`, port 8792), $0, no real API call. Not deployed. The live data
(the winter job `2026-10-19--cozy-winter-desk-props-for-pngtuber-and-vtuber`) was read, read only, for the W3 report.

### Records

- **L3 and L3.1 deployed** to live on 21/10/2026 at 12:29 UTC (`9122435`, `npm run deploy:live -- --no-start`; the owner starts live).
- **The winter job's "fetch failed"** (DESIGNER pass 4, set-v6, 21/10/2026): the laptop slept from 09:42 to 12:01 (on battery, lid
  closed), so the image call for file 07 lost its connection. The cause was the sleep, not a code fault. The three failed attempts are
  ledger rows charged at their reserved maximum (USD 0.08 each, reason "no response (connection failed)"); the owner may settle them with
  `npm run settle:failed` after checking OpenRouter's activity page.
- **What W3 found** (read only): QA DESIGN pass 2 required one redraw, 03-plaid-scarf (02 and 09 only borderline). Under W2's rule (any
  file a reason names) set-v5/rework.json flagged 02, 03 and 09 and carried the rest; DESIGNER drew 02 and 03, said 09 was carried and
  never drew it, so set-v5 had 11 of 12 files; the build failed ("raw/ has 11 file(s), the product spec lists 12"), and the prep retry
  started a fresh set-v6 (02 to 12) with generic prompts that ignored QA's scarf findings.

### The owner's decisions and how they are built

1. **Carry-over is mechanical.** Before DESIGNER runs a redraw pass the station copies every carried file into the new set, byte for
   byte (`carryFlagged`, unchanged since W2), and after DESIGNER's run it checks them again (`recarry`): a carried file missing, or with
   other bytes than `rework.json` records, is copied again from the set it came from (logged "carried file copied again by the
   station"). DESIGNER draws only the files on the redraw list. The list is QA DESIGN's `redraw` ids (L3) plus any file a build
   warning names; QA DESIGN is now told that a file it calls borderline or acceptable stays out of `redraw` and is carried unchanged.
   (Under L3 the winter verdict's "Redraw list: 03-plaid-scarf.png only" would have flagged 03 alone.)
2. **Missing files go back to the same set.** When the prep step sends a style-reference set back to DESIGNER and the newest set is
   unbuilt with files 02 to N missing from its raw/, the job does not start a new set: a missing file the set carried is copied again
   by the station ($0), and DESIGNER draws only the other missing files into the same set, run mode "DRAW MISSING FILES", each with QA
   DESIGN's findings for it (its rework.json entry, else the newest QA record's reasons that name it), told that every file already
   there stays as it is (`missingFilesOf`, `findingsOf`; `designSet.mode` "missing", carried on by a Resume like any set in progress).
   The one prep retry is used as before; if the set is still short after it, the job blocks. A prep failure that is not about
   missing files (a wrong name, a missing transparent background) keeps its old path.
3. **QA-only on an older set.** A QA-only run reviews the set the owner named: its verdict's `designFile` must be that set (it was
   refused unless it was the newest set: a QA-only run on set-v4 while set-v6 exists could never record a verdict), and the redraw ids
   are checked against that set's files (`validateVerdict`, `setFileIds(job, reviewedSet(job))`).
4. **Set approval on the page.** "Approve set-vN…" and "Reject set-vN…" appear only when that set is built and the approval would be
   accepted: the set is the one the last QA DESIGN pass reviewed (else the newest set), it is built (deliverables.json, every file of
   the spec), the last verdict is not "approved", the pass limit is reached (3 of 3) or the post-fix rule applies, the manifest has no
   limit problems or build warnings, and originality is clear for the current design.md (`lib/set-decision.mjs`). Otherwise the panel
   says why in one line, e.g. "set-v6 is not built: 5 of 12 files; set-v4: your set approval stands in for QA DESIGN only at the pass
   limit (2 of 3 passes) or after a post-fix". The owner's decision on every file is still required and checked by `approveSet`. For
   the post-fix rule the page now sends `rule` and the after previews it lists in the dialog.
5. **Designs panel.** The job panel shows every file of the newest built set as a thumbnail with its file name (was the last two).
6. **Job cap USD 7.00** for every job (`caps.perJobUsd`, was 6.00). The research line stays at USD 1.00, genre-scout at USD 0.50, the
   day cap at USD 10.00: a design job plus a research job is 7.00 + 1.00 = 8.00 worst case; two design jobs at once (14.00) are still
   refused. `npm run line:live` checks for USD 7.00.

### The winter job from now to the approval queue (via set-v4, under USD 7.00), once W4 is deployed

1. Optional, $0, server stopped: check the three failed image calls of 21/10 11:01–11:02 UTC on OpenRouter's activity page; if none was
   charged, `npm run settle:failed -- --job <id> --usd 0 --by "<name>" --source "OpenRouter activity page"`, then the same with `--apply`.
2. QA-only on set-v4 (about USD 0.65). The page has no QA-only button (the API route exists; the panel does not offer it), so with
   the server stopped: `$env:STATION_PROVIDER='live'; npm run line:live -- --qa-only <id> --set 4 --max-usd 0.80; Remove-Item Env:STATION_PROVIDER`.
3. If QA approves: on to step 5. If QA revises only on 03, the set is at the pass limit (3 of 3): the owner's decision on each of the
   12 files of set-v4 (`npm run owner -- file-decision`, server stopped: "approved" for 01, 02 and 04–12, "keep" for 03-plaid-scarf with
   qaPass 3, QA's words and the owner's reason), then `npm run owner -- set-approval <id> --from <args.json>` (or, with the server started, **Approve set-v4…** on the page), $0.
4. If QA revises on anything else, the owner decides (the same overrides where the owner accepts the file; originality and trademarks
   are never overridden).
5. Listing-only (LISTER + QA LISTING, about USD 0.15), server stopped: `npm run line:live -- --listing-only <id> --max-usd 0.30` with
   `STATION_PROVIDER=live` for that process; then the package step (`npm run owner -- package <id>`, server stopped, $0), which puts
   the job in the approval queue.

## B0: businesses as floors (owner vision, 21/10/2026; built 21/10/2026)

Built in the dev checkout only (mock provider, `STATION_INSTANCE=dev`, port 8792), $0, no real API call. Not deployed. The live data
was read once, read only, to copy `station.db` (with its -wal and -shm), `ledger/` and `events/` into a scratch folder outside both
checkouts for the migration dry run; nothing under the live checkout was written.

### The owner's vision

The Station is one building that runs several businesses. Each business is a floor with its own departments, lines, agents, budget,
data and rules; shared services sit on a shared floor. Today there is one business. This phase bakes the structure in and adds no new
business behaviour.

### As built

1. **A business is a config object**: `config/businesses/<id>.json` with id, name, floor, departments, lines, agents, monthlyBudgetUsd,
   dailyCapUsd (optional, at most the station's day cap), allowedOutbound (default [] = none), dataDir and ownerApprovalRequired
   (default true). `_template.json` documents every field and is never loaded (a file whose name starts with "_" is skipped).
   Today's Etsy work is **etsy-shop** ("TheStationShopFinds", floor 1): the lines research, genre-scout and room1-digital, the eight
   line agents, the departments Research, Design and Office, USD 200 a month, no day cap of its own (the station's USD 10.00 applies),
   dataDir "." (today's layout). `src/engine/business.mjs` checks the building when the config loads and stops the engine with the
   reason when it does not hold: an id that is not the file name, a floor below 1 or taken, a department, line or agent in two places
   or in none, a line agent the business does not list, a day cap above the station's, an outbound action the Station does not know,
   ownerApprovalRequired false, a dataDir other than `businesses/<id>/` (only one business may keep "."). The station's caps stay the
   outer limit. The agents list is a field of its own (the owner's list said "with today's lines, agents and departments").
2. **business_id on every record.** SQLite: jobs, runs, routines, approvals and the ledger's mirror have a `business_id` column (a new
   data root has it from the start). The engine sets it on every insert through one resolver: a job by its line's business, a run by
   its job (else its agent's business), a routine by its target line, an approval by its job, a ledger row by its job, line or agent
   (an own-shop Etsy call: the business that owns that outbound action), else "shared" (the shared floor, and station-wide records
   such as the engine's start). New ledger rows and events carry `businessId` in their JSONL. **The engine refuses a data root with a
   record that has no business** (code MIGRATE, with the command to run): `npm run migrate:businesses` is a dry run by default (what
   would be set, per table and business, and anything it cannot map); `--apply` takes a full backup first
   (`data/.backups/businesses-<stamp>/`, the database by SQLite's VACUUM INTO, nothing deleted), then adds the columns and sets every
   empty value in one transaction, logs every change (table, id, business), and checks nothing is left; a second run changes nothing
   and takes no backup; it holds the engine lock, so it refuses while the server runs on that data root; it refuses to apply while
   any record cannot be mapped. **Not rewritten: the ledger (`ledger/ledger.jsonl`) and the event log (`events/*.jsonl`)**, which are
   append-only records (ENGINE-PLAN.md §1.2: a row is never edited); their rows from before B0 get their business when they are read,
   by the same resolver, and the migration reports them. This is the one place the owner's "every ledger row and event carries
   business_id" is met by resolution rather than by a stored field.
3. **Spend guards at the business level.** The guard checks a call against its business's monthly budget (`businessMonth[<id>]`, the
   Dublin month, every reservation of that business in flight counted) and, when the business sets one below the station's, its day
   cap (`businessDay[<id>]`), as well as every station cap; the lowest limit wins. The shared floor has the station's caps only. The
   spend check of a start (`spend.startCheck`: the dialog, the server-side gate, a routine's firing) refuses a start whose worst case
   (this month + the business's open jobs + this one) would pass the budget, and the dialog shows a "business" line (name, floor, this
   month against the budget, its own day cap if set). The top bar on a business floor leads with that business's spend.
4. **Data.** etsy-shop's files stay where they are ("." is today's layout: the data root minus `businesses/`). A new business keeps its
   files in `businesses/<id>/`. An agent's file tools are jailed to its business's data on top of its run folder: a run whose folder is
   outside its business's data is refused before any tool runs, and every path is checked against the business's area (a link into
   another business's data is refused). Shared config stays read only (products.json, as before). The shared floor's agents serve
   every business (their area is the data root). Not built: the orchestrator still places every job folder under `jobs/` and the
   research folder under `research/`, so a second business's jobs would be refused by its own jail until those paths take the
   business (fail closed; there is no second business yet).
5. **Shared services, floor 0**: Finance (the ledger and budgets view), Compliance (originality, platform terms, privacy rules) and
   OVERSEER (`config/office.json` `shared`; OVERSEER's desk moved there). No new agents. The lounge is on floor 0.
6. **The building in 3D**: the page draws one floor at a time. Floor 1 (etsy-shop) is today's office with its lounge corner left as
   open floor; every agent stays at its desk (nobody walks to a lounge on that floor). Floor 0 has the Finance, Compliance and OVERSEER
   rooms, the services closet and the lounge, drawn procedurally (no bake). A floor switcher in the top bar (Building, 0, 1, …; `[`
   and `]`; `?floor=N`), each floor with its own task list, routines, board, calendar and spend; the whole-building view (G) lists
   every floor's totals; a business with no lines yet shows as an empty, labelled floor. The Office and atrium/lounge bake units were
   re-baked for floor 1 (`npm run build-office -- --room office`, `--room atrium`), so floor 1 stays fully baked. FPS: see "Measured".
7. **Building rules**: below.
8. README "The building" and "Adding a business".

### B0: building rules

Every business inherits these. What code can enforce is enforced; the rest is the owner's rule for every agent, prompt and decision.

1. **No outbound action** unless the business lists it in `allowedOutbound` **and** the owner approves that action each time.
   Enforced: the Station knows one outbound action, `etsy:read-own-shop` (E7a); the Etsy client is built only for a business that
   lists it (etsy-shop) and is unavailable otherwise, every Etsy call is the owner's click, and an unknown action in a business file
   stops the engine. Agents have no messaging, posting or publishing tool (as before). Model and image calls and the research line's
   web search are the Station's own work, not outbound actions.
2. **Spend caps per run, job, business and station** (guard.mjs): the lowest limit wins; caps change in config only, by the owner.
3. **Every agent output is a draft until the owner approves it.** Enforced: `ownerApprovalRequired` cannot be false; the approval
   queue is the only way out; nothing auto-publishes.
4. **Originality and IP rules for anything published**: the originality screens, the blocklist and the package gate, unchanged, for
   every business.
5. **Personal data only as the business strictly needs it**, and **never another company's data in the Station** (for example
   Stellar's). Enforced where code can see it: `config/building.json` `foreignDataMarkers` (the names of companies whose data must never
   enter); an agent's file write or a brief (owner or research) that holds one is refused with the reason. A new business that needs
   personal data is the owner's decision first (GDPR: what, why, how long), recorded before it is built.

### Measured

- **The migration dry run on a scratch copy of the live data** (21/10/2026; `station.db` with its -wal and -shm, `ledger/` and
  `events/` copied, read only, to a scratch folder outside both checkouts; `STATION_DATA_ROOT=<copy> npm run migrate:businesses`;
  nothing applied): jobs 32 (all etsy-shop, the legacy jobs included), runs 47 (etsy-shop), routines 4 (etsy-shop), approvals 1
  (etsy-shop), ledger mirror 509 (508 etsy-shop, 1 shared: the station-level smoke-test call of 17/10, USD 0.000005), every table
  without the column today; the ledger file's 509 rows resolve the same way (the 5 own-shop Etsy calls of 20/10 to etsy-shop); the
  event log, 6 files and 1,148 events, resolves 1,050 to etsy-shop and 98 to shared (engine starts, e-stop and other station-wide
  events). **Nothing could not be mapped.**
- **Frame rate** (`node scripts/screenshots-b0.mjs --headed --channel chromium --expect-gpu intel`, the default tier, 1600x1000, the
  page's own bench, 3 s per reading, Intel UHD Graphics (ANGLE D3D11) on this laptop; the target is 60): floor 1 (etsy-shop, every
  area baked) light 156 moving / 162.9 full, dark 161.7 / 163.7; floor 0 (shared, procedural) light 148.6 / 145.9, dark 152.4 /
  156.6; an empty floor (a capture-only second business) 156.8 / 151.6; floor 0 with OVERSEER walking to the lounge 150.9 (dark) and
  154.6 (light). The whole-building view is an HTML overlay: the 3D scene is paused under it (no frames drawn). Readings taken while
  the window was covered (the bench's throttled flag, about 1 fps) were measured again; the floor-0 light reading is from the run
  where it was not throttled.
- **Checks**: npm test 512/512 (new: `b0` 11/11; changed: `baked-room` for the floor-1 bake, `write-guard` for the capture script's
  jail); `npm run dry-run`, `dry-run:scout`, `parity -- --rebuild` (26/26) and port drift (69 files, no drift) pass.

### Before B0 reaches live (the owner's steps)

1. Deploy with `npm run deploy:live -- --no-start` (a deploy that starts live would fail its health check): **the live Station
   refuses to start until its data root is migrated** (MIGRATE: by design, no record without its business).
2. In the live checkout, server stopped: `npm run migrate:businesses` (the dry run; it should match the scratch copy's summary above,
   plus whatever live has done since), then `npm run migrate:businesses -- --apply` (the backup is taken first), then start live.
3. The dev checkout's own `data/` (scratch) needs the same before `npm start` on dev.

## R0: restructure (owner decision, 22/10/2026; plan written 23/10/2026)

Plan only: no engine or app code changed, dev checkout, no API call, $0. The plan is `RESTRUCTURE.md`.

### The owner's decision

A complete restructure of the system. Etsy production stops; it was a proving exercise. The Station becomes a software company that
builds, sells and keeps customers for the owner's products: first ReplyDesk (review-reply SaaS, repo
`markstynesfernandez/Review-Service`), then emty-inbox (inbox copilot SaaS, repo `markstynesfernandez/emty-inbox`). Agents run the
work autonomously; the owner is the human oversight and always has the final call, including the ethical calls.

### W6 (interrupted mid-build)

The W6 working tree (7 changed files, 2 new: owner listing approval without the outbox QA copy, the "set approved" line, rename-file,
the listing-only cap stop) ran the full suite: **510 passed, 2 failed** (`tests/w4.test.mjs:186` "the listing checks still run",
and the W4 QA-only test, which expects the set buttons where W6 now shows "set-v2 approved by the owner"). W6 had no tests or docs of
its own and `renameFile` was not wired to a script. So it was **not** committed to main: it is on branch **`w6-wip`** (`56adc5f`),
and main is clean. Recommendation: leave it parked, since Etsy production stops.

### What the plan proposes (for the owner's review; nothing decided until "go R1")

- Departments as floors: 0 Headquarters (Owner's office with the requests queue, Finance, Compliance & Ethics, Operations/OVERSEER,
  lounge), 1 Engineering, 2 Sales & Marketing, 3 Customer Success, 4 Etsy (archived, today's floor-1 bake).
- Products as a first-class dimension: `product_id` and `department_id` on every record; B0's business config splits into
  `config/products/` and `config/departments/`; one migration (`migrate:products`) that accepts a pre-B0 or a B0 data root.
- Thirteen agents (OVERSEER reused with a new prompt; the eight Etsy agents archived, not deleted).
- `config/autonomy.json`: every action auto, owner or forbidden; unknown actions forbidden; product overrides only stricter;
  changes only in the file, logged at start.
- Compliance gates on every outbound draft; GDPR/ePrivacy rules for B2B outreach, to be confirmed by legal advice before R3.
- Engineering safety: worktree-only writes, allowlisted `run_check`, secret refusals, no installs, `dev/<job-id>` branches; the
  owner merges and deploys.
- Phases R1 (engine core) – R5 (office), with estimated weekly API cost; the owner's open questions in RESTRUCTURE.md §9.

### Noted while reading

- emty-inbox's own PLAN.md names Stellar Corporate Housing as its first pilot tenant, while `config/building.json`
  `foreignDataMarkers` refuses Stellar's data in the Station: RESTRUCTURE.md §9 Q4 asks the owner to decide before any emty-inbox work.
- ReplyDesk's repo is not cloned on this laptop; its stack and check commands are unknown (§9 Q3).
- Live runs L3.1 (`9122435`); W4 and B0 are not deployed.

### R0 addendum (23/10/2026): ReplyDesk facts

Correction to "Noted while reading": ReplyDesk is cloned at `C:\Users\marks\review-reply-service` (`REPLYDESK_REPO`; main at
`d03a9ab`). Read-only checks only (git status, log, ls-files, show, check-ignore; file reads): `replydesk.db`, `.env` and `.venv/`
are untracked, never committed on any branch, and ignored. The repo already has a weekly drafts-only outreach routine (16
`outreach/*` branches, US businesses, nothing sent according to its logs) that R3 must replace or absorb. Recorded in
RESTRUCTURE.md §5.8, §8 R3 and §9 Q3; outreach rules per market, US rules still to be given by the owner.

## R0.2: seven-floor company, executive penthouse (owner decision, 23/10/2026)

Plan only: `RESTRUCTURE.md` updated throughout; no engine or app code changed, dev checkout, no API call, $0.

### The owner's decision

The Station is laid out as a miniature tech company (modelled on companies like Google and Meta), with Headquarters as the top-floor
penthouse. Floors are display order only: records keep `product_id` and `department_id` and are never keyed on a floor number;
existing Etsy data keeps `business_id` `etsy-shop`, only its display floor changes.

- **6 Penthouse, Headquarters**: the owner's office (the requests queue), CEO, CTO, COO, COMPLIANCE; Finance stays a ledger
  calculation shown here, not an agent.
- **5 Security & Data**: SECURITY, ANALYST. **4 Engineering**: TECH-LEAD, DEVELOPER, REVIEWER, TESTER. **3 Product & Design**:
  PRODUCT-MANAGER, DESIGNER. **2 Sales & Marketing**: LEAD-RESEARCHER, LEAD-CHECKER, OUTREACH-WRITER, CONTENT-WRITER. **1 Customer
  Success**: ONBOARDING-GUIDE, SUPPORT-DRAFTER, RETENTION-ANALYST.
- **G**: lobby, lounge, and the Etsy archive as a trophy room (history, live listings, the read-only Etsy connection; no
  production; the eight Etsy agents archived, not deleted).
- 19 active agents. The CEO ("virtual Mark") recommends only; locked in code, it can never approve, reject or act on a request,
  change the autonomy policy, budgets or caps, or send anything outside the building; the owner is the only approver. The CTO owns
  Engineering and Security & Data, orders the dev queue within the owner-approved roadmap, reviews large specs, may assign approved
  issues (auto), cannot merge or deploy. The COO replaces OVERSEER (retired into it): daily operations report, budget and cap watch,
  routines health, stuck-job triage; may pause a line on a breach (auto), never raise a cap. COMPLIANCE reports to the owner, not
  the CEO; no one but the owner can override its verdict. TECH-LEAD replaces the plan's PRODUCT agent.
- Reporting: Engineering and Security & Data to the CTO; Product & Design, Sales & Marketing and Customer Success to the CEO;
  operations to the COO; every exec and COMPLIANCE to the owner. Every outbound or irreversible action still goes to the owner's
  requests queue.
- Phases: R1 engine core (incl. the locked rules, Etsy archived to G, OVERSEER → COO), R2 Engineering + CTO on ReplyDesk, R3
  penthouse execs, R4 Product & Design, R5 Sales & Marketing (after legal advice, EU and US), R6 Customer Success and ANALYST (once
  there are paying customers), R7 the 3D office (seven floors, 60 fps). Later-phase agents are in config as "not hired yet" and cost
  nothing until their phase.
- Models: Haiku for routine; Sonnet for DEVELOPER, REVIEWER, SECURITY, COMPLIANCE and the execs; Opus only on the owner's choice per
  issue.

### How the plan records it (proposals, nothing built until "go R1")

- Locked rules in code (`RESTRUCTURE.md` §3.2): owner-only decide path, the CEO's fixed tool set, COMPLIANCE's independence, the COO
  pause-only rule, and the forbidden items of the old §9 Q7 (now locked; the owner may strike any, new Q7).
- New actions in the autonomy policy: `issue.assign`, `queue.prioritise`, `line.pause` (auto); `roadmap.approve`, `line.resume`,
  `site.change` (owner); `request.decide.agent`, `policy/cap/budget.change.agent`, `compliance.override.agent` (forbidden, locked).
- The CEO reads reports, roadmaps, Finance and ANALYST's aggregates, never tickets, customer records or named-contact drafts.
- Weekly cost estimates (thinking off; workload stated in §8): R1 USD 0; R2 6.50–10.50; R3 0.70; R4 0.05–0.10; R5 0.90–1.80; R6 0.45;
  R7 0; all running about USD 9–14.

### Noted while planning

- The archived Etsy DESIGNER owns the agent id `designer` (`config/agents/designer.json` and its records), so the new DESIGNER needs
  another id: proposed `ux-designer`, shown as "DESIGNER" (§9 Q8).
- Opus 5.5 has no price in `config/engine.json`, so the guard refuses it today; the owner adds verified prices before any Opus issue.
- The owner's model rule puts TECH-LEAD, PRODUCT-MANAGER, OUTREACH-WRITER and CONTENT-WRITER on Haiku (earlier the plan had them on
  Sonnet); flagged for confirmation (§9 Q8), with the cost of moving the writers to Sonnet in R5.
- Stripe read-only and the product read-only interfaces move from the old R4 to R6 (with ANALYST); each is a GDPR decision recorded
  before it is built.

## R0.3: owner answers (23/10/2026)

Plan only: `RESTRUCTURE.md` updated (§0, §1.4, §2.3, §3.1, §4, §5, §6, §8, §9); no engine or app code changed, dev checkout, no API
call, $0.

### Correction: live already runs B0

R0 and R0.2 said W4 and B0 were not deployed. The owner corrected this, and a read-only check of the live worktree on 23/10/2026
(file reads and `git log` from the dev checkout only; nothing written, the database not opened) confirms it:

- The live worktree (`office-agents-live`, branch `live`) is at **`df1a58d`** (B0; W4 `d342d91` and L3.1 `9122435` below it).
- `data/deploys.jsonl`: deploy `9122435` → `df1a58d` at 21/10/2026 15:09 UTC, `--no-start`, ok.
- `logs/migrate-businesses-2026-10-21.log`: dry run with **0 unmapped**, then **`migrate:businesses` applied** at 15:10 UTC (jobs
  32, runs 47, routines 4, approvals 1, **ledger mirror 509**), backup `data/.backups/businesses-20261021T151049Z`.
- Only the dev data root has not run `migrate:businesses`.

### The owner's answers

| # | Decision |
|---|---|
| Etsy | The winter job is archived as it is. The live listings stay on Etsy. **Owner action, not a Station task**: an unretouched photo of the product on a real screen against a real background, added by hand to each live listing. |
| Deploy | R1 deploys on top of B0 with one migration (`migrate:products`) from post-B0 data; a pre-B0 root is refused with the reason. |
| ReplyDesk outreach | The weekly outreach routine is paused by the owner outside the repo, pending R5. (The repo shows drafts only, nothing sent; the pause is because it collects prospect data without the legal check.) |
| ReplyDesk checks | Add ruff (an R2 issue: `dependency.add` + `ci.change`, merged by the owner); no type check for now. |
| emty-inbox | Synthetic data only; no Stellar or tenant data ever in the Station. |
| Isolation | Docker with `--network none` for every check, needed for R2; the owner installs it. |
| Push | The engine never pushes: `git.push.branch` forbidden; the owner pulls `dev/<job-id>` from the Station's mirror. |
| Locked list | Confirmed as is (RESTRUCTURE.md §3.2), nothing struck. |
| Budgets | ReplyDesk USD 60 a month; engineering job cap USD 3.00. emty-inbox USD 40, station USD 20, the day cap, the other department job caps and the exec run caps stay **proposals**. |
| Thinking | On ("default") for DEVELOPER, REVIEWER and COMPLIANCE; off for every other agent. |
| Models | TECH-LEAD, PRODUCT-MANAGER, OUTREACH-WRITER and CONTENT-WRITER on Sonnet instead of Haiku: about **USD 2 a week, about USD 8 a month** more at the planned workload (TECH-LEAD +0.55, PRODUCT-MANAGER +0.40, OUTREACH-WRITER +0.85, CONTENT-WRITER +0.10 a week). |
| Opus | Prices added only from Anthropic's official pricing page, before any Opus issue. |
| DESIGNER | New id `ux-designer`; the archived Etsy DESIGNER keeps `designer`. |
| Outreach mailbox | A separate outreach mailbox and sending domain, a decision for R5 (set up by the owner before R5). |

### Re-estimated (RESTRUCTURE.md §8; estimates, thinking off unless stated)

R1 USD 0; R2 about 7–11 a week (+1–4.50 thinking); R3 about 0.70; R4 about 0.45–0.55; R5 about 1.85–3.50; R6 about 0.45; R7 0. All
running about USD 10.50–16 a week (about 45–70 a month) plus about 1–5 for thinking.

### Noted

- At the planned workload ReplyDesk's spend can reach its USD 60 month in R2 alone with reworks and thinking (about USD 30–67 a
  month) and passes it with every phase running; the guard would then refuse ReplyDesk work until the month turns. Open for the
  owner (RESTRUCTURE.md §9.2 item 4).
- Still open (§9.2): ReplyDesk's paying users; the autumn package in the old approval queue; the remaining budgets and caps; the
  legal advice, legal name and address, mailbox set-up and retention before R5; names.

## R1: engine core (owner's go, 23/10/2026; built 23/10/2026)

Built in the dev checkout only (`STATION_INSTANCE=dev`, mock provider), $0, no API call, no new dependency. The live worktree, every
`.env` and the network were not touched. Not deployed: the deploy plan is in PROGRESS.md "R1 deploy plan (the owner runs it)".

### Before the build

- **Baseline**: main clean at `97cfafc`; W6 still parked on `w6-wip` (`56adc5f`, not in main). `npm test` on main: **512 passed, 0
  failed**. The two W4 tests that failed in R0 fail only with W6's working tree (`w6-wip`); on main they pass, so nothing needed fixing.
- **Dev data root**: `office-agents\data` (instance dev, stamped dev; not the live checkout). Backed up through the engine's store (the
  lock held, SQLite `VACUUM INTO`) to `data\.backups\dev-pre-r1-20261023T175115Z` (`station.db`, `events/`, `INSTANCE.json`); closing the
  store folded the 168,952-byte -wal into `station.db` (98,304 bytes), so no -wal or -shm remained. Then `npm run migrate:businesses`
  (dry run) and `-- --apply`: jobs 0, runs 0, routines 1 (etsy-shop), approvals 0, ledger mirror 0; the column added to all five tables;
  the events file's 1 row resolves to shared; **0 unmapped**; its own backup `data\.backups\businesses-20261023T175123Z`; a second run:
  nothing to change. `migrate:products` was run on dev as a dry run only (1 routine to etsy-shop/etsy, the 1 event to station/hq, 0
  unmapped); not applied (the R1 prompt asked for migrate:businesses on dev).

### As built

1. **Products x departments** (`src/engine/building.mjs`, which replaces `business.mjs` as the source of truth):
   `config/products/{replydesk,emty-inbox,station,etsy-shop}.json` and `config/departments/{hq,security-data,engineering,product-design,
   sales-marketing,customer-success,etsy}.json` (`_template.json` never loaded). Floors 6 to 1 and G are display order only. The building
   check stops the engine with every reason: a floor used twice, an agent or line in no department or two, a department reporting to
   anyone but the owner, CEO, CTO or COO, an agent status other than active, not-hired or archived, an active agent without its prompt,
   output limit or with a tool not built yet, a product dataDir outside `products/<id>/` (`.` for the archived Etsy layout only),
   `ownerApprovalRequired` false, a day cap above the station's. `config/businesses/` is retired; `config/products.json` (the Etsy product
   specs) moved to `config/archive/etsy/products.json` (read as before, `cfg.products`).
2. **Every record carries product_id and department_id** (jobs, runs, routines, approvals, the ledger mirror; `productId` and
   `departmentId` on new ledger rows and events). One resolver: the record's own, else its job's, line's, agent's (an HQ or not-hired
   agent: station/hq), an own-shop Etsy call's (etsy-shop/etsy), its B0 business's (etsy-shop -> etsy-shop/etsy, shared -> station/hq),
   else station/hq. No record carries a floor. The append-only ledger and events are never rewritten; older rows are resolved on read.
   `business_id` is kept and still filled (B0's view: etsy-shop or shared) so a rollback to B0 reads the data.
3. **19 agents in config, all not hired yet** (`status: "not-hired"`, `phase` R2 to R6, `enabled: false`), with the R0.2/R0.3 models,
   effort and thinking (thinking "default" for DEVELOPER, REVIEWER, COMPLIANCE), the §2.2 tools and limits (`proposals: ["limits"]`), the
   execs and COMPLIANCE `reportsTo: "owner"`; the new DESIGNER is `ux-designer`. The engine refuses to run a not-hired agent before
   anything is recorded or reserved, and the page cannot change it. The eight Etsy agents are `archived`; OVERSEER is `retired`,
   `retiredInto: "coo"`, in department hq (its history stays under agent overseer).
4. **The Etsy archive** (G): every job creation and start on the Etsy lines is refused with "archived" (`engine.lineHold`), their
   routines cannot be armed and skip, the Etsy agents and OVERSEER cannot run. History, packages, the old approval queue, the ledger and
   the own-shop connection (E7a) stay viewable.
5. **The autonomy policy** (`config/autonomy.json`, `src/engine/policy.mjs`): the §3.1 levels; every tool declares its action in code
   (`TOOL_ACTIONS`; a tool with no declared action stops the engine); an action not in the file is forbidden; a product, department or
   agent override may only be stricter. The runtime checks the policy before the guard reserves anything (a run whose tool is forbidden
   for its product is refused at USD 0) and again on every tool call. At every start the engine logs one row per changed action to
   `data/policy/autonomy-log.jsonl` (time, action, old -> new, sha256, commit, instance; the first start records every action once).
6. **The locked rules in code** (`src/engine/locked.mjs`): checked when the config loads (a config that loosens one stops the engine,
   naming the rule and the file) and on every action (`assertActor`, `src/engine/actions.mjs`). See "R1: the locked rules and their
   tests" below.
7. **The spend guard per product and department** (`guard.mjs`, `spend.mjs`): `productMonth[<id>]` (monthly budget), `productDay[<id>]`
   (day cap, when set), `perJob[<department>@<product>]` (the product's job cap for that department), `perRun[<agent>]` (an agent's
   `limits.runCapUsd`), with every station cap; the lowest limit wins. B0's business-level checks are replaced by the product level. The
   spend dialog shows the product line (department, floor, this month against the budget, "proposal" when it is one).
8. **Opus stays refused**: an Anthropic price counts only when it cites `https://platform.claude.com/docs/en/about-claude/pricing` with
   who verified it (`guard.mjs` `OFFICIAL_PRICING`); Claude Opus 5.5 has no price, so every Opus call is refused before it is made.
   No price was added.
9. **The Owner's office** (`src/engine/requests.mjs`, the `requests` table): an owner-level action files a request (product,
   department, job, action, summary, the payload's sha256 with the payload in `data/requests/<id>/payload.txt`, COMPLIANCE's verdict where
   required, SECURITY's) and the job waits; only the owner's page session decides one (`POST /api/requests/decide`: same origin, the
   per-launch token, JSON, an idempotency key, the owner's words, the version); each decision goes to the row,
   `data/requests/decisions.jsonl` (fsync), the log and the event stream. An approved request runs its action once; a payload changed
   after approval voids it and a new request is filed. The old `approvals` table stays for the Etsy history.
10. **Lines**: the COO (once hired) or the owner pauses a line with the reason; nothing starts on it and its routines skip; only the
    owner resumes it (`POST /api/lines/resume`, with words).
11. **`npm run migrate:products`** (`scripts/migrate-products.mjs`, `src/engine/lib/migrate-products.mjs`): dry run by default; `--apply`
    takes a full backup first (`data/.backups/products-<stamp>/`), then in one transaction adds the two columns, creates the requests
    table and sets every value; logs every change to `logs/migrate-products-<date>.log`; refuses while anything is unmapped, while an
    engine holds the lock, and on a pre-B0 root ("run npm run migrate:businesses first"); idempotent (a second run changes nothing, no
    backup); safe to restart (an error or a killed process mid-transaction leaves nothing half-written; a rerun completes). The engine
    refuses an unmigrated root (MIGRATE, with the command). The dry run writes nothing (the store creates the requests table only once
    the columns exist).
12. **Snapshot and page**: `snapshot.company` (the floors top to bottom with each agent's status, the products, the Owner's office:
    requests, decisions, the policy and its log, paused lines) and `spend.byProduct` (Finance; MRR "not connected"). The whole-building
    view (`G`) shows the penthouse: the requests with Approve and Reject (your words required), Finance, the policy, the seven floors.
    The 3D office keeps B0's two drawn floors until R7; a not-hired agent is not drawn (no desk yet).
13. **The COO's daily report routine** is seeded disabled (`rt_seed_coo-daily-report`, target `agent:coo`); it skips while the COO is
    not hired and cannot be armed before R3.

### R1: the locked rules and their tests

Each has a config test (the engine refuses to start, naming the rule and the file) and a runtime test (`tests/r1-locked.test.mjs`).

| Locked rule | Refused in config | Refused at runtime |
|---|---|---|
| owner-only-approver | `request.decide.agent` loosened or missing; a product override of it | an agent, the engine, a caller without the page session, a script run, a page request without the token or from another origin; only the page decides; the decision log is written |
| ceo-recommends-only | an extra CEO tool, a folder outside `products/station/memos`, writes outside it, another reporting line, `policy.change.agent` loosened, a hired CEO with a fourth tool | deciding, filing a request, changing policy, a budget or a cap, sending, merging, deploying, pricing, posting, pausing, assigning; a run outside its memos folder; a not-hired CEO cannot run |
| coo-pause-only | an extra COO tool, another folder, `cap.change.agent` or `budget.change.agent` loosened (file or product) | a hired COO pauses a line and nothing starts on it; it cannot resume it or change a cap, budget or the policy; caps and budgets unchanged; only the owner's page resumes; a not-hired COO cannot pause |
| compliance-independent | COMPLIANCE `reportsTo` not the owner; COMPLIANCE in a department under the CEO; `compliance.override.agent` loosened | an outbound draft with a revise, a refuse, no verdict or a "pass" from anyone but COMPLIANCE never becomes a request, whoever files it (the CEO included); no caller can override it |
| no-merge-deploy-push | `git.push.branch` owner or auto, `git.merge.agent` loosened, `deploy.agent` missing, a product override, a tool named `git_push` or `deploy_site` | push, agent merge and agent deploy refused for every caller, the owner included; no built tool is named for them |
| secrets-refused | `secrets.read` loosened (file or a department override) | `.env*`, `*.db` (and -wal/-shm), `.venv/`, `*.pem`, `*.key`, `id_*`, `.npmrc`, `credentials*`, `secrets/`, `.git/` refused on read and write; a file with a key is withheld (the key never reaches the agent or the log); a write holding a key, private key or password connection string is not written; an agent reading `.env` in a run ends it refused and its job blocks |
| legal-forbidden | `personal-data.scrape`, `review.fake`, `account.fake`, `claim.misleading`, `email.send.agent` loosened (file, product or agent override); a tool named for scraping | each refused for every caller; no tool can be named for scraping, reviews, accounts or sending |
| outbound-needs-owner | any of the 12 outbound actions at auto, in the file or a product override | a merge files a request and the job waits (nothing runs); approved, it runs once; a payload changed after approval is voided, refused and filed again; a rejected one never runs |
| owner-never-lowered | an owner action lowered to auto by a product, department or agent override; `ownerApprovalRequired` false | (a stricter override is accepted: tested) |

### Measured

- **Tests**: npm test **552 passed, 0 failed** (512 before R1; new: `r1-locked` 21/21, `r1-company` 13/13, `r1-migrate` 6/6; changed: `b0` for
  the derived business view and the product-level guard, `engine-line`, `e6-c0`, `live-web`, `people-looks`, `import-legacy`,
  `demo`, `write-guard` and `engine-server` for the R1 config, and every test that runs the Etsy line now opens the archive sandbox).
  `npm run dry-run` and `npm run dry-run:scout` pass (mock, $0).
- **migrate:products on the live-shaped fixture** (32 jobs, 47 runs, 4 routines, 1 approval, 509 ledger rows, 1,148 events in 6 files):
  the dry run sets jobs 32, runs 47, routines 4 and the approval to etsy-shop/etsy, the ledger mirror 508 to etsy-shop/etsy and 1 (the
  station-level smoke call) to station/hq; the ledger file resolves 508/1 and the events 1,050 to etsy-shop/etsy and 98 to station/hq;
  **0 unmapped**; nothing written. Apply: one backup, 593 values and 10 columns in one transaction, every change logged; the ledger and
  events byte for byte unchanged. A second run: nothing to change, no backup. An error after 300 of 593 updates, and a process killed
  after 400: nothing visible, the rerun completes. The engine then starts (and seeds the COO report routine, disabled).

### Choices made in the build (for the owner to confirm or change)

1. **Two items locked beyond RESTRUCTURE.md §3.2**, as the R1 prompt lists them: `git.push.branch` (§3.1 had it forbidden but not
   locked), and "anything leaving the building needs owner approval" (outbound actions can be owner or forbidden, never auto; §3.1 let
   the owner change those levels in the file). Changing either is now a code change.
2. **Five action names added** to the policy, at auto, because existing tools need a declared action: `file.read` (fs_read, fs_list),
   `image.generate`, `image.analyze` (archived Etsy line only), `verdict.submit` (submit_verdict), and `code.search` (the planned
   code_search). `report_blocked` maps to `report.write`.
3. **The archive sandbox** (`archiveSandbox`, mock provider only): the dry runs, the demo, the capture scripts and the existing Etsy
   regression tests run the archived line in it; `line:live`, `scout:live` and the owner CLI's run modes are refused with "archived".
4. **Data jail per product**: a run is jailed to its product's data (`products/<id>/`; the Etsy archive keeps today's layout minus
   `businesses/` and `products/`). B0's view stays for the 3D page and `business_id`.
5. **Not set, so not invented**: the HQ department's job cap (the station's USD 7.00 applies; the exec run caps are lower), each
   not-hired agent's `maxOutputTokens` and write paths (set when it is hired), emty-inbox's engineering job cap (3.00, copied from ReplyDesk
   and marked a proposal), and the COO report's hour (08:00 Dublin, marked a proposal).
6. **A department job cap above the station's** is accepted (the lowest wins in the guard); a day cap above the station's is refused,
   as in B0.
7. **An approved request does not restart its job** in R1 (no new line exists yet); the job's reason records the decision and R2's lines
   continue from it.
8. **A secret path read ends the run** (secrets.read is forbidden: the job blocks with the rule); secret content found in a file is
   withheld with a note and the run goes on; a write holding a secret is refused back to the agent.

### Open points for the owner

- The R1 choices above, in particular the two extra locked items (1).
- Still open from RESTRUCTURE.md §9.2: ReplyDesk's paying users; the autumn package in the old approval queue (its Approve/Reject still
  work on the page: they record a decision on Etsy history and send nothing); the remaining budgets and caps (emty-inbox 40, station 20,
  the department job caps, the exec run caps, the day cap); the legal and mailbox items before R5; names.
- The dev data root is post-B0 but not yet migrated to products: the dev Station refuses to start until `npm run migrate:products --
  --apply` runs on dev (dry run: 0 unmapped).
- RESTRUCTURE.md §8 R1 also lists a dry run on a scratch copy of live data; it was not done (the R1 prompt: do not touch the live
  worktree). The live dry run is step 4 of the deploy plan, and the fixture test reproduces live's shape.

## R1.1: owner confirmations, routine check (24/10/2026)

The owner's R1 follow-up (24/10/2026). Dev only, mock only, $0; the live worktree, every `.env` and the network untouched.

### Owner decisions

1. **Confirmed by the owner (24/10/2026): `git.push.branch` is locked in code.** It is forbidden for every caller, the owner included,
   and no config can change it (`src/engine/locked.mjs`, rule no-merge-deploy-push). This was R1 choice 1, first part.
2. **Confirmed by the owner (24/10/2026): outbound actions are locked to "owner" or "forbidden", never "auto".** Anything leaving the
   building waits for the owner's decision in the Owner's office, or is refused; a `config/autonomy.json` or product override that sets
   one to auto stops the engine. This was R1 choice 1, second part. Changing either is a code change.

### Proposal (not decided)

- **HQ job cap USD 0.50 per job (proposal, owner, 24/10/2026)**: one HQ exec run (the CEO's memo, the COO's report) is one job on HQ
  (product `station`, department `hq`). It replaces the station's USD 7.00 job cap as the fallback for HQ jobs. In
  `config/products/station.json` as `jobCapUsdByDepartment.hq` 0.5, listed in `proposals`. The guard applies it now (a proposal may
  only lower a cap; the lowest limit wins), and the agents' own run caps, also proposals, stay lower where they are: COO 0.20, CTO 0.30,
  COMPLIANCE 0.10; the CEO's is 0.50. No exec is hired in R1, so nothing runs under it yet. It replaces R1 choice 5's "the HQ
  department's job cap (the station's USD 7.00 applies)".

### Routine check: archived-line routines after `migrate:products`

- **The fixture now has live's routines** (`tests/helpers/post-b0-fixture.mjs`, still 4 routines; live's
  `logs/migrate-businesses-2026-10-21.log` lists the weekly genre scout, 2 legacy routines and one made on the page). The fixture's
  page-made routine is "Weekday research" (`line:research`, weekdays 09:00, USD 0.50 per run), **enabled** as the worst case: live's
  state was not read (the live worktree is not touched). Before, the fixture had 3 legacy routines and no page-made one.
- **Result** (`tests/r1-routines.test.mjs`: the fixture migrated, the engine started with the scheduler on, every routine fired once
  at 09:00 Dublin on a weekday):

  | Routine | Target | Product/department | Enabled | Armed | Firing |
  |---|---|---|---|---|---|
  | COO daily operations report (seeded at the first R1 start) | agent:coo | station/hq | no | no | skipped: routine is disabled |
  | Weekday research | line:research | etsy-shop/etsy | **yes** | **yes** | skipped: archived: the research line is in the Etsy archive |
  | Weekly genre scout | line:genre-scout | etsy-shop/etsy | no | no | skipped: routine is disabled |
  | 2 legacy routines | legacy:agent:… | etsy-shop/etsy | no | no | skipped: routine is disabled |

  Jobs 32 before and after, ledger rows 509 before and after, no reservation. **No routine on the archived Etsy lines can start a job
  or spend.** With every Etsy routine enabled (the worst case beyond live), all 4 are armed and none starts a job or spends: the line
  routines skip with "archived" and the legacy routines fail with "routine target not supported" (no runner), before any job.
- **What "cannot be armed" means after R1**: no Etsy routine can be *enabled* (the enable is refused with "archived"). A routine that
  was already enabled before R1 stays enabled after the migration (`migrate:products` changes no routine's state), so the scheduler
  arms it and each firing is skipped with "archived" (a `routine.skip` event and its last status; no job, no spend). The owner can
  disable it on the page (floor 1, the calendar, Disable); the deploy plan's verify step now checks this through the API
  (PROGRESS.md "R1 deploy plan", step 7).
- **Open for the owner**: whether the engine should also stop arming an enabled routine on an archived line at start (it would then
  never fire). Today it fires and skips, at $0. Not changed in R1.1.

### Dev data root

- `npm run migrate:products` on `office-agents\data` (instance dev), 24/10/2026: the dry run set routines 1 (the weekly genre scout)
  to etsy-shop/etsy, and jobs, runs, approvals and the ledger mirror 0 (no rows); every table's columns missing; the event log's 1 row
  resolves to station/hq; **0 unmapped**. `--apply`: backup `data\.backups\products-20261024T054652Z`, 10 columns added, 1 value set.
  A second run: "nothing to change". The dev Station then started on port 8792 (seeded the COO report routine, disabled; recorded the
  55 policy actions).

### Measured

- npm test **554 passed, 0 failed** (552 after R1; new: `r1-routines` 2/2; changed: `r1-company` for the HQ proposal, the post-B0
  fixture's routines).

## R2a: engineering workshop (26/10/2026)

The workshop the engineering line builds on: the Station's own copy of a product's code, a worktree per job, and the Docker check runner.
No agent, no model, no page or owner command. Dev only, mock only, $0; the live worktree, every `.env` and the network untouched.

### What it is

- `src/engine/lib/proc.mjs`: the one runner for git and docker (execFile, no shell, minimal environment, a timeout and the e-stop kill
  it, output capped at 200 KB). `tests/write-guard.test.mjs` allows it as the second module that starts a process (the pinned
  upscaler is the first), with its own checks: one call site, `shell: false`, hidden, killable, git and docker only.
- `src/engine/lib/repo.mjs`: the mirror `data/products/<id>/repo.git`, fetched from the owner's local clone (`REPLYDESK_REPO`), **only**
  the clone's `origin/main`, as `main` (no `outreach/*` branch, no tag; the clone is only read); a worktree per job on `dev/<job-id>`
  and no other ref; the staged diff; the commit with hooks off and the Station as author; git subcommands on an allowlist without
  push, remote or config. The engine never pushes.
- `src/engine/lib/checks.mjs`: a product check (its fixed argv from `config/products/<id>.json runChecks`) in Docker with
  `--network none`, the worktree mounted read-only and no other host path, a read-only root, no capabilities, no Station environment;
  no Docker or no image refuses (no fallback on the host); a timeout or the e-stop kills the container by name. The image
  `station-check-<product>:<sha>` is built from the product's requirements at `main`, on the owner's command only.
- `config/products/replydesk.json`: `repoSource.ref` (`refs/remotes/origin/main`) and `checkImage` (`python:3.12-slim`,
  `requirements.txt`).

### Owner instruction (26/10/2026): a hard timeout on every git process

- Every git process the engine starts goes through `lib/repo.mjs` `git()` and has a hard timeout; on it the process is killed and
  `GitTimeout` ("git timeout: git <subcommand> did not finish in N s and was killed") is thrown. The engineering line (R2b) blocks the
  job with it and logs it.
- **stdin is now closed** for every git and docker process as it starts. Before, `lib/proc.mjs` left it open, so a git that read stdin
  waited until its timeout (measured: `git hash-object --stdin` sat until the 3 s test timeout; now it returns at once).
- **The 25/10/2026 hang**: in the first run of the R2 tests, the fetch into the mirror (the only git call with a 300 s timeout) hung
  and was killed after 300 s. It did not happen again in 145 tries (25 alone, 120 in three loops at once, with the test suite running)
  or in the later test runs. Its log was in a temp folder the test removed, so **its cause is not proven**; the open stdin is one way a
  git process can sit until its timeout, and it is closed now.

### Proposals (not decided)

- Timeouts: **120 s** for a git call and **300 s** for the fetch from the owner's clone (`GIT_TIMEOUT_MS`, `GIT_FETCH_TIMEOUT_MS`), and
  300 s for a check (`runtime.checkTimeoutMs` default). A local fetch should take well under a minute; 60 s for it is an option.
- Container limits: 256 processes, 2 GB memory, 2 CPUs, 512 MB `/tmp`; output kept up to 200 KB.

### Not done

- **The check image is not built and was not pulled.** Docker is running (Desktop 4.94.0, engine 29.8.2); no `station-check-*` or
  `python` image is on the machine. The build reads `requirements.txt` at `main` and runs `pip install` (network) once, so it waits for
  the owner's approval. There is no `npm run check-image` script yet (the build function is `lib/checks.mjs` `buildImage`).
- No mirror exists on the dev data root (`data/products/replydesk/` does not exist); `REPLYDESK_REPO` is not set in this checkout.

### Measured

- `tests/r2a-workshop.test.mjs` 6/6, on a real git with a fixture clone and a fake Docker: the runner and stdin; a git that really hangs
  (a pipe that never answers) killed at its timeout, `GitTimeout`; every git call through `git()` with the timeout; the mirror takes
  `origin/main` only and never writes to the clone; the worktree, diff, commit and branch; the check runner's Docker arguments and
  refusals.
- On `53e7eb9` with only the R2a files added (a separate checkout): the suite passed except tests that need the git-ignored fixtures
  (`fixtures/SNAPSHOT.json`, `fixtures/station-root/`, `fixtures/synthetic/`); with those copied in, 561 tests, 557 and then 559 passed:
  the failures were timing tests in `tests/live-ui.test.mjs` and a restart-recovery test under load, a different set each run, none of
  them loading an R2a module; `live-ui` alone passed 9/9.

## R2b: the engineering line and its agents (built 25/10/2026, recorded 26/10/2026)

The engineering line on R2a's workshop: issues, the CTO's triage, and a job per issue (spec, code, checks, three reviews, the commit on
`dev/<job-id>`, a `git.merge` request for the owner). Dev only, mock only, $0; the live worktree, every `.env` and the network untouched.

**Built ahead of its prompt.** The code was written on 25/10/2026 (09:08–09:23) in an earlier session, before R2 was split; the R2a
prompt asked for the workshop with no agents. The agent configs say "owner's go, 25/10/2026"; that go is not recorded anywhere else.
It is committed separately so the owner can accept it or ask for it to be reverted.

### What it is

- `src/engine/engineering.mjs`: the line (issues, triage, steps, loops, the merge request, the owner's controls, the page's view and card).
- `src/engine/lib/eng-records.mjs` (issues and their decisions, the CTO's dev queue, the spec check, the engineering verdicts) and
  `src/engine/lib/eng-gates.mjs` (the secret gate on the diff; dependency and workflow files become `dependency.add` / `ci.change`).
- `config/lines/engineering.json`, `config/lines/eng-triage.json`; `config/departments/engineering.json` (the two lines).
- **Six agents hired**: CTO, SECURITY, TECH-LEAD, DEVELOPER, REVIEWER, TESTER (`status: active`, `enabled: true`, `maxOutputTokens` set,
  write paths), with prompts in `prompts/agents/` and `prompts/skills/engineering-rules.md`. The other 13 stay not hired.
- Tools: `fs_edit`, `code_search`, `run_check` (counted against `maxChecks`), `fs_read` by lines, `submit_verdict` for the engineering
  kinds; each call names its policy action (`code.edit`, `spec.write`, `queue.prioritise`, `code.review`, `security.audit`).
- Engine wiring: the orchestrator hands engineering jobs over and counts them in the running-jobs limit; actions, spend (quotes
  `eng-triage`, `eng-start`), the building (a line may borrow another active department's agent by name), the runtime wrapper,
  the snapshot (hired agents without a drawn floor get no desk until R7).
- `src/engine/bus.mjs` and `src/web/main.js`: the events `issue.written`, `issue.decided`, `eng.checks` (added 26/10/2026: without
  them writing an issue threw "unknown event type").
- `config/autonomy.json`: `repo.fetch` and `repo.worktree` added at **auto**.
- A git timeout in a job: the job blocks with "git timeout in <step>: git <subcommand> did not finish in N s and was killed", logged as
  "git timeout" (26/10/2026). After the merge request is filed, a timeout removing the worktree is logged and the job still waits for
  the owner (the commit and the request are already made).

### For the owner to confirm or change

1. **Accept R2b as built, or revert it** (it went past the R2a prompt).
2. **Hiring the six engineering agents** (status active, enabled) and their `maxOutputTokens` (proposals: CTO 4,000, SECURITY 6,000,
   TECH-LEAD 8,000, DEVELOPER 16,000, REVIEWER 12,000, TESTER 3,000).
3. **`config/autonomy.json`**: `repo.fetch` and `repo.worktree` at auto. The file is the owner's; this was changed by the build.
4. The CTO's queue is `backlog/dev-queue.json` (RESTRUCTURE.md §2.2 says `dev-queue.md`): JSON so it can be checked when written.

### Not done

- **Nothing drives it from the page or the command line yet**: no server endpoint or owner command writes an issue, starts the triage
  or a job, or builds the check image. The engine functions and the spend quotes exist.
- No real run: the check image is not built (R2a), `REPLYDESK_REPO` is not set, no model was called.

### Tests changed for R2b (existing files)

- `tests/r1-company.test.mjs`: the six are hired (status, enabled, the HQ label "active"); the not-hired checks run over the other 13;
  the "cannot be hired without its tools" check now uses the COO (`line_pause`, R3), since `code_search` and `run_check` are built;
  the policy counts auto 23 → 25 (`repo.fetch`, `repo.worktree`).
- `tests/b0.test.mjs`, `tests/l2-steer.test.mjs`, `tests/l3.test.mjs`: the two engineering lines in the line lists.
- `tests/people-looks.test.mjs`: hired agents without a drawn floor have no shirt to check.
- No locked-rule or secrets test changed (`tests/r1-locked.test.mjs`, `src/engine/locked.mjs`, `src/engine/lib/secrets.mjs` unchanged).

### Measured

- `tests/r2b-engineering.test.mjs` 15/15: issues are the owner's; the CTO cannot queue an unapproved issue; start conditions; the
  whole line to the merge request with the owner's clone untouched; the tools; the rework limit; the CTO's review of a large spec; a
  SECURITY refuse; a dependency change; a worktree changed after review; no Docker; an agent reading `repo/.git` (refused by the
  locked rule secrets-refused, R1); the line's records; the building; a git that hangs inside a job (blocked "git timeout").
- Full suite with R2a and R2b, 26/10/2026: two runs 576 passed of 576 (0 skipped, about 120 s each); two later runs on the same code
  573 and 571 of 576 (0 skipped, about 490–540 s each, the machine 4–5 times slower throughout): the failures were timing tests
  (`live-ui`, the dry-run controls, a restart recovery) that load no R2 module, a different set each run.

## R2a.1: real sandbox proof and test cleanup (26/10/2026)

Dev only, mock only, $0, no model call; the live worktree and every `.env` untouched. Committed on main as "R2a.1: real sandbox
proof, test cleanup, check image" (26/10/2026); not deployed.

### Owner decisions (26/10/2026)

1. **R2b is accepted** (not deployed). This settles R2b's owner point 1.
2. **The six R2 agents are confirmed**: DEVELOPER and REVIEWER on Sonnet with thinking on; TECH-LEAD on Sonnet; the others as R0.3
   recorded (CTO and SECURITY on Sonnet, thinking off; TESTER on Haiku, effort low, thinking off). This settles R2b's owner point 2.
   The configs already say this (`tier` strong = Sonnet, cheap = Haiku; DEVELOPER and REVIEWER `thinking: "default"`, the others
   `"off"`), so nothing changed in `config/agents/`. The `maxOutputTokens` figures stay proposals.

3. **`repo.fetch` and `repo.worktree` stay `auto`** in `config/autonomy.json` (R2b point 3; the owner, R2a.1 item 9). Both are the
   engine's own worktree step: `repo.fetch` fetches the owner's clone's `origin/main` into the Station's mirror, `repo.worktree` adds or
   removes a `dev/<job-id>` worktree; no agent tool maps to either and neither is outbound. Unchanged.

The check image: below (pinned and built on the owner's go).

### Temp folders

- **Found**: 1,296 folders left by the test suite in `%TEMP%` (45 prefixes, 139.7 MB, dated 21–26/10/2026), about one per suite run
  from the same tests every time. Largest: `station-fixtools-` 276 (33.8 MB), `og-` 190, `station-demo-` 123 (27.4 MB),
  `station-import-` 81, `station-l3maint-` and `station-l3own-` 46 each; the rest 1 to 41. All deleted (1,296 of 1,296). Not touched:
  5 `station-b0-engine-` folders (`scripts/screenshots-b0.mjs`, not the suite) and everything else in `%TEMP%`.
- **Why they were left**: `node:test` runs a test's after hooks in the order they are added; many tests add the folder's cleanup
  before the engine's close, so the folder was removed while the engine still held its SQLite files, and the cleanup (made never to
  throw) failed silently. One more: an engine whose start failed part way (`createEngine` throwing after it opened the store) never
  closed the store, so its folder could not be removed at all until the process ended.
- **Now**:
  - every test temp folder comes from `tests/helpers/engine.mjs` `tempDir` (or `tempRoot`, which uses it): removed by the test's
    cleanup, and whatever is still there when the test file's process exits is removed then, after every after hook, pass or fail. The
    18 raw `mkdtempSync` calls in the tests use it now.
  - `createEngine` closes what it opened (the store, the e-stop watcher) when its start fails (`src/engine/engine.mjs`); a test
    checks the folder of a refused start can be removed at once (fails without the fix).
  - `tests/helpers/temp-guard.mjs`: `npm test` and `npm run test:record` run with it (`--test-global-setup`). The run gets its own
    temp folder (`station-tests-…`) as TEMP for every test process; after the last test it must be empty and no `.tmp-from-*` may be in
    the repo, or the run fails (exit 1) with the folders listed (and removed). `tests/temp-guard.test.mjs` proves both ways.
- **Measured**: two runs of `npm test`, 578 of 578 passed, 0 failed, 0 skipped, 97 s and 96 s, exit 0, the temp check clean; with
  `check-image` and its test added, two more: 579 of 579, 96 s each, exit 0, the temp check clean. The
  4–5 times slower runs of earlier today (490–540 s, timing tests failing) did not recur; they stopped once the 1,296 folders were
  gone, which suggests them as the cause but does not prove it.

### The check image (proposal, for the owner)

- **ReplyDesk's Python**: 3.12, from its repo at `origin/main` (`d03a9ab`): `.github/workflows/ci.yml` (`python-version: "3.12"`, both
  jobs) and `render.yaml` (`PYTHON_VERSION: "3.12"`, production). No `.python-version`, `runtime.txt` or `pyproject.toml`.
- **Proposed base**: the official `python:3.12-slim`, pinned by digest:
  `python:3.12-slim@sha256:a0f57064cbdcd6285fa45f51237ab0b35ea8ebaed06a1f5973e89e19dfb86704` (the multi-platform index; Python
  3.12.15 on Debian trixie-slim, built 21/10/2026; its linux/amd64 image is
  `sha256:e8a38829209aea82774882e5157e1f7c3e8c8393ff53a697b3580896e57f345c`). Read from Docker Hub with
  `docker buildx imagetools inspect`; nothing pulled.
- **Requirements**: `requirements.txt` at the root, at `origin/main`: sha256
  `1c91e5fcdbc870b2c36b8383bfaf5952ec12e790a3148e1cd98e9a7537391580`, 450 bytes, LF line endings (git blob `9387c2f9`).
  Version ranges, no lockfile: the build records `pip freeze` beside the image.
- **`npm run check-image -- <product>`** (`scripts/check-image.mjs`): the plan by default (the base, the requirements path, sha256
  and size at main, the Dockerfile, the tag, whether Docker answers and the image exists; it fetches the Station's mirror, nothing
  pulled or built). `--apply` builds (docker pulls the base, pip downloads the requirements: the network, once), refused unless
  `checkImage.base` is pinned by digest. `config/products/replydesk.json` is unchanged (`python:3.12-slim`, not pinned), so `--apply`
  refuses today. Tested on the fixture clone with a fake Docker (`tests/r2a-workshop.test.mjs` 7).

### Owner decision (26/10/2026): pin and build, with a lock

- **Pinned**: `config/products/replydesk.json` `checkImage.base` is
  `python:3.12-slim@sha256:a0f57064cbdcd6285fa45f51237ab0b35ea8ebaed06a1f5973e89e19dfb86704`.
- **`REPLYDESK_REPO` on the command line only** (owner's condition 1): `check-image` no longer reads `.env` at all; nothing was written
  to any `.env`.
- **Requirements pinning** (owner's condition 2, asked before the build): **no line of ReplyDesk's `requirements.txt` is pinned with
  `==`**. All nine are ranges with an upper bound below the next major version (flask, anthropic, python-dotenv, requests,
  APScheduler, stripe, psycopg[binary], gunicorn, pytest), so what pip installs depends on the day of the build.
- **Built** 26/10/2026 11:32 UTC: `station-check-replydesk:fc3eeeed826a3b0a`, image
  `sha256:1971201a3bf0eb190eca59cb14e6789cc028f45c30d7d45b1300fdb0661da6e2`, 310.6 MB, Python 3.12.15, from `requirements.txt`
  sha256 `1c91e5fc…1580` at `d03a9ab`. The build record is `data/products/replydesk/check-image/fc3eeeed826a3b0a/` (Dockerfile,
  requirements.txt, freeze.txt, image.json). The mirror `data/products/replydesk/repo.git` now exists on the dev data root (main at
  `d03a9ab` only). The dev engine logged the two R2 autonomy actions at this first R2 start (`data/policy/autonomy-log.jsonl`) and
  replaced a stale engine lock left by a dead process.
- **The lock**: the image's `pip freeze` (38 packages) is `config/products/replydesk.lock.txt`, sha256
  `dde217f94f94e3cdf17054430c653a0f76c2236ebaa8b188b8ed6ca91c7eb539`, recorded in `checkImage.lock`. `check-image` checks the file
  against that sha256 (plan and build) and, after a build, compares the image's freeze with it: a package added, removed or at another
  version prints a WARNING naming each (it does not refuse; the checks would run on the new versions). The script never writes the lock;
  changing it is the owner's, in a commit. A second `--apply` found the image built and the freeze the same as the lock (no warning).
- **Measured**: `tests/r2a-workshop.test.mjs` 8/8 (test 8: the comparison, the sha256 check, the warnings, no `.env` read, no lock
  written); `npm test` twice: 580 of 580, 0 skipped, 104 s and 102 s, exit 0, the temp check clean.

### Owner decisions (26/10/2026): the sandbox gaps and `.env.example`

Found while writing the real-Docker proofs (item 6), decided by the owner the same day:

1. **The container runs as a non-root user**: `docker run --user 65534:65534` (nobody:nogroup in the Debian image) in
   `src/engine/lib/checks.mjs`, so the image and its lock are unchanged (no rebuild). Before: root (uid 0).
2. **A check that timed out blocks the job** with the reason (`check "test" timed out after N s and was killed (its container
   stopped); the log is checks/pass-N/test.log. Resume to run the checks again, or archive the job`), in `src/engine/engineering.mjs`.
   Before: the timed-out check was recorded as a failed result and the job went on (to the diff step, then TESTER). The checks after a
   timed-out one in the same pass are not run.
3. **A worktree holding a secret file is refused before Docker starts** (`CheckRefusal` code `SECRETS`; not one docker call, nothing
   mounted): any file or folder `lib/secrets.mjs` names by path (`.env`, `.env.*`, `*.db` and the other database files, keys and
   certificate stores, `.venv/`, `.npmrc`/`.pypirc`/`.netrc`, `credentials*`, `secrets/`, a `.git` folder), anywhere in the worktree.
   Not a secret: the worktree's own `.git` file at its root (its link to the mirror). In a job the checks step blocks with the reason;
   in DEVELOPER's `run_check` the run ends refused (as with no Docker), so the job blocks.
4. **`.env.example` is the one exception**, by that exact name (ReplyDesk tracks one at `main`: 31 setting names, blank or placeholder
   values). It is mounted only after R1's secret content scan (`secretContentHits`) passes on it, on every check; a hit refuses the
   check naming the file and the kind (e.g. `.env.example holds Stripe key`), never the value. A connection string with a password to
   `localhost`, `127.0.0.1` or `[::1]` is allowed (ReplyDesk's is the commented stock default, user and password `postgres` on
   localhost); one to any other host is refused. Every other `.env.*` (`.env.local`, `.env.production`, ...) stays refused.
5. **A Render API key pattern** (`rnd_` and 20 or more letters and digits) is added to R1's content scan (`src/engine/lib/secrets.mjs`),
   as the owner listed Render with Stripe, Google, Anthropic, OpenAI, GitHub and private keys. It is stricter everywhere the scan runs
   (the agents' file tools, issues, the commit gate), not only for `.env.example`.

### Real-Docker proof: `npm run test:docker`

`tests/docker/sandbox.docker.mjs`, run by `npm run test:docker` (with the temp check) and never by `npm test` (its name matches none of
`node --test`'s default patterns; `tests/temp-guard.test.mjs` checks this). It uses the built image
`station-check-replydesk:fc3eeeed826a3b0a` and the engine's own runner; nothing pulled or built, no model call; a missing Docker or image
fails the run. Docker 29.8.2 (Docker Desktop, WSL 2). Each proof runs its own container:

| # | Proof | How | Before the fixes | After |
|---|---|---|---|---|
| 1 | an outbound network attempt fails | inside: only `lo`; connect to 1.1.1.1:53 and 8.8.8.8:443 `errno 101 Network is unreachable`; DNS fails; inspect `NetworkMode none` | pass | pass |
| 2 | the root filesystem is read-only | inside: writes to `/var/tmp`, `/usr/local`, `/etc` and `/work` fail `Read-only file system`, `/tmp` is written; inspect `ReadonlyRootfs`, tmpfs `/tmp` only | pass | pass |
| 3 | it runs as a non-root user | inside: uid, euid and gid 65534; inspect `Config.User 65534:65534` | **fail** (uid 0) | pass |
| 4 | the hard timeout kills a hanging test in a job | a job on a fixture clone with ReplyDesk's requirements (so the job picks the built image) and a test that sleeps an hour; timeout 8 s: the container ran, `docker kill` by its name, the container is gone (`docker ps -a`), the job `blocked` at `checks` with the timeout reason, `pass-1.json` `timedOut` | **fail** (the job went on and blocked at `diff`: "DEVELOPER made no change") | pass (10.6 s) |
| 5 | a worktree with `.env`, `.env.*` or `*.db` is refused before docker starts | `.env`, `config/.env.local`, `instance/app.db`, `reviews.sqlite3`: `SECRETS`, the file and kind named, not one docker call | **fail** (the container ran) | pass |
| 5b | a clean `.env.example` passes | the stock commented localhost default: the check runs, the file is visible in `/work` | pass | pass |
| 5c | a planted fake `sk_live_` key in `.env.example` is refused | `SECRETS`, ".env.example holds Stripe key", the value nowhere in the message; not one docker call | **fail** (the container ran) | pass |
| 6 | no host environment variable reaches the container | a random canary set on the host is absent inside (name and value); every variable inside is the image's own, the five the runner sets, or `HOSTNAME` | pass | pass |
| 7 | only the job's worktree is mounted | inspect: one mount, `bind`, `/work`, read-only, the worktree; inside, the mount points besides `/proc`, `/sys`, `/dev` are `/`, `/tmp`, `/work` and Docker's own `/etc/hostname`, `/etc/hosts`, `/etc/resolv.conf` for this container; `/work` holds the worktree's files only; no Docker socket, `/mnt` empty, no host drive | pass | pass |
| 8 | the CPU, memory and pids limits are applied | inspect `NanoCpus` 2e9, `Memory` 2 GiB, `PidsLimit` 256, `CapDrop ALL`, `no-new-privileges`; inside, cgroup `cpu.max` `200000 100000`, `memory.max` 2147483648, `pids.max` 256 | pass | pass |

Before the fixes: 6 passed, 4 failed (3, 4, 5, 5c), 39 s. After: 10 of 10, 37 s.

### ReplyDesk smoke (item 7)

ReplyDesk's own pytest, unchanged, in the real sandbox: a worktree of the dev Station's mirror on a new branch `dev/r2a-smoke` at
`main` = `d03a9ab` (clean, no change), the product's check (`python -m pytest -q`), the image `station-check-replydesk:fc3eeeed826a3b0a`
(the tag `imageTag` gives for `requirements.txt` at main), the secret scan clean (`.env.example` passed the content scan).
**27 passed, 0 failed, 0 errors in 4.37 s** (pytest's time; 6.2 s for the container run), exit 0. **No test failed for want of the
network or a secret**, so there is nothing to list. Run by a one-off script with the engine's own `lib/repo.mjs` git (allowlisted,
jailed paths) and `lib/checks.mjs`; `addWorktree` takes only `eng-…` job ids, so the script ran the allowlisted `git worktree add -b
dev/r2a-smoke` itself. The worktree was removed after; **the branch `dev/r2a-smoke` stays in the dev mirror** (at `d03a9ab`, no
commit of its own): the engine has no git subcommand that deletes a branch.

### Tests changed for R2a.1 (existing files)

- `tests/r2a-workshop.test.mjs` 6: the check runs on a clean worktree folder (the fixture base holds a clone's `.git` folder, which the
  new scan refuses); `--user 65534:65534` added to the flags it requires. No assertion loosened.
- `tests/r2b-engineering.test.mjs` 11: the no-image refusal runs on an empty temp folder, not the whole data root (which holds
  `station.db`, now refused before Docker). No assertion loosened.
- New: `tests/r2a-workshop.test.mjs` 9 (the scan: clean cases incl. the worktree's `.git` file and localhost connection strings;
  refusals by name for `.env`, `.env.local`, a nested `.env.production`, `*.db`, `*.sqlite3`, a key, `.venv/`, `.git/` folders;
  `.env.example` with a Stripe, Render, Anthropic, Google or GitHub key, a private key block or a remote connection string refused, the
  value never named; with or without Docker, not one docker call); `tests/r2b-engineering.test.mjs` 15 (a timed-out check blocks the
  job, the container stopped by name, TESTER never runs; fake Docker); `tests/temp-guard.test.mjs` 3 (`test:docker` and its exclusion
  from `npm test`).

### Measured (items 6 to 8)

- `npm run test:docker`: 10 of 10, 37 s, the temp check clean.
- `npm test` once: 583 of 583, 0 failed, 0 skipped, 119 s, exit 0, the temp check clean; the Docker file not run.
