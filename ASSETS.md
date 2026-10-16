# ASSETS.md — Station (office-agents)

Every 3D asset, font, dependency, tool and data source used by Station (office-agents), with its source and licence. Nothing in
this project comes from ajsahni/agents-office, sahni.ai or any non-permissive repository. Nothing was fetched from
starnetos.com. The StarNet name, logo, artwork and sprites are not licensed and are not used anywhere here.

## 3D assets

All geometry is generated procedurally in Three.js at runtime and every texture is drawn with the 2D canvas API at
start-up (`src/web/scene/`). No model files, image textures or sprite sheets are bundled, so there is no third-party
asset licence file to ship. Kenney's CC0 kits remain an allowed option; Redesign R1 did not use them (procedural gave
the control over instancing and merging that the frame budget needed, and no download or archive was involved). If a
kit is added later, it is recorded here with its version, source URL and licence file in the repo.

**Mood references (not assets).** `design-refs/01-main.png` to `05.png` are other people's renders, kept locally as mood
references only and ignored by git. Nothing was traced or copied from them: no layout, model, artwork or texture.

**Redesign R1 (16/10/2026).** All entries below are procedural and made for this project; licence: this project.

| Asset | Made with | Where |
|-------|-----------|-------|
| Floor plan: three cutaway department rooms, lounge, server closet, atrium | own layout (`computeLayout`) | `scene/layout.js` |
| Floor slab, back walls with caps, baseboards and cut ends, low closet partition | `BoxGeometry`, merged per room into one vertex-coloured mesh | `scene/rooms.js` |
| Wood plank floors, atrium stone tiles | `CanvasTexture`s drawn from a seeded generator, planar UVs | `scene/textures.js` |
| Library wall (bookcase, books, binders with blank label patches, flat stacks) | boxes; sizes and colours from a seeded generator; no text or titles | `scene/rooms.js` |
| Mood board, whiteboard, framed pictures | one canvas atlas: seeded abstract compositions (circles, bands, blocks, arcs), colour swatches, wavy lines in place of writing; no text; not copies of any artwork | `scene/textures.js` |
| Reading nook (armchair, arc lamp, side table), credenza, lockers, wall shelves with objects | boxes, `RoundedBoxGeometry`, cylinders, cones | `scene/rooms.js` |
| Lounge: two sofas, two armchairs, coffee table, rug, arc lamp | `RoundedBoxGeometry`, boxes, cylinders | `scene/rooms.js` |
| LED strips (emissive lines) and their soft glow (additive quads), lamp light pools | boxes; a canvas glow atlas (radial pool, vertical wash) | `scene/rooms.js`, `scene/textures.js` |
| Desks (wood top, dark metal frame, L-shaped return), monitors, keyboards, desk lamps, office chairs | `RoundedBoxGeometry` (one bevel segment), cylinders, cones; instanced (`InstancedMesh`) | `scene/office.js` |
| People (body, head, arms, legs), soft blob shadows | `CapsuleGeometry`, `SphereGeometry`, `RoundedBoxGeometry`, a radial canvas texture; instanced | `scene/office.js` |
| Plants (tall and small) | cylinders + merged `IcosahedronGeometry` leaves; instanced | `scene/office.js` |
| Server cabinets with status lights and LED blocks | `RoundedBoxGeometry`, planes, spheres; instanced | `scene/office.js`, `scene/rooms.js` |
| Memory core | `OctahedronGeometry` crystal, `TorusGeometry` ring, radial-gradient glow sprite, octagonal plinth | `scene/office.js`, `scene/rooms.js` |
| Monitor screens | status-colour glow at overview; `CanvasTexture` text when zoomed in or selected | `scene/monitor.js` |
| Slab drop shadow | a blurred rounded rectangle on a canvas | `scene/office.js` |
| Backdrop | a CSS linear gradient behind the transparent canvas (colours from the palette) | `scene/office.js` |
| Activity lines | `QuadraticBezierCurve3` + `LineDashedMaterial` | `scene/office.js` |

