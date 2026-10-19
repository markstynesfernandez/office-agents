# Station

Station is the station's own agent engine, with a live 3D isometric office that shows it working. "Station" is a placeholder name (owner, Q14). The engine runs each line's agents itself: one model–tool loop per agent, a spend guard in front of every paid call, originality as hard fails, an e-stop, and the approval queue as the only human gate. It replaces the StarNet-era build in `C:\Users\marks\projects\Virtual-workers`, which is only read (for the legacy view, the port and E4's import) and never written.

**Build stage: E1–E3 done, mock provider only.** No model is called and nothing is charged. Live providers stay locked until E6, which needs the owner's answers on billing (Q1), caps (Q2) and products (Q3, §4.3).

- `ENGINE-PLAN.md`: the approved plan (stages E1–E7)
- `DECISIONS.md`: the owner's decisions and answers
- `PORTED.md`: what was ported from the owner's station code, with sha256s (`npm run port-drift` checks them)
- `NOTICE.md`: credits; StarNet code is not ported
- `ASSETS.md`: every asset and dependency, with its licence
- `REUSE.md`, `WRITE-PATH.md`: Phase 0/1 records (WRITE-PATH is superseded)

## Run

```
npm install                       # exact versions: three, sharp, croner; playwright (dev)
npx playwright install chromium   # once, for screenshots and the dry run's pictures
npm start                         # this checkout's Station (dev here: http://127.0.0.1:8792, scratch data in data/); see "Running live"
npm test                          # every suite (node --test)
npm run dry-run                   # the E3 dry run on its own data root (dry-run/e3/), screenshots to screenshots/e3/
npm run demo                      # demo mode: a scripted ~3-minute day on the mock provider, http://127.0.0.1:8793 (data-demo/)
npm run demo:record               # records the demo in headed Chrome: screenshots/demo/station-demo.webm + 4 stills
npm run estop                     # e-stop from a terminal; --off releases, --status shows the state
npm run port-drift                # read-only: has any ported legacy source changed since the port?
npm run legacy-view               # the Phase 1 read-only view of the legacy build (STATION_LEGACY_ROOT)
npm run mock                      # the Phase 1 view from fixtures/ (no legacy root needed)
```

Copy `.env.example` to `.env` for settings. The dev checkout runs on `STATION_PROVIDER=mock` only, and keys are never read in mock mode. The server binds to 127.0.0.1 only and refuses 8787, the legacy system's port.

## Running live

Since L1 there are two Stations, each in its own checkout of this repository, and they never share data or a port.

| | **live** | **dev** |
|---|---|---|
| Checkout | `C:\Users\marks\projects\office-agents-live` (a git worktree on branch `live`) | `C:\Users\marks\projects\office-agents` (branch `main`; Claude Code builds here) |
| Port | 8790 | 8792 |
| Data | `office-agents-live\data\` (the station's real data: jobs, ledger, approval queue) | `office-agents\data\` (scratch: a fresh store on first start, never a copy of live data) |
| Provider | live (from its own `.env`) | mock only |
| Top bar | **LIVE · real data** | **DEV · scratch data** (the ledger panel says "Dev ledger") |

`STATION_INSTANCE` (`live` or `dev`; unset means dev) says which one a process is. The guards (`src/engine/instance.mjs`, `tests/l1-instance.test.mjs`):
- **dev** refuses `STATION_PROVIDER=live`, port 8790, any data root in the live checkout, and a data backup folder. The live providers themselves build only when `STATION_INSTANCE=live`, so no dev script can go live.
- **live** starts only through `npm start` (`scripts/start.mjs`), only from the live checkout, only on branch `live`, only with no uncommitted changes to tracked files, only on port 8790 and only with its data inside its own checkout. It logs the commit it runs and shows it in the badge's tooltip and on `/api/office/health`.
- Each data root is stamped with its instance on the first start (`data\INSTANCE.json`); the other instance refuses a stamped root.

**Start** (each in its own PowerShell window; Ctrl+C stops it; the shell's environment is restored afterwards):
```
cd C:\Users\marks\projects\office-agents-live
powershell -ExecutionPolicy Bypass -File scripts\start-live.ps1     # live, http://127.0.0.1:8790

cd C:\Users\marks\projects\office-agents
powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1      # dev, http://127.0.0.1:8792
powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1 -Demo   # or demo mode (data-demo\, port 8793)
```
The scripts set the instance, port and data root themselves and pass on no `STATION_*` or key variable from your shell, so the live provider and keys come only from the live checkout's `.env`.

**Deploy** (from the dev checkout):
1. Commit on `main`, then `npm run test:record`: it runs the full suite on the clean tree and records the result in `logs\test-passes.jsonl`.
2. `npm run deploy:live` (the current commit; `-- --to <commit>` for another, `-- --plan` to see what it would do). It refuses while the live engine reports a job running or a call in flight (`-- --force` overrides, and only with the live e-stop on: `cd ..\office-agents-live; npm run estop`), refuses a commit with no passing record, and refuses a dirty live worktree. Then it stops the live server (it writes `data\SHUTDOWN`; the server stops cleanly within a few seconds), moves branch `live` to the commit, runs `npm ci` only if `package-lock.json` changed, starts the server in its own window and checks the health route reports instance live and that commit. `-- --no-start` leaves the server stopped.
3. **Roll back**: `npm run deploy:live -- --rollback` returns to the commit the last deploy came from (no test record needed: it already ran live).

Every deploy and rollback appends a row (from, to, time, who, result) to `office-agents-live\data\deploys.jsonl`.

**Owner's `.env` steps** (by hand; nothing in this repository writes a `.env`):
- Live: copy `.env.live.example` to `C:\Users\marks\projects\office-agents-live\.env` and fill in `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY`.
- Dev (`C:\Users\marks\projects\office-agents\.env`): set `STATION_INSTANCE=dev`, `STATION_PORT=8792`, keep `STATION_PROVIDER=mock`; the two API keys can be removed (dev never reads them). Compare with `.env.example`.

**Notes**
- The e-stop works on live exactly as on dev: the page's E-STOP, or `npm run estop` run in the live checkout (it writes that checkout's `data\HALT`).
- Routines are all disabled on live; the owner enables (arms) them in the page.
- Since L2 the line is started and steered from the live page (below). `npm run line:live`, `scout:live` and `smoke:live` still work, only in the live checkout (the dev instance refuses the live provider), with the per-process `$env:STATION_PROVIDER='live'`, and only while the live server is stopped (one engine per data root); the same goes for `npm run owner` (region fixes).

**Driving the line from the page** (L2; on live the calls are real, on dev they are mock: $0):
- **Start line on brief**: pick a brief (verified research briefs and owner briefs, "OWNER · ..."), or **New owner brief…**: title, theme, audience, one item per file of the product spec, price bounds at or above the floor, and whether you approve file 1 yourself. It is saved to `data\research\briefs\` after the same checks as `npm run owner-brief`; saving spends nothing. **Start line** then queues the job.
- **Research this** queues a research job; its demand evidence is indicative until the Etsy API (E7).
- **Every action that can spend** (start line, research, resume, re-run listing, an agent back on duty with waiting jobs) shows a dialog first: the line, the models, the job cap, today's spend and the worst case of open jobs against the daily cap, the Console's monthly limit (set `outerLimits.anthropicConsoleMonthlyUsd` in `config\engine.json` to see it), and whether it starts now or waits as next. Only **Confirm** gets the server's one-time token; the server refuses without it (428), under the e-stop (423) and when the daily cap would be exceeded (422).
- **One job runs at a time** (`runtime.maxRunningJobs`); a further start waits as **next** and starts when the running job ends.
- **The job panel** shows the live status (stage, agent, spend against the cap, the last 5 events) and the steering: Resume, Amend brief, file 1 Approve/Reject (when the brief set ownerFile1), Approve/Reject set in your words, and the approval queue's Approve/Reject. Region fixes stay on the command line (the panel shows the commands; stop the server first).
- The page is served on 127.0.0.1 only; there is no login yet.
- `npm run parity` on dev reads the imported legacy job read-only from the live checkout's `data\legacy\` (dev's scratch data has none); `STATION_PARITY_DATA` overrides.
- Backups: `C:\Users\marks\projects\office-agents-data-backup-L1` is the copy of `data\` taken before the move on 18/10/2026 (3,211 files, sha256-verified).
- The pinned Real-ESRGAN binary (`tools\`, git-ignored) is copied into the live checkout by hand; its sha256s are in `config/engine.json` `upscale`.

### The dry run

`npm run dry-run` (or `node scripts/dry-run.mjs --no-shots`) starts the engine on the mock provider with its own data root, `office-agents/dry-run/e3/`. Any earlier run is moved to `dry-run/e3-previous/`. It uses the FIXTURE product and config patch in `fixtures/engine/`, then runs two briefs:

- **A** (5 mushroom stickers): DESIGNER, then QA-DESIGN asks for a revise, DESIGNER redraws, QA-DESIGN approves. Then LISTER, price fill, QA-LISTING, the package gate, and the package into the approval queue. Output goes to `dry-run/e3/jobs/<id>/package/` (MANIFEST.json, cost.json, files/).
- **B** (astronaut cats): the Designer names a protected character. The image call is refused and the originality screen blocks the job at prep, with the reason.

The office page stays open on the run's own server and takes a screenshot at each stage. The fixture terms are marked FIXTURE-approved for the dry run only; the real notice and licence status in `config/` are untouched.

### Demo mode

`npm run demo` runs the real engine on the mock provider ($0, no model called) for showing the station to people. It refuses to start if a provider key (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` or any other `ANTHROPIC_`/`OPENROUTER_`/`OPENAI_` key or token) is set in the environment, or if `STATION_PROVIDER` is not `mock`. It never reads `.env`. Its data root is `office-agents/data-demo/`, which is wiped and rebuilt on every start and every restart. Its jail has only `data-demo/` and `logs/` as roots, so it cannot write to `data/` or the legacy build, and a demo root that overlaps the station data root is refused. Port: 8793 (`STATION_DEMO_PORT`; it refuses 8787 and the instance ports 8790 and 8792). The day starts when a page connects.

