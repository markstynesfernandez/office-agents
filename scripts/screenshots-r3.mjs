// screenshots-r3.mjs — R3 spike captures: the Design room, current (procedural) vs baked (?scene=baked), light and dark,
// same camera as Redesign R2's 04-design-room (legacy fixtures view, zoom 2.3), plus fps rows and the asset sizes.
//   node scripts/screenshots-r3.mjs            -> headless (a quick look; fps on the headless GPU)
//   node scripts/screenshots-r3.mjs --headed   -> Google Chrome, headed: fps-headed.json (the budget figure)
//   ... --headed --channel chromium --expect-gpu intel   -> Playwright's Chromium, headed, checked to be on the Intel iGPU
// Starts its own Station server on a random port (fixtures, mock data) and opens only that page. Playwright launches
// the browser with a fresh temporary profile (no persistent context). Every file goes through outJail()
// (screenshots/ only): screenshots/r3-spike/.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createOfficeServer, ROOT } from '../src/server/index.mjs';
import { makeLogger } from '../src/server/log.mjs';
import { launch, makeViewer, outJail, settle, W, H } from './screenshots.mjs';

const argv = process.argv.slice(2), headed = argv.includes('--headed');
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const outDir = 'r3-spike', benchMs = Number(arg('--bench-ms', 3000)), only = arg('--only', null);
const want = (name) => !only || only.split(',').some((p) => name.startsWith(p));
fs.mkdirSync(outJail(outDir), { recursive: true });
const log = makeLogger({ dir: path.join(ROOT, 'logs'), name: 'screenshots-r3' });
const { server } = createOfficeServer({ fixtures: true, log });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
console.log('station server for R3 captures:', base, '(legacy fixtures view)');
const channel = arg('--channel', null), expectGpu = arg('--expect-gpu', null);   // e.g. --channel chromium --expect-gpu intel
const { browser, label: browserLabel, gl } = await launch({ headed, channel });
const problems = [], fpsRows = [];
if (expectGpu && !String(gl).toLowerCase().includes(expectGpu.toLowerCase())) problems.push('GL renderer is ' + gl + ', expected ' + expectGpu + ': fps rows are not the budget figure');
const view = makeViewer({ browser, base, outDir, log, problems, fpsRows, benchMs });

// the R2 04-design-room camera: focus the Design room at zoom 2.3, aimed a little behind its centre
const designCam = async (page) => { await page.evaluate(() => { const o = window.__office.office, a = o.anchors.depts.design; window.__office.focusDept('design', 2.3); o.focus({ x: a.x - 0.9, z: a.z - 0.9 }, 2.3); }); };
// on the baked views, check the baked room is really the one on screen (not the procedural fallback)
const bakedCheck = (name, glow) => async (page) => {
  await page.waitForFunction(() => { const b = window.__office.baked(); return b.loaded || b.failed; }, null, { timeout: 30000 });
  const b = await page.evaluate(() => window.__office.baked());
  if (!b.active) problems.push(name + ': baked room not active ' + JSON.stringify(b));
  if (glow != null && b.glow !== glow) problems.push(name + ': glow ' + b.glow + ', expected ' + glow);
};
const both = (...fs) => async (page) => { for (const f of fs) await f(page); };

