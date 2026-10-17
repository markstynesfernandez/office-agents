# PROGRESS

Last updated: 17/10/2026 (E6 step b2: scout fixes D1–D4 and the owner's part-2 decisions, then one live rerun (incomplete: TREND-SCOUT reported blocked on the product key); E6 steps b0 and b: live web search with the owner's source rule, and the first live scout run (no briefs); E6 steps a0 and a: the live Anthropic text provider and one Haiku smoke call; E6 readiness: the owner's decisions recorded, prices and caps in the guard; scouting decisions built and approved by the owner; genre-trend scouting line approved by the owner; R3b and the importer label fix approved by the owner; port batch before E6 approved by the owner; R3a approved by the owner; R3 spike decided by the owner; pre-E6 housekeeping; E4, R1, R2 and E5 approved by the owner). Plan: `ENGINE-PLAN.md` (approved). Decisions: `DECISIONS.md`. Port record: `PORTED.md`.

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
| **Port batch before E6** | Done (17/10/2026), **approved by the owner** (17/10/2026). The PNGTuber job's fixes and the 16 drifted sources ported at the 5th moment (PORTED.md); the build with the pinned Real-ESRGAN in the engine; owner overrides, set and listing approvals; QA-only and listing-only; the digital package step, listing photos, Mark published with title, price and SKU. Delta import done. Parity on the live product: 26/26, the rebuild byte for byte. Mock only, $0. See below. |
| Pre-E6 housekeeping | Done (17/10/2026). Line endings fixed; port drift measured (not ported); port-step items planned; E6 readiness checklist below. |
| **R3 spike** Baked lighting, Design room only | Done (17/10/2026). **Owner's decision:** roll the baked look out in two phases (R3a now, phase 2 later). Was behind `?scene=baked`. 71+ fps full quality on the Intel iGPU in every measured view, walking included (headed Chromium; see below), 1.41 MiB of assets, 41 s rebuild. Screenshots in `screenshots/r3-spike/`. See below. |
| **R3a** Baked look, phase 1 of 2 | Done (17/10/2026), **approved by the owner** (17/10/2026). Shared Blender library; the Design room fixed (readable in dark mode, mood board and pictures back, warm-white walls by day); the Office room baked; one oak floor everywhere; baked rooms are the default (`?scene=procedural` turns them off). 66+ fps full quality on the Intel iGPU in every measured view, walking included; 2.76 MB of the 10 MB office budget; full rebuild 104–127 s. Screenshots in `screenshots/r3a/`. See below. |
| **R3b** Baked look, phase 2 of 2 | Done (17/10/2026), **approved by the owner** (17/10/2026), with the importer label fix (`db18e5a`). The Research room, the lounge and the atrium baked: every area is baked. One lightmap atlas per bake unit (`npm run build-office -- --room <name>`); light-mode Design room within 1% of the other rooms; dark grey rugs everywhere. Frame-rate fix: the AO multiply and the glow folded into the output pass. 66+ fps full quality on the Intel iGPU in every measured view, all 8 agents walking included; 6.88 MB of the 10 MB office budget; full rebuild 262 s, one unit 43–91 s. Screenshots in `screenshots/r3b/`. See below. |
| **Genre-trend scouting** Research line | Done (17/10/2026), **approved by the owner** (17/10/2026); the owner's 7 scouting decisions built the same day (DECISIONS.md "Scouting decisions") and **approved by the owner** (17/10/2026). TREND-SCOUT (12 web calls, engine-enforced) writes internal notes and 4 genre-only desk-props briefs; every scouted name goes on an engine-written blocklist that the brief, intake, image-prompt, design and listing screens all apply; the notes are visible to TREND-SCOUT only. "Weekly genre scout" seeded disabled. Desk in Research; Research, Design and atrium re-baked. Mock only, $0. See below. |
| E6 readiness | Done (17/10/2026). The owner's decisions on Q1 (verbal), Q2 caps, prices, image models, keys and scout sources recorded; the guard prices Haiku's long-prompt tier and cache reads and writes; the scout run cap. Mock only, $0. See below. |
| E6 First real job | In progress. **a0**, **a** (smoke call, USD 0.000005), **b0** (live web search, `80b034c`; source rule `1b912a7`) done 17/10/2026. **b** ran once on 17/10/2026: within every cap (USD 0.033242), but **no genre brief** (TREND-SCOUT stopped after its notes); not rerun. **b1** (output contract + job transcripts, `795adcb`) done; the **b1 rerun** (17/10/2026, USD 0.053095) completed research-done but **0 verified** briefs: the scout's Etsy demand fetch is refused (`url_not_allowed`), so no brief can carry demand evidence; see "E6 step b1". **b2** (D1–D4 `0ab5b1d`; owner's part 2 `308c91a`) done; the **b2 rerun** (17/10/2026, USD 0.002051) ended **incomplete**: TREND-SCOUT reported blocked at step 1 (it did not recognise `pngtuber-prop-pack` as "the desk-props pack key"), no web call; see "E6 step b2". Step **c** needs a verified genre brief. Images not built yet. The plan is under "Exact next step". |
| E7 Routines and cut-over | Not started |

Up to E6 readiness everything ran on the mock provider: $0, with no API keys read. E6 step a made the first real call
(USD 0.000005, below).

### E6 step b2: scout fixes, one live rerun (17/10/2026)

