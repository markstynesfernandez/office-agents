# PORTED

What office-agents took from the owner's own station code in `Virtual-workers/station/` (E3, ENGINE-PLAN.md §8), at a fixed moment, with the sha256 of every source as it was then. The legacy build itself was only read, never run or written. `npm run port-drift` hashes the same files again (read-only) and lists any that changed since.

Port moment: 2026-10-16T18:16:46Z
Second moment: 2026-10-16T18:42:21Z
Third moment: 2026-10-16T18:58:15Z
Fourth moment: 2026-10-16T19:04:02Z

- **1st moment**: 2026-10-16T18:16:46Z (16/10/2026 19:16 Irish time). Everything was staged and hashed then.
- **2nd moment**: 2026-10-16T18:42:21Z (16/10/2026 19:42 Irish time). The legacy build kept changing during E3: another session was working in Virtual-workers. A check at 19:42 found 9 staged sources changed after 19:16, plus one new module (`style-ref.mjs`) and a new test. As the build notes ask, the current versions were re-staged at the second moment and ported again. Those rows say "2nd".
- **3rd moment**: 2026-10-16T18:58:15Z (16/10/2026 19:58 Irish time). After E3 ended, `npm run port-drift` found 4 sources changed at 19:50–19:52 Irish time: `scripts/check-briefs.mjs`, `scripts/lib/demand-evidence.mjs`, `skills/brief-format.md` and `tests/digital.test.mjs`. Together they add the owner's keyword-source rule (2026-10-16): a brief fails with fewer than 5 sourced keywords, each written `- <phrase> — <source>` (`keywordSourceProblems`). After the owner approved E3, the four were re-staged and ported again. Those rows say "3rd".
- **4th moment**: 2026-10-16T19:04:02Z (16/10/2026 20:04 Irish time). While the 3rd moment was being verified, the legacy session changed 3 ported sources at 20:02 for one owner change (2026-10-16, the mug's handle hole: an enclosed background-like region is made transparent at clean-up and re-checked after the build): `scripts/lib/digital-build.mjs`, `scripts/lib/digital-gate.mjs` and `config/station.config.json` (plus its own `tests/digital-build.test.mjs`, which is not ported). In digital-build only `BUILD_VERSION` changed on the ported read side (2 to 3); the other ported functions were checked and are unchanged in the source. digital-gate gained the package-gate check for an enclosed region left after the build (packaged products only, which fail closed at prep in the engine). The config was copied unchanged. The three were re-staged together and ported again. Those rows say "4th".

Every ported module starts with a header that names its source, its moment, its sha256 and each change. The changes are mechanical. Ported code is the owner's own code, and its sha256 is the one listed here.

## Ported and copied

| Engine file | Source (station/) | Moment | Changes |
|---|---|---|---|
| src/engine/lib/zip.mjs | scripts/lib/zip.mjs | 1st | none |
| src/engine/lib/digital-files.mjs | scripts/lib/digital-files.mjs | 1st | none (sha256 from ./common.mjs, which is the engine's) |
| src/engine/lib/demand-evidence.mjs | scripts/lib/demand-evidence.mjs | 3rd | none |
| src/engine/lib/image-policy.mjs | scripts/lib/image-policy.mjs | 1st | none (config default is the engine's business config) |
| src/engine/lib/etsy-fees.mjs | scripts/lib/etsy-fees.mjs | 1st | none (the POD shipping helpers are kept so the ported fee tests run unchanged; the digital line never calls them) |
| src/engine/lib/originality.mjs | scripts/lib/originality.mjs | 1st | SOFT_CATEGORIES is [] (owner Q5: the saturated list applies to all text; the source applied it to slogans only); file writes go through the engine's data jail (dataJail from ../store/active.mjs); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/digital-build.mjs | scripts/lib/digital-build.mjs | 4th | read side only (buildStatus and its inputs, previewDirOf, noticeFor); the build is not ported |
| src/engine/lib/digital-prep.mjs | scripts/lib/digital-prep.mjs | 1st | file writes go through the engine's data jail (dataJail from ../store/active.mjs); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); measuredBy names the engine module |
| src/engine/lib/digital-prices.mjs | scripts/lib/digital-prices.mjs | 2nd | file writes go through the engine's data jail (dataJail from ../store/active.mjs); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/); fillDigitalPrices takes the blocklist terms (`extra`) from the engine instead of reading the station's file |
| src/engine/lib/digital-gate.mjs | scripts/lib/digital-gate.mjs | 4th | job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/style-ref.mjs | scripts/lib/style-ref.mjs | 2nd | read side only (styleRefProblems and what it needs); style-reference products fail closed |
| src/engine/lib/spelling.mjs | scripts/lib/slogan.mjs | 1st | ukSpellings + listingSpellingProblems only |
| src/engine/lib/gates.mjs | scripts/lib/gates.mjs | 1st | the POD branch and its import (archive/pod) are removed: digital only; listingSpellingProblems comes from ./spelling.mjs and gets cfg; the listing originality screen uses the cfg passed in (the source used the module default config there); job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/) |
| src/engine/lib/common.mjs | scripts/lib/common.mjs | 1st | in part: readJson, sha256, sha256File, today, isListingId, productsFile, BLOCKLIST_FILE, the config default; config from office-agents/config/, digital only; loadEnv, makeLogger and api() dropped |
| src/engine/lib/brief-check.mjs | scripts/check-briefs.mjs | 3rd | the digital per-brief checks as one function checkBrief(); no CLI, folder walk or console; saturated list applies to the Design direction (Q5); the keyword-source rule (at least 5 sourced keywords) runs after demand evidence, as in the source |
| src/engine/prompts.mjs | scripts/seed.mjs | 1st | in part: parseSource() and the prompt build order, the originality-rules requirement, the owner budget; the engine wrapper is new |
| src/engine/lib/digital-build.mjs (esrganCfg) | scripts/lib/esrgan.mjs | 1st | esrganCfg only (the upscale settings in a build key) |
| config/lines/room1-digital.json | rooms/etsy-digital/room.json | 1st | written from the room's routing (loop limits design 2, listing 1); exhausted listing loop to REJECTS-DESK (Q4) |
| config/station.config.json | config/station.config.json | 4th | copied unchanged |
| config/products.json | rooms/etsy-digital/products.json | 2nd | copied unchanged |
| config/blocklist.txt | rooms/etsy-digital/blocklist.txt | 1st | copied unchanged |
| prompts/agents/demand-researcher.md | agents/src/demand-researcher.md | 1st | copied unchanged |
| prompts/agents/designer.md | agents/src/designer.md | 2nd | copied unchanged |
| prompts/agents/evidence-checker.md | agents/src/evidence-checker.md | 1st | copied unchanged |
| prompts/agents/lister.md | agents/src/lister.md | 2nd | copied unchanged |
| prompts/agents/overseer.md | agents/src/overseer.md | 1st | copied unchanged |
| prompts/agents/qa-design.md | agents/src/qa-design.md | 2nd | copied unchanged |
| prompts/agents/qa-listing.md | agents/src/qa-listing.md | 1st | copied unchanged |
| prompts/agents/rejects-desk.md | agents/src/rejects-desk.md | 1st | copied unchanged |
| prompts/skills/brief-format.md | skills/brief-format.md | 3rd | copied unchanged |
| prompts/skills/data-hygiene.md | skills/data-hygiene.md | 1st | copied unchanged |
| prompts/skills/demand-evidence.md | skills/demand-evidence.md | 1st | copied unchanged |
| prompts/skills/digital-terms.md | skills/digital-terms.md | 2nd | copied unchanged |
| prompts/skills/etsy-policy.md | skills/etsy-policy.md | 1st | copied unchanged |
| prompts/skills/originality-rules.md | skills/originality-rules.md | 1st | copied unchanged |
| prompts/skills/originality-sources.md | skills/originality-sources.md | 1st | copied unchanged |
| prompts/skills/package-format-listing.md | skills/package-format-listing.md | 1st | copied unchanged |
| prompts/skills/package-format-qa-design.md | skills/package-format-qa-design.md | 1st | copied unchanged |
| prompts/skills/package-format-qa-listing.md | skills/package-format-qa-listing.md | 1st | copied unchanged |
| prompts/skills/package-format.md | skills/package-format.md | 1st | copied unchanged |
| prompts/skills/price-floor.md | skills/price-floor.md | 1st | copied unchanged |
| prompts/skills/price-rules-brief.md | skills/price-rules-brief.md | 1st | copied unchanged |
| prompts/skills/price-rules-lister.md | skills/price-rules-lister.md | 1st | copied unchanged |
| prompts/skills/price-rules-qa-listing.md | skills/price-rules-qa-listing.md | 1st | copied unchanged |
| prompts/skills/verdict-protocol.md | skills/verdict-protocol.md | 1st | copied unchanged |
| tests/ported/originality.test.mjs | tests/originality.test.mjs | 1st | imports to src/engine/lib; job folders; the saturated-list test expects a hit on titles and tags (Q5) |
| tests/ported/digital.test.mjs | tests/digital.test.mjs | 3rd | imports to src/engine/lib; job folders |
| tests/ported/etsy-fees.test.mjs | tests/etsy-fees.test.mjs | 1st | imports to src/engine/lib; the POD-only test is not ported |
| tests/ported/vat-fees.test.mjs | tests/vat-fees.test.mjs | 1st | imports to src/engine/lib |
| tests/ported/listing-notice.test.mjs | tests/style-ref.test.mjs | 2nd | listing-notice.test.mjs: only the last test (the product's own download notice); the others need the StarNet patch, run-line or the build |

## Not ported

| Source | Why |
|---|---|
| scripts/lib/digital-build.mjs (the build) | cleanAlpha, processFile, buildPreview, buildDigitalSet, enclosedBackgroundRegions, clearEnclosedBackground: clean-up (including the enclosed-background step, build version 3), Real-ESRGAN through a child process, zip. Packaged products fail closed at prep until the owner decides how the build runs in the engine. |
| scripts/lib/style-ref.mjs (the workflow) | firstFileOf, makeReviewImages, recordDecision, ensureStyleRefInSet: the first-file run mode, review images and the owner's decision record (added upstream 16/10/2026 19:26). Style-reference products fail closed at the package gate. |
| scripts/lib/esrgan.mjs (the rest) | the Real-ESRGAN runner (child process). |
| scripts/lib/tracker.mjs | the CSV tracker writers: replaced by the SQLite tracker table (TRACKER_COLUMNS keeps the columns). |
| scripts/lib/cost.mjs | rewritten as the ledger and guard (src/engine/ledger.mjs, guard.mjs); costs come from the ledger by jobId, not by time window. |
| scripts/lib/research-routines.mjs | the research routines: imported at E4. |
| scripts/lib/run-line.mjs, scripts/lib/starnet-patch.mjs | the StarNet-driven line runner and the StarNet image-tool patch: replaced by the engine's orchestrator and toolbox. |
| scripts/lib/slogan.mjs (the rest) | the POD slogan flow. |
| tests/prompt-size.test.mjs | replaced by the engine prompt test in tests/engine-line.test.mjs (same owner caps and targets). |
| tests/digital-build.test.mjs, most of tests/style-ref.test.mjs, tests/helpers/pod.mjs, tests/helpers/room.mjs | test the code above that is not ported, or POD. |
| StarNet itself (Virtual-workers/starnet) | not ported (MIT; NOTICE.md). Nothing of its artwork is used. |

## Source hashes (read by `npm run port-drift`)

Each source's sha256 at its moment, relative to `Virtual-workers/station/`.

```sha256
b1798ffcd5863fd8e88782812f338c97de0fd2c79f0832e06584b69c2dd7eb1d *agents/src/demand-researcher.md
98021c05d1ed446d96e0f150f939026368f0c8d19fa9fe0de298e61c1b80b21b *agents/src/designer.md
c8c9b0947de8bc5b774493d445c1852ea9dfcd775e9aca17518dbf9aa277e799 *agents/src/evidence-checker.md
c5d82c0aef5db3e4f3639ca06508fd42f021896024df3599dd3d350d8a73defc *agents/src/lister.md
1d0e349fc86ddee27a853985f697773ff6cbe3a6dc1a10cc549213526abce45e *agents/src/overseer.md
02e21500c6cbe2ddd5a9ff42fd4a7a32616f28f10a853697d1ff2f3b89a16dc8 *agents/src/qa-design.md
aee4c99fb82448ab6bf8a4356b6d422f9bae1d9e80c6109e43d2040e0b8542bc *agents/src/qa-listing.md
61d4323cdadecb5ade502dc0234fc8430b81c93dfca7121fff90ed3fbcd425b6 *agents/src/rejects-desk.md
54a17ee5e4a4711065434538e89104ab6ebb5613fa2699ddea9d74952d7d6aec *config/station.config.json
6e5de029653fb8abd156a577289cf99c72ff65a4841bf5acec62c5acb0cbaa39 *rooms/etsy-digital/blocklist.txt
a7f6d88698bbdd4f655a65b76b1d5f11642b686d5a532163bffc4629a0a07424 *rooms/etsy-digital/products.json
abfb4659a66c7a8b705fa1861c9e78bdba8789c944abc584a7ea0d4114a805fb *rooms/etsy-digital/room.json
8b308745d8be4852ac9b2cc7607301d42a1b06fbb1a1ff7e82ef756afc7425c3 *scripts/check-briefs.mjs
6ff4433aff6f728610eaeb537b0c24b4d8ec9b66cb59dce96764cbc8e4ff7be2 *scripts/lib/common.mjs
2ccf471ac9c3a99ae7ae88d42db9c18d4d7a3460e69c8f4ea90930ae83aff010 *scripts/lib/demand-evidence.mjs
b99fcc6fbd3052a25bece1ba74246c14866eb1d9ca2172d9c958a91f9a68ca51 *scripts/lib/digital-build.mjs
57bff4f9fd0ca0f88dc88eb6685782ef06a27c73ce58b1c4725163c1d8ac518a *scripts/lib/digital-files.mjs
e833a1740a66ea0d693796a06c9e044b1093fd2b7bba76cfac9304c5022995e9 *scripts/lib/digital-gate.mjs
361d8ac33e12c8ffafe8fcf7901d2f6023a7c9fce50768ee045b629315d8ec53 *scripts/lib/digital-prep.mjs
ba393738f3bd2a4707fe30db6b840fe7cc84f02c25d5233e1920db7a4e6e7a36 *scripts/lib/digital-prices.mjs
7bb48ee9d9ea821c3f7bd2694edbe90bef1ac6deac30d2a4583a0dbd184680bc *scripts/lib/esrgan.mjs
c22bf16e394b6074b38e2e87d97bffb60a9ef99c76cf69cd0aa8c51389250d19 *scripts/lib/etsy-fees.mjs
d4ba54d24887fdb051d9a7da8e6c50ce633538c9663c92cbf739a0caefa5eb9c *scripts/lib/gates.mjs
dc28944d79fccb08f275b9e2cc1032ec5d35c99c625ecb7fc6412fa70d7c4bb6 *scripts/lib/image-policy.mjs
c2ca40934746c3354e87280ab9d80d488fb11a02e0a6822da6649766081967a7 *scripts/lib/originality.mjs
438f63df5896fe2f784943dcfbbd95294925ba4e167f0f05f3797f3edfed2cf5 *scripts/lib/slogan.mjs
961703edc7a7fe57dda8f75e0ece01047a1ca4b7ed66db074e7284212a5409db *scripts/lib/style-ref.mjs
0b7f5008ed2f338437e38a5e35fe925ab0211001e1e38b87d5720ebd0c92bea8 *scripts/lib/zip.mjs
f06093b370b04283dace105530c9fdf7d68f1baee676c8127a940a169074e578 *scripts/seed.mjs
40a433a0bb315b89870dee7b0005890408cd0697f54c4ffd64e6b9ccde009714 *skills/brief-format.md
8f585898a92d0d9d7590b3910a19221b776ef413a8b013444d39a0c99467dbba *skills/data-hygiene.md
2c5737ab1232e9bf5f0e47171e847ddba07b86d655cba84f86c635add9630f87 *skills/demand-evidence.md
7dba44ab0f200ca4d51307a26260e782d560d29f91f4c3015d83df6a167dd30c *skills/digital-terms.md
47040ca4ea35e67f0a7fa833c1798b6a6e61808770ae1138f378c50c0af78da8 *skills/etsy-policy.md
e69b2c9e77fdbdf4554d38a01d534f7e7ac0430f0d709ca3fe8e1fa2c08428ff *skills/originality-rules.md
6083a7ba530a814bfc67fef29f86fd8253e8bd877e211f662728a7e58bf3c8d4 *skills/originality-sources.md
74405142dbaa0efa78bddc5750f57a136d7948c09e4d2316916e4518baa0e8bd *skills/package-format-listing.md
fc8aa90e16fc3807f059703414702feb30bf4c1507e85ad8568e1eacb68ffb82 *skills/package-format-qa-design.md
cec997d75d6599eb682f25d0cf8b1d8cac44395b77ac9bd9aad6c158dc14650d *skills/package-format-qa-listing.md
24dc2e8c26deff6221f5d2836eee9188a877e3461bca257ada387301ffb73bd8 *skills/package-format.md
8aa1a1190d52a275c608ec76b9efcd7e506347ba8257dd26a0575256cf708208 *skills/price-floor.md
4eb7eae776f6e24f320535513738d98bde6519216c8e38ff016a92056c4815d7 *skills/price-rules-brief.md
e5c6fd58854777904299049edf2a5d146ad5d9371c7814064d935e03a06cdbdb *skills/price-rules-lister.md
c9a413dc0960dd4af8914c6d64e5224432b6b6b1026259f1cf4eae5460d3606a *skills/price-rules-qa-listing.md
a0b5c8157768c3bea19ff146be8fb5305f4e56e3d1da4aa77d6f2ac543cc821f *skills/verdict-protocol.md
ba99e6da16a43c4f6ccd5d32622004e652c08503b66b4a8734ff9737fd8487a4 *tests/digital.test.mjs
fe6b88a52fa363a7fefaec8fdf7a530352f17ab96c6151cc4b40b4113d22ead6 *tests/etsy-fees.test.mjs
d78a1a53ac71a05f534b6c73933025367bbe1d2f51e86e9ac32d3d8675264d6e *tests/originality.test.mjs
2614824e45514b2c012e8adc8ccb85b5a1cecea154ac7af788fdc676c0e6a5f4 *tests/style-ref.test.mjs
9c4ed0cfe28b48c74c55db9c4a5df8675493b87360982962520e9b02fe3ce102 *tests/vat-fees.test.mjs
```
