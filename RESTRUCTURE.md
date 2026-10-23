# RESTRUCTURE: the Station becomes a software company (R0 plan)

Owner decision, 22/10/2026: a complete restructure. Etsy production stops; it was a proving exercise. The Station becomes a
software company that builds, sells and keeps customers for the owner's products: first **ReplyDesk** (review-reply SaaS, repo
`markstynesfernandez/Review-Service`), then **emty-inbox** (inbox copilot SaaS, repo `markstynesfernandez/emty-inbox`). Agents run
the work autonomously; the owner is the human oversight and always has the final call, including the ethical calls.

This is a plan only (R0, 23/10/2026). No engine or app code changed. Nothing here is decided until the owner answers §9 and says
"go R1". Every cap, budget and cost below is a **proposal or an estimate**, marked as such; the owner sets caps (DECISIONS.md Q7).

Contents: 0 what exists today · 1 org chart · 2 agents · 3 autonomy policy · 4 ethics and law gates · 5 engineering safety ·
6 integrations · 7 the 3D office · 8 phased build · 9 open questions.

---

## 0. What exists today (read 23/10/2026, main at `df1a58d`)

What the restructure keeps, because it is the hard part and it works:

| Part | Today | In the new company |
|---|---|---|
| Engine (`src/engine/engine.mjs`, `runtime.mjs`) | one model–tool loop per agent run; reserve → call → settle → tools | kept as is |
| Spend guard (`guard.mjs`, `spend.mjs`) | caps per run (USD 2.00), job (7.00; research 1.00, scout 0.50), line-day, business month (etsy-shop 200), station day (10.00); crash-safe reservations; unknown price refuses | kept; "business month" becomes "product month"; a department job cap added (§2) |
| Ledger (`ledger.mjs`) | append-only JSONL with fsync, the only source of cost; SQLite mirror | kept; rows carry `productId` and `departmentId` |
| E-stop (`halt.mjs`) | page, `data/HALT`, `npm run estop`; kills every call and the ESRGAN child | kept; also kills every `run_check` child (§5) |
| Data jail (`store/jail.mjs`) + write-guard test | every write inside the data root and `logs/`; the test fails on any unjailed write | kept; product worktrees live under the data root so the jail covers them |
| Tools (`tools/index.mjs`) | `fs_read/list/write`, `image_*`, `web_*`, `submit_verdict`, `report_blocked`; `FORBIDDEN_TOOL_RE` refuses any tool named send/mail/post/shell/exec/browser/mcp… | kept; new tools `code_search` and `run_check` (§5) are named to stay outside that pattern, and the pattern stays |
| Approval queue (`store/db.mjs` `approvals`) | one row per Etsy job (`job_id` is the key), the only human gate | generalised into **requests** (§3): one row per owner-approval action, any product, any department |
| Live / dev instances (`instance.mjs`, `deploy-live.mjs`) | live in `office-agents-live` (branch `live`, port 8790), dev here (mock, 8792); deploy needs a recorded test pass; rollback | kept unchanged |
| Routines (`scheduler.mjs`) | croner, Europe/Dublin, always seeded disabled; arming is the owner's approval with a spend confirm | kept; new routines (OVERSEER daily, lead research, churn report) seeded disabled |
| B0 building (`business.mjs`, `config/businesses/`, `config/building.json`) | a business = a floor with departments, lines, agents, budget, dataDir, `allowedOutbound`; `business_id` on every record; `foreignDataMarkers` refuse another company's data | **replaced** by products × departments (§1.3); the building check, the record stamping, the migration pattern and `foreignDataMarkers` are reused |
| Web tools policy (`config/engine.json` `webSources`) | blocked domains sent to the API and refused by the engine before any spend | kept; Sales adds domains whose terms bar automated collection (§4) |
| Etsy own-shop connection (`providers/etsy.mjs`, E7a) | OAuth PKCE, read scopes only, owner-clicked, USD 0 rows | kept read-only on the archived Etsy floor |
| 3D office (`src/web/scene/`, `ui/floors.js`, `ui/building.js`) | floor switcher, whole-building view; floor 1 baked (Research, Design, Office, atrium), floor 0 procedural; 145+ fps on the Intel UHD iGPU | reused (§7) |

What it retires: the Etsy lines (`research`, `genre-scout`, `room1-digital`), their eight agents, the Etsy skills and the Etsy-only
gates (originality screens for images, the package gate, listing QA, Real-ESRGAN). Nothing is deleted: they become the archived
Etsy floor (§1.1). W6, interrupted mid-build, is parked on branch `w6-wip` (it failed 2 of 512 tests; see DECISIONS.md "R0").

Not deployed to live today: W4 (`d342d91`) and B0 (`df1a58d`). Live runs L3.1 (`9122435`). R1's migration must therefore start from
a pre-B0 data root as well as a B0 one (§8, R1).

---

## 1. Org chart: departments as floors

### 1.1 Floors

| Floor | Department | Rooms / functions | Agents |
|---|---|---|---|
| **0** | **Headquarters** (shared) | **Owner's office**: the requests queue (every owner-approval action), the autonomy policy log, the daily report. **Finance**: spend per product and department from the ledger, budgets, MRR per product (Stripe read-only from R4; "not connected" until then). **Compliance & Ethics**: every outbound draft's review, the suppression list, the lawful-basis records, the claims register. **Operations**: OVERSEER's daily report to the owner. **Lounge**. | OVERSEER, COMPLIANCE |
| **1** | **Engineering** | Product desk, development bay, review desk, test bench; a CI wall showing each product's last checks | PRODUCT, DEVELOPER, REVIEWER, TESTER |
| **2** | **Sales & Marketing** | Lead research, outreach desk, content desk, the pipeline board | LEAD-RESEARCHER, LEAD-CHECKER, OUTREACH-WRITER, CONTENT-WRITER |
| **3** | **Customer Success** | Onboarding, support desk, retention desk | ONBOARDING-GUIDE, SUPPORT-DRAFTER, RETENTION-ANALYST |
| **4** | **Etsy (archived)** | Today's floor-1 office, frozen: job history, packages, the ledger, the old approval queue, the live listings via the read-only own-shop connection | none running (eight archived agents shown at empty desks) |

