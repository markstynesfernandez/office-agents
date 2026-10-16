// screenshots.mjs — starts a Station server, opens ITS OWN page in Chromium and captures the review views at 1600x1000,
// then measures the frame rate of each view. Never opens any other URL (never the legacy system's 8787). Each view is a
// fresh page load. Every file it writes goes through outJail() (office-agents/screenshots/ only). Usage:
//   npm run screenshots                                  -> screenshots/e1/*.png, legacy view of the fixtures (headless)
//   node scripts/screenshots.mjs --headed                -> same, in a visible Google Chrome window (fps as you'd see it)
//   node scripts/screenshots.mjs --out e1b --live        -> legacy view of .env STATION_LEGACY_ROOT (read-only)
// FPS: after each capture the page renders continuously for --bench-ms (default 3000) twice: once with the camera moving
// every frame (the real pan/zoom path; AO is skipped while moving) and once at full quality with AO on (the cost of each
// animation tick or settled frame). At rest the page renders on demand only. Overlay views pause the 3D scene, so their
// number is the page's own frame rate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createOfficeServer, ROOT } from '../src/server/index.mjs';
import { makeLogger } from '../src/server/log.mjs';
import { loadEnv } from '../src/lib/legacy-readers/common.mjs';

export const SHOTS_ROOT = path.resolve(ROOT, 'screenshots');
// the only way this script writes: a path inside office-agents/screenshots/
export function outJail(p) { const f = path.resolve(SHOTS_ROOT, p); if (!f.startsWith(SHOTS_ROOT + path.sep)) throw new Error('refusing to write outside screenshots/: ' + p); return f; }
export const W = 1600, H = 1000;

