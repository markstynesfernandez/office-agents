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
| Q1 | Billing on Stellar's Anthropic Console credits | Being confirmed with finance. **Blocks E6 only.** |
| Q2 | Caps for digital jobs | Open. **Blocks E6 only.** No cap is changed. |
| Q3 | Products and the other §4.3 items (licence wording, image terms, market/spelling, AI disclosure, pricing) | Open. **Block E6 only.** |
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
