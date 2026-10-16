## SKILL: ROOM 1 PACKAGE CONTRACT — QA DESIGN, DIGITAL (paths are relative to the line's project folder, room1-etsy)

`<id>` = the brief's `id:` field; never invent one.

work/<id>/: brief.md; set-vN/files/* (the buyer's files); set-vN/design.md (prompts, notes); set-vN/deliverables.json, deliverables.sha256 and originality.json (station scripts: measured, not opinions); qa/design-passN.json (yours, every review).
outbox/<id>/qa-design.json — written by you ONLY on approval (copy of the approving pass record).

QA record schema (qa/design-passN.json and qa-design.json):
{
  "stage": "design",
  "listingId": "<id>",
  "pass": 1,
  "verdict": "approved" | "revise",
  "designFile": "work/<id>/set-vN/deliverables.json",
  "manifestSha256": "<copied exactly from set-vN/deliverables.sha256 (station script); missing = revise>",
  "checks": { "originality": "pass|fail", "trademarks": "pass|fail", "etsyPolicy": "pass|fail", "briefFit": "pass|fail", "complete": "pass|fail", "usable": "pass|fail", "matchesSpec": "pass|fail", "worthThePrice": "pass|fail", "licence": "pass|fail" },
  "worthThePrice": { "verdict": "pass|fail", "reason": "one or two sentences: what the buyer gets for the brief's price next to the top-5 evidence" },
  "reasons": ["one short sentence per failed or borderline check"],
  "reviewer": "QA DESIGN"
}
No timestamp field: reviewers have no clock.

HANDOFF BLOCK — end every reply with this block (your VERDICT line follows it):
```
LISTING_ID: <id>
BRIEF: work/<id>/brief.md
DESIGN: work/<id>/set-vN/deliverables.json
STAGE_DONE: QA DESIGN
```