// Headed: the installed Google Chrome. Headless: the full Chromium build on the real GPU, SwiftShader as a fallback.
export async function launch({ headed = false } = {}) {
  const attempts = headed
    ? [{ label: 'Google Chrome (headed)', opts: { headless: false, channel: 'chrome', args: ['--window-size=' + W + ',' + (H + 140)] } }, { label: 'Chromium (headed)', opts: { headless: false, channel: 'chromium' } }]
    : [{ label: 'chromium + GPU (headless)', opts: { headless: true, channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default'] } },
       { label: 'headless shell + SwiftShader', opts: { headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl'] } }];
  for (const a of attempts) {
    try {
      const browser = await chromium.launch(a.opts);
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return null; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl (renderer hidden)'; });
      await page.close();
      if (gl) { console.log('browser:', a.label, '| GL renderer:', gl); return { browser, label: a.label, gl }; }
      await browser.close();
    } catch (e) { console.log('launch failed for', a.label + ':', e.message.split('\n')[0]); }
  }
  throw new Error('no WebGL-capable browser');
}

export const settle = async (page) => { await page.waitForFunction(() => window.__office.settled(), null, { timeout: 15000 }); await page.evaluate(() => new Promise((r) => { let i = 0; const f = () => (++i >= 12 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })); };

// One capture: fresh page load, optional action, screenshot through outJail(), then the fps bench unless fps is off.
export function makeViewer({ browser, base, outDir, log, problems, fpsRows, benchMs = 3000, noShots = false, fps = true }) {
  return async function view(name, query, act, note = '') {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => problems.push(name + ' pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(name + ' console.error: ' + m.text()); });
    try {
      await page.goto(base + '/?anim=0&' + query, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__office && window.__office.ready(), null, { timeout: 60000 });
      await settle(page);
      if (act) await act(page);
      await settle(page); await page.waitForTimeout(250);
      const f = path.join(outDir, name);
      if (!noShots) { const png = await page.screenshot({ type: 'png' }); fs.writeFileSync(outJail(f), png); console.log('wrote', f); log.written(f); }
      if (fps) {
        const moving = await page.evaluate((ms) => window.__office.bench(ms, { move: true }), benchMs);
        const full = moving.paused ? moving : await page.evaluate((ms) => window.__office.bench(ms, { move: false }), benchMs);
        fpsRows.push({ view: name, moving, full, note: moving.paused ? '(3D scene paused behind the overlay; page frame rate)' : note });
        console.log('  fps', name.padEnd(24), 'moving', String(moving.fps).padStart(6), '| full quality', String(full.fps).padStart(6), '| avg', full.avgFrameMs + ' ms p95', full.p95FrameMs + ' ms |', full.calls + ' calls', moving.paused ? '(scene paused)' : '');
      }
      return f;
    } finally { await page.close(); }
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const live = argv.includes('--live'), headed = argv.includes('--headed'), noShots = argv.includes('--fps-only');
  const outDir = outJail(String(arg('--out', 'e1')).replace(/^screenshots[/\\]/, ''));
  const benchMs = Number(arg('--bench-ms', 3000));
  fs.mkdirSync(outJail(outDir), { recursive: true });
  loadEnv(path.join(ROOT, '.env'));
  const log = makeLogger({ dir: path.join(ROOT, 'logs'), name: 'screenshots' });
  const stationRoot = live && process.env.STATION_LEGACY_ROOT ? path.resolve(process.env.STATION_LEGACY_ROOT) : null;
  const { server, mode } = createOfficeServer({ stationRoot, fixtures: !stationRoot, log });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  console.log('station server for screenshots:', base, '(legacy view, ' + mode + ')');
  const { browser, label: browserLabel, gl } = await launch({ headed });
  const problems = [], fpsRows = [];
  const view = makeViewer({ browser, base, outDir, log, problems, fpsRows, benchMs, noShots });
  const files = [];
  try {
    files.push(await view('01-overview.png', 'theme=light'));
    files.push(await view('02-desk-panel.png', 'theme=light', async (page) => {
      const id = await page.evaluate(() => window.__office.snapshot().agents.find((a) => a.name === 'DESIGNER').id);
      await page.evaluate((id) => window.__office.openAgent(id, 2.4), id);
      await page.waitForSelector('#sidepanel:not(.hidden) .sp-head', { timeout: 15000 });
      await page.waitForFunction(() => [...document.querySelectorAll('#sidepanel img')].every((i) => i.complete), null, { timeout: 15000 });
    }));
    files.push(await view('03-calendar.png', 'theme=light', async (page) => {
      await page.evaluate(() => { window.__office.openCalendar(); window.__office.calendar.toggleMode('month'); });
      await page.waitForSelector('#calendar .cal-grid', { timeout: 15000 });
    }, '(scene behind the calendar overlay)'));
    files.push(await view('04-dark-mode.png', 'theme=dark'));
    files.push(await view('05-board.png', 'theme=light', async (page) => {
      await page.keyboard.press('b');
      await page.waitForSelector('#board:not(.hidden) .lanes', { timeout: 15000 });
    }, '(scene behind the board overlay)'));
    files.push(await view('06-overview-zoomed.png', 'theme=light', async (page) => {
      await page.evaluate(() => window.__office.focusDept('office', 3.3));
    }));
    console.log('\nScreenshots:\n' + files.join('\n'));
    const summary = { at: new Date().toISOString(), browser: browserLabel, gl, viewport: W + 'x' + H, benchMs, mode, views: fpsRows };
    fs.writeFileSync(outJail(path.join(outDir, headed ? 'fps-headed.json' : 'fps.json')), JSON.stringify(summary, null, 2) + '\n');
    console.log('\nAverage fps per view (continuous rendering, ' + benchMs + ' ms each, ' + browserLabel + ', ' + gl + '):');
    console.log('  ' + 'view'.padEnd(24) + 'camera moving'.padStart(14) + 'full quality'.padStart(14) + '  frame avg / p95 (full quality)');
    for (const r of fpsRows) console.log('  ' + r.view.padEnd(24) + (r.moving.fps + ' fps').padStart(14) + (r.full.fps + ' fps').padStart(14) + '  ' + r.full.avgFrameMs + ' / ' + r.full.p95FrameMs + ' ms ' + (r.note || ''));
    if (problems.length) { console.error('\nPage problems:\n' + problems.join('\n')); process.exitCode = 1; }
  } catch (e) {
    console.error('screenshot run failed:', e.message); if (problems.length) console.error(problems.join('\n')); process.exitCode = 1;
  } finally {
    await browser.close(); server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
