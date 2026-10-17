# PORTED

What office-agents took from the owner's own station code in `Virtual-workers/station/` (E3, ENGINE-PLAN.md §8), at a fixed moment, with the sha256 of every source as it was then. The legacy build itself was only read, never run or written. `npm run port-drift` hashes the same files again (read-only) and lists any that changed since.

Port moment: 2026-10-16T18:16:46Z
Second moment: 2026-10-16T18:42:21Z
Third moment: 2026-10-16T18:58:15Z
Fourth moment: 2026-10-16T19:04:02Z
Fifth moment: 2026-10-17T11:34:23Z

- **1st moment**: 2026-10-16T18:16:46Z (16/10/2026 19:16 Irish time). Everything was staged and hashed then.
- **2nd moment**: 2026-10-16T18:42:21Z (16/10/2026 19:42 Irish time). The legacy build kept changing during E3: another session was working in Virtual-workers. A check at 19:42 found 9 staged sources changed after 19:16, plus one new module (`style-ref.mjs`) and a new test. As the build notes ask, the current versions were re-staged at the second moment and ported again. Those rows say "2nd".
- **3rd moment**: 2026-10-16T18:58:15Z (16/10/2026 19:58 Irish time). After E3 ended, `npm run port-drift` found 4 sources changed at 19:50–19:52 Irish time: `scripts/check-briefs.mjs`, `scripts/lib/demand-evidence.mjs`, `skills/brief-format.md` and `tests/digital.test.mjs`. Together they add the owner's keyword-source rule (2026-10-16): a brief fails with fewer than 5 sourced keywords, each written `- <phrase> — <source>` (`keywordSourceProblems`). After the owner approved E3, the four were re-staged and ported again. Those rows say "3rd".
- **4th moment**: 2026-10-16T19:04:02Z (16/10/2026 20:04 Irish time). While the 3rd moment was being verified, the legacy session changed 3 ported sources at 20:02 for one owner change (2026-10-16, the mug's handle hole: an enclosed background-like region is made transparent at clean-up and re-checked after the build): `scripts/lib/digital-build.mjs`, `scripts/lib/digital-gate.mjs` and `config/station.config.json` (plus its own `tests/digital-build.test.mjs`, which is not ported). In digital-build only `BUILD_VERSION` changed on the ported read side (2 to 3); the other ported functions were checked and are unchanged in the source. digital-gate gained the package-gate check for an enclosed region left after the build (packaged products only, which fail closed at prep in the engine). The config was copied unchanged. The three were re-staged together and ported again. Those rows say "4th".

- **5th moment**: 2026-10-17T11:34:23Z (17/10/2026 12:34 Irish time). **The port batch before E6**, after the owner's legacy job `2026-10-16--pngtuber-cosy-desk-props-r2` was published on Etsy (https://www.etsy.com/listing/4597311033, 2026-10-17, EUR 9.00, SKU DESK-PROPS-01). One batch: the 16 sources `npm run port-drift` showed drifted, plus every entry under "To port to office-agents" in `Virtual-workers/station/HANDOFF.md` (items 1–32, with the freeze exceptions a–o of 16–17/10/2026). The legacy session was still editing HANDOFF.md, so every source was first copied, read only, into a frozen staging folder at this moment and ported from there; a check after the port found no source changed since. The batch's new legacy files are tracked below from this moment. The owner's decisions for this port are in DECISIONS.md, "Port batch before E6: owner decisions" (17/10/2026). Those rows say "5th".

Every ported module starts with a header that names its source, its moment, its sha256 and each change. The changes are mechanical. Ported code is the owner's own code, and its sha256 is the one listed here.

## Ported and copied

| Engine file | Source (station/) | Moment | Changes |
|---|---|---|---|
| src/engine/lib/zip.mjs | scripts/lib/zip.mjs | 1st | none |
| src/engine/lib/digital-files.mjs | scripts/lib/digital-files.mjs | 5th | none (fileLimitProblems moved here, as in the source) |
| src/engine/lib/demand-evidence.mjs | scripts/lib/demand-evidence.mjs | 3rd | none |
| src/engine/lib/image-policy.mjs | scripts/lib/image-policy.mjs | 1st | none (config default is the engine's business config) |
| src/engine/lib/etsy-fees.mjs | scripts/lib/etsy-fees.mjs | 1st | none (the POD shipping helpers are kept so the ported fee tests run unchanged; the digital line never calls them) |
| src/engine/lib/originality.mjs | scripts/lib/originality.mjs | 5th | SOFT_CATEGORIES is [] (owner Q5); file writes go through the engine's data jail (dataJail); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); hitLine labels a hit without a field "text" (port item 13); FUZZY_CATEGORIES includes the engine's `scouted-games` (owner 17/10/2026, "Scouting decisions": one-letter misspellings of scouted names hit). The near-miss allow-list and the digital set screen came over unchanged |
| src/engine/lib/digital-build.mjs | scripts/lib/digital-build.mjs | 5th | the whole build now (owner 17/10/2026: it runs in the engine): the upscaler is passed in (the pinned Real-ESRGAN runner, esrgan.mjs); without one, Lanczos with a warning the gate refuses; file writes go through the engine's data jail (dataJail); temp files in set-vN/.tmp-build-<pid>/; job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); builtBy names the engine module |
| src/engine/lib/digital-prep.mjs | scripts/lib/digital-prep.mjs | 5th | file writes go through the engine's data jail (dataJail); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); measuredBy names the engine module |
| src/engine/lib/digital-prices.mjs | scripts/lib/digital-prices.mjs | 5th | file writes go through the engine's data jail (dataJail); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); fillDigitalPrices takes the blocklist terms (`extra`) from the engine; the engine calls it with the job's own id (never "the most recently changed listing": the legacy price-hook bug, item 31) |
| src/engine/lib/digital-gate.mjs | scripts/lib/digital-gate.mjs | 5th | job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/style-ref.mjs | scripts/lib/style-ref.mjs | 5th | the whole library now (cleaned version, per-version decisions, approvedRef, ensureStyleRefInSet, makeReviewImages, styleRefProblems); file writes go through the engine's data jail (dataJail); the review build's temp folder is in the set folder; job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); the first-file run mode itself is not ported (see below) |
| src/engine/lib/spelling.mjs | scripts/lib/slogan.mjs | 1st | ukSpellings + listingSpellingProblems only |
| src/engine/lib/gates.mjs | scripts/lib/gates.mjs | 5th | the POD branch and its import (archive/pod) are removed: digital only; listingSpellingProblems comes from ./spelling.mjs and gets cfg; the listing originality screen uses the cfg passed in; job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/common.mjs | scripts/lib/common.mjs | 1st | in part: readJson, sha256, sha256File, today, isListingId, productsFile, BLOCKLIST_FILE, the config default; config from office-agents/config/, digital only; loadEnv, makeLogger and api() dropped |
| src/engine/lib/brief-check.mjs | scripts/check-briefs.mjs | 3rd | the digital per-brief checks as one function checkBrief(); no CLI, folder walk or console; saturated list applies to the Design direction (Q5); the keyword-source rule (at least 5 sourced keywords) runs after demand evidence, as in the source |
| src/engine/prompts.mjs | scripts/seed.mjs | 1st | in part: parseSource() and the prompt build order, the originality-rules requirement, the owner budget; the engine wrapper is new |
| src/engine/lib/esrgan.mjs | scripts/lib/esrgan.mjs | 5th | in part: esrganCfg, bleedColour and the upscale's three parts kept; the binary is the engine's own pinned copy (config/engine.json upscale, sha256 of the binary, DLL and model checked before every run), run with execFile (no shell), cwd and files inside the job's set folder, a minimal environment, killed by the E-STOP or the owner's Stop; the GPU probe writes in the jail (owner decision 17/10/2026) |
| config/lines/room1-digital.json | rooms/etsy-digital/room.json | 1st | written from the room's routing (loop limits design 2, listing 1); exhausted listing loop to REJECTS-DESK (Q4) |
| config/station.config.json | config/station.config.json | 5th | copied unchanged |
| config/products.json | rooms/etsy-digital/products.json | 2nd | copied unchanged |
| config/blocklist.txt | rooms/etsy-digital/blocklist.txt | 1st | copied unchanged |
| prompts/agents/demand-researcher.md | agents/src/demand-researcher.md | 1st | copied unchanged |
| prompts/agents/designer.md | agents/src/designer.md | 2nd | copied unchanged |
| prompts/agents/evidence-checker.md | agents/src/evidence-checker.md | 1st | copied unchanged |
| prompts/agents/lister.md | agents/src/lister.md | 5th | copied unchanged |
| prompts/agents/overseer.md | agents/src/overseer.md | 1st | copied unchanged |
| prompts/agents/qa-design.md | agents/src/qa-design.md | 5th | copied unchanged |
| prompts/agents/qa-listing.md | agents/src/qa-listing.md | 5th | copied unchanged |
| prompts/agents/rejects-desk.md | agents/src/rejects-desk.md | 1st | copied unchanged |
| prompts/skills/brief-format.md | skills/brief-format.md | 3rd | copied unchanged |
| prompts/skills/data-hygiene.md | skills/data-hygiene.md | 1st | copied unchanged |
| prompts/skills/demand-evidence.md | skills/demand-evidence.md | 1st | copied unchanged |
| prompts/skills/digital-terms.md | skills/digital-terms.md | 2nd | copied unchanged |
| prompts/skills/etsy-policy.md | skills/etsy-policy.md | 1st | copied unchanged |
| prompts/skills/originality-rules.md | skills/originality-rules.md | 1st | copied unchanged |
| prompts/skills/originality-sources.md | skills/originality-sources.md | 1st | copied unchanged |
| prompts/skills/package-format-listing.md | skills/package-format-listing.md | 5th | copied unchanged |
| prompts/skills/package-format-qa-design.md | skills/package-format-qa-design.md | 1st | copied unchanged |
| prompts/skills/package-format-qa-listing.md | skills/package-format-qa-listing.md | 5th | copied unchanged |
| prompts/skills/package-format.md | skills/package-format.md | 1st | copied unchanged |
| prompts/skills/price-floor.md | skills/price-floor.md | 1st | copied unchanged |
| prompts/skills/price-rules-brief.md | skills/price-rules-brief.md | 1st | copied unchanged |
| prompts/skills/price-rules-lister.md | skills/price-rules-lister.md | 1st | copied unchanged |
| prompts/skills/price-rules-qa-listing.md | skills/price-rules-qa-listing.md | 1st | copied unchanged |
| prompts/skills/verdict-protocol.md | skills/verdict-protocol.md | 1st | copied unchanged |
| tests/ported/originality.test.mjs | tests/originality.test.mjs | 5th | imports to src/engine/lib; job folders; the saturated-list test expects a hit on titles and tags (Q5); the POD, guard and run-line tests are not ported; added: hitLine without a field, screenDigitalSetOnDisk on the engine layout |
| tests/ported/digital.test.mjs | tests/digital.test.mjs | 3rd | imports to src/engine/lib; job folders |
| tests/ported/etsy-fees.test.mjs | tests/etsy-fees.test.mjs | 1st | imports to src/engine/lib; the POD-only test is not ported |
| tests/ported/vat-fees.test.mjs | tests/vat-fees.test.mjs | 1st | imports to src/engine/lib |
| tests/ported/style-ref.test.mjs | tests/style-ref.test.mjs | 5th | imports to src/engine/lib; job folders; a jail per temp root; the StarNet patch, image_generate and run-line --first-file tests are not ported; replaces listing-notice.test.mjs (its test moved here) |
| src/engine/lib/owner-approval.mjs | scripts/lib/owner-approval.mjs | 5th | job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/prop-edit.mjs | scripts/lib/prop-edit.mjs | 5th | file writes go through the engine's data jail (dataJail); the edits.json note names the engine module |
| src/engine/lib/listing-fix.mjs | scripts/lib/listing-fix.mjs | 5th | none |
| src/engine/lib/listing-photos.mjs | scripts/lib/listing-photos.mjs | 5th | none |
| src/engine/lib/package-digital.mjs | scripts/lib/package-digital.mjs | 5th | adapted: the package is jobs/<id>/package/ (was approval-queue/<id>/), an earlier one moved to package-replaced-<sha12>/; cost.json is passed in (the engine's ledger rows by jobId, not the time window); the owner-decided check reads the approvals row; every override also carries the file's sha256, the stage, the date and who decided; file writes go through the engine's data jail (dataJail) |
| src/engine/owner.mjs | scripts/approve-set.mjs, scripts/approve-listing.mjs, scripts/edit-prop.mjs, scripts/fix-listing-text.mjs, scripts/make-listing-photos.mjs, scripts/style-ref.mjs | 5th | in part: what each script does, as engine actions (version-checked, logged, emitted); the owner's decisions are an append-only log (owner-decisions.jsonl) and owner-review.json is derived from it; an override applies only to a QA judgement verdict and never while originality is a hit; the recolour / outline step refuses an unapproved source |
| src/engine/orchestrator.mjs (qaOnly, listingOnly, packageJob) | scripts/lib/run-line.mjs | 5th | in part: qaOnlyRequest / runQaOnly and listingOnlyRequest / runListingOnly / agentRunEstimate as engine run modes (no StarNet session); QA-only refused past the pass limit; the listing-only cap checked before every hop against the dearest of the agent's last 10 runs; the package step is a separate owner action |
| config/listing-photos/pngtuber-prop-pack.json | scripts/make-listing-photos.mjs | 5th | the owner's photo plan (owner words, scene, close-ups) copied word for word |
| tests/ported/digital-build.test.mjs | tests/digital-build.test.mjs | 5th | imports to src/engine/lib; job folders; a jail per temp root; package-digital adapted as above; the run-line tests are not ported |
| tests/ported/owner-approval.test.mjs | tests/owner-approval.test.mjs | 5th | imports to src/engine/lib; job folders; a jail per temp root |
| tests/ported/prop-edit.test.mjs | tests/prop-edit.test.mjs | 5th | imports to src/engine/lib; a jail per temp root |
| tests/ported/listing-photos.test.mjs | tests/listing-photos.test.mjs | 5th | imports to src/engine/lib |

## Not ported

| Source | Why |
|---|---|
| scripts/lib/run-line.mjs (--first-file), scripts/lib/starnet-patch.mjs | the first-file run mode and the reference image sent to the image model (StarNet's image-tool patch): image_generate has no reference image yet, so a NEW style-reference job still fails closed at the package gate (E6 checklist). The library, decisions and the cleaned version are ported. |
| scripts/lib/tracker.mjs | the CSV tracker writers: replaced by the SQLite tracker table (TRACKER_COLUMNS keeps the columns). |
| scripts/lib/cost.mjs | rewritten as the ledger and guard (src/engine/ledger.mjs, guard.mjs); costs come from the ledger by jobId, not by time window. |
| scripts/lib/research-routines.mjs | the research routines: imported at E4. |
| scripts/lib/run-line.mjs (the rest) | the StarNet-driven line runner: replaced by the engine's orchestrator and toolbox (QA-only and listing-only ported in part, above). |
| scripts/lib/slogan.mjs (the rest) | the POD slogan flow. |
| tests/prompt-size.test.mjs | replaced by the engine prompt test in tests/engine-line.test.mjs (same owner caps and targets). |
| tests/qa-only.test.mjs, tests/listing-only.test.mjs | drive a StarNet session through a fake API: replaced by tests/port-batch.test.mjs (the engine's run modes on the mock provider). |
| scripts/lib/price-hook.mjs | the StarNet price hook whose `pendingListing` filled "the most recently changed unreviewed listing" (the legacy bug, item 31): replaced by the engine's price-fill step, keyed to its job; the bug's shape is a test in tests/port-batch.test.mjs. Tracked below so a change to it shows. |
| scripts/update-tracker.mjs | the published state: replaced by the engine's Mark published (final title, final price, SKU in the approvals row and the tracker row). |
| scripts/build-digital-set.mjs, scripts/package-digital.mjs | the CLIs: the build runs inside the engine's prep step; the package is the engine's package step. |
| tests/helpers/pod.mjs, tests/helpers/room.mjs, tests/upscale.test.mjs | POD fixtures and the POD-era upscale test. |
| StarNet itself (Virtual-workers/starnet) | not ported (MIT; NOTICE.md). Nothing of its artwork is used. |

## Source hashes (read by `npm run port-drift`)

Each source's sha256 at its moment, relative to `Virtual-workers/station/`.

```sha256
b1798ffcd5863fd8e88782812f338c97de0fd2c79f0832e06584b69c2dd7eb1d *agents/src/demand-researcher.md
98021c05d1ed446d96e0f150f939026368f0c8d19fa9fe0de298e61c1b80b21b *agents/src/designer.md
c8c9b0947de8bc5b774493d445c1852ea9dfcd775e9aca17518dbf9aa277e799 *agents/src/evidence-checker.md
01524364657bc9c76e2e5524c4b80841bc71aea1338971d2101690270a25625b *agents/src/lister.md
1d0e349fc86ddee27a853985f697773ff6cbe3a6dc1a10cc549213526abce45e *agents/src/overseer.md
ed5c7afc2a0dd37f7ff8725994e753101639ea0790dff7db59e8d4b97e8f1002 *agents/src/qa-design.md
8947e4a0260816bd0b9045905203a1ce60ae8c602e47b841c32bfdbe0b068f20 *agents/src/qa-listing.md
61d4323cdadecb5ade502dc0234fc8430b81c93dfca7121fff90ed3fbcd425b6 *agents/src/rejects-desk.md
3f92c3317495f5e9c0f1c83ce995aa068c6eff263c6edf86fce97a4888c19262 *config/station.config.json
6e5de029653fb8abd156a577289cf99c72ff65a4841bf5acec62c5acb0cbaa39 *rooms/etsy-digital/blocklist.txt
a7f6d88698bbdd4f655a65b76b1d5f11642b686d5a532163bffc4629a0a07424 *rooms/etsy-digital/products.json
abfb4659a66c7a8b705fa1861c9e78bdba8789c944abc584a7ea0d4114a805fb *rooms/etsy-digital/room.json
ae7b74f03ac4d9687ff0e508a3e3558ef0eb2bd6e949e83de0b08a0fd2065742 *scripts/approve-listing.mjs
19df301f97e6333002baa30633a0eb4f90222d38677f92f62a2ca475fa750fda *scripts/approve-set.mjs
8b308745d8be4852ac9b2cc7607301d42a1b06fbb1a1ff7e82ef756afc7425c3 *scripts/check-briefs.mjs
cb88e8a7a5e659279c2e43346c3e87d8f79d6ac026d1eea77a60d8abf399ae85 *scripts/edit-prop.mjs
3e96e47c977d49060b5983ff6ad68db5b7f82d936540095a240250597ae1f310 *scripts/fix-listing-text.mjs
6ff4433aff6f728610eaeb537b0c24b4d8ec9b66cb59dce96764cbc8e4ff7be2 *scripts/lib/common.mjs
2ccf471ac9c3a99ae7ae88d42db9c18d4d7a3460e69c8f4ea90930ae83aff010 *scripts/lib/demand-evidence.mjs
c8085338fc5c2e08d3e61d78ce4ae29fe1e5d3f56238fa89d2082f2f36c6ecc4 *scripts/lib/digital-build.mjs
51145814831cb99ea5b9c03286b30f8acc1aa6fcb82253d8a987f3e66ece92ef *scripts/lib/digital-files.mjs
7a81b0ff6cac146bc631bec5dc60a05cf8a0feb49e8961fa6b71aff7ccdf6ebe *scripts/lib/digital-gate.mjs
f075e4f0ab18bc34de89cf8f18f692c80c7206a7fe3106b1a7eb0fbbfc97f058 *scripts/lib/digital-prep.mjs
797d30b7fba8a38cd3fe0910204d20731aec2e7fb4af12f28879ce1bd4489700 *scripts/lib/digital-prices.mjs
7bb48ee9d9ea821c3f7bd2694edbe90bef1ac6deac30d2a4583a0dbd184680bc *scripts/lib/esrgan.mjs
c22bf16e394b6074b38e2e87d97bffb60a9ef99c76cf69cd0aa8c51389250d19 *scripts/lib/etsy-fees.mjs
9036e90693594b7e0a61d8173b757e304dd9f4b365ab36b078712da272eff633 *scripts/lib/gates.mjs
dc28944d79fccb08f275b9e2cc1032ec5d35c99c625ecb7fc6412fa70d7c4bb6 *scripts/lib/image-policy.mjs
40ce12ea14b1c1d94271028f189c507001499501a219750af04013a4dc8aca8b *scripts/lib/listing-fix.mjs
d8393752b5fe6df0c872602b5b59de85680913450efb5500b622bf8a02a9b56e *scripts/lib/listing-photos.mjs
8801bf7781f83e129f75c35fa4a7bc0fcbc4164b51feac65e84adfd39fa83294 *scripts/lib/originality.mjs
41466fa009f3fcba53b650f03e847a1a7deff0159902496b31830e15b2bc536a *scripts/lib/owner-approval.mjs
0f7d8045d948052bc1794b7adc276760511c8ce9c26538a104f04261bbda7f0a *scripts/lib/package-digital.mjs
e06d7d47199600c97823a8f528321dff36e5933252b31b4cd112d2ed30a4a292 *scripts/lib/price-hook.mjs
5fac53df089a61d5e514e27a06e2ffc81b494f5834dc0797c6c733d108ccc1bd *scripts/lib/prop-edit.mjs
0b73711c6e24148ea162ba5ed6e0fa33d6c2464137562e99c59479f98ffffd5d *scripts/lib/run-line.mjs
438f63df5896fe2f784943dcfbbd95294925ba4e167f0f05f3797f3edfed2cf5 *scripts/lib/slogan.mjs
dc6fcc0aa19e9e5447f3ca38f2e787e3d6c6602acbddb884d525a8bac3d0b9f3 *scripts/lib/style-ref.mjs
0b7f5008ed2f338437e38a5e35fe925ab0211001e1e38b87d5720ebd0c92bea8 *scripts/lib/zip.mjs
8953c757512f13d523d1f6e95e02c535d78d7a6ccd0d35a6d4345b93603ec17b *scripts/make-listing-photos.mjs
f06093b370b04283dace105530c9fdf7d68f1baee676c8127a940a169074e578 *scripts/seed.mjs
414b65ba0bf3aac90bd02be3ba6dfff3ea63ca398c5118cba33004f40deb113e *scripts/style-ref.mjs
40a433a0bb315b89870dee7b0005890408cd0697f54c4ffd64e6b9ccde009714 *skills/brief-format.md
8f585898a92d0d9d7590b3910a19221b776ef413a8b013444d39a0c99467dbba *skills/data-hygiene.md
2c5737ab1232e9bf5f0e47171e847ddba07b86d655cba84f86c635add9630f87 *skills/demand-evidence.md
7dba44ab0f200ca4d51307a26260e782d560d29f91f4c3015d83df6a167dd30c *skills/digital-terms.md
47040ca4ea35e67f0a7fa833c1798b6a6e61808770ae1138f378c50c0af78da8 *skills/etsy-policy.md
e69b2c9e77fdbdf4554d38a01d534f7e7ac0430f0d709ca3fe8e1fa2c08428ff *skills/originality-rules.md
6083a7ba530a814bfc67fef29f86fd8253e8bd877e211f662728a7e58bf3c8d4 *skills/originality-sources.md
73843724135bf3c3a0f42544909dd47064844705359349650a903358c08867d4 *skills/package-format-listing.md
fc8aa90e16fc3807f059703414702feb30bf4c1507e85ad8568e1eacb68ffb82 *skills/package-format-qa-design.md
b2ef8695648633b9f8599cacdb1fbcab1df0c2014083c772513046aed750bf5f *skills/package-format-qa-listing.md
24dc2e8c26deff6221f5d2836eee9188a877e3461bca257ada387301ffb73bd8 *skills/package-format.md
8aa1a1190d52a275c608ec76b9efcd7e506347ba8257dd26a0575256cf708208 *skills/price-floor.md
4eb7eae776f6e24f320535513738d98bde6519216c8e38ff016a92056c4815d7 *skills/price-rules-brief.md
e5c6fd58854777904299049edf2a5d146ad5d9371c7814064d935e03a06cdbdb *skills/price-rules-lister.md
c9a413dc0960dd4af8914c6d64e5224432b6b6b1026259f1cf4eae5460d3606a *skills/price-rules-qa-listing.md
a0b5c8157768c3bea19ff146be8fb5305f4e56e3d1da4aa77d6f2ac543cc821f *skills/verdict-protocol.md
a7a34eafffc228050fa4b42cf8c20273cda19d6432975fac7061070e3e389759 *tests/digital-build.test.mjs
ba99e6da16a43c4f6ccd5d32622004e652c08503b66b4a8734ff9737fd8487a4 *tests/digital.test.mjs
fe6b88a52fa363a7fefaec8fdf7a530352f17ab96c6151cc4b40b4113d22ead6 *tests/etsy-fees.test.mjs
116caf4050080cc598e672998cbc65f105d4411764ab6bc08e3c6a726679375c *tests/listing-only.test.mjs
4a5d5146c2dfdb16089ead7ff81fd2e6a082119bf27bed52b19e21e53f3fdefe *tests/listing-photos.test.mjs
bf853a54b1749f59b8297f229115c0796410335d4f635913545691a858169704 *tests/originality.test.mjs
9640cf0269e163fd09e0e8fd04e75f6f89500fa026138ca2f7bf54bf974bf9ee *tests/owner-approval.test.mjs
2e007798ad31d0901788c711399a6cbaae2a0d3d8e5789b3e23de7d7e0d74f8c *tests/prop-edit.test.mjs
b40388f561ce747a78ff3bc15333d32392e4f74eb300790fb47cfd2fdb4d4e7b *tests/qa-only.test.mjs
c5fc4f1c4bf14ce19f049d327364f1fbe4b248f69f1ac6d1bb9ec1f37b19243d *tests/style-ref.test.mjs
9c4ed0cfe28b48c74c55db9c4a5df8675493b87360982962520e9b02fe3ce102 *tests/vat-fees.test.mjs
```