**b2a** (`0ab5b1d`, DECISIONS.md "E6 step b2: owner decisions" and "E6 step b2a build record"): D1 etsy.com fetches refused
by the engine before reserve (not sent as blocked_domains; etsy.com search results still come back); a fetch must name
a URL a search in the job returned; genre briefs carry "indicative" evidence (search results, competitor count "not
measured"), citations checked against the job transcript at brief-check and intake. D2 `report_blocked(reason)`; the
nudge offers exactly fs_write or report_blocked (`tool_choice` any on Haiku, the engine refuses other tools). D3 one
genre brief schema (`lib/scout-brief.mjs`), checked on write, at the screen, at brief-check and intake; naming
`YYYY-MM-DD--<slug>` (the intake convention). D4 only name-like blocklist terms; the b1 placeholder removed with
`scripts/blocklist-hygiene.mjs --apply` (11 → 10 entries; b1's customer-facing check now clean).
**Owner's part 2** (`308c91a`, DECISIONS.md "E6 step b2: owner decisions, part 2"): the approval card shows the evidence
level ("INDICATIVE" banner); report_blocked after >= 1 valid draft records the shortfall and its reason and the line
continues (0 drafts: incomplete); refused short names go to `research/scouting/short-names-review.json`; transcript
retention follows the citing briefs (`lib/transcript-retention.mjs`; refuses while one is open; no cleanup is
scheduled). 330/330 tests, port drift none, scout dry run and parity unchanged (26/26 with --rebuild).

**b2b rerun** (job `2026-10-17--genre-scout-3`, 0.1 minutes, exit 1, not rerun):
- Pre-run line as approved: Haiku 5.5 effort low for both agents and the relay; web caps 12 / 15; max_uses 1; 4 blocked
  domains on both tools, etsy.com engine-only; run cap USD 0.50; retries 2; max nudges 2; web search supported.
- **Result: incomplete, no brief.** TREND-SCOUT read products.json and listed briefs/ and rejected/, then ended its turn
  with "NO PRODUCT": its orders say "use the product key the routine prompt names (default: the desk-props pack key);
  if it is not listed, reply NO PRODUCT", products.json lists only `pngtuber-prop-pack`, and the run input names no
  key. Nudge 1 (`any`, offering fs_write or report_blocked) -> it called report_blocked with that reason. No web call,
  no notes, no draft, nothing downstream; D2 worked as built.
- Cost USD 0.002051 (3 Haiku requests: `req_011Cg86RZbgjKtyCCDHeUHxP` 0.000828, `req_011Cg86Rf8pKhVedcZgikz83`
  0.000656, `req_011Cg86Rt6vWnbrshYP7dKzm` 0.000567; none estimated); no search fees. Ledger today USD 0.088393
  (35 rows). No blocklist addition; no file outside scouting/ (customer-facing check: 0 files, clean).
- `.env` unchanged (size and modified time), the override removed, the engine default still mock, no key-shaped
  string in logs/ or the transcript.
- Fix (owner to decide; not made): name the key. For example, step 1 of TREND-SCOUT's orders could read "default:
  `pngtuber-prop-pack`, the desk-props pack", or scout-live's run input could name the product key.

### E6 step b1: output contract, job transcripts, one live rerun (17/10/2026)

**b1a** (`795adcb`): every model call of a job appends a key-redacted line to `data/jobs/<id>/transcript.jsonl`
(internal, data/ only). Line steps declare `outputs` (TREND-SCOUT: 4 genre drafts via fs_write, partial allowed;
EVIDENCE-CHECKER: a verdict per brief received). Missing outputs at end of turn -> a follow-up message and
`tool_choice` forcing fs_write (Haiku 5.5; Sonnet 5.5 tier uses auto), max 2 nudges; still missing -> job state
`incomplete`, no downstream step, scout-live exits 1. TREND-SCOUT prompt step 7 now says: write each draft with
fs_write, one call per draft. 316 tests green, scout dry run and parity unchanged, port drift none.

**b1b rerun** (job `2026-10-17--genre-scout-2`): research-done, exit 0, USD 0.053095 (text 0.026796, web relay tokens
0.006299, search fees 0.02), 17 ledger rows, none estimated; 2 searches + 1 fetch (TREND-SCOUT), 0 by
EVIDENCE-CHECKER. Ledger today USD 0.086342 (32 rows). Each agent was nudged once and then wrote its outputs.
- **Cause of b's 0 briefs (from the transcript):** TREND-SCOUT web_fetched an Etsy search URL for the demand check;
  the server tool returned `url_not_allowed` (etsy.com is not on the station's blocked list; the API's web fetch
  only fetches URLs already in its conversation). With no demand evidence it correctly wrote no brief and said so.
- **The nudge then pushed it to write 4 drafts with demand evidence "UNKNOWN — needs owner check"**; it flagged
  them itself as not valid briefs. EVIDENCE-CHECKER rejected all 4 (no Etsy demand evidence, keywords or price range).
  Lesson: the contract needs a way for an agent to report "cannot produce, reason X" instead of being forced to write.
- **Drafts not screened:** the drafts put `origin: genre-scout` on the audience_segment line, so `isScoutBrief` did
  not match and scout-notes reported "no genre drafts"; ids lack the `genre-` prefix, so scout-live's brief report was
  empty. No game name is in any draft (customer-facing check: only the placeholder below matched).
- **Blocklist pollution:** the notes gave one studio as "UNKNOWN — needs owner check" and the engine added that phrase
  to the internal blocklist (with 2 new games). It now matches any brief using that placeholder. Needs owner cleanup.
- Drafts stay in `research/scout-drafts/2026-10-17/` with status rejected (brief-check moves only verified briefs).

### E6 steps b0 and b: live web search, the first live scout run (17/10/2026)

**b0** (`80b034c`, `1b912a7`; DECISIONS.md "E6 step b0 build record" and "E6 step b0: owner decisions"): each
web_search / web_fetch is one Haiku request with one server tool (`web_search_20250305` / `web_fetch_20250910`,
direct, max_uses 1), reserved and settled through the guard (searches x USD 0.01 + tokens), one ledger row per request.
The owner's source rule: `steampowered.com`, `itch.io`, `twitch.tv`, `youtube.com` as `blocked_domains` on both
tools for every agent with web tools, and the engine refuses a fetch to them before it is sent; TREND-SCOUT reads trend
articles, editorial roundups and community discussion. 312/312 tests; parity dry run unchanged.

**b, one live run** (`npm run scout:live`, job `2026-10-17--genre-scout-1`, 0.74 minutes, exit 0; not rerun):
- Pre-run line: Haiku 5.5 effort low for TREND-SCOUT, EVIDENCE-CHECKER and the web relay; web-call caps 12 / 15;
  max_uses 1; 4 blocked domains on both tools; run cap USD 0.50; retries 2; web search supported (Models API).
- **Result: no genre brief.** TREND-SCOUT made 3 web calls (2 searches, 1 fetch), wrote valid internal notes (2 AAA,
  2 indie; 4 games and 4 studios added to the internal blocklist), then ended its turn without writing any of the 4
  genre drafts. scout-notes: "no genre drafts"; EVIDENCE-CHECKER found nothing to check (no web calls); the job ended
  research-done, "no drafts for 2026-10-17". No cap was hit, no tool was refused, nothing failed. The engine keeps no
  model reply text, so why it stopped is not known from the record.
- Cost USD 0.033242: Haiku agent tokens 0.007126, web relay tokens 0.006116, search fees 0.02 (2 searches). 10 ledger
  rows, all with request ids, none estimated. Ledger today USD 0.033247 (15 rows, the smoke call included).
- Customer-facing check: no file was written outside `scouting/`, so no brief, title or other customer-facing field
  exists to carry a name.
- Points for the owner (DECISIONS.md not changed): one AAA title was tagged `common-word` by the scout although it is
  not an ordinary word, so its bare title only warns (full-title hard fail does not apply when the title is the bare
  word); no entry has `alsoBlock` names; the evidence came from streaming-statistics and gaming-news sites (none on the
  blocked list).
- `.env` unchanged (metadata only), STATION_PROVIDER removed after the command, config still `mock`, no key in
  `logs/`.

### E6 steps a0 and a: live Anthropic text provider, one Haiku smoke call (17/10/2026)

DECISIONS.md, "E6 step a0 build record" (with the owner's answers). Nothing was written to Virtual-workers; no key
value was read, printed, logged or copied.

- **a0** (`cbb2388`): `@anthropic-ai/sdk` **0.131.0**, pinned exactly (published 30/09/2026, MIT; ASSETS.md). The live
  text provider `src/engine/providers/anthropic.mjs`, built only with STATION_PROVIDER=live in the process's own
  environment, never in demo mode, with the key from the environment only and redacted from every message; models from
  config only; SDK retries off. `guardedTextCall` (runtime.mjs) reserves before every attempt, retries 429, 5xx and
  network errors per `live` in config/engine.json (approved by the owner as set), and settles from the usage with the
  request id on the ledger row. Web and images on the live provider refuse with "not built". `npm test` 295/295
  (new: `live-anthropic` 14/14, SDK stubbed, fake key); port drift: none.
- **a** (the owner's go-ahead, 17/10/2026): with the Station server stopped,
  `$env:STATION_PROVIDER='live'; npm run smoke:live; Remove-Item Env:STATION_PROVIDER` made **one** call:
  `claude-haiku-5-5`, max_tokens 32, thinking disabled (smoke call only), retries 0, run cap USD 0.01.
  - Reply **"ready"** (`end_turn`), request `req_011Cg7xU6wxApdmaNh1rw2VC`, message `msg_011Cg7xU8FbQ1sJefDToA4Pj`.
  - 31 input and 4 output tokens, no cache: (31 x 0.10 + 4 x 0.50) / 1,000,000 = USD 0.0000051, settled **USD
    0.000005** (standard tier), reserved USD 0.000022.
  - Ledger row `98d912b8-b733-4643-8c8a-92dd85e3b7b0` (run `smoke_20261017142049`, no job), `estimated: false`;
    today's ledger total USD 0.000005 over 5 rows (the other 4 are mock, USD 0); no pending reservation left.
  - Checks: `.env` unchanged (same modified time and size), ignored and untracked; a fresh shell has no
    STATION_PROVIDER; the engine default is still `mock`; no key-shaped string in `logs/` or the ledger; the engine
    lock released. To do: match the request id against the Console for the station workspace (owner).

### E6 readiness: owner decisions (17/10/2026)

DECISIONS.md, "E6 readiness: owner decisions". Mock only; no key value was read, printed, logged or copied.

- **Scouting decisions** (`fd10911`) approved by the owner. **Scout sources for v1:** Anthropic web search over public
  articles and chart write-ups only: no page scraping, and no Twitch, Steam or itch.io APIs yet. The official Twitch
  and YouTube APIs come in a later phase, after the owner checks their terms, keeping derived conclusions only (genre,
  date, source name). ENGINE-PLAN.md updated. One reading is flagged (web fetch of an article that a search found
  stays allowed).
- **Q1:** verbal approval from finance (Lorena), 17/10/2026; written confirmation to follow.
- **Q2 caps:** USD 5.00 per job (images included), 10.00 per day, 10.00 per line per day, 0.50 per scout run (new key
  `perJobUsdByLine`). The outer limits are the Console monthly workspace limit and the OpenRouter key's USD 2 a day.
  `perRunUsd` is unchanged at 1.00 (open question).
- **Prices** verified by the owner against the Anthropic pricing page, in `config/engine.json` with source and date.
  The guard now prices Haiku's long-prompt tier (over 100,000 prompt tokens, cache reads and writes included: the
  higher prices for the whole request) and both models' own cache prices. Web search costs USD 0.01 a search and web
  fetch USD 0, plus tokens. Images reserve USD 0.08 and settle to OpenRouter's reported cost (estimated if none).
- **Image models:** only `openai/gpt-5-image-mini`; the opaque model stays disabled (owner). Row 5 closed.
- **Keys:** both names are in `.env` (non-empty), `STATION_PROVIDER=mock`; `.env` is ignored and has never been in
  any commit (file names checked across `git rev-list --all`); the demo refused to start with the keys in its
  environment (exit 2, names only in the message).
- `npm test` 281/281 (new: `e6-prices` 8/8). `npm run dry-run` and `npm run dry-run:scout`: same results as before.

### Scouting decisions (17/10/2026) — approved by the owner (17/10/2026)

The owner approved the genre-trend scouting line (`cc9a5cc`) with 7 decisions (DECISIONS.md, "Scouting decisions").
Built on the mock only:

- **Derivative wording:** whole phrases only, no bare "fan" ("desk fan" passes, "fan art" fails; tested).
- **Scouted names:** exact plus the station's one-letter misspelling match (one line in the ported `originality.mjs`,
  recorded in PORTED.md).
- **Common-word titles:** `"tags": ["common-word"]` in the notes; the bare word warns at `scout-notes`, `brief-check`
  and `price-fill`, and QA-LISTING's run input tells it to check the context; the full title and "<word> game" fail.
- **Sources:** candidate official APIs with links to their terms in ENGINE-PLAN.md, for the owner to check before E6
  (E6 checklist row 17).
- **Retention:** new first step `scout-retention` deletes scouting notes more than 90 days old (logged); the blocklist
  stays.
- **Own drafts folder:** `research/scout-drafts/<day>/`; the research line and the scout line can run on the same day.
- **Lounge:** unchanged; a ninth seat goes in at the next lounge re-bake.
- `npm test` 273/273; `npm run dry-run:scout` unchanged in outcome (4 verified, 1 blocked, 12 web calls, USD 0.00).

### Genre-trend scouting line (17/10/2026) — approved by the owner (17/10/2026)

The owner's rules, the build choices and the open flags are in DECISIONS.md, "Genre-trend scouting". Mock only, no keys.

- **Line `genre-scout`:** TREND-SCOUT -> `scout-notes` (engine) -> EVIDENCE-CHECKER -> `brief-check`. TREND-SCOUT:
  RESEARCH, cheap tier, web search and fetch (12 calls a run, the 13th refused by the engine), fs tools only for its
  notes and drafts. Prompt `prompts/agents/trend-scout.md`.
- **IP fence:** `src/engine/lib/scouting.mjs`. Notes at `research/scouting/<day>/notes.json` (2 AAA + 2 indie). Each
  game, studio and related name goes on `research/scouting/blocklist.json` (engine-only, append-only), which joins the
  originality lists as `scouted-games`, so the brief check, intake, the image-prompt screen, the design-set screen and
  the listing and package gates refuse it. Whole-brief screen; extra derivative wording ("fan", "fandom", "homage",
  "tribute" and more). Only TREND-SCOUT can see `scouting/`; a genre draft naming a game goes to
  `scouting/blocked/<day>/` before EVIDENCE-CHECKER runs; job folders receive `brief.md` only.
- **Routine:** "Weekly genre scout" (Mondays 09:00 Dublin) seeded disabled from `config/routines.json`; a deleted seed
  stays deleted.
- **Office:** TREND-SCOUT's desk in the Research room (a second desk row). Research, Design and the atrium re-baked
  (206.8 s; 7,135,513 bytes, 71.4% of the 10 MB budget). The legacy fixtures view keeps two research desks, so those
  three areas are procedural there (tested); `screenshots-r3b.mjs --engine` captures the engine view. 9 agents and 8
  lounge seats: REJECTS-DESK stays at its desk when idle (flagged).
- **Measured** (`screenshots/r3b-scout/`, engine view, headed Playwright Chromium on the Intel UHD iGPU), full quality:
  overview 83.8 light / 77.1 dark; Research 74.8 / 71.8; lounge 83.1 / 77.1; atrium 64.9 / 64.8; Design (light) 78.9;
  8 agents walking 75.5 light / 66.5 dark. One moving reading under 60 (atrium dark 57.9; 67.1 in the first run).
  **Light-mode brightness:** every baked area 0.952–1.069 x its procedural version, inside the owner's 10% target;
  Design vs the other rooms 1.01 (light).
- **Dry run** (`npm run dry-run:scout`, FIXTURE data with invented titles, `dry-run/scout/REPORT.md`): 4 genre briefs
  verified (candlelit dark fantasy, cozy farming, neon cyberpunk, survival camp); the deliberately bad brief naming a
  scouted game blocked at `scout-notes` and refused again at intake; 13 blocklist names; 12 web calls, the 13th
  refused; 23 ledger rows, USD 0.00, all mock.
- **Also:** `.gitignore` `tools/` anchored to `/tools/` (it also matched `src/engine/tools/`); the R3b capture script
  flags light-mode rows outside the 10% target.

### R3b: baked Research, lounge and atrium, phase 2 of 2 (17/10/2026) — approved by the owner (17/10/2026)

The owner's answers to the R3a questions and the build record are in DECISIONS.md, "R3b build record". Mock data only.

- **Every area baked.** Four bake units, each with its own day and evening atlas at one texel density: Research, Design,
  Office, and the atrium with the lounge. `npm run build-office -- --room <name>` re-bakes one unit (`lounge` = the
  atrium unit). New library pieces: bookcase, sofas, armchair, coffee and side tables, arc lamp, bench, printer, water
  cooler, wall clock, slab, core plinth, the closet (ASSETS.md).
- **Owner's look decisions.** Light-mode Design room brightened (pale backing and credenza, oak tops by day; the evening
  unchanged): 0.991 x the other rooms on the light overview. Evening walls keep their department tints. Rugs dark grey
  everywhere, baked and procedural.
- **Frame-rate fix.** `OfficeOutputPass` does the cached AO multiply and adds the glow inside three's output pass (one
  full-screen read and write instead of three); the glow blurs at quarter resolution. A fallback to the separate blends
  is kept; it did not trigger (every view reports `post: 'fused'`).
