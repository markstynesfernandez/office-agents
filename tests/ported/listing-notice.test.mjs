// PORTED from Virtual-workers/station/tests/style-ref.test.mjs at 16/10/2026 19:42 Irish time (re-ported: it changed after 19:16), source sha256 2614824e45514b2c012e8adc8ccb85b5a1cecea154ac7af788fdc676c0e6a5f4.
//   change: only the last test (the product's own download notice) is ported; the others test the StarNet image patch, run-line and
//           the Real-ESRGAN build, which are not ported (PORTED.md)
//   change: imports point at src/engine/lib
// Everything else is the source test unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { config, loadProductList } from '../../src/engine/lib/common.mjs';
import { noticeFor } from '../../src/engine/lib/digital-build.mjs';
import { digitalListingChecks } from '../../src/engine/lib/digital-gate.mjs';

test('the prop pack (live products.json): its own owner-approved notice matches the spec and passes the listing check; the config default stays DRAFT', () => {
  const live = loadProductList('digital').find((x) => x.key === 'pngtuber-prop-pack'), nt = noticeFor(live, config), f = live.deliverables.files;
  assert.match(nt.status, /^owner-approved 2026-10-16/); assert.equal(nt.where, 'products.json pngtuber-prop-pack.listingNotice');
  assert.ok(f.every((x) => x.widthPx === f[0].widthPx && x.heightPx === f[0].heightPx && x.format === 'png'));
  assert.ok(nt.text.includes('one ZIP file containing ' + f.length + ' transparent PNG files (' + f[0].widthPx + '×' + f[0].heightPx + ' px)'), 'the notice states the spec');
  assert.equal(live.styleReference.ownerOk, true); assert.match(config.digital.listingNoticeStatus, /^DRAFT/); assert.equal(noticeFor({ key: 'other' }, config).where, 'config.digital.listingNotice');
  const d = config.digital, reasons = [];
  digitalListingChecks({ L: { delivery: d.delivery, licence: live.licence, description: 'Twelve desk props.\n\n' + nt.text + '\n\n' + d.licences[live.licence].listingText + '\n\n' + d.aiDisclosure.text }, workDir: os.tmpdir(), design: { product: live, manifest: null }, reasons, cfg: { ...config, productType: 'digital' } });
  assert.deepEqual(reasons.filter((x) => /notice|licence|license|AI disclosure|shipping/i.test(x)), []);
});
