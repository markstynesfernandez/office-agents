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
npm start                         # the engine + office at http://127.0.0.1:8790 (data in office-agents/data/)
npm test                          # every suite (node --test)
npm run dry-run                   # the E3 dry run on its own data root (dry-run/e3/), screenshots to screenshots/e3/
npm run estop                     # e-stop from a terminal; --off releases, --status shows the state
npm run port-drift                # read-only: has any ported legacy source changed since the port?
npm run legacy-view               # the Phase 1 read-only view of the legacy build (STATION_LEGACY_ROOT)
npm run mock                      # the Phase 1 view from fixtures/ (no legacy root needed)
```

Copy `.env.example` to `.env` for settings. `STATION_PROVIDER=mock` is the only working value until E6, and keys are never read in mock mode. The server binds to 127.0.0.1 only and refuses 8787, the legacy system's port.

### The dry run

`npm run dry-run` (or `node scripts/dry-run.mjs --no-shots`) starts the engine on the mock provider with its own data root, `office-agents/dry-run/e3/`. Any earlier run is moved to `dry-run/e3-previous/`. It uses the FIXTURE product and config patch in `fixtures/engine/`, then runs two briefs:

- **A** (5 mushroom stickers): DESIGNER, then QA-DESIGN asks for a revise, DESIGNER redraws, QA-DESIGN approves. Then LISTER, price fill, QA-LISTING, the package gate, and the package into the approval queue. Output goes to `dry-run/e3/jobs/<id>/package/` (MANIFEST.json, cost.json, files/).
- **B** (astronaut cats): the Designer names a protected character. The image call is refused and the originality screen blocks the job at prep, with the reason.

The office page stays open on the run's own server and takes a screenshot at each stage. The fixture terms are marked FIXTURE-approved for the dry run only; the real notice and licence status in `config/` are untouched.

### The e-stop

The **E-STOP** button in the page aborts every in-flight model and image call, stops the scheduler and refuses new calls. To resume, type `RESUME`. Stopped jobs are not restarted on their own. `npm run estop` does the same from a terminal by writing `data/HALT`, which works even when the page or server is stuck. The state survives a restart.

## Layout

```
src/engine/            the engine
  engine.mjs           assembles one engine per data root (lock, store, ledger, bus, e-stop, guard, scheduler, providers)
  orchestrator.mjs     the written lines (config/lines/*.json): agent steps, mechanical steps, loops, the package
  runtime.mjs          one agent run: reserve -> call -> settle -> tools, the guard and e-stop before every call
  guard.mjs            the spend guard (every cap, every call; crash-safe reservations)
  ledger.mjs           append-only money record (fsync), the only source of cost
  halt.mjs             the e-stop (page, HALT file, CLI)
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
tests/                 node --test: guard, e-stop, store, engine line, engine server, write guard, ported station tests
scripts/               dry-run, estop, port-drift, screenshots, snapshot-fixtures
```

## Safety rules built in

- Every write goes through the data jail (`src/engine/store/jail.mjs`). It allows writes only inside the data root (and `logs/`), and refuses traversal, links and junctions, other drives, 8.3 names and anything inside `Virtual-workers` or `station-workspace`. `tests/write-guard.test.mjs` scans the code and fails on any unjailed write.
- Caps live in `config/engine.json` only (Q7). The guard checks every cap before every call, and an unknown price refuses the call.
- POST actions need the page's own origin, a per-launch action token and JSON. The page never receives keys, prompts or provider responses.
- No messaging: agents cannot send mail, chat or anything else. They draft, and a person sends.
- New or automated entries are drafts. Nothing auto-publishes: the approval queue is the only way out.