- **Measured** (headed Playwright Chromium on the Intel UHD iGPU, `screenshots/r3b/fps-headed.json`), full quality:
  overview 72.5 light / 74.2 dark; Research 75.4 / 69.2; lounge 80.1 / 75.4; atrium 69.8 / 66.1; Design (light) 79.1;
  all 8 agents walking 70.8 light / 66.2 dark. No bench needed a retry.
- **Assets:** 6,877,262 bytes, 68.8% of the 10 MB budget (`screenshots/r3b/asset-sizes.json`). **Rebuild:** full 261.8 s;
  one unit 43.2–91.0 s.
- **Brightness** (`screenshots/r3b/brightness.json`): dark mode, every baked area is 5–33% brighter than its procedural
  version; light mode, the baked rooms are 3–10% darker. **Owner, 17/10/2026: light-mode target = every baked area within
  10% of its procedural version (all met it); recorded in DECISIONS.md.**
- **Captures:** `node scripts/screenshots-r3b.mjs --headed --channel chromium --expect-gpu intel` -> `screenshots/r3b/`
  (01–09 PNGs, `ref/` procedural references, `fps-headed.json`, `brightness.json`, `asset-sizes.json`, `build.json`).
  Demo video re-recorded (`npm run demo:record`).

### R3a: baked Design and Office rooms, phase 1 of 2 (17/10/2026) — approved by the owner (17/10/2026)