const VIEWS = [
  ['01-design-current-light.png', 'theme=light', designCam, 'current (procedural), light'],
  ['02-design-baked-light.png', 'theme=light&scene=baked', both(bakedCheck('02', false), designCam), 'baked, day lightmap'],
  ['03-design-current-dark.png', 'theme=dark', designCam, 'current (procedural), dark'],
  ['04-design-baked-dark.png', 'theme=dark&scene=baked', both(bakedCheck('04', true), designCam), 'baked, evening lightmap, half-res LED glow on'],
];
const files = [];
try {
  for (const [name, query, act, note] of VIEWS) if (want(name)) files.push(await view(name, query, act, note));
  // fps only (no screenshot file): the glow's cost, and the whole office with the baked room
  const fpsOnly = makeViewer({ browser, base, outDir, log, problems, fpsRows, benchMs, noShots: true });
  if (want('fps')) {
    await fpsOnly('fps-design-baked-dark-noglow', 'theme=dark&scene=baked&glow=0', both(bakedCheck('noglow', false), designCam), 'baked, dark, glow off (the glow pass cost)');
    await fpsOnly('fps-overview-current-dark', 'theme=dark', null, 'whole office, current');
    await fpsOnly('fps-overview-baked-dark', 'theme=dark&scene=baked', bakedCheck('overview-dark', true), 'whole office, baked Design room, glow on');
    await fpsOnly('fps-overview-baked-light', 'theme=light&scene=baked', bakedCheck('overview-light', false), 'whole office, baked Design room');
    // people walking (animation on) with the baked room: every idle agent set to working on the page (display only)
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    try {
      await page.goto(base + '/?theme=dark&scene=baked', { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__office && window.__office.ready(), null, { timeout: 60000 });
      await settle(page); await page.waitForTimeout(500);
      const n = await page.evaluate(() => { const s = structuredClone(window.__office.snapshot()); let k = 0; for (const a of s.agents) if (a.status === 'idle') { a.status = 'working'; k++; } window.__office.office.setData(s); return k; });
      const full = await page.evaluate((ms) => window.__office.bench(ms, { move: false }), benchMs);
      fpsRows.push({ view: 'walk (overview, dark, baked, ' + n + ' agents walking lounge to desk)', moving: full, full, note: 'animation on' });
      console.log('  fps walk (' + n + ' walking)'.padEnd(30), 'full quality', String(full.fps).padStart(6));
    } finally { await page.close(); }
  }
  // side by side: current | baked, one image per theme (made from the four captures above)
  const label = (t) => Buffer.from('<svg width="' + W / 2 + '" height="34"><rect width="100%" height="100%" fill="rgba(0,0,0,0.55)"/><text x="12" y="23" font-size="18" font-family="Segoe UI, Arial" fill="#fff">' + t + '</text></svg>');
  for (const [theme, a, b] of [['light', '01-design-current-light.png', '02-design-baked-light.png'], ['dark', '03-design-current-dark.png', '04-design-baked-dark.png']]) {
    const fa = outJail(path.join(outDir, a)), fb = outJail(path.join(outDir, b));
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
    const half = async (f) => sharp(f).resize(W / 2, H / 2).png().toBuffer();
    const out = path.join(outDir, 'side-by-side-' + theme + '.png');
    await sharp({ create: { width: W, height: H / 2, channels: 3, background: '#000' } }).composite([{ input: await half(fa), left: 0, top: 0 }, { input: await half(fb), left: W / 2, top: 0 }, { input: label('current (procedural) · ' + theme), left: 0, top: 0 }, { input: label('baked (?scene=baked) · ' + theme), left: W / 2, top: 0 }]).png().toFile(outJail(out));
    console.log('wrote', out);
  }
  const assetDir = path.join(ROOT, 'src', 'web', 'assets', 'design-room');
  const manifest = JSON.parse(fs.readFileSync(path.join(assetDir, 'manifest.json'), 'utf8'));
  fs.writeFileSync(outJail(path.join(outDir, 'asset-sizes.json')), fs.readFileSync(path.join(assetDir, 'sizes.json'), 'utf8'));
  fs.writeFileSync(outJail(path.join(outDir, 'build.json')), JSON.stringify(manifest.build, null, 2) + '\n');
  const summary = { at: new Date().toISOString(), browser: browserLabel, gl, viewport: W + 'x' + H, benchMs, mode: 'legacy fixtures view (mock data)', views: fpsRows, problems };
  fs.writeFileSync(outJail(path.join(outDir, headed ? 'fps-headed.json' : 'fps.json')), JSON.stringify(summary, null, 2) + '\n');
  console.log('problems:', problems.length ? problems : 'none');
} finally { await browser.close(); server.close(); }