The scripted day (`demo/script.mjs`; the timing is in one file, `demo/pacing.json`) goes through the real orchestrator, spend guard, ledger and SSE. The research line and job B run side by side, and job A follows B on the Room 1 line (one job per line, Q12):
- **Research:** DEMAND-RESEARCHER drafts the mushroom-sticker brief and EVIDENCE-CHECKER verifies it. The station's brief check then moves it to `research/briefs/`.
- **Job B (astronaut cats)** starts first. DESIGNER names a protected character, so the image call is refused. The prep originality screen then trips on `design.md`. The line sends the job back once, the screen trips again, and the job ends **blocked at prep** with the reason. This is the real line's routing: a mechanical originality fail does not go to REJECTS-DESK (owner, 16/10/2026).
- **Job A** starts straight after. DESIGNER makes the 5-file set, QA-DESIGN sends it back once ("file 3: the door detail is too small to read at sticker size") and then approves it. LISTER and QA-LISTING follow, the package gate passes, and the job lands in the approval queue.

Keys: **Space** pauses or resumes, **1 / 2 / 4** set the speed, **R** restarts (in demo mode R restarts rather than resetting the view; the ⌂ button still resets it), and **P** toggles the presenter view. The **presenter view** is on by default in demo mode (`?presenter=0|1`; `?tour=0` keeps the camera still). It has a gentle camera tour that follows the active desk and holds 3 seconds on each stage change, plus a caption strip built from the engine's own events. Money is hidden: costs, prices, margins and caps print as "—". A "DEMO · simulated data" badge stays in the top bar. The demo product, config patch and briefs in `demo/` are DEMO values, not owner decisions.

