# RESTRUCTURE: the Station becomes a software company (R0 plan, updated R0.2)

Owner decision, 22/10/2026: a complete restructure. Etsy production stops; it was a proving exercise. The Station becomes a
software company that builds, sells and keeps customers for the owner's products: first **ReplyDesk** (review-reply SaaS, repo
`markstynesfernandez/Review-Service`), then **emty-inbox** (inbox copilot SaaS, repo `markstynesfernandez/emty-inbox`). Agents run
the work autonomously; the owner is the human oversight and always has the final call, including the ethical calls.

Owner decision, 23/10/2026 (**R0.2**): the Station is laid out as a **miniature tech company** (modelled on companies like Google
and Meta): seven floors, with Headquarters as the **top-floor penthouse** (the owner's office, CEO, CTO, COO, COMPLIANCE), five
working floors below it, and the lobby with the Etsy archive as a trophy room on the ground floor. 19 active agents.

This is a plan only (R0, R0.1 and R0.2, all 23/10/2026). No engine or app code changed. Nothing here is built until the owner
answers §9 and says "go R1". Every cap, budget and cost below is a **proposal or an estimate**, marked as such; the owner sets caps
(DECISIONS.md Q7).

Contents: 0 what exists today · 1 org chart · 2 agents and models · 3 autonomy policy and locked rules · 4 ethics and law gates ·
5 engineering safety · 6 integrations · 7 the 3D office · 8 phased build · 9 open questions.

---

## 0. What exists today (read 23/10/2026, main at `df1a58d`)

What the restructure keeps, because it is the hard part and it works:

| Part | Today | In the new company |
|---|---|---|
| Engine (`src/engine/engine.mjs`, `runtime.mjs`) | one model–tool loop per agent run; reserve → call → settle → tools | kept as is |
| Spend guard (`guard.mjs`, `spend.mjs`) | caps per run (USD 2.00), job (7.00; research 1.00, scout 0.50), line-day, business month (etsy-shop 200), station day (10.00); crash-safe reservations; unknown price refuses | kept; "business month" becomes "product month"; a department job cap and per-agent run caps added (§2) |
| Ledger (`ledger.mjs`) | append-only JSONL with fsync, the only source of cost; SQLite mirror | kept; rows carry `productId` and `departmentId` |
| E-stop (`halt.mjs`) | page, `data/HALT`, `npm run estop`; kills every call and the ESRGAN child | kept; also kills every `run_check` child (§5) |
| Data jail (`store/jail.mjs`) + write-guard test | every write inside the data root and `logs/`; the test fails on any unjailed write | kept; product worktrees live under the data root so the jail covers them |
| Tools (`tools/index.mjs`) | `fs_read/list/write`, `image_*`, `web_*`, `submit_verdict`, `report_blocked`; `FORBIDDEN_TOOL_RE` refuses any tool named send/mail/post/shell/exec/browser/mcp… | kept; new tools `code_search` and `run_check` (§5) are named to stay outside that pattern, and the pattern stays |
| Approval queue (`store/db.mjs` `approvals`) | one row per Etsy job (`job_id` is the key), the only human gate | generalised into **requests** (§3): one row per owner-approval action, any product, any department; only the owner decides one (§3.2) |
| Live / dev instances (`instance.mjs`, `deploy-live.mjs`) | live in `office-agents-live` (branch `live`, port 8790), dev here (mock, 8792); deploy needs a recorded test pass; rollback | kept unchanged |
| Routines (`scheduler.mjs`) | croner, Europe/Dublin, always seeded disabled; arming is the owner's approval with a spend confirm | kept; new routines (COO daily, CEO weekly, CTO weekly triage, lead research, churn report, ANALYST metrics) seeded disabled |
| B0 building (`business.mjs`, `config/businesses/`, `config/building.json`) | a business = a floor with departments, lines, agents, budget, dataDir, `allowedOutbound`; `business_id` on every record; `foreignDataMarkers` refuse another company's data | **replaced** by products × departments (§1.4); the building check, the record stamping, the migration pattern and `foreignDataMarkers` are reused |
| Web tools policy (`config/engine.json` `webSources`) | blocked domains sent to the API and refused by the engine before any spend | kept; Sales adds domains whose terms bar automated collection (§4) |
| Etsy own-shop connection (`providers/etsy.mjs`, E7a) | OAuth PKCE, read scopes only, owner-clicked, USD 0 rows | kept read-only in the ground-floor trophy room |
| 3D office (`src/web/scene/`, `ui/floors.js`, `ui/building.js`) | floor switcher, whole-building view; floor 1 baked (Research, Design, Office, atrium), floor 0 procedural; 145+ fps on the Intel UHD iGPU | reused (§7) |

What it retires: the Etsy lines (`research`, `genre-scout`, `room1-digital`), their eight agents, the Etsy skills and the Etsy-only
gates (originality screens for images, the package gate, listing QA, Real-ESRGAN), and OVERSEER (retired into the COO). Nothing is
deleted: the Etsy work becomes the ground-floor trophy room (§1.1). W6, interrupted mid-build, is parked on branch `w6-wip` (it
failed 2 of 512 tests; see DECISIONS.md "R0").

Not deployed to live today: W4 (`d342d91`) and B0 (`df1a58d`). Live runs L3.1 (`9122435`). R1's migration must therefore start from
a pre-B0 data root as well as a B0 one (§8, R1).

---

## 1. Org chart: a seven-floor tech company

### 1.1 Floors

Floors are **display order only**. Records are keyed on `product_id` and `department_id`, never on a floor number; moving a
department to another floor changes its config's `floor` field and nothing else. Existing Etsy data keeps `business_id` `etsy-shop`
(and gets product `etsy-shop`, department `etsy`); only its display floor changes, to G.

| Floor | Name | Rooms / functions | Agents (19 active) |
|---|---|---|---|
| **6** | **Penthouse: Headquarters** | **Owner's office**: the requests queue (every owner-approval action), the autonomy policy log, the COO's daily report, the CEO's weekly memo and proposals. **Executive suite**: CEO, CTO, COO offices. **Compliance**: every outbound draft's review, the suppression list, the lawful-basis records, the claims register. **Finance**: spend per product and department from the ledger, budgets, MRR per product (Stripe read-only from R6; "not connected" until then). Finance is a ledger calculation shown here, **not an agent**. | CEO, CTO, COO, COMPLIANCE |
| **5** | **Security & Data** | Security desk (diff and dependency audits), data desk (metrics board) | SECURITY, ANALYST |
| **4** | **Engineering** | Tech-lead desk, development bay, review desk, test bench; a CI wall showing each product's last checks | TECH-LEAD, DEVELOPER, REVIEWER, TESTER |
| **3** | **Product & Design** | Roadmap wall per product, backlog board, design studio | PRODUCT-MANAGER, DESIGNER |
| **2** | **Sales & Marketing** | Lead research, outreach desk, content desk, the pipeline board | LEAD-RESEARCHER, LEAD-CHECKER, OUTREACH-WRITER, CONTENT-WRITER |
| **1** | **Customer Success** | Onboarding, support desk, retention desk | ONBOARDING-GUIDE, SUPPORT-DRAFTER, RETENTION-ANALYST |
| **G** | **Lobby** | Reception, the **lounge**, and the **Etsy archive as a trophy room**: job history, packages, the old approval queue, the ledger, the live listings via the read-only own-shop connection. No production. | none (the eight Etsy agents archived, not deleted, shown at dimmed desks; OVERSEER retired) |

Department ids (config, records): `hq` (6), `security-data` (5), `engineering` (4), `product-design` (3), `sales-marketing` (2),
`customer-success` (1), `etsy` (G, archived). The lobby and lounge are display areas on G, not a department.

### 1.2 Reporting lines

```
                                   OWNER (the only approver)
              ┌──────────────┬───────────┴──────────┬───────────────────┐
             CEO            CTO                    COO              COMPLIANCE
   (recommends only)   ┌─────┴──────┐         (operations,      (reports to the owner,
     ┌──────┼───────┐  Engineering  Security    budgets, caps     not the CEO; no exec can
 Product  Sales &  Customer  (4)    & Data (2)  watch, stuck jobs) override its verdict)
 & Design Marketing Success
   (2)      (4)      (3)
```

- Engineering and Security & Data report to the **CTO**.
- Product & Design, Sales & Marketing and Customer Success report to the **CEO**.
- Operations (schedules, routines, budgets, stuck jobs) is the **COO**'s.
- Every exec and **COMPLIANCE** report to the **owner**. COMPLIANCE sits in the penthouse but is outside the CEO's line.
- A reporting line decides **whose report or memo a department's output feeds** and who may assign or prioritise its work within
  the policy. It never grants an approval: every outbound or irreversible action still goes to the owner's requests queue per the
  autonomy policy (§3). In config, each department has `reportsTo` (`ceo`, `cto`, `coo`) and each exec and COMPLIANCE `reportsTo:
  "owner"`; the building check (§1.4) refuses any other value for COMPLIANCE.

### 1.3 Products: a first-class dimension

Every job, run, ledger row, event, request (approval), lead, ticket, memo and routine carries **`product_id`** and
**`department_id`**.

| Product id | Name | Repo | Status |
|---|---|---|---|
| `replydesk` | ReplyDesk | `markstynesfernandez/Review-Service` (local clone: `C:\Users\marks\review-reply-service`, env `REPLYDESK_REPO`; main at `d03a9ab`) | active from R2; facts in §5.8 |
| `emty-inbox` | emty-inbox (package name `inbox-copilot`) | `markstynesfernandez/emty-inbox` (local: `C:\Users\marks\projects\Emty-inbox`, read only for R0) | second; see §9 Q4 before any work |
| `etsy-shop` | TheStationShopFinds | n/a | archived (all history), shown on G |
| `station` | the Station itself | this repo | HQ and station-wide records (today's "shared"), exec memos and reports |

Each product has its own monthly budget and optional day cap (B0's guard logic, renamed), its own roadmap (owned by the
PRODUCT-MANAGER, approved by the owner), and its own autonomy overrides, which may only be **stricter** than the station's policy
(§3). A job without a product is refused, except on HQ (`station`).

### 1.4 How this replaces B0, and how data migrates

B0 made a business the unit of floor, budget, data and rules. The new company splits that into two axes: **departments** own floors
(display order), rooms, agents, lines and a reporting line; **products** own budgets, repos, data, roadmaps and policy overrides. A
department works on many products.

| B0 | New |
|---|---|
| `config/businesses/<id>.json` (floor, departments, lines, agents, monthlyBudgetUsd, dailyCapUsd, allowedOutbound, dataDir, ownerApprovalRequired) | `config/departments/<id>.json` (floor for display, rooms, agents, lines, `reportsTo`, status) **and** `config/products/<id>.json` (name, repo, status, monthlyBudgetUsd, dailyCapUsd, jobCapUsdByDepartment, runChecks, readOnlyApi, policy overrides, dataDir `products/<id>/`) |
| `config/office.json` `shared` (floor 0) | `config/departments/hq.json` (floor 6) and a lobby display entry (G) |
| `allowedOutbound` + owner click | the autonomy policy (§3); the one existing outbound action `etsy:read-own-shop` becomes the action `etsy.read-own-shop` (owner, archived product) |
| `ownerApprovalRequired: true` (cannot be false) | kept as a building invariant: anything "owner" in the policy can never be lowered to "auto" by a product override |
| `business_id` column on jobs, runs, routines, approvals, ledger mirror | `product_id` + `department_id` columns; `business_id` kept, read only, for one release (Etsy rows keep `etsy-shop`) |
| `config/building.json` `foreignDataMarkers` | kept unchanged (see §9 Q4 for emty-inbox) |
| `business.mjs` building check | `building.mjs`: a floor used once (display), an agent in exactly one department, a line in one department, a product id on every product-department job, a product override never looser than the station policy, every locked rule intact (§3.2), COMPLIANCE `reportsTo` the owner, every agent `active`, `not-hired` or `archived`; failure stops the engine with the reason (as B0) |
| `config/products.json` (Etsy product specs) | moved to `config/archive/etsy/products.json` so `config/products/` is unambiguous |
| `config/agents/overseer.json` | `retired: true, retiredInto: "coo"`; history keeps agent `overseer`; the COO is a new agent id |

**Agent ids.** The new UX DESIGNER cannot reuse the id `designer`: the archived Etsy DESIGNER owns it (`config/agents/designer.json`
and every Etsy record). Proposal: the new agent's id is `ux-designer`, shown as "DESIGNER"; the archived one keeps `designer`
(§9 Q8). Every other new id is the lower-case name (`ceo`, `cto`, `coo`, `tech-lead`, `product-manager`, …).

**Migration** (`npm run migrate:products`, the B0 pattern): dry run by default; `--apply` takes a full backup first
(`data/.backups/products-<stamp>/`, SQLite `VACUUM INTO`, nothing deleted), adds the columns, sets every empty value in one
transaction, logs every change, checks nothing is left, holds the engine lock, is idempotent (a second run changes nothing and takes
no backup), and refuses to apply while any record cannot be mapped. It accepts a **pre-B0 root** (it runs B0's mapping first, in
the same transaction) and a B0 root, so live can go from L3.1 straight to R1 with one migration. Mapping: every Etsy record
(`etsy-shop`, or pre-B0 with an Etsy line or agent) → product `etsy-shop`, department `etsy`; "shared" → product `station`,
department `hq`; OVERSEER's history stays under agent `overseer`, department `hq`. No floor number is written to any record. The
ledger and event JSONL files stay append-only and are resolved on read, as B0 does. The old `approvals` table is kept read only for
the Etsy history; new requests go to a new table (§3), so a rollback to older code still finds its own table.

---

## 2. Agents and models

### 2.1 Executives (penthouse)

- **CEO ("virtual Mark")**: reads every department's reports and Finance; writes a **weekly priorities memo** across products and
  **proposes decisions** for the owner, each with options, a recommendation and the cost. It **recommends only**. Locked in code,
  not config (§3.2): the CEO can never approve, reject or act on anything in the requests queue, never change the autonomy policy,
  budgets or caps, and never send anything outside the building. The owner is the only approver. A proposal is a document in the
  Owner's office, not a request: the owner acts on it (a config change, a "go", a request decision) or not. What the CEO reads:
  department reports, specs, roadmaps, the pipeline counts, ANALYST's aggregates and Finance; **not** support tickets, customer
  records or outreach drafts with a named contact (it gets counts and summaries from those departments), so no personal data reaches
  the memo.
- **CTO**: owns Engineering and Security & Data. Prioritises the dev queue **within the owner-approved roadmap** (it cannot add a
  roadmap item); reviews the architecture of large specs (a spec TECH-LEAD marks `large`, or one touching auth, billing, data model
  or dependencies) before DEVELOPER starts; may **assign an approved issue to Engineering** (`issue.assign`, auto). It cannot merge or
  deploy (forbidden for every agent; the Station holds no such credential).
- **COO** (replaces OVERSEER, which is retired into it): the **daily operations report** to the owner (spend per product and
  department, caps, routines health, blocked and stuck jobs, open requests, policy changes, compliance refusals); budget and cap
  watch; schedules and routines health; stuck-job triage (a written diagnosis and a proposed next step). It **may pause a line** on a
  budget or error breach (`line.pause`, auto; the line stays paused until the owner resumes it) and can **never raise a cap**
  (locked).
- **COMPLIANCE**: sits in the penthouse but **reports to the owner directly, not to the CEO**. Reviews every outbound draft before
  the owner sees it (§4). The CEO (or any agent) cannot override or bypass a COMPLIANCE verdict (locked); only the owner can decide
  against it, and that decision is logged with the owner's words.

### 2.2 Every agent (19 active)

Caps are **proposals** (the owner decides, §9 Q8): the station's run cap stays USD 2.00 unless a lower one is stated; department job
caps are in §8. "Phase" is when the agent is hired; before that it is in config as `"status": "not-hired"`, the engine refuses to
run it, its desk is shown empty with a "not hired yet" label, and it costs nothing.

| Agent | Floor / dept | Reports to | Purpose | Tools | Limits (proposed) | Inputs → outputs | Phase |
|---|---|---|---|---|---|---|---|
| **CEO** | 6 HQ | owner | Weekly priorities memo, decision proposals | `fs_read`, `fs_list`, `fs_write` (memos folder only) | 30 turns, run cap USD 0.50 | department reports, roadmaps, Finance, ANALYST aggregates → `memos/YYYY-Www.md`: priorities per product, proposals (options, recommendation, cost) | R3 |
| **CTO** | 6 HQ | owner | Dev-queue priority, architecture review, assigns approved issues | `fs_read`, `fs_list`, `fs_write` (job folder, queue file), `code_search`, `submit_verdict` (architecture `approve` / `revise`) | 30 turns, run cap USD 0.30 | approved roadmap + backlog + open specs → `dev-queue.md` order and assignments; on a large spec, a verdict with findings | R2 |
| **COO** | 6 HQ | owner | Daily operations report, budget and routine watch, stuck-job triage, line pause | `fs_read`, `fs_write` (reports only), `line_pause` (engine-executed, logged) | 20 turns, run cap USD 0.20 | metrics JSON the engine writes (spend, caps, routines, blocked jobs, requests, policy changes, refusals) → `reports/YYYY-MM-DD.md`; a pause with the breach as reason | R1 config, R3 live |
| **COMPLIANCE** | 6 HQ | owner (not the CEO) | Reviews every outbound draft | `fs_read`, `fs_list`, `submit_verdict` | 20 turns, run cap USD 0.10 | draft + claims register + lawful-basis record + the mechanical gate's results → `pass` / `revise` / `refuse` (§4) | R1 config, R5 live |
| **SECURITY** | 5 Security & Data | CTO | Audits diffs and dependencies for vulnerabilities and secrets before the owner sees a merge request; read only | `fs_read`, `fs_list`, `code_search`, `submit_verdict` | 30 turns, run cap USD 0.30 | `diff.patch`, the lockfile diff, the mechanical secret and dependency gates' results → `approve` / `revise` / `refuse` with file and line findings | R2 |
| **ANALYST** | 5 Security & Data | CTO | Product metrics: MRR, churn, usage, funnel; aggregate numbers only, never personal customer data | `fs_read`, `fs_write` (reports), `metrics_read` (engine-fetched aggregates) | 20 turns, run cap USD 0.10 | Stripe read-only aggregates (MRR, churn, counts), product admin stats (counts per plan, active accounts), pipeline counts → `metrics-YYYY-Www.md` for the CEO, Product and Sales | R6 |
| **TECH-LEAD** (replaces the plan's PRODUCT agent) | 4 Engineering | CTO | Turns an approved issue into a spec | `fs_read`, `fs_list`, `fs_write` (job folder), `code_search` | 30 turns | approved issue + repo → `spec.md`: problem, scope, out of scope, acceptance criteria as testable statements, a test plan, files likely touched, risk notes, `size` (`small` / `large`) | R2 |
| **DEVELOPER** | 4 Engineering | CTO | Writes the code on a branch in a git worktree | `fs_read`, `fs_list`, `fs_write` (worktree, §5 refusals), `code_search`, `run_check` | 60 turns, 10 `run_check` calls a run | `spec.md` + worktree + TESTER/REVIEWER/SECURITY findings on a rework → code and tests on `dev/<job-id>`; `notes.md` | R2 |
| **REVIEWER** | 4 Engineering | CTO | Reviews the diff against the spec | `fs_read`, `fs_list`, `code_search`, `submit_verdict` | 30 turns | `diff.patch`, `spec.md`, test results → `approve` / `revise` / `refuse` | R2 |
| **TESTER** | 4 Engineering | CTO | Runs the product's tests and linters, turns failures into findings, checks the test plan is covered | `fs_read`, `fs_list`, `run_check`, `submit_verdict` | 20 turns, 8 `run_check` calls | worktree + `spec.md` → `pass` / `fail` per check and per acceptance criterion | R2 |
| **PRODUCT-MANAGER** | 3 Product & Design | CEO | Roadmap and backlog drafts per product; turns owner ideas and Customer Success signals into issues | `fs_read`, `fs_list`, `fs_write` (product folder) | 30 turns | owner ideas, CS and ANALYST reports, CEO memo → `roadmap.md` draft (the owner approves it: `roadmap.approve`), backlog issues in the Station's own backlog | R4 |
| **DESIGNER** (id `ux-designer`) | 3 Product & Design | CEO | UX flows, copy and UI specs as drafts for Engineering; no live site changes | `fs_read`, `fs_list`, `fs_write` (job folder) | 30 turns | an issue + the product's current UI (repo templates, read only) → `design.md` (flow, states, copy, acceptance notes) | R4 |
| **LEAD-RESEARCHER** | 2 Sales & Marketing | CEO | Finds business prospects from public business sources | `fs_read`, `fs_list`, `fs_write` (job folder), `web_search`, `web_fetch` | 40 turns, 12 web calls | ideal-customer profile (owner-written) + market rules → `leads.json` (organisation, business contact, source URL, date seen, why relevant, proposed lawful basis) | R5 |
| **LEAD-CHECKER** | 2 Sales & Marketing | CEO | Re-checks each lead's source and fitness | `fs_read`, `fs_list`, `fs_write`, `web_fetch` | 30 turns, 6 fetches | `leads.json` → `verified` / `rejected` with the reason | R5 |
| **OUTREACH-WRITER** | 2 Sales & Marketing | CEO | First-contact and follow-up email drafts | `fs_read`, `fs_list`, `fs_write` (job folder) | 20 turns | a verified lead + facts sheet + claims register → `draft.md` (the engine adds sender identity, notice line, opt-out) | R5 |
| **CONTENT-WRITER** | 2 Sales & Marketing | CEO | Landing-page copy, blog posts, product-update notes | `fs_read`, `fs_list`, `fs_write` (job folder) | 30 turns | brief + facts sheet + claims register → drafts (never published by the Station) | R5 |
| **ONBOARDING-GUIDE** | 1 Customer Success | CEO | Onboarding emails and checklists for a new customer | `fs_read`, `fs_list`, `fs_write` | 20 turns | account summary from the product's read-only API (plan, setup state; no message content) → draft email + checklist | R6 |
| **SUPPORT-DRAFTER** | 1 Customer Success | CEO | A reply to one support ticket | `fs_read`, `fs_list`, `fs_write`, `support_ticket_read` (one ticket, read only) | 20 turns | one ticket + product docs → `reply.md` | R6 |
| **RETENTION-ANALYST** | 1 Customer Success | CEO | Weekly retention and churn signals per account | `fs_read`, `fs_write` (reports) | 20 turns | per-account usage counts and billing state (account ids only, no personal data) → `retention-YYYY-Www.md` | R6 |

No agent has a send, post, merge, deploy, push, shell or browser tool. Pushing, sending and posting, when the owner approves them,
are done by the engine's own executors (or by the owner by hand), never by an agent (§3). `line_pause` and `metrics_read` are
engine-executed tools with declared actions (§3), named to stay outside `FORBIDDEN_TOOL_RE`.

### 2.3 Models and thinking (proposals; the owner decides, §9 Q8)

Model tiers are today's (`config/engine.json` `tiers`): **cheap** = Claude Haiku 5.5, **strong** = Claude Sonnet 5.5. Config prices:
Haiku USD 0.10 / 0.50 per M input / output (cache read 0.01; above 100k input tokens 0.50 / 2.50), Sonnet USD 2 / 10 (cache read
0.10, cache write 2.50). Today every agent's thinking is "off" (owner D2; on Sonnet "off" is sent as `between_tools`). "Default"
means no thinking field: the model's adaptive thinking.

Rule from the owner's instruction: **Haiku for routine work; Sonnet for DEVELOPER, REVIEWER, SECURITY, COMPLIANCE and the execs;
Opus only on the owner's choice, per issue.**

| Agent | Model | Effort | Thinking | Reason |
|---|---|---|---|---|
| CEO | Sonnet | medium | default | weighs trade-offs across products and costs; once a week, so thinking costs little |
| CTO | Sonnet | medium | default | architecture judgement on large specs; low volume |
| COO | Sonnet | low | off | a daily structured report from engine metrics; the judgement is in triage, which is short |
| COMPLIANCE | Sonnet | medium | default | legal and ethical judgement on outbound text; a missed problem costs far more than the tokens |
| SECURITY | Sonnet | medium | default | finding a vulnerability or a leaked secret in a diff needs careful reading |
| DEVELOPER | Sonnet | medium | default | the hardest work; thinking reduces rework loops, which cost more than the thinking |
| REVIEWER | Sonnet | medium | default | catching wrong logic against a spec |
| TECH-LEAD | Haiku | medium | off | routine spec writing from an approved issue; CTO reviews large specs; see §9 Q8 |
| TESTER | Haiku | low | off | runs checks and reports results |
| PRODUCT-MANAGER | Haiku | medium | off | structured drafting; the owner approves the roadmap |
| DESIGNER | Haiku | medium | off | text specs for flows and copy; no images |
| LEAD-RESEARCHER, LEAD-CHECKER | Haiku | low | off | search and verification |
| OUTREACH-WRITER, CONTENT-WRITER | Haiku | low | off | short drafts behind the mechanical gate, COMPLIANCE and the owner; see §9 Q8 |
| ONBOARDING-GUIDE, SUPPORT-DRAFTER | Haiku | low | off | short drafts behind COMPLIANCE and the owner |
| RETENTION-ANALYST, ANALYST | Haiku | low | off | aggregates the engine has already computed |

**Opus per issue**: the owner may set `model: opus` on one issue (on its intake or request card); it applies to that issue's
DEVELOPER run only. The guard refuses any model without a price, and Opus 5.5 has none in `config/engine.json` today, so the owner
must first add its verified prices (§9 Q8). Nothing else can choose Opus.

The weekly estimates in §8 assume thinking **off** (as today); "default" on the seven Sonnet agents above adds output tokens,
estimated at +20–50% on those agents' cost. Each phase's first live runs measure the real figure.

### 2.4 Retired (archived, not deleted)

The eight Etsy agents: DEMAND-RESEARCHER, EVIDENCE-CHECKER (as an Etsy agent), TREND-SCOUT, DESIGNER (`designer`), QA-DESIGN,
LISTER, QA-LISTING, REJECTS-DESK. Their config files stay where they are with `"archived": true`; the engine refuses to run an
archived agent; their desks show in the ground-floor trophy room, dimmed. **OVERSEER** is retired into the COO (`retired: true`,
`retiredInto: "coo"`); its reports and history stay. Their prompts and the Etsy skills (`etsy-policy`, `price-*`,
`package-format*`, `originality-*`, `digital-terms`, `brief-format`, `scout-brief-format`, `demand-evidence`) stay for the record.
Reused patterns, not agents: the verdict protocol (`submit_verdict`, `verdict-protocol.md`), `report_blocked`, EVIDENCE-CHECKER's
"fetched in this run or not reachable" rule, REJECTS-DESK's record of why a job stopped (now written by the engine),
`data-hygiene.md`.

---

## 3. Autonomy policy and locked rules

### 3.1 The policy (config, enforced by the engine)

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
   and the COO's next daily report. The live instance already refuses to start with uncommitted tracked changes, so every live
   change is also a commit.
4. An `owner` request records: product, department, job, action, a one-line summary, the payload's sha256 (the exact text or diff
   approved), COMPLIANCE's verdict where required, SECURITY's verdict for a merge request, and the decision (approved / rejected,
   the owner's words, date). If the payload changes after approval, the approval no longer matches and the executor refuses.

**Defaults** (the owner may change any level in the file except the locked ones, §3.2):

| Action | Level | Executed by, after approval |
|---|---|---|
| `research.web` (public business sources, blocked domains honoured) | auto | agent |
| `draft.write` (any draft in the job folder) | auto | agent |
| `spec.write`, `design.write`, `report.write`, `memo.write`, `crm.write` (internal pipeline record) | auto | agent / engine |
| `backlog.write` (an issue in the Station's own backlog) | auto | agent |
| `roadmap.approve` (a product's roadmap) | owner | the owner, in the Owner's office |
| `issue.assign` (CTO assigns an owner-approved issue to Engineering) | auto | engine, on the CTO's assignment |
| `queue.prioritise` (CTO orders the dev queue within the approved roadmap) | auto | engine |
| `code.edit` (worktree, branch `dev/<job-id>`) | auto | agent |
| `code.check` (`run_check`: allowlisted test, lint, typecheck, format check) | auto | engine |
| `code.review`, `security.audit`, `code.commit` (local commit on `dev/<job-id>`) | auto | agent / engine |
| `product.read` (a product's read-only interface, one record at a time) | auto | engine |
| `metrics.read` (Stripe read-only aggregates, product admin stats; no personal data) | auto | engine |
| `line.pause` (COO, on a budget or error breach; reason recorded) | auto | engine |
| `line.resume` | owner | the owner, on the page |
| `email.send.prospect` | owner | the owner sends from their own mailbox (R5); an engine sender later only on a separate decision |
| `email.send.customer`, `support.reply.send` | owner | as above |
| `git.push.branch` (push `dev/<job-id>` to the product repo, open a PR) | owner | engine (refspec `dev/<job-id>` only), §9 Q6 |
| `git.merge` | owner | **the owner, by hand on GitHub**; the Station holds no credential that can merge |
| `deploy` | owner | **the owner, by hand**; the Station holds no deploy credential |
| `site.change` (any change to a live site or app outside a merge) | owner | the owner |
| `price.set`, `refund.issue` | owner | the owner, in Stripe or the product's admin |
| `public.post` (landing page, blog, social, directory listing) | owner | the owner |
| `dependency.add` (any change to dependencies or the lockfile) | owner | the owner approves; the engine then installs offline from the lockfile |
| `ci.change` (`.github/workflows/**`, other CI config) | owner | as a normal merge |
| `lead.source.add` (a new source or country for leads) | owner | config change |
| `etsy.read-own-shop` (trophy room) | owner | engine (the owner's click, as E7a) |
| `git.merge.agent`, `deploy.agent` (an agent or the engine merging or deploying) | forbidden, **locked** | — |
| `secrets.read` (`.env*`, keys, tokens, credential files; by path and by content) | forbidden, **locked** | — |
| `personal-data.scrape` (collecting personal data, or any collection that breaks a site's terms) | forbidden, **locked** | — |
| `review.fake`, `account.fake` (fake reviews, testimonials, sock-puppet accounts) | forbidden, **locked** | — |
| `claim.misleading` (a claim not in the claims register, false urgency, fake scarcity) | forbidden, **locked** | — |
| `request.decide.agent` (any agent approving or rejecting a request) | forbidden, **locked** | — |
| `policy.change.agent`, `cap.change.agent`, `budget.change.agent` | forbidden, **locked** | — |
| `compliance.override.agent` (any agent overriding or skipping a COMPLIANCE verdict) | forbidden, **locked** | — |
| `email.send.agent` (an agent sending directly) | forbidden, **locked** | — |
| `dependency.install.agent`, `network.from-checks` | forbidden | — |
| `customer-data.bulk-export` | forbidden | — |

`claim.misleading` and `review.fake` cannot be fully detected by code. Code enforces what it can (the claims register match, the
absence of any review-posting or account-creating tool, the blocked domains); COMPLIANCE and the owner catch the rest. The plan does
not pretend otherwise.

### 3.2 Locked rules (in code, not config)

A fixed table in code (`src/engine/locked.mjs`, proposed), checked at every start and on every action. Editing `config/` cannot
loosen any of them: if `config/autonomy.json`, a product override, a department or an agent config tries, **the engine refuses to
start** and says which rule and which file. Changing one needs a code change, its tests, a recorded test pass and the owner's deploy.

1. **The owner is the only approver.** A request is decided only through the owner's page session (same-origin, the owner token,
   idempotency key, as E5). The decide path refuses any call whose actor is an agent or a script run, and no agent has a tool that
   reaches it (`request.decide.agent` is forbidden and locked).
2. **The CEO recommends only.** The CEO's tool set is fixed in code to `fs_read`, `fs_list` and `fs_write` jailed to the memos
   folder; a CEO config listing any other tool stops the engine. It cannot decide a request, change the policy, a budget or a cap, or
   send anything outside the building. Its proposals are documents, never requests.
3. **COMPLIANCE is independent.** COMPLIANCE `reportsTo` must be `owner`. A COMPLIANCE `revise` or `refuse` stops the draft's path
   to the owner's request except through the revise loop; no agent, the CEO included, can override or skip it
   (`compliance.override.agent`); only the owner can decide against it, logged with the owner's words.
4. **The COO can pause, never raise.** `line.pause` is the COO's only engine action; no agent can change a cap or budget
   (`cap.change.agent`, `budget.change.agent`).
5. **The legal and safety "forbidden" items** marked locked in §3.1: `secrets.read`, `personal-data.scrape`, `review.fake`,
   `account.fake`, `claim.misleading`, `git.merge.agent`, `deploy.agent`, `email.send.agent` (R0.2 reads the owner's "legal
   forbidden items" as this list, which was §9 Q7; the owner may strike any that should stay configurable).
6. **`ownerApprovalRequired`** (B0's invariant): nothing at `owner` can be lowered to `auto` by a product override.

---

## 4. Ethics and law gates

**Order for every outbound draft**: agent draft → **mechanical gate** (deterministic) → **COMPLIANCE** verdict → the owner's request.
A `revise` goes back to the drafting agent at most twice, then the job blocks. The owner sees the draft, the gate results and
COMPLIANCE's verdict together. The CEO sees only counts of drafts, verdicts and sends.

**Mechanical gate** (code, no model): every factual claim about a product matches the product's **claims register**
(`config/products/<id>/claims.md`: each claim with its evidence and date, owner-approved); the sender identity (the company's legal
name and address) and a working **opt-out** are present (added by the engine, not the model); the recipient is not on the
**suppression list**; the lead has a recorded lawful basis and source; no blocked words (urgency and pressure patterns, "guaranteed",
invented figures); `foreignDataMarkers` (§1.4); AI disclosure line present where the product's config requires it.

**COMPLIANCE checks** (judgement): truthful, not misleading by omission; no pressure tactics; respectful tone; AI disclosure where
relevant (the EU AI Act's transparency duties under Article 50 apply from 2 August 2026 to systems that interact with people and to
some AI-generated content; COMPLIANCE flags where they bite, e.g. ReplyDesk's own generated review replies; the exact scope is a
question for legal advice, §9 Q9).

**Sales outreach in Ireland and the EU (GDPR and ePrivacy)**. This is the plan's rule set, **to be confirmed by legal advice before
R5 runs live** (the Irish ePrivacy Regulations, S.I. 336/2011 Regulation 13, treat email marketing to individuals and to corporate
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
ANALYST and RETENTION-ANALYST get aggregates and account ids only; the CEO gets their reports, never records. No bulk export exists
(forbidden, §3). A new data flow (a new tool, a new field, sharing, retention) is a GDPR decision recorded in DECISIONS.md before it
is built: what, why, how long, which processor. The Stripe read-only connection (R6) is one such decision.

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
   dependency. SECURITY's audit (§2.2) is a second, judgement layer on top of these mechanical gates, not a replacement.
4. **`run_check`** (the only process an agent can cause): input is a check name (`test`, `lint`, `typecheck`, `format`) and
   optionally a test-file filter, mapped to a fixed argv in `config/products/<id>.json` `runChecks` (for emty-inbox today: `pnpm
   test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`; for ReplyDesk `python -m pytest -q`, as its CI runs it; it has no
   linter or type check configured, §5.8). Spawned with `execFile` (no
   shell), cwd the worktree, a minimal environment (no key, no token, no home credentials; proxy variables pointed at a closed local
   port), a timeout (proposed 300 s, whole process tree killed), output capped at 200 KB, killed by the E-STOP. **No network**: true
   network isolation on Windows needs an OS boundary; the plan's recommendation is a container with `--network none` per check
   (§9 Q5). Until then the environment above is best-effort, and the plan says so.
5. **Dependency installs refused**: no `install`/`add` command is in any allowlist. A change to dependency fields or the lockfile is
   detected in the diff and becomes a `dependency.add` request, with SECURITY's dependency verdict on the card. The worktree's
   `node_modules` come from an engine step (`pnpm install --frozen-lockfile --offline`) from the owner's existing store, against the
   unchanged lockfile only.
6. **Branches** `dev/<job-id>` only. **The owner merges and deploys**, by hand. The Station holds no merge or deploy credential; the
   CTO's authority stops at assigning and ordering work. If the owner allows `git.push.branch`, the push token must not be able to
   write to `main`: a GitHub ruleset protecting `main` (PR required, no bypass for the token) is set by the owner on GitHub before
   R2's first push.
7. **Prompt injection**: issue text, repo content, test output and web pages are data, never instructions (as today's tool
   descriptions say). Agents have no outbound tool, so an injected instruction can at worst write code in a throwaway worktree that
   REVIEWER, SECURITY, the gates and the owner then see.
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
     sits on the 16 `outreach/*` branches (§8, R5). `.pytest_cache/` is not ignored, but it is untracked. `replydesk.db` was not
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
| Git / GitHub repos | Engineering, Security | fetch: read-only (fine-grained token or deploy key, contents read, one repo each); push of `dev/*` only if Q6 allows (contents write + `main` ruleset) | R2 | merges, releases, deploys, branch protection |
| GitHub issues | issue intake | issues: read only | R2 | creating, closing, labelling issues |
| Product read-only interfaces | Customer Success, ANALYST | a Station-only token per product: read one ticket / one account summary / aggregate admin stats, rate-limited, no bulk listing of personal data | R6 (built in each product by Engineering, merged by the owner) | everything else in the product admin |
| Stripe | MRR and churn for ANALYST and Finance | restricted key, **read only** on subscriptions and prices; the Station stores aggregates (MRR, counts, churn), not customer details | R6 | prices, refunds, coupons, invoices |
| Mail | outreach and support drafts | R5: none; drafts are in the Owner's office, the owner copies and sends from their own mailbox. Later option: a draft-only connection (e.g. Microsoft Graph `Mail.ReadWrite` without `Mail.Send`, as emty-inbox does) | R5 / later | sending, always |
| CRM store | leads, pipeline, lawful basis, suppression, retention | internal SQLite tables in the Station's own store; no external CRM | R5 | — |
| Official business registers / APIs (e.g. CRO open data) | lead sources | public, within their terms | R5 | each new source is an owner decision |
| Etsy (own shop) | trophy room | read scopes only, owner click (E7a) | kept | — |
| Analytics, social, hosting | marketing, deploys | none | — | all |

---

## 7. The 3D office

Seven floors, the penthouse at the top, the lobby at the bottom. Floor labels come from each department's `floor` (display order).

| Floor | Scene | Reused | New |
|---|---|---|---|
| 6 Penthouse | procedural (today's floor 0 rooms, moved up and restyled) | Finance and Compliance rooms, people looks | the **Owner's office** with the requests wall (pending requests by product, colour-tagged), CEO, CTO and COO offices, a memo board, glass walls and a roof-terrace edge as the penthouse cue |
| 5 Security & Data | procedural | desks, monitors | 2 desks, a metrics board (aggregates only) |
| 4 Engineering | procedural | desks, monitors, people looks from the Research/Design rooms; quality tiers | 4 desks, a CI wall (each product's last check result) |
| 3 Product & Design | procedural | desks, the board (`ui/board.js`) as the backlog board | 2 desks, roadmap wall per product |
| 2 Sales & Marketing | procedural | desks, board as the pipeline board | 4 desks, pipeline stages |
| 1 Customer Success | procedural | desks, board | 3 desks, support queue board |
| G Lobby | **today's floor-1 bake, unchanged**, as the trophy room (Research, Design, Office, atrium lightmaps); lobby and lounge procedural | the bake, the lounge with walking idle agents | reception, the trophy room labels, dimmed archived desks, the own-shop panel |

"Not hired yet" desks are shown empty with a label until their phase. Products show as a colour tag on desk monitors, task cards
and request cards. The floor switcher, the whole-building view, `?floor=N` and the per-floor task list, routines and spend are
reused; the switcher shows `G` and 1–6. New rooms stay procedural; a bake is considered only if a floor misses the fps target.
**Target: 60 fps** at the default tier, 1600x1000, on this laptop's Intel UHD iGPU (today's measured floors: 145–163 fps), on every
floor and in the whole-building view, measured by the B0 screenshot bench before R7 is accepted. Seven stacked floors are the fps
risk in the whole-building view: non-selected floors render as low-detail shells (no people, merged geometry), as B0's building
view does for floor 0.

---

## 8. Phased build

Each phase is one prompt, built in the dev checkout on the mock provider ($0 build), committed with its tests, recorded with
`npm run test:record`, and deployed only on the owner's go. **Rollback** for every phase: `npm run deploy:live -- --rollback`
(returns live to the previous commit), plus, where a migration ran, the backup it took first. Agents of later phases exist in config
as `not-hired` from R1 and cost nothing until their phase.

Costs are **estimates** from config prices and assumed token counts, thinking off (§2.3), not measurements; each phase's first live
runs measure the real figure. Workload assumed (one product, ReplyDesk): **5 engineering issues a week** (1 large), **1 CEO memo**,
**7 COO reports**, **1 CTO triage**, **1 roadmap update and 2 design specs**, **20 leads, 20 outreach drafts and 2 content pieces**,
**20 support tickets, 2 onboardings, 1 retention report, 2 ANALYST runs** a week.

### R1: engine core

- **Scope**: `config/products/*.json`, `config/departments/*.json` (floor as display order, `reportsTo`), `building.mjs`
  (replaces `business.mjs`); `product_id` and `department_id` on every record, no floor number on any record; `npm run
  migrate:products` (pre-B0 and B0 roots; backup, dry run, idempotent; Etsy keeps `etsy-shop`); guard and spend dialog per product
  and department; `config/autonomy.json` + the action table + enforcement before reservation + the change log; **the locked rules**
  (§3.2) in code; the `requests` table and the Owner's office queue (generalised approvals, owner-only decide path); all 19 agents
  in config (all `not-hired`), with the `ux-designer` id; the Etsy lines and agents archived and shown on G (starts
  refused with "archived", routines cannot be armed, history and the own-shop connection viewable); OVERSEER retired into the COO
  (config and history; the COO's routine seeded disabled, its live report is R3); Finance view per product (MRR "not connected");
  README, DECISIONS, PROGRESS.
- **Tests**: migration on pre-B0 and B0 fixtures (and a dry run on a scratch copy of live data, read only, as B0 did); every
  existing guard, jail, e-stop and instance test still passes; policy: unknown action forbidden, looser product override stops the
  engine, change logged once, `owner` creates a request and the job waits, payload change voids an approval; locked rules: a config
  loosening any locked item stops the engine, a CEO config with an extra tool stops the engine, an agent or script actor deciding a
  request is refused, COMPLIANCE `reportsTo` other than owner stops the engine; a `not-hired` or archived agent is refused; changing
  a department's floor changes no record.
- **Risks**: the migration on live (mitigated: backup, dry run on a copy, idempotent); the orchestrator's Etsy assumptions (job
  folders under `jobs/`) leaking into new lines (mitigated: new lines use `products/<id>/`, Etsy paths untouched); a big diff in
  `orchestrator.mjs` (mitigated: new lines in a new module, the Etsy orchestrator frozen); the locked table drifting from the policy
  file (mitigated: a test that every locked action is in the file at `forbidden`).
- **Rollback**: deploy rollback; the old `approvals` table and `business_id` are untouched, so L3.1 code still reads its data; the
  backup restores the database if needed.
- **Weekly cost**: build USD 0; running **USD 0** (no agent is hired in R1).

### R2: Engineering and the CTO live on ReplyDesk

- **Scope**: hire CTO, TECH-LEAD, DEVELOPER, REVIEWER, TESTER, SECURITY. Repo mirror, worktree manager, `code_search`, `run_check`,
  path and content refusals, diff secret and dependency gates; the engineering line (owner-approved issue → CTO assigns and orders
  → TECH-LEAD spec → CTO architecture review if `large` → worktree → DEVELOPER → checks → TESTER → REVIEWER → SECURITY → commit →
  `git.merge` request; revise loops at most 2, then blocked); the request card shows spec, diff, test log, review and security
  verdicts; the CI wall data; optional `git.push.branch` executor (Q6); ReplyDesk's `runChecks` and the container for checks if Q5
  says so; per-issue Opus choice (refused until Opus is priced). Until R4 the owner writes and approves issues directly.
- **Tests**: on a fixture repo: writes outside the worktree refused, `.env` refused by path and a key refused by content, a diff
  with a key refused at commit, a lockfile change becomes a request with SECURITY's verdict, a ref other than `dev/<job-id>`
  refused, `run_check` timeout and E-STOP kill the process tree, no shell metacharacters reach the process, the CTO cannot assign an
  issue the owner has not approved, a SECURITY `refuse` blocks the merge request, the whole line on the mock provider ends in a merge
  request.
- **Risks**: product tests needing a database or network (emty-inbox uses Postgres; ReplyDesk's pytest suite runs on a temporary
  SQLite file and needs none, but its Postgres smoke job stays in GitHub CI); a Python environment for the worktree (§5.8); Windows
  path and worktree lock issues; DEVELOPER loops burning the cap (mitigated by the job cap and turn limits); spec quality on Haiku
  (mitigated by the CTO's review of large specs; §9 Q8); code quality (mitigated by REVIEWER, SECURITY, the owner's merge).
- **Rollback**: deploy rollback; worktrees and mirrors are under `data/products/` and can be removed; nothing reaches GitHub unless
  the owner approved a push.
- **Weekly cost** (5 issues, 1 large): per pass TECH-LEAD (Haiku, ~40k in / 4k out) ≈ USD 0.01; DEVELOPER ~30 turns, ~1.5M input of
  which ~90% cache reads + ~45k out ≈ USD 0.96; TESTER ≈ 0.01; REVIEWER ~50k in / 4k out ≈ 0.14; SECURITY ~50k in / 3k out ≈ 0.13:
  **≈ USD 1.25 a pass**, ≈ USD 2.05 with one rework (DEVELOPER ≈ 0.50, TESTER, REVIEWER and SECURITY again). CTO: weekly triage
  ~40k in / 3k out ≈ 0.11 + one architecture review ~60k in / 4k out ≈ 0.16. **About USD 6.50–10.50 a week.** Proposed engineering
  job cap USD 3.00 (an Opus issue needs its own cap; owner decides).

### R3: Penthouse executives

- **Scope**: hire CEO and COO (COMPLIANCE is hired in R5, when there is outbound to review). COO daily report routine (seeded
  disabled; arming is the owner's), budget and cap watch, routines health, stuck-job triage, `line.pause` with the reason in the
  Owner's office; CEO weekly memo routine (seeded disabled), the memo board and the proposals list in the Owner's office (each
  proposal: options, recommendation, cost; the owner marks it taken, declined or later, which is a note, not an approval of
  anything).
- **Tests**: the COO pauses a line on a mock breach and cannot resume it or change a cap; the CEO's memo is written, its proposals
  appear, and every attempt (tool, API, config) by the CEO to decide a request or change policy is refused; the CEO's inputs contain
  no ticket, customer record or named-contact draft.
- **Risks**: a confident memo nudging decisions (mitigated: options and costs required, recommendation clearly marked, the owner
  decides); COO false-positive pauses (mitigated: the reason is shown, the owner resumes in one click); report noise.
- **Rollback**: deploy rollback; disarm the routines.
- **Weekly cost**: CEO ~80k in / 5k out ≈ USD 0.21; COO 7 × (~25k in / 2k out ≈ 0.07) ≈ 0.49. **About USD 0.70 a week** (≈ 0.85–1.05
  with thinking "default" on the CEO).

### R4: Product & Design

- **Scope**: hire PRODUCT-MANAGER and DESIGNER (`ux-designer`). Roadmap drafts per product and the `roadmap.approve` request; the
  Station's own backlog (issues from owner ideas, and from Customer Success signals once R6 runs); the CTO orders only issues on the
  approved roadmap; DESIGNER specs attached to issues for TECH-LEAD; the roadmap wall and backlog board.
- **Tests**: an unapproved roadmap item cannot be assigned; a design spec reaches TECH-LEAD's input; DESIGNER has no path to a live
  site (`site.change` owner, no tool).
- **Risks**: roadmap churn and backlog bloat (mitigated: the owner approves the roadmap, the CTO orders only approved items); weak
  specs on Haiku (§9 Q8).
- **Rollback**: deploy rollback; the backlog and roadmap files are additive.
- **Weekly cost**: PRODUCT-MANAGER ~50k in / 5k out ≈ USD 0.01 plus 5 issue drafts ≈ 0.02; DESIGNER 2 × ≈ 0.01. **About USD
  0.05–0.10 a week.**

### R5: Sales & Marketing (after legal advice, EU and US)

- **Prerequisites**: legal advice on §4 and on the US rules below (Q9); the ideal-customer profile and claims register for
  ReplyDesk, written by the owner. Hire LEAD-RESEARCHER, LEAD-CHECKER, OUTREACH-WRITER, CONTENT-WRITER and COMPLIANCE.
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
  - **Absorbing it** (R5 scope): the owner stops the scheduled routine before R5's lead line is armed; the dedup list moves into the
    CRM (`contacted`, and any objection into the suppression list); the owner decides what happens to the prospect data on the 16
    branches and the tracked prospect file (keep under a retention period, or delete); the playbook's good rules (never invent
    reviews, names or contacts; verify the contact on the business's own site; drafts only) carry into LEAD-RESEARCHER's and
    OUTREACH-WRITER's prompts.
- **Outreach rules are per market.** Each market is a config entry (`config/markets/<id>.json`: lawful-basis rule, contact rule,
  required message content, opt-out handling and deadline, retention) that the mechanical gate and COMPLIANCE apply; a lead
  without a market is refused, and a market is added only by `lead.source.add` (owner). **EU / Ireland**: GDPR and ePrivacy, as §4
  (to be confirmed by legal advice). **United States** (the existing outreach targets US businesses only): the owner's
  instruction was cut off at this point, so the entry below is **a proposal from R0, not an owner decision**; until the owner
  confirms or replaces it, no US market entry exists and the lead line refuses US leads.
  - *CAN-SPAM Act* (federal; covers B2B email, no prior consent needed): truthful header and sender; a subject line that is not
    deceptive; the message identified as an advertisement; a valid physical postal address; a clear opt-out that works for at least
    30 days after sending and is honoured within 10 business days, asking for nothing more than the address. The gate adds the
    address and opt-out, as for the EU.
  - *GDPR still applies to the controller*: the company is established in Ireland, so its processing of a US prospect's personal
    data (a named contact, an address) falls under GDPR (Art. 3(1)) wherever the prospect is: lawful basis recorded, Art. 14
    notice, retention and suppression as §4. Whether the Irish ePrivacy rules also reach email sent to US recipients is a question
    for the legal advice (Q9).
  - *Contact rule*: published business addresses only, as §4; a free-mail address (`@gmail.com` etc.) only where the business
    itself publishes it as its contact, recorded with the source URL; named individuals only as the business publishes them.
  - *State laws*: state privacy and anti-spam laws to be checked by the legal advice before the first US send.
- **Scope**: CRM tables (leads, pipeline, lawful basis, suppression, retention routine); the lead line (LEAD-RESEARCHER → LEAD-CHECKER
  → dedupe/suppression gate); the outreach line (OUTREACH-WRITER → mechanical gate → COMPLIANCE → `email.send.prospect` request; the
  owner sends by hand and marks it sent); opt-out recording; the content line (CONTENT-WRITER → gate → COMPLIANCE → `public.post`
  request); new blocked domains; the pipeline board; pipeline counts (not contacts) to the CEO.
- **Tests**: a suppressed address never reaches a draft; an opt-out is recorded and blocks every later draft; a claim not in the
  register fails the gate; the footer and notice are added by the engine; retention deletes an expired lead and keeps the suppression
  hash; a personal address or blocked-domain source is rejected; a lead without a market entry is refused; a COMPLIANCE `refuse`
  cannot be skipped by any agent.
- **Risks**: legal (mitigated: legal check first, one market at a time, owner sends every email); reputation from poor outreach
  (mitigated: COMPLIANCE and owner review, low volume; Haiku drafts, §9 Q8); lead quality from public sources.
- **Rollback**: deploy rollback; CRM tables are additive; routines disarmed.
- **Weekly cost**: lead research 2 runs × ~USD 0.16 (12 searches at USD 0.01 + tokens) ≈ 0.32; lead check 2 × ~0.05 ≈ 0.10;
  outreach 20 × ~0.003 (Haiku) ≈ 0.06; COMPLIANCE 22 × ~0.017 ≈ 0.37; content 2 × ~0.01 ≈ 0.02: ≈ USD 0.87, **about USD 0.90–1.80 a
  week** with reworks (≈ USD 1.40–3.00 if the writers move to Sonnet).

### R6: Customer Success and ANALYST (once there are paying customers)

- **Scope**: hire ONBOARDING-GUIDE, SUPPORT-DRAFTER, RETENTION-ANALYST, ANALYST. The product's read-only interface (specified here,
  built by Engineering in the product repo, merged and deployed by the owner); `support_ticket_read`; SUPPORT-DRAFTER and
  ONBOARDING-GUIDE lines through COMPLIANCE to `support.reply.send` and `email.send.customer` requests; RETENTION-ANALYST weekly;
  Stripe read-only (GDPR decision recorded first) and `metrics_read` for ANALYST; MRR into Finance; Customer Success signals into
  the PRODUCT-MANAGER's backlog; ANALYST's report to the CEO, Product and Sales.
- **Tests**: one record per call, no listing endpoint used, content not stored after the job; Stripe and admin stats aggregates
  only, no personal field reaches ANALYST or the CEO; the draft never carries data from another customer.
- **Risks**: personal data in prompts (mitigated: one ticket at a time, nothing stored, processor terms checked); wrong answers to
  customers (owner approves every reply); small numbers making aggregates identifying (mitigated: ANALYST reports counts below 5 as
  "<5").
- **Rollback**: deploy rollback; revoke the product token and the Stripe restricted key.
- **Weekly cost**: support 20 × (Haiku ~0.003 + COMPLIANCE ~0.017) ≈ 0.40; onboarding 2 × ~0.005 ≈ 0.01; retention ≈ 0.01; ANALYST 2 ×
  ~0.005 ≈ 0.01: **about USD 0.45 a week**.

### R7: the 3D office

- **Scope**: seven floors as §7: the penthouse at the top with the Owner's office requests wall, exec offices and memo board;
  Security & Data, Engineering, Product & Design, Sales & Marketing and Customer Success floors; the lobby with the trophy room
  (today's floor-1 bake moved to G) and the lounge; "not hired yet" desks; product colour tags, CI wall, backlog, pipeline, support
  and metrics boards; the switcher with G and 1–6.
- **Tests**: scene layout per floor, every desk matches a department agent, the floor label comes from config (display order only),
  the baked-room test for G, the fps bench on every floor and the whole-building view (target 60).
- **Risks**: fps on the iGPU with seven floors in the building view (mitigated: low-detail shells for non-selected floors;
  procedural rooms are cheap today, 145+ fps); visual clutter.
- **Rollback**: deploy rollback (scene only).
- **Weekly cost**: USD 0.

**All phases running** (R2–R6 at the workloads above, thinking off): about **USD 8.60–13.55 a week**, call it **USD 9–14**, within
today's USD 10 day cap on any normal day and the USD 200 Console month. Thinking "default" on the seven Sonnet agents (§2.3) could
add USD 2–5 a week, mostly DEVELOPER. Order: R1 first; R2 straight after; R3 any time after R2; R4 after R3; R5 waits for legal
advice; R6 waits for paying customers; R7 any time after R1.

---

## 9. Open questions for the owner before R1

Answered by the R0.2 decision (23/10/2026) and dropped: the old Q7 (locking the legal levels: locked in code, §3.2, with the list
read as below) and the model rule (Haiku routine, Sonnet for DEVELOPER, REVIEWER, SECURITY, COMPLIANCE and the execs, Opus per
issue by the owner).

1. **Etsy wind-down.** The winter job on live (QA-only on set-v4 was next) and the autumn package in the approval queue: archive them
   as they are, or finish them by hand first? Do the live listings stay on Etsy? (The Station keeps only the read-only connection,
   in the trophy room.)
2. **Deploy path.** Live runs L3.1; W4 and B0 are not deployed. Go from L3.1 straight to R1 with the one migration (recommended), or
   deploy B0 first? W6 stays parked on `w6-wip` (recommended: not merged, since Etsy stops).
3. **ReplyDesk facts.** Answered 23/10/2026: the clone is `C:\Users\marks\review-reply-service` (`REPLYDESK_REPO`, main at
   `d03a9ab`); Python/Flask, pytest, Render, Stripe, Google Business Profile (§5.8). Still open: whether it has users or customer
   data in production yet (this decides when R6 starts); whether a linter or type check should be added to its checks; confirm or
   replace the proposed US market rules (§8, R5); stopping the weekly outreach routine and what to do with its prospect data (§8,
   R5).
4. **emty-inbox and Stellar.** emty-inbox's PLAN.md names Stellar Corporate Housing as its first pilot tenant, and the repo's text
   names it. The building rule refuses Stellar's data (`foreignDataMarkers`), so today an agent's write containing that name is
   refused. Choose: (a) the Station works on emty-inbox code, the marker check applies to data and drafts but not to repo source
   text, and no tenant data ever enters the Station; or (b) emty-inbox stays outside the Station until it has a non-Stellar customer.
   Selling to Stellar is a decision for Stellar's own decision-makers, not the Station.
5. **No network for checks.** Accept a container (Docker Desktop or WSL with `--network none`: an install on this laptop, outside the
   repo) or best-effort isolation for R2? emty-inbox's tests may need Postgres.
6. **Branch push.** May the engine push `dev/<job-id>` and open a PR after your approval (needs a token with contents write and a
   `main` ruleset), or do you pull the branch from the Station's mirror yourself?
7. **The locked list.** R0.2 locks in code (§3.2): the CEO rules, the owner as only approver, COMPLIANCE's independence, the COO
   never raising a cap, and the forbidden items `secrets.read`, `personal-data.scrape`, `review.fake`, `account.fake`,
   `claim.misleading`, `git.merge.agent`, `deploy.agent`, `email.send.agent`. Confirm, or strike any that should stay configurable.
8. **Budgets, caps and models.** Monthly budget per product (proposal: ReplyDesk USD 60, emty-inbox USD 40, station USD 20); job caps
   per department (proposal: engineering 3.00, security-data 0.50, product-design 0.50, sales-marketing 0.50, customer-success 0.50)
   and exec run caps (CEO 0.50, CTO 0.30, COO 0.20, COMPLIANCE 0.10); the day cap (USD 10.00 today). Thinking "default" for the seven
   Sonnet agents (§2.3), or off as today? Three Haiku placements to confirm, since each writes work others build on: TECH-LEAD
   (specs), PRODUCT-MANAGER (roadmaps) and OUTREACH-WRITER / CONTENT-WRITER (text that reaches prospects). For Opus per issue, add
   Opus 5.5's verified prices to config and set the cap for an Opus issue. The new DESIGNER's id `ux-designer` (the archived Etsy
   DESIGNER keeps `designer`).
9. **Before R5 (not blocking R1, but long lead time).** Legal advice on B2B email under S.I. 336/2011, the US rules (CAN-SPAM, state
   laws, whether Irish ePrivacy reaches US recipients) and the AI Act's Article 50 for ReplyDesk; the lead retention period
   (proposed 12 months); the company's legal name and address for the sender identity; whether you send outreach from your own
   mailbox.
10. **Names.** The company's name (the Station is a placeholder, Q14), and the public product names (ReplyDesk; emty-inbox or Inbox
    Copilot).