Floor numbers are labels: the Etsy bake moves from floor 1 to floor 4 unchanged (§7). Finance is mechanical (computed from the
ledger and, later, Stripe), not an agent: figures must reconcile to the ledger, and a model adds cost and risk there for nothing.

### 1.2 Products: a first-class dimension

Every job, run, ledger row, event, request (approval), lead, ticket and routine carries **`product_id`** and **`department_id`**.

| Product id | Name | Repo | Status |
|---|---|---|---|
| `replydesk` | ReplyDesk | `markstynesfernandez/Review-Service` (local clone: `C:\Users\marks\review-reply-service`, env `REPLYDESK_REPO`; main at `d03a9ab`) | active from R2; facts in §5.8 |
| `emty-inbox` | emty-inbox (package name `inbox-copilot`) | `markstynesfernandez/emty-inbox` (local: `C:\Users\marks\projects\Emty-inbox`, read only for R0) | second; see §9 Q4 before any work |
| `etsy-shop` | TheStationShopFinds | n/a | archived (all history) |
| `station` | the Station itself | this repo | HQ and station-wide records (today's "shared") |

Each product has its own monthly budget and optional day cap (B0's guard logic, renamed), and its own autonomy overrides, which may
only be **stricter** than the station's policy (§3). A job without a product is refused, except on HQ (`station`).

### 1.3 How this replaces B0, and how data migrates

B0 made a business the unit of floor, budget, data and rules. The new company splits that into two axes: **departments** own floors,
rooms, agents and lines; **products** own budgets, repos, data and policy overrides. A department works on many products.

| B0 | New |
|---|---|
| `config/businesses/<id>.json` (floor, departments, lines, agents, monthlyBudgetUsd, dailyCapUsd, allowedOutbound, dataDir, ownerApprovalRequired) | `config/departments/<id>.json` (floor, rooms, agents, lines, status) **and** `config/products/<id>.json` (name, repo, status, monthlyBudgetUsd, dailyCapUsd, jobCapUsdByDepartment, runChecks, readOnlyApi, policy overrides, dataDir `products/<id>/`) |
| `config/office.json` `shared` (floor 0) | `config/departments/hq.json` |
| `allowedOutbound` + owner click | the autonomy policy (§3); the one existing outbound action `etsy:read-own-shop` becomes the action `etsy.read-own-shop` (owner, archived product) |
| `ownerApprovalRequired: true` (cannot be false) | kept as a building invariant: anything "owner" in the policy can never be lowered to "auto" by a product override |
| `business_id` column on jobs, runs, routines, approvals, ledger mirror | `product_id` + `department_id` columns; `business_id` kept, read only, for one release |
| `config/building.json` `foreignDataMarkers` | kept unchanged (see §9 Q4 for emty-inbox) |
| `business.mjs` building check | `building.mjs`: a floor used once, an agent in exactly one department, a line in one department, a product id on every product-department job, a product override never looser than the station policy; failure stops the engine with the reason (as B0) |
| `config/products.json` (Etsy product specs) | moved to `config/archive/etsy/products.json` so `config/products/` is unambiguous |

**Migration** (`npm run migrate:products`, the B0 pattern): dry run by default; `--apply` takes a full backup first
(`data/.backups/products-<stamp>/`, SQLite `VACUUM INTO`, nothing deleted), adds the columns, sets every empty value in one
transaction, logs every change, checks nothing is left, holds the engine lock, is idempotent (a second run changes nothing and takes
no backup), and refuses to apply while any record cannot be mapped. It accepts a **pre-B0 root** (it runs B0's mapping first, in
the same transaction) and a B0 root, so live can go from L3.1 straight to R1 with one migration. Mapping: every Etsy record
(`etsy-shop`, or pre-B0 with an Etsy line or agent) → product `etsy-shop`, department `etsy`; "shared" → product `station`,
department `hq`. The ledger and event JSONL files stay append-only and are resolved on read, as B0 does. The old `approvals` table is
kept read only for the Etsy history; new requests go to a new table (§3), so a rollback to older code still finds its own table.

---

## 2. Every agent

Model tiers are today's (`config/engine.json` `tiers`): **cheap** = Claude Haiku 5.5, **strong** = Claude Sonnet 5.5. Prices in
config: Haiku USD 0.10 / 0.50 per M input / output (cache read 0.01), Sonnet USD 2 / 10 (cache read 0.10, cache write 2.50). Today
every agent has thinking "off" (owner D2); the table proposes where "default" (adaptive) should be considered (§9 Q8). Caps are
**proposals**: per-run cap stays the station's USD 2.00 unless stated; job caps per department are in §8.

### 2.1 New and reused agents

| Agent | Dept | Purpose | Model, effort, thinking | Tools | Limits (proposed) | Inputs → outputs |
|---|---|---|---|---|---|---|
| **OVERSEER** (reused, new prompt) | HQ / Operations | Daily report to the owner | Sonnet, low, off | `fs_read`, `fs_write` (reports only) | 20 turns, run cap USD 0.20 | metrics JSON the engine writes (spend per product/department, MRR, pipeline counts, open requests, blocked jobs, policy changes, compliance refusals) → `reports/YYYY-MM-DD.md` in the Owner's office |
| **COMPLIANCE** (new; reuses the verdict protocol) | HQ / Compliance & Ethics | Reviews every outbound draft before the owner sees it | Sonnet, medium, off (consider default) | `fs_read`, `fs_list`, `submit_verdict` | 20 turns, run cap USD 0.10 | draft + the claims register + the lawful-basis record + the mechanical gate's results → verdict `pass` / `revise` / `refuse` with checks: truthful and evidenced claims, no pressure tactics or false urgency, AI disclosure where it applies, opt-out and sender identity present, tone. A `refuse` cannot be overridden by an agent; the owner can still decide (logged) |
| **PRODUCT** (new) | Engineering | Turns an issue into a spec with acceptance criteria | Sonnet, medium, off | `fs_read`, `fs_list`, `fs_write` (job folder), `code_search` (read only, worktree) | 30 turns | issue text (owner-entered or read from GitHub issues, read only) + the repo → `spec.md` (problem, scope, out of scope, acceptance criteria as testable statements, files likely touched, risk notes) |
| **DEVELOPER** (new) | Engineering | Writes the code on a branch in a git worktree | Sonnet, medium, off (consider default) | `fs_read`, `fs_list`, `fs_write` (worktree, §5 refusals), `code_search`, `run_check` | 60 turns, 10 `run_check` calls per run | `spec.md` + the worktree + TESTER/REVIEWER findings on a rework → code changes and tests in `dev/<job-id>`; `notes.md` (what changed, how each criterion is met) |
| **TESTER** (new) | Engineering | Runs the product's own tests and linters and turns failures into findings | Haiku, low, off | `fs_read`, `fs_list`, `run_check`, `submit_verdict` | 20 turns, 8 `run_check` calls | the worktree + `spec.md` → verdict `pass` / `fail` with each failing check, the cause in one line, and which acceptance criteria have a test |
| **REVIEWER** (new; reuses the verdict protocol) | Engineering | Reviews the diff against the spec, for security and secrets | Sonnet, medium, off (consider default) | `fs_read`, `fs_list`, `code_search`, `submit_verdict` | 30 turns | `diff.patch` (engine-made), `spec.md`, test results, the mechanical secret and dependency gates' results → verdict `approve` / `revise` (with file and line findings) / `refuse` |
| **LEAD-RESEARCHER** (new) | Sales & Marketing | Finds business prospects for a product from public business sources | Haiku, low, off | `fs_read`, `fs_list`, `fs_write` (job folder), `web_search`, `web_fetch` | 40 turns, 12 web calls | the product's ideal-customer profile (owner-written) → `leads.json`: organisation, role-based or published business contact, source URL, date seen, why relevant, proposed lawful basis |
| **LEAD-CHECKER** (reuses EVIDENCE-CHECKER's verification pattern) | Sales & Marketing | Re-checks each lead's source and fitness | Haiku, low, off | `fs_read`, `fs_list`, `fs_write`, `web_fetch` | 30 turns, 6 fetches | `leads.json` → each lead `verified` / `rejected` with the reason (source not a public business source, personal address, sole trader, terms bar collection, not relevant) |
| **OUTREACH-WRITER** (new) | Sales & Marketing | Drafts first-contact and follow-up emails | Sonnet, low, off | `fs_read`, `fs_list`, `fs_write` (job folder) | 20 turns | a verified lead + the product facts sheet + the claims register → `draft.md` (the engine adds sender identity, the Art. 14 notice line and the opt-out; §4) |
| **CONTENT-WRITER** (new) | Sales & Marketing | Drafts landing-page copy, blog posts, product-update notes | Sonnet, low, off | `fs_read`, `fs_list`, `fs_write` (job folder) | 30 turns | a brief + facts sheet + claims register → draft files (never published by the Station) |
| **ONBOARDING-GUIDE** (new, R4) | Customer Success | Drafts onboarding emails and checklists for a new customer | Sonnet, low, off | `fs_read`, `fs_list`, `fs_write` | 20 turns | account summary from the product's read-only API (plan, setup state; no message content) → draft email + checklist |
| **SUPPORT-DRAFTER** (new, R4) | Customer Success | Drafts a reply to one support ticket | Sonnet, low, off | `fs_read`, `fs_list`, `fs_write`, `support_ticket_read` (one ticket, read only) | 20 turns | one ticket through the product's read-only interface + the product docs → `reply.md` |
| **RETENTION-ANALYST** (new, R4) | Customer Success | Weekly retention and churn signals | Haiku, low, off | `fs_read`, `fs_write` (reports) | 20 turns | aggregated per-account usage counts and billing state (no personal data, account ids only) → `retention-YYYY-Www.md` with accounts at risk and the signal |

No agent has a send, post, merge, deploy, push, shell or browser tool. Pushing, sending and posting, when the owner approves them,
are done by the engine's own executors (or by the owner by hand), never by an agent (§3).

### 2.2 Retired (archived, not deleted)

DEMAND-RESEARCHER, EVIDENCE-CHECKER (as an Etsy agent), TREND-SCOUT, DESIGNER, QA-DESIGN, LISTER, QA-LISTING, REJECTS-DESK. Their
config files stay where they are with `"archived": true`; the engine refuses to run an archived agent; their desks show on the Etsy
floor, dimmed. Their prompts and the Etsy skills (`etsy-policy`, `price-*`, `package-format*`, `originality-*`, `digital-terms`,
`brief-format`, `scout-brief-format`, `demand-evidence`) stay for the record. Reused patterns, not agents: the verdict protocol
(`submit_verdict`, `verdict-protocol.md`), `report_blocked`, EVIDENCE-CHECKER's "fetched in this run or not reachable" rule,
REJECTS-DESK's record of why a job stopped (now written by the engine), `data-hygiene.md`.

---

## 3. Autonomy policy (config, enforced by the engine)

**File**: `config/autonomy.json`. Every action type has one level: **`auto`**, **`owner`** (the engine files a request in the
Owner's office and the job waits) or **`forbidden`** (refused, logged, the job blocks with the reason).

**Enforcement**:
1. Every tool and every mechanical step declares the action it performs in a fixed table in code. The runtime checks the policy
   **before** the guard reserves any spend. An action not in the file is **forbidden** (fail closed); a tool with no declared action
   stops the engine at start.
2. A product override (`config/products/<id>.json` `policy`) may only move an action to a stricter level. A looser override stops the
   engine with the reason.
3. **Changes are made only in the file, by the owner.** The page shows the policy and cannot edit it. At every start the engine
   compares the file's sha256 with the last recorded one; if it changed, it appends a row per changed action to
   `data/policy/autonomy-log.jsonl` (time, action, old → new, file sha256, git commit, instance) and shows it in the Owner's office
   and the next daily report. The live instance already refuses to start with uncommitted tracked changes, so every live change is
   also a commit.
4. An `owner` request records: product, department, job, action, a one-line summary, the payload's sha256 (the exact text or diff
   approved), COMPLIANCE's verdict where required, and the decision (approved / rejected, the owner's words, date). If the payload
   changes after approval, the approval no longer matches and the executor refuses.

**Defaults** (owner may change any level in the file; see §9 Q7 on locking the legal ones):

| Action | Level | Executed by, after approval |
|---|---|---|
| `research.web` (public business sources, blocked domains honoured) | auto | agent |
| `draft.write` (any draft in the job folder) | auto | agent |
| `spec.write`, `report.write`, `crm.write` (internal pipeline record) | auto | agent / engine |
| `code.edit` (worktree, branch `dev/<job-id>`) | auto | agent |
| `code.check` (`run_check`: allowlisted test, lint, typecheck, format check) | auto | engine |
| `code.review`, `code.commit` (local commit on `dev/<job-id>`) | auto | agent / engine |
| `product.read` (a product's read-only interface, one record at a time) | auto | engine |
| `email.send.prospect` | owner | the owner sends from their own mailbox (R3); an engine sender later only on a separate decision |
| `email.send.customer`, `support.reply.send` | owner | as above |
| `git.push.branch` (push `dev/<job-id>` to the product repo, open a PR) | owner | engine (refspec `dev/<job-id>` only) — §9 Q6 |
| `git.merge` | owner | **the owner, by hand on GitHub**; the Station holds no credential that can merge |
| `deploy` | owner | **the owner, by hand**; the Station holds no deploy credential |
| `price.set`, `refund.issue` | owner | the owner, in Stripe or the product's admin |
| `public.post` (landing page, blog, social, directory listing) | owner | the owner |
| `dependency.add` (any change to dependencies or the lockfile) | owner | the owner approves; the engine then installs offline from the lockfile |
| `ci.change` (`.github/workflows/**`, other CI config) | owner | as a normal merge |
| `lead.source.add` (a new source or country for leads) | owner | config change |
| `etsy.read-own-shop` (archived floor) | owner | engine (the owner's click, as E7a) |
| `git.merge.agent`, `deploy.agent` (an agent or the engine merging or deploying) | forbidden | — |
| `secrets.read` (`.env*`, keys, tokens, credential files; by path and by content) | forbidden | — |
| `personal-data.scrape` (collecting personal data, or any collection that breaks a site's terms) | forbidden | — |
| `review.fake`, `account.fake` (fake reviews, testimonials, sock-puppet accounts) | forbidden | — |
| `claim.misleading` (a claim not in the claims register, false urgency, fake scarcity) | forbidden | — |
| `dependency.install.agent`, `network.from-checks` | forbidden | — |
| `customer-data.bulk-export` | forbidden | — |
| `email.send.agent` (an agent sending directly) | forbidden | — |

`claim.misleading` and `review.fake` cannot be fully detected by code. Code enforces what it can (the claims register match, the
absence of any review-posting or account-creating tool, the blocked domains); COMPLIANCE and the owner catch the rest. The plan does
not pretend otherwise.

---

## 4. Ethics and law gates

**Order for every outbound draft**: agent draft → **mechanical gate** (deterministic) → **COMPLIANCE** verdict → the owner's request.
A `revise` goes back to the drafting agent at most twice, then the job blocks. The owner sees the draft, the gate results and
COMPLIANCE's verdict together.

**Mechanical gate** (code, no model): every factual claim about a product matches the product's **claims register**
(`config/products/<id>/claims.md`: each claim with its evidence and date, owner-approved); the sender identity (the company's legal
name and address) and a working **opt-out** are present (added by the engine, not the model); the recipient is not on the
**suppression list**; the lead has a recorded lawful basis and source; no blocked words (urgency and pressure patterns, "guaranteed",
invented figures); `foreignDataMarkers` (§1.3); AI disclosure line present where the product's config requires it.

**COMPLIANCE checks** (judgement): truthful, not misleading by omission; no pressure tactics; respectful tone; AI disclosure where
relevant (the EU AI Act's transparency duties under Article 50 apply from 2 August 2026 to systems that interact with people and to
some AI-generated content; COMPLIANCE flags where they bite, e.g. ReplyDesk's own generated review replies; the exact scope is a
question for legal advice, §9 Q9).

**Sales outreach in Ireland and the EU (GDPR and ePrivacy)**. This is the plan's rule set, **to be confirmed by legal advice before
R3 runs live** (the Irish ePrivacy Regulations, S.I. 336/2011 Regulation 13, treat email marketing to individuals and to corporate
subscribers differently, and other EU states are stricter for B2B email, e.g. Germany):

1. **Business contacts only**: an organisation's published business address (role-based such as `info@`, or a named contact the
   organisation itself publishes for that role). Never a personal address, never a sole trader's or individual's contact without
   consent.
2. **Sources**: public business sources (the organisation's own website, official registers such as the CRO's open data, official
   APIs used within their terms). Never scraping that breaks a site's terms; domains whose terms bar automated collection (e.g.
   `linkedin.com`) go in `webSources.blockedDomains` and are refused before any spend, as Etsy is today.
3. **Lawful basis recorded per lead**: legitimate interests, with the legitimate-interests assessment kept once per product and
   segment (owner-approved), the source URL and the date seen.
4. **Article 14 notice in the first message**: who we are, where we found the address, why we write, how to object.
5. **An opt-out in every message**, honoured at once by the owner's action and recorded by the engine.
6. **Suppression list honoured forever**: an objection or opt-out adds the address (stored as a keyed hash plus the date, the minimum
   needed to honour it) to `crm.suppression`; the gate refuses any lead or draft that matches; there is no tool to remove an entry.
7. **Retention**: an unconverted lead is deleted after a period the owner sets (proposed 12 months from last contact; §9 Q9), by a
   logged routine; the suppression entry stays.
8. **Countries**: Ireland first; each further country is a `lead.source.add` owner decision after its rules are checked.

**Customer data stays in each product's own systems.** The Station never holds a copy of customer mailboxes, reviews or tickets.
Agents see one record at a time through the product's **read-only interface** (an authenticated endpoint the product exposes for the
Station, scoped and rate-limited), and only what the task needs; the Station keeps the draft and the record id, not the content.
No bulk export exists (forbidden, §3). A new data flow (a new tool, a new field, sharing, retention) is a GDPR decision recorded in
DECISIONS.md before it is built: what, why, how long, which processor.

---

## 5. Engineering safety

1. **Repos**: the engine keeps a mirror of each product repo at `data/products/<id>/repo.git` (fetched by the engine with a
   **read-only** credential; `git fetch` is `auto`). Agents never touch the mirror.
2. **Worktree-only writes**: for each job the engine (a mechanical step, not an agent) runs
   `git worktree add data/products/<id>/worktrees/<job-id> -b dev/<job-id> origin/main`. DEVELOPER's `fs_write` is jailed to that
   worktree (the data jail already covers the data root). The engine refuses any ref other than `dev/<job-id>`; it removes the
   worktree when the job ends (the branch stays in the mirror).
3. **Refused paths and content**: no read or write of `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_*`, `.npmrc`, `.pypirc`,
   `credentials*`, `secrets/**`, `.git/**`; `.github/workflows/**` is writable only as a `ci.change` (owner). On read, a file whose
   content matches a secret pattern (API key prefixes, private key blocks, connection strings with passwords) is withheld with a
   note. On commit, the engine scans the whole diff with the same patterns and refuses the commit on any hit. Built in, no new
   dependency.
4. **`run_check`** (the only process an agent can cause): input is a check name (`test`, `lint`, `typecheck`, `format`) and
   optionally a test-file filter, mapped to a fixed argv in `config/products/<id>.json` `runChecks` (for emty-inbox today: `pnpm
   test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`; for ReplyDesk `python -m pytest -q`, as its CI runs it; it has no
   linter or type check configured, §5.8). Spawned with `execFile` (no
   shell), cwd the worktree, a minimal environment (no key, no token, no home credentials; proxy variables pointed at a closed local
   port), a timeout (proposed 300 s, whole process tree killed), output capped at 200 KB, killed by the E-STOP. **No network**: true
   network isolation on Windows needs an OS boundary; the plan's recommendation is a container with `--network none` per check
   (§9 Q5). Until then the environment above is best-effort, and the plan says so.
5. **Dependency installs refused**: no `install`/`add` command is in any allowlist. A change to dependency fields or the lockfile is
   detected in the diff and becomes a `dependency.add` request. The worktree's `node_modules` come from an engine step
   (`pnpm install --frozen-lockfile --offline`) from the owner's existing store, against the unchanged lockfile only.
6. **Branches** `dev/<job-id>` only. **The owner merges and deploys**, by hand. The Station holds no merge or deploy credential. If
   the owner allows `git.push.branch`, the push token must not be able to write to `main`: a GitHub ruleset protecting `main` (PR
   required, no bypass for the token) is set by the owner on GitHub before R2's first push.
7. **Prompt injection**: issue text, repo content, test output and web pages are data, never instructions (as today's tool
   descriptions say). Agents have no outbound tool, so an injected instruction can at worst write code in a throwaway worktree that
   REVIEWER, the gates and the owner then see.
8. **ReplyDesk, the first product repo** (read-only check, 23/10/2026; nothing in the clone was changed):
   - **Where**: `C:\Users\marks\review-reply-service`, an existing clone of `markstynesfernandez/Review-Service`, branch `main` at
     `d03a9ab` ("Production hardening: secure billing webhooks, AI output safety, multi-tenant + ops fixes"), level with
     `origin/main`; one uncommitted local change (`stripe_smoke.py`), which is the owner's. The engine reads the path from
     `REPLYDESK_REPO=C:\Users\marks\review-reply-service`; it fetches into its own mirror (item 1) and never writes to this clone.
   - **Stack**: Python with Flask (`app.py`, `requirements.txt`); tests with pytest (`test_replydesk.py`, `conftest.py`); deployed on
     Render (`render.yaml`, `Procfile`); Stripe billing (`billing.py`); Google Business Profile integration (`google_business.py`);
     SQLite locally, Postgres in production (`DATABASE_URL`); SMTP mail for the product's own emails (`email_util.py`). CI
     (`.github/workflows/ci.yml`) runs `python -m pytest -q` and a Postgres smoke job on GitHub (the CI notes Postgres cannot run
     locally on Windows).
   - **Data safety** (git ls-files, git log --all, git check-ignore):

     | File | Tracked now | In any commit (all branches) | In `.gitignore` |
     |---|---|---|---|
     | `replydesk.db` | no | no | yes (`*.db`) |
     | `.env` | no | no | yes (`.env`) |
     | `.venv/` | no | no | yes (`.venv/`) |
     | any other `*.db`, `*.sqlite*` | no | no | `*.db` yes; `*.sqlite`/`*.sqlite3` not listed (none exist) |
     | credential or key files (`*.pem`, `*.key`, `credentials*`, `secret*`, `token*`) | none | none | n/a |

     Tracked and worth knowing: `.env.example` (a template), `prospect.example.json`, and `prospect_austin_rotisserie.json` on
     `main` (a real US business's published contact and two review texts, added by the owner on 12/06/2026); further prospect data
     sits on the 16 `outreach/*` branches (§8, R3). `.pytest_cache/` is not ignored, but it is untracked. `replydesk.db` was not
     opened: 45,056 bytes, last modified 06/06/2026 15:57 (Irish time).
   - **So**: the DEVELOPER worktree is created from a commit, so the untracked files (`.env`, `replydesk.db`, `.venv/`) are never
     present in it. The path and content refusals (item 3) still apply, in case one is ever committed. Tests run against a fresh
     test database, never `replydesk.db`: `conftest.py` already creates a temporary SQLite file per test client, clears
     `DATABASE_URL` and blanks the Anthropic and Stripe keys, and `run_check` adds the stripped environment on top.
   - **Python environment**: with no `.venv` in the worktree and installs refused (item 5), `run_check` needs an interpreter with
     the locked requirements. Options for the owner (§9 Q5): the engine builds one venv per product from `requirements.txt` with
     `pip install --no-index --find-links <wheel folder the owner fills>` (offline, refused if `requirements.txt` changed), or the
     check runs inside the container of Q5.

---

## 6. Integrations

| Integration | Why | Permission | Phase | Stays manual for now |
|---|---|---|---|---|
| Anthropic API (text, web search/fetch) | every agent | existing key in live `.env` | now | Console limit (USD 200/month) set by the owner |
| OpenRouter images | Etsy only | — | retired | key can be removed from live `.env` after R1 (owner) |
| Git / GitHub repos | Engineering | fetch: read-only (fine-grained token or deploy key, contents read, one repo each); push of `dev/*` only if Q6 allows (contents write + `main` ruleset) | R2 | merges, releases, deploys, branch protection |
| GitHub issues | issue intake | issues: read only | R2 | creating, closing, labelling issues |
| Product read-only interfaces | Customer Success, Finance signals | a Station-only token per product: read one ticket / one account summary, rate-limited, no bulk listing of personal data | R4 (built in each product by Engineering, merged by the owner) | everything else in the product admin |
| Stripe | MRR per product | restricted key, **read only** on subscriptions and prices; the Station stores aggregates (MRR, counts), not customer details | R4 | prices, refunds, coupons, invoices |
| Mail | outreach and support drafts | R3: none; drafts are in the Station's Owner's office, the owner copies and sends from their own mailbox. Later option: a draft-only connection (e.g. Microsoft Graph `Mail.ReadWrite` without `Mail.Send`, as emty-inbox does) | R3 / later | sending, always |
| CRM store | leads, pipeline, lawful basis, suppression, retention | internal SQLite tables in the Station's own store; no external CRM | R3 | — |
| Official business registers / APIs (e.g. CRO open data) | lead sources | public, within their terms | R3 | each new source is an owner decision |
| Etsy (own shop) | archived floor | read scopes only, owner click (E7a) | kept | — |
| Analytics, social, hosting | marketing, deploys | none | — | all |

---

## 7. The 3D office

| Floor | Scene | Reused | New |
|---|---|---|---|
| 0 HQ | procedural (today's floor 0) | Finance, Compliance, OVERSEER rooms, services closet, lounge, people looks | the **Owner's office** room with the requests wall (pending requests by product, colour-tagged), Compliance & Ethics renamed, Operations label |
| 1 Engineering | procedural first | desks, monitors, people looks from the Research/Design rooms; quality tiers | 4 desks (PRODUCT, DEVELOPER, REVIEWER, TESTER), a CI wall (each product's last check result) |
| 2 Sales & Marketing | procedural | desks, the board (`ui/board.js`) as the pipeline board | 4 desks, pipeline stages |
| 3 Customer Success | procedural | desks, board | 3 desks, support queue board |
| 4 Etsy (archived) | **today's floor-1 bake, unchanged** (Research, Design, Office, atrium lightmaps) | all of it | dimmed desks, "archived" labels, the own-shop panel |

Products show as a colour tag on desk monitors, task cards and request cards. The floor switcher, the whole-building view (G),
`?floor=N` and the per-floor task list, routines and spend are reused. New rooms stay procedural; a bake is considered only if a floor
misses the fps target. **Target: 60 fps** at the default tier, 1600x1000, on this laptop's Intel UHD iGPU (today's measured floors:
145–163 fps), with every floor measured by the B0 screenshot bench before R5 is accepted.

---

## 8. Phased build

Each phase is one prompt, built in the dev checkout on the mock provider ($0 build), committed with its tests, recorded with
`npm run test:record`, and deployed only on the owner's go. **Rollback** for every phase: `npm run deploy:live -- --rollback`
(returns live to the previous commit), plus, where a migration ran, the backup it took first. Costs are **estimates** from config
prices and assumed token counts, not measurements; each phase's first live runs measure the real figure.

### R1: engine core (products, departments, autonomy policy, Etsy archived)

- **Scope**: `config/products/*.json`, `config/departments/*.json`, `building.mjs` (replaces `business.mjs`); `product_id` and
  `department_id` on every record; `npm run migrate:products` (pre-B0 and B0 roots; backup, dry run, idempotent); guard and spend
  dialog per product and department; `config/autonomy.json` + the action table + enforcement before reservation + the change log;
  the `requests` table and the Owner's office queue (generalised approvals); the Etsy lines and agents archived (starts refused with
  "archived", routines cannot be armed, history and the own-shop connection viewable); Finance view per product (MRR "not
  connected"); OVERSEER's new prompt and daily routine (seeded disabled); README, DECISIONS, PROGRESS.
- **Tests**: migration on pre-B0 and B0 fixtures (and a dry run on a scratch copy of live data, read only, as B0 did); every
  existing guard, jail, e-stop and instance test still passes; policy: unknown action forbidden, looser product override stops the
  engine, change logged once, `owner` creates a request and the job waits, payload change voids an approval; archived lines refuse.
- **Risks**: the migration on live (mitigated: backup, dry run on a copy, idempotent); the orchestrator's Etsy assumptions (job
  folders under `jobs/`) leaking into new lines (mitigated: new lines use `products/<id>/`, Etsy paths untouched); a big diff in
  `orchestrator.mjs` (mitigated: new lines in a new module, the Etsy orchestrator frozen).
- **Rollback**: deploy rollback; the old `approvals` table and `business_id` are untouched, so L3.1 code still reads its data; the
  backup restores the database if needed.
- **API cost**: build USD 0. Running: OVERSEER daily if armed, about USD 0.07 a run (25k in, 2k out on Sonnet) ≈ **USD 0.50 a week**.

### R2: Engineering live on ReplyDesk

- **Scope**: repo mirror, worktree manager, `code_search`, `run_check`, path and content refusals, diff secret and dependency gates,
  the engineering line (intake → PRODUCT → worktree → DEVELOPER → checks → TESTER → gates → REVIEWER → commit → `git.merge`
  request; revise loops at most 2, then blocked), the request card shows spec, diff, test log, review; the CI wall data; optional
  `git.push.branch` executor (Q6). ReplyDesk's `runChecks` and the container for checks if Q5 says so.
- **Tests**: on a fixture repo: writes outside the worktree refused, `.env` refused by path and a key refused by content, a diff
  with a key refused at commit, a lockfile change becomes a request, a ref other than `dev/<job-id>` refused, `run_check` timeout and
  E-STOP kill the process tree, no shell metacharacters reach the process, the whole line on the mock provider ends in a merge request.
- **Risks**: product tests needing a database or network (emty-inbox uses Postgres; ReplyDesk's pytest suite runs on a temporary
  SQLite file and needs none, but its Postgres smoke job stays in GitHub CI); a Python environment for the worktree (§5.8); Windows path and worktree
  lock issues; DEVELOPER loops burning the cap (mitigated by the job cap and turn limits); code quality (mitigated by REVIEWER, the
  owner's merge).
- **Rollback**: deploy rollback; worktrees and mirrors are under `data/products/` and can be removed; nothing reaches GitHub unless
  the owner approved a push.
- **API cost** (estimate per issue, one pass): PRODUCT ~40k in / 4k out ≈ USD 0.12; DEVELOPER ~30 turns, ~1.5M input of which ~90%
  cache reads + ~45k out ≈ USD 0.96; TESTER (Haiku) ≈ USD 0.01; REVIEWER ~50k in / 4k out ≈ USD 0.14; ≈ USD 1.25 a pass, ≈ USD 1.90
  with one rework. **At 5 issues a week: about USD 6–10 a week.** Proposed engineering job cap USD 3.00 (owner decides).

### R3: Sales & Marketing

- **Prerequisites**: legal advice on §4 (Q9); the ideal-customer profile and claims register for ReplyDesk, written by the owner.
- **ReplyDesk's existing outreach must be replaced or absorbed by Sales & Marketing, never run alongside it.** What exists (read-only
  check, 23/10/2026):
  - **What creates the branches**: a weekly scheduled Claude routine, not a GitHub Action (the repo's only workflow is
    `ci.yml`, tests). From 22/06/2026 every `outreach/YYYY-MM-DD` branch is a commit authored `Claude <noreply@anthropic.com>`
    on a Monday at about 08:15 UTC; the first, `outreach/2026-06-15`, was committed by the owner. It follows
    `outreach/WEEKLY_PROSPECTING.md` (the playbook) on `main`. 16 branches on GitHub, 15/06 to 05/10/2026; none for 12/10 or
    19/10, so the routine may have stopped or failed (to check where it is scheduled; it is not in this repo).
  - **What it does**: finds 2–3 US small businesses (restaurants, dental, home services, med spas, agencies) with visible
    review problems, by web search of press, Reddit and the businesses' own sites; drafts a personalised email per prospect with
    `prospect.py` (live Claude if `ANTHROPIC_API_KEY` is set, else templates); writes `outreach/batches/<date>.md`, appends to
    `outreach/contacted.md` (the dedup list) and commits on a branch for the owner to review.
  - **Sends or drafts**: drafts only. The playbook says "YOU DO NOT SEND ANY EMAIL"; `prospect.py` has no send path (the SMTP
    sender, `email_util.py`, is used only by the product itself: `app.py`, `auth.py`, `digest.py`). Every row in every branch's
    `contacted.md` says "not sent" / "drafted". The repo shows no message sent; only the owner's Sent folder can confirm that none
    went out by hand.
  - **Prospect data**: business names, cities, contact emails (several are free-mail addresses such as `@gmail.com`, many marked
    UNVERIFIED), some owners' or managers' names, and quoted review text, held in git on the `outreach/*` branches and in
    `prospect_austin_rotisserie.json` on `main`. Under §4's rules several of these would not pass (personal-looking addresses,
    named individuals), and the same prospects recur across weeks (one appears in 11 of the 16 batches).
  - **Absorbing it** (R3 scope): the owner stops the scheduled routine before R3's lead line is armed; the dedup list moves into the
    CRM (`contacted`, and any objection into the suppression list); the owner decides what happens to the prospect data on the 16
    branches and the tracked prospect file (keep under a retention period, or delete); the playbook's good rules (never invent
    reviews, names or contacts; verify the contact on the business's own site; drafts only) carry into LEAD-RESEARCHER's and
    OUTREACH-WRITER's prompts.
- **Outreach rules are per market.** Each market is a config entry (`config/markets/<id>.json`: lawful-basis rule, contact rule,
  required message content, opt-out handling and deadline, retention) that the mechanical gate and COMPLIANCE apply; a lead
  without a market is refused, and a market is added only by `lead.source.add` (owner). **EU / Ireland**: GDPR and ePrivacy, as §4
  (to be confirmed by legal advice). **United States** (the existing outreach targets US businesses only): the rules are to be
  recorded by the owner (the R0 follow-up instruction was cut off at this point); until then no US market entry exists and the
  lead line refuses US leads.
- **Scope**: CRM tables (leads, pipeline, lawful basis, suppression, retention routine); the lead line (LEAD-RESEARCHER → LEAD-CHECKER
  → dedupe/suppression gate); the outreach line (OUTREACH-WRITER → mechanical gate → COMPLIANCE → `email.send.prospect` request; the
  owner sends by hand and marks it sent); opt-out recording; the content line (CONTENT-WRITER → gate → COMPLIANCE → `public.post`
  request); new blocked domains; the pipeline board.
- **Tests**: a suppressed address never reaches a draft; an opt-out is recorded and blocks every later draft; a claim not in the
  register fails the gate; the footer and notice are added by the engine; retention deletes an expired lead and keeps the suppression
  hash; a personal address or blocked-domain source is rejected.
- **Risks**: legal (mitigated: legal check first, Ireland only, owner sends every email); reputation from poor outreach (mitigated:
  COMPLIANCE and owner review, low volume); lead quality from public sources.
- **Rollback**: deploy rollback; CRM tables are additive; routines disarmed.
- **API cost** at 20 leads, 20 outreach drafts and 2 content pieces a week: lead research 2 runs × ~USD 0.16 (12 searches at USD 0.01
  + tokens); lead check 2 × ~USD 0.05; outreach 20 × ~USD 0.02; COMPLIANCE 22 × ~USD 0.017; content 2 × ~USD 0.07 ≈ USD 1.40, **about
  USD 1.50–3.00 a week** with reworks.

### R4: Customer Success (once there are paying customers)

- **Scope**: the product's read-only interface (specified here, built by Engineering in the product repo, merged and deployed by the
  owner); `support_ticket_read`; SUPPORT-DRAFTER and ONBOARDING-GUIDE lines through COMPLIANCE to `support.reply.send` and
  `email.send.customer` requests; RETENTION-ANALYST weekly; Stripe read-only MRR into Finance.
- **Tests**: one record per call, no listing endpoint used, content not stored after the job; Stripe aggregates only; the draft
  never carries data from another customer.
- **Risks**: personal data in prompts (mitigated: one ticket at a time, nothing stored, processor terms checked); wrong answers to
  customers (owner approves every reply).
- **Rollback**: deploy rollback; revoke the product token and the Stripe restricted key.
- **API cost** at 20 tickets, 2 onboardings and 1 retention report a week: support ~USD 0.03 + COMPLIANCE ~USD 0.017 per ticket;
  onboarding ~USD 0.05 each; retention ~USD 0.01 ≈ **USD 1.10 a week**.

### R5: the office

- **Scope**: floors 0–4 as §7, the Owner's office requests wall, product colour tags, the CI wall, pipeline and support boards; the
  Etsy bake moved to floor 4.
- **Tests**: scene layout per floor, every desk matches a department agent, the baked-room test for floor 4, the fps bench on every
  floor (target 60).
- **Risks**: fps on the iGPU (mitigated: procedural rooms are cheap today, 145+ fps); visual clutter.
- **Rollback**: deploy rollback (scene only).
- **API cost**: USD 0.

**All phases running** (R1–R4 at the workloads above): about **USD 9–15 a week** of Anthropic spend, within today's USD 10 day cap
and the USD 200 Console month. R1 can follow R2 immediately; R3 waits for legal advice; R4 waits for paying customers; R5 can run any
time after R1.

---

## 9. Open questions for the owner before R1

1. **Etsy wind-down.** The winter job on live (QA-only on set-v4 was next) and the autumn package in the approval queue: archive them
   as they are, or finish them by hand first? Do the live listings stay on Etsy? (The Station keeps only the read-only connection.)
2. **Deploy path.** Live runs L3.1; W4 and B0 are not deployed. Go from L3.1 straight to R1 with the one migration (recommended), or
   deploy B0 first? W6 stays parked on `w6-wip` (recommended: not merged, since Etsy stops).
3. **ReplyDesk facts.** Answered 23/10/2026: the clone is `C:\Users\marks\review-reply-service` (`REPLYDESK_REPO`, main at
   `d03a9ab`); Python/Flask, pytest, Render, Stripe, Google Business Profile (§5.8). Still open: whether it has users or customer
   data in production yet; whether a linter or type check should be added to its checks; the US outreach rules (§8, R3); stopping
   the weekly outreach routine and what to do with its prospect data (§8, R3).
4. **emty-inbox and Stellar.** emty-inbox's PLAN.md names Stellar Corporate Housing as its first pilot tenant, and the repo's text
   names it. The building rule refuses Stellar's data (`foreignDataMarkers`), so today an agent's write containing that name is
   refused. Choose: (a) the Station works on emty-inbox code, the marker check applies to data and drafts but not to repo source
   text, and no tenant data ever enters the Station; or (b) emty-inbox stays outside the Station until it has a non-Stellar customer.
   Selling to Stellar is a decision for Stellar's own decision-makers, not the Station.
5. **No network for checks.** Accept a container (Docker Desktop or WSL with `--network none`: an install on this laptop, outside the
   repo) or best-effort isolation for R2? emty-inbox's tests may need Postgres.
6. **Branch push.** May the engine push `dev/<job-id>` and open a PR after your approval (needs a token with contents write and a
   `main` ruleset), or do you pull the branch from the Station's mirror yourself?
7. **Locking the legal levels.** Should `secrets.read`, `personal-data.scrape`, `review.fake`, `account.fake`, `claim.misleading` and
   the agent merge/deploy actions be **locked** (the engine refuses to start if any is set looser), or changeable in config like the
   rest (logged)?
8. **Budgets and models.** Monthly budget per product (proposal: ReplyDesk USD 60, emty-inbox USD 40, station USD 20), the job caps
   per department (proposal: engineering 3.00, sales and CS 0.50, OVERSEER run 0.20), the day cap (USD 10.00 today). DEVELOPER on
   Sonnet 5.5 (proposed) or Opus 5.5 (not priced in config today); thinking "default" for DEVELOPER, REVIEWER and COMPLIANCE?
9. **Before R3 (not blocking R1, but long lead time).** Legal advice on B2B email under S.I. 336/2011 and the AI Act's Article 50 for
   ReplyDesk; the lead retention period (proposed 12 months); the company's legal name and address for the sender identity; whether
   you send outreach from your own mailbox.
10. **Names.** The company's name (the Station is a placeholder, Q14), and the public product names (ReplyDesk; emty-inbox or Inbox
    Copilot).