Palette: `src/web/config/palette.js` (own choice; one accent per department used as a soft wall tint and on the cards;
light and dark themes; one warm accent in dark mode, shared with the UI's `--accent` in `src/web/styles.css`).

## Fonts

No font files are bundled. The page uses the system font stack (`Segoe UI`, `system-ui`, `Helvetica Neue`, Arial)
and the system monospace stack (`Cascadia Code`, `Consolas`, `ui-monospace`). Nothing is downloaded at runtime.

## Data in `fixtures/`

| Item | Source | Notes |
|------|--------|-------|
| `fixtures/station-root/` | read-only snapshot of the owner's own StarNet build (`Virtual-workers`), taken by `npm run snapshot-fixtures` | owner's data, internal only. Prompts removed (roster `system`, runs `deliveryPrompt`), save trimmed to rooms/props/agent basics, images copied only as PNG thumbnails (max 384 px). Secrets (`.secrets/`, `.env`, provider keys) are refused by name and never read. Details and the skip list: `fixtures/SNAPSHOT.json`. Contains prices, margins and costs, so keep it internal. |
| `fixtures/synthetic/overlay.json` | hand-written for this project | test states the real snapshot lacks (working, error, waiting, blocked). Applied in fixtures mode only; shown with a "synthetic" tag. |

## Dependencies (pinned, licence-checked)

| Package | Version | Licence | Use | Where |
|---------|---------|---------|-----|-------|
| three | 0.186.1 | MIT | renderer, geometry, post-processing (`EffectComposer`, `RenderPass`, `GTAOPass`, `OutputPass`, `Pass`/`FullScreenQuad`, `CopyShader`, `RoundedBoxGeometry`, `BufferGeometryUtils`) | `dependencies`; served to the browser from `node_modules/three/build` and `examples/jsm` only |
| sharp | 0.34.5 | Apache-2.0 | downscales design and print PNGs into thumbnails: `scripts/snapshot-fixtures.mjs` now; the server's `.cache/thumbs/` in Phase 2 (decision 9). Same version the owner's station already uses. | `dependencies` |
| @img/sharp-win32-x64 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later | sharp's prebuilt binary; bundles libvips 8.17.3 (LGPL-3.0-or-later, dynamically linked, unmodified) | transitive (optional, platform-specific) |
| @img/colour | 1.1.0 | MIT | sharp dependency | transitive |
| detect-libc | 2.1.2 | Apache-2.0 | sharp dependency | transitive |
| semver | 7.8.5 | ISC | sharp dependency | transitive |
| croner | 10.0.1 | MIT | cron parsing and next-run times for routines (`src/engine/scheduler.mjs`), Europe/Dublin; no dependencies of its own | `dependencies` |
| playwright | 1.64.1 | Apache-2.0 | Chromium / Chrome automation for `npm run screenshots` (captures station-office's own page only) | `devDependencies` |
| playwright-core | 1.64.1 | Apache-2.0 | transitive dependency of playwright | `devDependencies` (transitive) |
| Chromium (downloaded by `npx playwright install chromium`, build 1248) | per Playwright | BSD-3-Clause (Chromium) | headless screenshot browser; not redistributed with this project | `~/AppData/Local/ms-playwright` |
| Google Chrome (already installed on this PC) | system | Google Chrome Terms of Service | only for `node scripts/screenshots.mjs --headed` (fps as seen in headed Chrome) and `npm run demo:record` (headed recording); not redistributed | system install |
| ffmpeg, Playwright build 1013 (downloaded with Playwright's browsers) | pinned by playwright-core 1.64.1 (`browsers.json`) | LGPL-2.1 (`COPYING.LGPLv2.1` in its folder) | Playwright's own video capture for `npm run demo:record` (WebM, VP8/VP9). `demo-record.mjs` also runs it to read the WebM's duration and probes it for MP4 output: it has no MP4 muxer or H.264/MPEG-4 encoder, so no .mp4 is made. A system ffmpeg on PATH (GPL-3.0 "full" build on this PC) is never used: it is not pinned or licence-checked here. | `~/AppData/Local/ms-playwright/ffmpeg-1013` |

npm reports an install script for sharp that is not run (`allowScripts`); it is not needed because the prebuilt
binary package is used.

Node.js built-ins only otherwise (`http`, `fs`, `path`, `os`, `url`, `crypto`, `node:test`, and `node:sqlite` for the engine store, which uses the SQLite build bundled with Node, 3.53.0 on Node 24.16, public domain). No bundler, no transpiler. `better-sqlite3` was tested against and not installed (DECISIONS.md, E2 store). The Anthropic SDK is not installed yet: E6.

## Code copied from the owner's own station code

`src/lib/legacy-readers/*.mjs` (the legacy view's readers) and `src/engine/lib/*.mjs` (the engine's business rules),
plus `config/station.config.json`, `config/products.json`, `config/blocklist.txt`, `prompts/` and `tests/ported/`, come from
`Virtual-workers/station/`, the owner's own code with no third-party code. `PORTED.md` lists each one with its source sha256
and changes, and each code file names its source in a header comment. Nothing from `starnet/`
(androoAGI/starnet, MIT code, unlicensed artwork) is imported or copied.

## How to re-check

```
npm ls --all --omit=optional
node -e "for (const p of ['three','sharp','croner','@img/sharp-win32-x64','@img/colour','detect-libc','semver','playwright','playwright-core']) console.log(p, require('./node_modules/'+p+'/package.json').version, require('./node_modules/'+p+'/package.json').license)"
```