`npm run demo:record` runs the day once in headed Google Chrome at 1600x1000. It records the video with Playwright's video capture to `screenshots/demo/station-demo.webm`, and takes four stills: `01-overview-mid-run`, `02-desk-close-up`, `03-board-end` and `04-approval-queue`. `--speed 4` gives a quicker take, and `--headless` runs without a window. It makes an `.mp4` only with a pinned, licence-checked converter. Playwright's pinned ffmpeg can only write WebM, so today there is no `.mp4` (ASSETS.md).

### The e-stop

The **E-STOP** button in the page aborts every in-flight model and image call, stops the scheduler and refuses new calls. To resume, type `RESUME`. Stopped jobs are not restarted on their own. `npm run estop` does the same from a terminal by writing `data/HALT` (of the checkout it is run in), which works even when the page or server is stuck. The state survives a restart.

## Layout

```
src/engine/            the engine
  engine.mjs           assembles one engine per data root (lock, store, ledger, bus, e-stop, guard, scheduler, providers)
  orchestrator.mjs     the written lines (config/lines/*.json): agent steps, mechanical steps, loops, the package
  runtime.mjs          one agent run: reserve -> call -> settle -> tools, the guard and e-stop before every call
  guard.mjs            the spend guard (every cap, every call; crash-safe reservations)
  ledger.mjs           append-only money record (fsync), the only source of cost
  halt.mjs             the e-stop (page, HALT file, CLI)
  instance.mjs         L1: live | dev, and the guards that keep the two apart (data root stamp, ports, provider)
  scheduler.mjs        routines (croner), Europe/Dublin days, created disabled
  tools/index.mjs      the agents' tools, jailed to the job folder; no messaging, shell or browser tools exist
  providers/           mock.mjs (E1–E5); live providers are locked until E6
  store/               jail.mjs (every write), db.mjs (node:sqlite), active.mjs
  lib/                 modules ported from the owner's station code (PORTED.md)
  prompts.mjs, config.mjs, bus.mjs, time.mjs
src/server/            engine-server.mjs (engine mode, SSE, write actions), index.mjs (entry, legacy view), log.mjs
src/web/               the office page (Three.js scene, panels); talks only to its own origin
config/                engine.json (caps, prices, tiers), agents/, lines/, station.config.json, products.json, office.json
prompts/               agents/<key>.md and skills/<name>.md (edited as files only, Q8)
fixtures/engine/       dry-run fixtures (FIXTURE product, config patch, briefs, scripted mock replies)
demo/                  demo mode: pacing.json (the timing), script.mjs (scripted replies), DEMO product, config patch, briefs
tests/                 node --test: guard, e-stop, store, engine line, engine server, write guard, ported station tests
scripts/               dry-run, demo, demo-record, estop, port-drift, screenshots, snapshot-fixtures
```

## Safety rules built in

- Every write goes through the data jail (`src/engine/store/jail.mjs`). It allows writes only inside the data root (and `logs/`), and refuses traversal, links and junctions, other drives, 8.3 names and anything inside `Virtual-workers` or `station-workspace`. `tests/write-guard.test.mjs` scans the code and fails on any unjailed write.
- Caps live in `config/engine.json` only (Q7). The guard checks every cap before every call, and an unknown price refuses the call.
- POST actions need the page's own origin, a per-launch action token and JSON. The page never receives keys, prompts or provider responses.
- No messaging: agents cannot send mail, chat or anything else. They draft, and a person sends.
- New or automated entries are drafts. Nothing auto-publishes: the approval queue is the only way out.
