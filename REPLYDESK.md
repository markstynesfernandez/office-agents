# REPLYDESK

R0.1: ReplyDesk facts and a secrets check of its git history, 24/10/2026. Read-only on
`C:\Users\marks\review-reply-service`: nothing modified, committed, pushed, fetched or checked
out there; the uncommitted `stripe_smoke.py` edit left alone. No secret value was printed or
recorded; only paths, commits, dates, branches and counts.

## Secrets verdict: clean

Nothing to rotate. No real secret was found in any commit on any branch, and none of the
sensitive files was ever committed. Two `.gitignore` gaps and one privacy point are below; none
of them needs a rotation.

## Scope

- Refs: `main`, `origin/main` and the 17 remote-tracking `origin/outreach/2026-06-15` …
  `origin/outreach/2026-10-05` (20 refs, 36 commits, 108 distinct path/blob pairs). No stash,
  no other refs.
- Remote-tracking refs as of the last fetch, 23/10/2026 10:30 (`.git/FETCH_HEAD`). Anything
  pushed to GitHub after that, branches deleted on GitHub before it was fetched, and
  unreachable objects are not covered.
- Git only (`rev-list --all`, `ls-tree`, `cat-file`, `check-ignore`) with a small Python
  reader in the session scratchpad; nothing installed. Commit messages scanned too.

## 2a. Sensitive files ever committed

| Path | First commit | Last commit | Branches | In current tree |
|---|---|---|---|---|
| `.env` | never | | | no (on disk, ignored) |
| `.env.*` other than `.env.example` | never | | | no |
| `replydesk.db`, `*.db`, `*.sqlite` | never | | | no (`replydesk.db` on disk, ignored) |
| `.venv/` | never | | | no (on disk, ignored) |
| name with key / secret / credential / token | never | | | |
| `.env.example` | `a70ce95` 06/06/2026 | `a70ce95` (one version, never changed) | all 20 refs | yes |
| `.claude/settings.local.json` (not on the list; reported because it is local config) | `a70ce95` 06/06/2026 | `758adc2` 06/06/2026, removed ("stop tracking .claude/") | all 20 refs | no |

`.env.example`: every secret variable is empty or a placeholder (`SECRET_KEY` is a 9-character
low-entropy placeholder; `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` empty). No version of
`.claude/settings.local.json` had a pattern or high-entropy hit.

## 2b. Content scan of all history

Patterns: Stripe `sk_live_` / `sk_test_` / `rk_` / `whsec_` / `pk_`, Google `AIza` and
`GOCSPX-` and `client_secret` assignments, Anthropic `sk-ant-`, OpenAI `sk-` / `sk-proj-`,
`-----BEGIN … PRIVATE KEY-----`, `SECRET_KEY` assignments, Render `rnd_`, GitHub
`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`/`github_pat_`; plus a generic sweep for high-entropy tokens
(24+ characters, mixed case and digits).

| Pattern type | Path | Commit (first seen) | Finding |
|---|---|---|---|
| Flask `SECRET_KEY` | `.env.example` | `a70ce95` | placeholder |
| Flask `SECRET_KEY` | `config.py` | `a70ce95` | read from the environment |
| Flask `SECRET_KEY` | `app.py` | `d03a9ab` | code: refuses to start on the dev default or a key under 16 characters |
| Flask `SECRET_KEY` | `GO_LIVE.md` | `d03a9ab` | instructions, placeholder |
| Stripe key variable | `setup_stripe.py` | `a70ce95` | code reading `Config.STRIPE_SECRET_KEY` |
| Google `client_secret` | `google_business.py` | `a70ce95` | code reading `Config.GOOGLE_CLIENT_SECRET` |
| Stripe `whsec_` | `test_replydesk.py` | `d03a9ab` | 16-character test fixture |
| High-entropy | `.env.example` | `a70ce95` | model id strings (`VOICE_MODEL`, `REPLY_MODEL`) |
| High-entropy | `outreach/batches/` (2026-06-15, -06-22, -07-27, -09-28) | outreach branches | source URLs |

No hit in any commit message. No Stripe live or test secret key, restricted key, webhook
secret, Google API key or OAuth secret, Anthropic, OpenAI, Render or GitHub token, or private
key anywhere in history.

## 2c. `.gitignore` now (`git check-ignore -v`)

- `.env`: ignored (`.gitignore:1`).
- `*.db` / `replydesk.db`: ignored (`.gitignore:2`).
- `.venv` / `.venv/`: ignored (`.gitignore:5`).
- `.claude/`: ignored (`.gitignore:7`).
- **Not ignored:** `.env.*` (e.g. `.env.local`, `.env.production` would be committable),
  `*.sqlite`, and SQLite side files (`*.db-wal`, `*.db-shm`, `*.db-journal` don't match `*.db`).
  For the owner to decide; not changed.

## 2d. Is the GitHub repo private?

Can't tell without the network. The local config only has
`origin = https://github.com/markstynesfernandez/Review-Service.git`; nothing local records
visibility.

## Facts

- **Stack:** Python 3.12, Flask 3, Anthropic SDK (drafts replies), APScheduler (poller and
  daily digest, off on the free tier), Stripe (billing and webhook), Google Business Profile
  API (optional), SMTP (optional), SQLite locally and Postgres (`psycopg`) when `DATABASE_URL`
  is set, gunicorn (1 worker, 8 threads). Frontend: `templates/index.html`, `static/app.js`,
  `static/style.css`.
- **Test command:** `python -m pytest -q` (CI, `.github/workflows/ci.yml`, mock mode, no
  secrets), 27 test functions in `test_replydesk.py`. CI also runs a Postgres 16 smoke job
  (`init_db`, `/api/health`, existing-DB upgrade). Not run in this check (read-only).
- **Deploy target:** Render web service `replydesk` from `render.yaml` (Blueprint, free plan,
  `autoDeploy: true` from GitHub, health check `/api/health`, `APP_BASE_URL`
  `https://replydesk.onrender.com`); database on Neon via `DATABASE_URL`; secrets set in the
  Render dashboard (`sync: false`), `SECRET_KEY` generated by Render. Local: `run.bat`.
- **What creates `outreach/YYYY-MM-DD` branches:** nothing in the repo runs it. The repo holds
  the playbook, `outreach/WEEKLY_PROSPECTING.md` (added `4eb452f`, 12/06/2026), which tells the
  agent to commit the batch on a branch and open a PR, never push to main. The runner is
  outside the repo: 16 of the 17 branch tips are authored "Claude" (a scheduled routine); the
  first, 2026-06-15, by `markstynesfernandez`. Weekly from 15/06 to 05/10/2026; none since,
  consistent with the owner pausing the routine (R0.3).
- **Send or draft:** drafts only. Every `contacted.md` row on every branch is "drafted … — not
  sent" or "Draft — not yet sent"; every "sent" in a batch file is in a quoted news story; the
  2026-08-31 batch says "Nothing has been sent". 2026-07-06 is a null run (no web access).

## Other findings (no action taken)

- **Dedup doesn't work.** No outreach branch was merged into `main` (each is 1–2 commits ahead),
  so `main`'s `outreach/contacted.md` still has 2 rows and each run starts from it. One
  prospect appears in 11 of the 17 batches.
- **Personal data on GitHub.** The outreach batch files name individual reviewers and business
  owners and carry business contact emails and phone numbers, on 17 branches of the GitHub
  remote. Not a secret, so no rotation, but worth a privacy decision (keep, trim, or delete the
  branches) and it matters more if the repo is public (2d). `prospect_alpana.json` is only on
  `origin/outreach/2026-09-14` (`0b42afd`).