The owner's decisions on the spike (recorded in DECISIONS.md, "R3a build record"): roll the baked look out in two phases
(this phase: fix the Design room, a shared library, the Office room; phase 2 later: Research, lounge and atrium); 10 MB
compressed for the whole office's baked assets; Chrome stays on High performance for the owner's viewing, fps checks
stay on the Intel iGPU through Playwright. Mock data only.

- **Shared library.** `scripts/blender/office_lib.py` is the one module every baked room is built from: the mesh
  builder, the shared materials (vertex colour, five photo textures, the decal atlas, themed wall/cap/skirting colours,
  unlit LED) and the pieces (desk with drawer pedestals and L return, task chair, desk lamp, rug, binder shelf, wall shelf
  with books, lockers, credenza, meeting table with stools, easel, slat panel, mood board, whiteboard, framed picture,
  LED strips; plants: fiddle-leaf fig, small pot plant, trailing shelf plant). `office_rooms.py` holds one short recipe
  per room; `build-office.py` builds every room, packs all their lightmap UVs into **one atlas** per mode (one texel
  density for every room) and exports `office.gltf` + `office.bin` with the textures as separate files in `textures/`,
  each written once. `npm run build-office` (`scripts/build-office.mjs`) replaces `build-design-room`; the old
  `src/web/assets/design-room/`, its script and `screenshots-r3.mjs` are removed.
- **Design room fixes.** (1) Dark mode: the evening bake's fill is raised (sky 0.8 -> 1.5) and the page lifts the
  evening lightmap by 1.15; measured, both baked rooms are now 6–8% brighter than the procedural rooms in dark mode
  (table below). (2) The mood board is back on the oak slat panel over the desks (3.8 x 1.35, in an oak frame, a warm LED
  strip along its top), and three framed abstract pictures hang over a credenza on the left wall; their artwork is the
  page's own procedural atlas (`textures.js`, seeded shapes, no text, no copies), so baked and procedural rooms show the
  same pictures. The long shelf over the desks and the fabric pads made way for them. (3) Light mode: walls, caps and
  skirting are themed materials; the day bake uses the light palette's warm-white walls with the department tint (as the
  procedural rooms), the evening bake the dark palette's walls, and the page swaps the colours with the theme.
  (4) Floor: one mid-tone oak (the Poly Haven plank floor shifted to `#a47f58`, 2.2 units a tile) in every room,
  baked or procedural, and the lounge; the procedural floors load the same `textures/floor.jpg` (palette `wood` is now
  white in both themes).
- **Office room.** Same footprint (10.9 x 8.7), four desks in two rows (the first of each row L-shaped), chairs and seats
  as the live layout; lockers, the framed picture and a lit wall shelf on the left wall; the whiteboard (the page's
  procedural whiteboard) and two lit book shelves on the back wall; rugs per row; oak desk tops; the meeting table with
  two stools; a fig and a small plant; warm cove LEDs. Day and evening bakes.
- **Default and fallback.** The baked rooms are the default scene; `?scene=procedural` draws every room procedurally.
  Each baked room is checked on its own against the live layout (`bakedRoomSpec`): a stale room falls back to the
  procedural one with a console warning and the other stays baked (tested: a fifth Office desk makes only the Office
  stale).
- **Rebuild time:** 126.8 s for the full build on the first run (Blender 117.6 s: modelling 0.1, textures 0.5, UVs 6.4,
  day bake 41.0, evening bake 60.9, export 0.8; the rest is start-up and the WebP step), 103.7 s on a second run.
  3072 px atlases, 1024 samples, OptiX on the RTX 5060. `--quick` (1536 px, 128 samples): about 22 s.
- **Reproducible:** `office.gltf`, `office.bin` and the five textures were byte-identical on a rebuild. The lightmaps
  differ only by GPU sampling noise: mean 0.16/255 (day) and 0.07/255 (evening), at most 17/255 and 19/255 on isolated
  texels, 1.5% and 0.4% of channels by more than 2/255 (more than the spike: the same samples over a bigger atlas).
- **Size against the 10 MB office budget:** 2,762,638 bytes as served (2.76 MB, 27.6% of the budget; 1.83 MB with
  brotli): day atlas 921 KB, evening atlas 497 KB, `office.bin` 1,060 KB (geometry, uncompressed), `office.gltf` 38 KB,
  five shared textures 238 KB, manifest and sizes 11 KB. 9,948 triangles (Design 4,032, Office 5,916).
- **Brightness** (`screenshots/r3a/brightness.json`: mean luma, 0–255, inside each room's outline on screen, baked vs
  `?scene=procedural`, same camera):

