# WRITE-PATH.md — the (disabled) write adapter

**Superseded by ENGINE-PLAN.md (owner-approved 16/10/2026).** The write adapter described below was removed in E1. Its
job (never writing into the legacy build) is now write-guard v2 rule 2 (ENGINE-PLAN.md §8): the engine writes only
inside its own data root, through `dataJail()`, and makes no HTTP call to the legacy system. Kept for the record.


Status: **designed, not wired, not enabled.** v1 of station-office is read-only. This document records how a write
path would work so it can be reviewed before any of it is switched on. Nothing here is implemented beyond the
disabled stub in `src/write-adapter/index.mjs`, which throws on every call and contains no network or file I/O.

## Rules (from the spec and DECISIONS.md 11)

1. One adapter, one module: `src/write-adapter/index.mjs`. No other code may create jobs or routines, call a
   state-changing route, or write under `Virtual-workers/` or `station-workspace/`. `tests/write-guard.test.mjs`
   fails if any does.
2. Behind an env flag that defaults to off: `STATION_OFFICE_WRITE_ENABLED=on` is the only value that enables it.
3. "Needs my OK" is forced on and cannot be turned off from the page:
   - a **job** is created but **not started**. The owner starts it from the office UI with a second, explicit action.
   - a **routine** is created with `enabled:false` (StarNet shows it as paused). The owner enables it from the office UI.
   The adapter never sends `arm`, `run`, `continue` or any "fire now" request.
4. The adapter must not rely on StarNet's "review before LISTER" pause. That pause is becoming a config flag that
   defaults to off (owner, 2026-10-16). The only human gate inside the pipeline is the approval queue before the
   owner publishes to Etsy; the office's gate is *before* the line starts.
5. Only StarNet's own existing job-creation mechanisms (REUSE.md §5):
   - jobs: the step-through line run that `station/scripts/lib/run-line.mjs` uses (a routing step-test on line
     `p33`, started from a verified brief). The folder trigger (disabled since the 2026-10-15 incident) and the
     ad-hoc `/api/run` path are **not** used.
   - routines: the cron-job creation that `station/scripts/lib/research-routines.mjs planRoutines` uses, with
     `enabled:false`.
   The route strings are deliberately not present in the adapter stub; they are added only when wiring is approved.

## Proposed flow (not implemented)

```
owner types a task in the office panel  ->  office server validates (dept, brief id, text <= 4000 chars)
  -> adapter.createJob({ listingId, briefText, lineId:'p33' })
       -> StarNet step-test session created in the paused/not-started state   [needs my OK]
       -> office shows the job in "Waiting for my approval" with a Start button
  -> owner clicks Start  ->  adapter.startJob(sessionId)  (first hop only; later hops run as StarNet's line does)

owner schedules in the calendar popover  ->  adapter.createRoutine({ name, prompt, scheduleExpr, agentId, workdir })
       -> cron job created with enabled:false                                 [needs my OK]
       -> office shows it as "paused · waits for my OK" with an Enable button
  -> owner clicks Enable  ->  adapter.enableRoutine(id)  (a patch that sets enabled:true, nothing else)
```

Every adapter call would be logged (route, body with the token redacted, StarNet's response id) to
`office-agents/logs/`, and every call would require the office page to send a one-time confirmation nonce that
the server issued for that specific action, so a stale tab cannot replay a write.

## What wiring would need

- Owner approval of this document (and of the exact route list, which will be added to a separate
  `ALLOWED_WRITE_ROUTES` constant inside the adapter only).
- `STATION_OFFICE_STARNET_API` and `STATION_OFFICE_STARNET_TOKEN` in `office-agents/.env` (server only).
- The write-guard test extended so that the adapter is the only file allowed to name those write routes, and so
  that `createJob`/`createRoutine` are only reachable from one server route that checks the env flag and the nonce.
- A dry-run mode (`STATION_OFFICE_WRITE_ENABLED=dry`) that logs the request it would send and sends nothing, to be
  used first.

## What it will never do

- Call `POST /api/save` or `POST /api/roster` (the stale-tab overwrite paths).
- Enable, arm or fire a routine without the owner's explicit click.
- Write files under `station-workspace/` or `Virtual-workers/station/`.
- Put the StarNet token anywhere the browser can read it.