| View | Room | Theme | Baked | Procedural | Ratio |
|---|---|---|---|---|---|
| Overview | Design | dark | 67.0 | 63.1 | 1.06 |
| Overview | Office | dark | 68.5 | 63.3 | 1.08 |
| Room view | Design | dark | 63.1 | 58.9 | 1.07 |
| Room view | Office | dark | 64.0 | 59.3 | 1.08 |
| Overview | Design | light | 125.1 | 138.6 | 0.90 |
| Overview | Office | light | 138.2 | 134.5 | 1.03 |
| Room view | Design | light | 119.1 | 133.2 | 0.89 |
| Room view | Office | light | 135.4 | 131.8 | 1.03 |

  (The light Design room reads about 10% darker than its procedural version because of its dark slat backing, walnut
  desks and dark credenza, not its walls; the brief's brightness rule is for dark mode.)
- **fps** (`screenshots/r3a/fps-headed.json`; **headed Playwright Chromium on the Intel UHD iGPU**, renderer checked,
  1600x1000, full quality = camera still, AO on; legacy fixtures view; one back-to-back run):

| View | Camera moving | Full quality | Frame avg / p95 | Draw calls |
|---|---|---|---|---|
| Overview, light | 81.4 | 78.6 | 12.61 / 14.3 ms | 80 |
| Overview, light, procedural (reference) | 82.4 | 81.1 | 12.28 / 13.9 ms | 58 |
| Overview, dark (glow on) | 72.4 | 71.4 | 13.92 / 16.0 ms | 87 |
| Overview, dark, procedural (reference) | 82.1 | 79.8 | 12.49 / 14.4 ms | 61 |
| Design room, light | 74.5 | 75.4 | 13.16 / 15.1 ms | 60 |
| Design room, dark | 69.8 | 68.9 | 14.42 / 16.7 ms | 67 |
| Office room, light | 75.4 | 73.1 | 13.61 / 15.7 ms | 63 |
| Office room, dark | 68.5 | 67.1 | 14.79 / 16.6 ms | 70 |
| Walk: overview, dark, 5 agents walking | 66.0 | 66.0 | 15.22 / 17.3 ms | 87 |
| Walk: overview, light, 5 agents walking | 72.7 | 72.7 | 13.81 / 16.8 ms | 80 |
| Walk: overview, dark, procedural (reference) | 75.4 | 75.4 | 13.31 / 15.6 ms | 61 |

  The first run of the same set had the dark walk row at 1 fps (the browser window was covered; every other row
  matched); it was re-run whole and the table is the second run. Browsers were launched by Playwright with fresh
  temporary profiles; only the script's own server on a random port was opened (never 127.0.0.1:8787).
- **Captures** (`screenshots/r3a/`, git-ignored as before): `01-overview-light.png`, `02-overview-dark.png`,
  `03-design-light.png`, `04-design-dark.png`, `05-office-light.png`, `06-office-dark.png`; side-by-sides against R2
  (`side-by-side-design-r2.png`, `side-by-side-office-r2.png`: R2's dark room captures, same cameras) and, because R2
  has no light room captures, against today's procedural rooms (`side-by-side-design-light.png`,
  `side-by-side-office-light.png`); `fps-headed.json`, `asset-sizes.json`, `brightness.json`, `build.json`; the
  procedural reference captures in `ref/`. Problems: none.
- **Files:** new `scripts/blender/office_lib.py`, `office_rooms.py`, `build-office.py`, `scripts/build-office.mjs`,
  `scripts/screenshots-r3a.mjs`, `src/web/scene/bakedlook.js`, `src/web/assets/office/*`; changed `src/web/scene/baked.js`
  (multi-room loader, themed colours, shared floor texture), `office.js` (default on, per-room guard, procedural floor
  texture), `rooms.js` (`skipRooms`, oak floor scale), `layout.js` (comment), `src/web/main.js` (`?scene=procedural`),
  `src/web/config/palette.js` (wood white), `src/server/index.mjs` (MIME for .gltf, .bin), `tests/baked-room.test.mjs`
  (rewritten, 8 tests), `tests/write-guard.test.mjs` (the new scripts' jails), `package.json` (`build-office`,
  `screenshots-r3a`), `.gitattributes` (`*.bin binary`), `.gitignore` (`__pycache__/`), `ASSETS.md`, `DECISIONS.md`,
  `PROGRESS.md`; removed `scripts/blender/build-design-room.py`, `scripts/build-design-room.mjs`,
  `scripts/screenshots-r3.mjs`, `src/web/assets/design-room/`.

### R3 spike: baked Design room (17/10/2026) — decided: roll out in two phases (R3a)

A spike only. `?scene=baked` swaps the Design room for a baked one; without the flag the office is exactly as before
(the default Design room view differs from R2's capture in 0.05% of pixels: monitor text and the clock). Mock data only.

- **Tooling.** Blender **5.2.1 LTS** (installed by the owner; 5.2.2 is the latest 5.2 patch, so 5.2.1 is what is pinned in ASSETS.md). `npm run build-design-room` (`scripts/build-design-room.mjs`) runs `scripts/blender/build-design-room.py` headless: it models the room from the layout spec, bakes a day and an evening lightmap in Cycles on the RTX 5060 (OptiX), exports `src/web/assets/design-room/design-room.glb` (second UV set for the lightmap), turns the lightmaps into WebP and writes `manifest.json` and `sizes.json`. Writes are jailed to that folder (`assetJail`), Blender's too.
- **Rebuild time:** 41.4 s wall clock for the full build (2048 px lightmaps, 1024 samples): 37.1 s inside Blender (UVs 5.5 s, day bake 8.0 s, evening bake 16.1 s, export 0.5 s; the rest is Blender start-up and the device check). `--quick` (1024 px, 128 samples): about 15 s.
- **Reproducible:** the glb is byte-identical on every rebuild. The lightmaps differ only by GPU path-tracing noise between runs (mean 0.002/255 day and 0.024/255 evening; at most 9/255 and 19/255 on isolated texels; 0.006% and 0.17% of channels differ by more than 2/255).
- **Assets:** CC0 only: five Poly Haven 1k diffuse textures (oak and walnut veneer, wood floor, herringbone wool, hessian), with source URLs, dates, authors, MD5s and the CC0 legal text in `assets-src/`. Everything else is modelled in the script (4,676 triangles). `design-refs/05.png` was mood only.
- **The room:** dark walls, a warm oak slat panel behind the desks, three oak shelves with binders (blank label patches) and LED strips under them, ten fabric wall pads (muted rust), an oatmeal hessian rug, two walnut desks with drawer pedestals (the first L-shaped, as before), two ergonomic chairs, desk lamps, a fiddle-leaf fig, a small pot plant, the easel, and warm cove LEDs along the floor edge of both walls. Same footprint (9.7 x 5.2), desk positions, chairs and seats as the live layout: the page uses the bake only while `bakedRoomSpec` of the live layout equals the manifest's spec, otherwise it draws the procedural room and logs a warning. Labels, status lights, monitors, keyboards and people are unchanged and real-time.
- **Lighting:** unlit `MeshBasicMaterial` (albedo x lightmap) on every baked surface, so the room costs no real-time lights or PBR; day lightmap in light mode, evening lightmap in dark mode, swapped on the theme toggle. LED strips and lamp bulbs stay real-time (unlit; bright HDR in dark mode). A half-resolution glow on the strips in dark mode only: threshold, 2x2 downsample, 9-tap blur each way, additive; it costs about 0.9 ms a frame and is kept. `?glow=0` turns it off, `?bakedao=0` leaves the baked room out of the GTAO pre-pass (for comparison only).
- **Size:** 1,478,332 bytes as served (1.41 MiB; glb 727 KB with JPEG textures, day lightmap 470 KB, evening 281 KB), against the 6 MB budget. With brotli on top: 1.05 MB.
- **fps** (`screenshots/r3-spike/fps-headed.json`; **headed Playwright Chromium on the Intel UHD iGPU**, renderer checked, 1600x1000, full quality = camera still, AO on; legacy fixtures view). Measured back to back on the same build:

| View | Camera moving | Full quality | Frame avg / p95 | Draw calls |
|---|---|---|---|---|
| Design room, current, light | 80.7 | 80.4 | 12.31 / 14.0 ms | 49 |
| Design room, baked, light | 80.1 | 77.8 | 12.75 / 14.4 ms | 57 |
| Design room, current, dark | 80.4 | 80.5 | 12.38 / 13.8 ms | 52 |
| Design room, baked, dark (glow on) | 73.7 | 71.8 | 13.82 / 15.6 ms | 64 |
| Design room, baked, dark, glow off | 79.5 | 77.1 | 12.88 / 14.3 ms | 60 |
| Overview, current, dark | 80.3 | 81.8 | 12.14 / 13.7 ms | 61 |
| Overview, baked, dark | 72.1 | 74.5 | 13.37 / 14.9 ms | 73 |
| Overview, baked, light | 84.1 | 81.8 | 12.15 / 14.0 ms | 66 |
| Walk: overview, dark, baked, 5 agents walking | 71.1 | 71.1 | 14.09 / 15.5 ms | 73 |

- **Why Chromium, not Chrome:** Windows' per-app graphics preference now has `chrome.exe` on "High performance" (`GpuPreference=2` under `HKCU\Software\Microsoft\DirectX\UserGpuPreferences`), so headed Google Chrome runs on the RTX 5060 (its run, vsync-capped at about 165 fps everywhere, is kept as `fps-headed-chrome-nvidia.json`; it is not the budget figure). The setting was not changed. Playwright's Chromium has no per-app preference, so Windows gives it the Intel iGPU; same ANGLE/D3D11 path. `scripts/screenshots-r3.mjs --headed --channel chromium --expect-gpu intel` records a problem if the renderer is not Intel. Browsers were launched by Playwright with fresh temporary profiles; only the script's own server on a random port was opened.
- **Captures** (`screenshots/r3-spike/`, git-ignored as before): `01-design-current-light.png`, `02-design-baked-light.png`, `03-design-current-dark.png`, `04-design-baked-dark.png` (same camera as R2's 04-design-room), plus `side-by-side-light.png` and `side-by-side-dark.png` (current | baked), `fps-headed.json`, `fps-headed-chrome-nvidia.json`, `asset-sizes.json`, `build.json`. Problems: none.
- **Files:** new `scripts/blender/build-design-room.py`, `scripts/build-design-room.mjs`, `scripts/screenshots-r3.mjs`, `src/web/scene/baked.js`, `src/web/assets/design-room/*`, `assets-src/`, `tests/baked-room.test.mjs`; changed `src/web/scene/layout.js` (`bakedRoomSpec`), `rooms.js` (`skipRoom`), `office.js` (loader, instance hiding, glow pass), `src/web/main.js` (flag), `src/server/index.mjs` (MIME for .glb, .webp, .jpg), `scripts/screenshots.mjs` (`launch({ channel })`), `tests/write-guard.test.mjs` (two new script jails), `package.json` (`build-design-room`, `screenshots-r3`), `ASSETS.md`, `DECISIONS.md`, `PROGRESS.md`.

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

### Port batch before E6 (17/10/2026) — approved by the owner (17/10/2026)

The legacy job `2026-10-16--pngtuber-cosy-desk-props-r2` is live on Etsy (https://www.etsy.com/listing/4597311033, published
2026-10-17, EUR 9.00, SKU DESK-PROPS-01): the first real product and the parity reference. This phase ported its fixes in one
batch. Mock provider only; $0; no key read; nothing written to Virtual-workers. The owner's decisions and the build record are in
DECISIONS.md ("Port batch before E6").

- **Sources.** The 16 drifted files plus every "To port to office-agents" entry of the legacy HANDOFF.md (items 1–32, freeze
  exceptions a–o), copied read only into a frozen staging folder at **2026-10-17T11:34:23Z** (the 5th moment) and ported from
  there; none changed afterwards. 19 new legacy files are tracked; `npm run port-drift`: 0 of 69 drifted.
- **What is ported:** the near-miss allow-list (exact whole words) and the set screen (all of design.md but the self-check,
  file names, the brief, the listing); the whole digital build (enclosed background with edge unmix, removed-area and
  near-white checks, Real-ESRGAN with alpha apart, PNG optimisation, one ZIP, the preview) as the prep step of packaged
  products, with the pinned binary as the engine's only child process (killed by the E-STOP); limitProblems and buildWarnings
  for QA DESIGN; the cleaned file-1 version and per-version style-reference decisions; the owner set approval and owner listing
  approval as gate sign-offs; recolour of an approved file and outline normalise (refusing an unapproved source); the
  deterministic listing text fix; the digital package step (ZIP delivery, MANIFEST with every file and ZIP entry, owner
  overrides with date, reason and owner); listing photos from the packaged ZIP; QA-only and listing-only run modes and the
  package step as owner actions; the price fill keyed to the job; QA pass numbers from the job's counter; Mark published with
  the final title, price and SKU; the Lister, QA DESIGN and QA LISTING prompts and two skills (QA DESIGN 11,970 and QA LISTING
  11,996 characters: under the 12,000 target, no trim needed). The owner's decisions are an append-only log per job, shown on
  the job panel; `npm run owner -- <action> <job-id> '<json>'` runs them from a terminal (the page has no buttons for them yet).
- **Delta import:** `npm run import-legacy`: 104 files added, 11 changed, 14 ledger rows and 8 runs added (ledger 176 rows,
  $12.4899616, match); the PNGTuber job is in `data/legacy/` as `published`, with its approval records, listing photos and
  package. **Second run: nothing changed (0 added).**
- **Parity** (`npm run parity -- --rebuild`; read only on `data/legacy`, writes only `dry-run/parity/`, $0, no model or
  network): **26/26 checks pass, 0 unexplained differences.** The engine re-derives the set (build current, 12 files, no limit
  problems or build warnings, originality clear), the listing screen (clear), the owner set approval (6 QA pass, 3 owner
  override, 3 deterministic fix, every file's status the same) and the owner listing approval; the package gate passes with
  the same 3 design passes; the price fill gives EUR 9.00 and leaves another job's unreviewed listing untouched; the ZIP is
  byte for byte the published download, its 12 entries match, within Etsy's limits; the listing passes US spelling; the
  package step builds and is idempotent; all 7 listing photos come out byte for byte; and **the rebuild of set-v4 from its raw
  files with the pinned Real-ESRGAN gives the same build key, all 12 files and the ZIP byte for byte** (about 3 minutes, local
  GPU). The 73 differences, each with its reason (dry-run/parity/PARITY.md):

  | Count | Where | Reason |
  |---|---|---|
  | 19 | records rewritten in the replay copy | layout only: `work/<id>/`, `outbox/<id>/` and `approval-queue/<id>` are `jobs/<id>/`, `jobs/<id>/outbox/`, `jobs/<id>/package/` |
  | 17 | sha256s in the approvals and MANIFEST | follow those path rewrites (QA records, listing.json's designFile, the re-composed approvals, the re-based fix record) |
  | 7 | path strings in MANIFEST, deliverables.json, photos.json | the same layout |
  | 16 | set-v4/originality.json `screened` | the legacy set screen ran before the listing existed; a re-prep screens the listing too (as the legacy code does when listing.json exists); still clear |
  | 19 | MANIFEST `overrides` | engine addition (owner decision): each override also carries the file's sha256, the stage, the date and who decided |
  | 2 | MANIFEST cost.json bytes and sha256 | the replay carries the legacy total (USD 4.205638); engine jobs use their own ledger rows by jobId |
  | 2 + 1 | measuredBy, builtBy | name the engine module |
  | 12 | rebuild aiMs | timing |

- **Tests:** 257/257 (206 before). New: `tests/port-batch.test.mjs` (the price-hook bug, pass numbering, the run modes end to end,
  override guardrails, the set approval, the recolour step, the text fix, the upscaler pin and its kill by the E-STOP, US
  spelling) and the ported `digital-build`, `owner-approval`, `prop-edit`, `listing-photos`, `style-ref` tests (replacing
  `listing-notice`); `originality` re-ported. `npm run dry-run`: job A to `approval`, job B blocked on "garfield", as before.

### E6 readiness checklist (17/10/2026; updated after the owner's E6 readiness decisions)

The items that blocked E6, with their state. **First product and parity reference:** the PNGTuber job `2026-10-16--pngtuber-cosy-desk-props-r2`
(the `pngtuber-prop-pack` product), live on Etsy since 2026-10-17. The engine's first real job is judged against it; the parity
replay above passes.

| # | Item | Status | Where it stands |
|---|---|---|---|
| 1 | Q1 billing confirmation (Anthropic Console credits; finance and the founder) | **closed for E6** (verbal, 17/10/2026); written confirmation **open** | Verbal approval from finance (Lorena) on 17/10/2026 for the station workspace's Console credits; written confirmation to follow (record its date in DECISIONS.md). `station.config.json`'s "approved by Finance" now agrees with it. |
| 2 | Q2 caps for digital jobs | **closed** (17/10/2026) | USD 5.00 per job (images included), 10.00 per day, 10.00 per line per day, 0.50 per scout run (`perJobUsdByLine`), in `config/engine.json`. Outer limits: the Console monthly workspace limit and the OpenRouter key's USD 2 a day. For scale: the live product's legacy job cost USD 4.205638 over three design passes. `perRunUsd` 1.00 unchanged: row 19. |
| 3 | Q3 product spec | **closed** (17/10/2026) | `pngtuber-prop-pack` (12 transparent 2000x2000 PNGs, one ZIP download, the preview a listing photo only) ported as owner-approved per the legacy record, and live. Any other product is a new owner decision. |
| 4 | Licence and download-notice wording | **closed** for this product | `commercial-content` licence and the prop pack's notice, owner-approved 2026-10-16, ported word for word with the dates; the gate requires them word for word. `personal-use` and `commercial-standard` stay DRAFT and fail closed. |
| 5 | Image model commercial terms | **closed** (17/10/2026) | `openai/gpt-5-image-mini` (transparent images): owner-confirmed 2026-10-16 (OpenAI Business Terms) in the asset register; the only model allowed. The opaque model stays disabled (owner decision 17/10/2026; opaque images are refused). The earlier to-do "skim OpenRouter's terms" has no recorded outcome; noted only. |
| 6 | Market and spelling | **closed** (17/10/2026) | US English for listings (owner decision for this product), enforced by the gate's spelling check, which now includes the owner's fix list ("colourway"). |
| 7 | AI-disclosure wording in listings | **closed** | The owner's wording (2026-10-16, `config.digital.aiDisclosure`), required word for word by the gate; on the live listing. |
| 8 | Price approach | **closed** (17/10/2026) | The owner's price point in the brief, else the low end of the owner's range, never the top-5 high; the package carries it as a proposal (`final: false`); the owner sets the final price on Etsy, recorded by Mark published (EUR 9.00 on the live listing). A brief without an owner price line still falls back to the brief high: the owner may want such briefs refused. |
| 9 | Provider price verification | **closed** (17/10/2026) | Verified by the owner against the Anthropic pricing page; in `config/engine.json` with source and date. Haiku's long-prompt tier and both models' cache prices are priced by the guard (tested). Web search USD 0.01 a search plus tokens, web fetch tokens only. Images: USD 0.08 reserved, settled to OpenRouter's reported cost. |
| 10 | Separate API keys (a station-engine key in the Anthropic Console workspace and a new OpenRouter key) | **closed** (17/10/2026) | The owner put `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` in `.env` with `STATION_PROVIDER=mock`. Checked by name only: both present; `.env` ignored and never committed; the demo still refuses keys. That they are the separate station-engine keys is the owner's word. |

Also needed before a real job on the product (added here; not in the owner's list):

| # | Item | Status | Where it stands |
|---|---|---|---|
| 11 | Port batch from the PNGTuber job | **done** (17/10/2026) | 5th moment, above. |
| 12 | Packaged-product build in the engine | **done** (17/10/2026) | The ported build with the pinned Real-ESRGAN (owner decision); the parity rebuild is byte for byte. |
| 13 | Style-reference workflow | **partly done**; **blocks step c** | The library, the owner's decisions and the cleaned version are ported. Open: the first-file run mode and a reference image in `image_generate`, so a NEW style-reference job still fails closed at the package gate. `pngtuber-prop-pack` uses a style reference, so a genre brief for it cannot pass the gate until this is built. |
| 14 | Parity check against the legacy job (§7.2 step 3) | **done** (17/10/2026) | 26/26, 0 unexplained differences. |
| 15 | Designer token use (legacy item 12: a compact brief extract, under 30k tokens per image) | **open** | Not built; proposal in DECISIONS.md. Measurable only on a real run. |
| 16 | Buttons on the page for the owner's actions | **open** (not blocking) | The routes exist; `npm run owner` works today with the server stopped. |
| 17 | Genre-scout sources | **closed** (17/10/2026) | v1: trend articles, editorial roundups and community discussion by Anthropic web search; Steam, itch.io, Twitch and YouTube blocked on both web tools and refused by the engine for fetch (`1b912a7`); TREND-SCOUT's prompt changed. Twitch and YouTube data later through their official APIs only. |
| 18 | Live providers (Anthropic text, the live web backend, OpenRouter images) | **partly done**: Anthropic text (a0/a) and the live web backend (b0, first live run in b) done 17/10/2026; images (c0) **open** | `@anthropic-ai/sdk` 0.131.0; `providers/anthropic.mjs`, `providers/anthropic-web.mjs`. |
| 19 | Per-run cap | **open** (owner; before step c) | `perRunUsd` is USD 1.00 (StarNet era) and was not part of the Q2 answer. One legacy DESIGNER pass cost about USD 0.92. |
| 20 | Image token estimate in reservations | **open** (before step c) | `image_analyze` sends base64, and the runtime counts it as text (length ÷ 3). A 1 MB PNG reserves about USD 1.1 on Sonnet, over the per-run cap. Fix proposed in DECISIONS.md. |

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
  - **Legacy rows are tagged.** Ledger and run rows carry `source: "legacy"`; jobs, tracker rows and routines carry `legacy = 1` in the store. Legacy jobs are on the line `legacy:room1-etsy` with their legacy room (`etsy-pod`, or `etsy-digital` for the PNGTuber job: label fixed 17/10/2026). Routines are imported **disabled** (one was enabled in the source).
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
- `f51ec46`: Pre-E6 housekeeping (E5 approval, drift list, port-step items, E6 readiness checklist)
- `96c23b2`: R3 milestone (Blender build and the baked Design room behind `?scene=baked`)
- `91c748b`: R3 spike: baked Design room (the headed captures' fixes, the Chromium channel, docs)
- `1db8e72`: R3a milestone (the shared library, the baked Design and Office rooms as the default scene)
- `c156965`: R3a: baked Design and Office rooms (docs, comments)
- `052f2b1`: R3b milestone (per-unit lightmaps, baked Research, lounge and atrium)
- `cb4bdcc`: Port batch milestone (the PNGTuber fixes at the 5th moment, tests green)
- `edd26a1`: Port PNGTuber batch before E6 (owner CLI, US spelling, docs); approved by the owner 17/10/2026
- `dc403fb`: R3b: baked Research, lounge and atrium (the frame-rate fix, capture robustness, docs)
- `db18e5a`: Importer: digital legacy jobs labelled with their digital room; approved by the owner 17/10/2026 (with R3b)
- `b75cfac`: Genre-scout milestone (TREND-SCOUT, scouting blocklist, re-bake, tests green)
- `cc9a5cc`: Genre-trend scouting line (docs); approved by the owner 17/10/2026
- `fd10911`: Scouting decisions (the owner's 7 decisions, tests, docs); approved by the owner 17/10/2026
- The next commit: "E6 readiness" (the owner's E6 decisions, prices and caps in the guard, tests, docs)

`.gitignore` excludes `data/`, `data-demo/`, `dry-run/`, `fixtures/*` (except `fixtures/engine/`), `design-refs/`, `screenshots/`, `.cache/`, `logs/`, `*.log`, `.env` and `node_modules/`. `core.autocrlf` is false in this repository, so files are committed byte for byte. Before the first commit, the staged files were scanned: they contained no ignored paths, no key or token patterns and no email addresses.

**Housekeeping (Redesign R1 item 0, 16/10/2026):** `fixtures/engine/` is now committed (the owner's order). Before un-ignoring it, every file was checked: it holds only synthetic FIXTURE data (FixtureShop1–5, placeholder listing ids 1000000001–5, made-up USD 7.50–9.99 brief prices, the FIXTURE product and config patch, the scripted mock replies) and nothing from the real snapshot, so nothing had to be moved out. `.gitignore` now ignores `fixtures/*` except `fixtures/engine/`, so the legacy snapshot (`fixtures/station-root/`, `SNAPSHOT.json`) and `fixtures/synthetic/` stay local. `design-refs/` (the owner's mood references) is ignored; `git rev-list --all` + `ls-tree` confirms no `design-refs` file was ever in a commit.

## Half-built

- **Packaged digital products** build in the engine since the port batch (17/10/2026): the pinned Real-ESRGAN runs as the one child process; a missing or changed binary blocks the job (it never falls back silently to a file the gate would pass).
- **Style-reference workflow:** the library and the owner's decisions are ported (17/10/2026); there is still no first-file run mode and no `reference_image` in `image_generate`, so a new style-reference job fails closed at the package gate.
- **Routines** run `line:research`, `line:genre-scout` and `line:room1-digital` (E5; genre scout 17/10/2026). "Weekly genre scout" is seeded disabled from `config/routines.json`. With the mock replies the research line ends "no drafts" (the fixture script has no researcher replies), so no test runs a research batch that verifies a brief; the demo's script does.
- **The package folder** cannot be opened from the page (the server starts no process); the page shows its path with a copy button.
- **Live providers** are locked (`ProviderLocked`). The Anthropic SDK is not installed and the effort mapping is not written (E6).
- **Web search and fetch** return canned text in the mock. Their prices are set (17/10/2026), but the live web backend is not built, and its reservation does not yet include the tokens of the Anthropic call that carries the results (E6 step b0).
- **Legacy archive** (Q10): the transcripts and task briefs are imported to `data/legacy/archive/`, but no page shows them yet (E5, if wanted).
- **Parity check** (§7.2 step 3): done for the live product (`npm run parity`, 17/10/2026). Other legacy jobs are POD (archived) and are not replayed.
- **Owner actions on the page:** shown on the job panel; no buttons yet (`npm run owner` with the server stopped).
- **Designer brief extract** (legacy item 12): not built (E6 checklist row 15).

## Test status

`npm test`: **281 passed, 0 failed**, after E6 readiness (17/10/2026; new: `e6-prices` 8/8: the owner's prices and caps in config, Haiku just under and just over 100,000 prompt tokens with and without cache, Sonnet's cache prices, reservations by tier, the web fees, the image reservation settled to OpenRouter's reported cost or marked estimated, the scout run cap in the guard and on the whole scout line). Before that: **273 passed, 0 failed**, after the scouting decisions (17/10/2026; `genre-scout` 15/15: 5 new (derivative wording, misspellings, common-word titles, retention, own drafts folder), 3 changed for the new wording and drafts folder). Before that: **268 passed, 0 failed**, after the genre-trend scouting line (17/10/2026; new: `genre-scout` 10/10; changed: `baked-room` (the legacy fixtures view differs in the Research row only)). Before that: **258 passed, 0 failed**, after the importer label fix (17/10/2026; new: `import-legacy` digital room label). Before that: **257 passed, 0 failed**, after the port batch and again after R3b (17/10/2026): new `port-batch` 7/7, `ported/digital-build` 21/21, `ported/owner-approval` 4/4, `ported/prop-edit` 6/6, `ported/listing-photos` 2/2, `ported/style-ref` 5/5 (replaces `ported/listing-notice`), `ported/originality` 62/62 (re-ported), `write-guard` 20/20, `live-ui` 9/9. Before that: **206 passed, 0 failed**, after R3a (17/10/2026); `baked-room` rewritten for both rooms (8/8: both rooms match the engine and fixtures layouts, a layout change makes only that room stale, the look matches the palette and atlas, the 10 MB budget, lightmap UVs and shared textures, default on with `?scene=procedural`, jail). After the R3 spike: 204 passed; new: `baked-room` 6/6 (the bake matches the engine and fixtures layouts, size budget, lightmap UVs, flag only, jail); changed: `write-guard` (the two new scripts' jails). After E5: 198 passed; new: `live-ui` 9/9, `people-looks` 2/2; changed: `import-legacy` (the Legacy lane), `engine-server` and `demo` (idempotency key, resume version), `write-guard` (the E5 capture script's own jail). After Redesign R2: 187 passed; new: `scene-layout` 5/5 (the lounge-seat test), `model` 15/15 (role labels). After Redesign R1: 186 passed (16/10/2026, about 22:00 Irish time). After E4: 182 passed, 0 failed in 14 suites (16/10/2026, about 21:10 Irish time). New in E4: `import-legacy` 4/4, `demo` 9/9 (2 new) and `write-guard` 20/20 (1 new: the importer's writes and source refusals). The table below is from demo mode (175/175).

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

0. **E6 readiness review.** The owner reviews this phase (DECISIONS.md "E6 readiness: owner decisions") and answers
   its open questions: the web fetch reading, the per-run cap (row 19) and the image token estimate (row 20). Written
   Q1 confirmation to be recorded when it arrives. Next lounge re-bake: a ninth seat.
1. Done and approved by the owner (17/10/2026): R3a, R3b, the importer label fix, the port batch before E6, the
   genre-trend scouting line and the scouting decisions.
2. **E6 a0, a, b0, b1 and b2 done; no verified genre brief yet** (b2's rerun stopped on the product key, see "E6 step
   b2"). Owner decision first: how TREND-SCOUT is told the product key (prompt or run input), and whether to run the
   scout again. Then, on the owner's go-ahead: **c0** (images and the style-reference run; no spend). Step **c** needs a
   verified genre brief. Owner to-do: match b2's request ids in the Console. Owner to-do: match the b run's request ids in
   the Console (DECISIONS/PROGRESS "E6 steps b0 and b"). Owner to-do: match request `req_011Cg7xU6wxApdmaNh1rw2VC` in the Console.

### E6 plan: the first real run (each step stops for the owner's go-ahead)

Rules for every step:
- `.env` keeps `STATION_PROVIDER=mock`. Live is set only in the environment of the one command that makes the calls,
  and `loadEnv` never overrides a shell variable. In PowerShell:
  `$env:STATION_PROVIDER='live'; <command>; Remove-Item Env:STATION_PROVIDER`.
  The server and every other process stay on the mock.
- The Station server is stopped during a live command (one engine per data root). The E-STOP (`npm run estop`) works
  throughout. Real rows go to `data/ledger/ledger.jsonl` like any other spend.
- Before each step: `npm run port-drift` and `npm test`. After each step: the results go in PROGRESS.md and
  DECISIONS.md, then a commit; then stop.
- Keys are read from the environment by the provider only. They never reach a log, the ledger, an event, the page or
  the repository.

**a0. Build: live text provider (no spend; go-ahead needed).** **Done 17/10/2026 (`cbb2388`).**
- `providers/index.mjs`: `live` mode gets an Anthropic text provider, with the key read from `ANTHROPIC_API_KEY` when
  it is created. Web and images stay locked: they refuse with "not built". `usage` is settled through the guard
  (tiers and cache prices as tested), and the agents' effort maps to the request.
- Client: the official Anthropic SDK (ENGINE-PLAN §2.3), pinned, its licence in ASSETS.md. This is a new dependency,
  so it needs the owner's OK; the alternative is plain `fetch` with no dependency.
- `scripts/smoke-live.mjs` (`npm run smoke:live`) makes ONE call:
  - `claude-haiku-5-5`, a fixed one-line prompt, `max_tokens` 16;
  - reserved and settled through the guard, with a run cap of USD 0.01;
  - it refuses to run unless its own environment says live, and refuses on the e-stop;
  - it prints the model, the usage, the USD and the ledger entry id.
- Tests against a stubbed client (no network): the key appears in no log, ledger row or event; usage is priced; a
  missing key is refused before any reservation.

**a. One smoke call (go-ahead 1).** **Done 17/10/2026:** "ready", USD 0.000005, one ledger row (see "E6 steps a0
and a" above). As built: max_tokens 32 and thinking disabled (owner), not 16.
- Run `$env:STATION_PROVIDER='live'; npm run smoke:live; Remove-Item Env:STATION_PROVIDER`.
- Expected cost: about 40 input and at most 16 output tokens on Haiku, about USD 0.00001; the reservation is below
  USD 0.001.
- Check:
  - one ledger row, matching the call shown in the Console for the station workspace;
  - `.env` still says mock;
  - no key in `logs/`.
- Stop and report.

**b0. Build: live web backend and the v1 source rule (no spend; go-ahead needed).** **Done 17/10/2026 (`80b034c`, source rule `1b912a7`).**
- `providers.web`: each `web_search` or `web_fetch` becomes one Anthropic call (Haiku) with the server-side tool,
  limited to one search a call. The results come back to TREND-SCOUT as data.
- Ledger: USD 0.01 for each search the response reports, plus that call's tokens at Haiku's prices. The web
  reservation also covers that call's maximum tokens (the 12-call limit is unchanged).
- The v1 source rule. TREND-SCOUT's prompt line becomes "public articles and chart write-ups found by web search;
  never fetch a store chart, browse or streaming page itself (Steam, itch.io, Twitch, YouTube)". If the owner wants it,
  the engine also refuses `web_fetch` to those sites.
- Tests against a stub.

**b. One scout run (go-ahead 2; cap USD 0.50).** **Ran 17/10/2026: USD 0.033242, no genre brief (see "E6 steps b0 and b" above); not rerun.**
- One `genre-scout` job, started by hand by a one-shot command that runs a single job and exits; the routine stays
  disabled.
- Caps: `perJob[genre-scout]` USD 0.50 and 12 web calls (at most USD 0.12 in search fees) are enforced by the engine.
  No cost estimate is given (no real scout has run).
- For review:
  - the internal notes (game names stay in `scouting/`) and the blocklist additions;
  - the genre briefs, verified or rejected;
  - a check that no scouted name appears outside `scouting/`;
  - the ledger rows against the Console.
- Stop and report.

**b1. Output contract + job transcripts, one live rerun (go-ahead "go scout 2").** **Done 17/10/2026 (`795adcb`); rerun USD 0.053095, 0 verified (Etsy fetch refused; see "E6 step b1"). Owner decisions needed: how the scout gets demand evidence, an agent "cannot produce" outcome for the contract, the origin-line/id check, the blocklist placeholder entry.**

**b2. Scout fixes (D1–D4) and one live rerun (go-ahead "go scout 3").** **Done 17/10/2026 (`0ab5b1d`, `308c91a`); rerun USD 0.002051, incomplete: TREND-SCOUT reported blocked on the product key (see "E6 step b2"). Owner decision needed: how the scout is told the product key.**

**c0. Build: images and the style-reference run (no spend; go-ahead needed).**
- OpenRouter image client: `OPENROUTER_API_KEY` from the environment, the one allowed model, and the reported cost
  from the response (marked estimated otherwise).
- The first-file run mode and the reference image in `image_generate` (row 13), mock-tested. These are needed because
  `pngtuber-prop-pack` uses a style reference: without them a new job fails at the package gate after spending.
- Also needed: the image token estimate (row 20) and the owner's answer on the per-run cap (row 19).

**c. One genre brief through the full line (go-ahead 3; cap USD 5.00 for the job).** The owner picks one verified
genre brief from step b.
- **c1:** the first-file run. DESIGNER draws file 1 alone, then the run stops for the owner's decision on file 1
  (`npm run owner`, style reference).
- **c2:** after the owner approves file 1:
  - files 2–12, QA-DESIGN, LISTER, QA-LISTING, the package gate and the package step;
  - the job ends in the approval queue;
  - the whole job (c1 and c2) is held to USD 5.00, and OpenRouter's own USD 2 a day applies.
- For review: the package, `cost.json` with workings, the ledger rows against the Console and OpenRouter's activity
  page, and screenshots.
- Nothing is published. The listing and the final price are the owner's, on Etsy.
- Stop and report.

Re-run `npm run import-legacy` at any time to pick up legacy deltas; it backs up first and changes nothing when there is nothing new.

Before each, run `npm run port-drift` and `npm test`, and commit at the milestone.
