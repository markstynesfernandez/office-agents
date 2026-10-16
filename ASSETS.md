# ASSETS.md — Station (office-agents)

Every 3D asset, font, dependency, tool and data source used by Station (office-agents), with its source and licence. Nothing in
this project comes from ajsahni/agents-office, sahni.ai or any non-permissive repository. Nothing was fetched from
starnetos.com. The StarNet name, logo, artwork and sprites are not licensed and are not used anywhere here.

## 3D assets

All geometry is generated procedurally in Three.js at runtime (`src/web/scene/office.js`). No model files, textures
or sprite sheets are bundled. Kenney's CC0 kits remain an allowed option for later and would be recorded here.

| Asset | Made with | Source / licence |
|-------|-----------|------------------|
| Department platforms (tinted top, darker bevelled base, rim line), walkways, services-rack platform, hub plinth | `RoundedBoxGeometry`, `CylinderGeometry`, `ShapeGeometry`, merged with `BufferGeometryUtils.mergeGeometries` into one vertex-coloured mesh | procedural, this project |
| Desk tops, legs, chairs, monitor bodies, glass dividers | `RoundedBoxGeometry`, `CylinderGeometry`, instanced (`InstancedMesh`) | procedural, this project |
| Workers (body, head, arms) and status lights | `CapsuleGeometry`, `SphereGeometry`, `RoundedBoxGeometry`, instanced | procedural, this project |
| Plants | `CylinderGeometry` + merged `IcosahedronGeometry` leaves, instanced | procedural, this project |
| Memory core (hub) | `OctahedronGeometry` crystal, `TorusGeometry` ring, radial-gradient `CanvasTexture` glow sprite | procedural, this project |
| Services rack terminals, screens and status lights | `RoundedBoxGeometry`, `PlaneGeometry`, `SphereGeometry`, instanced | procedural, this project |
| Monitor screens | status-colour glow at overview; `CanvasTexture` drawn with the 2D canvas API when zoomed in (`src/web/scene/monitor.js`) | procedural, this project |
| Backdrop gradient, platform drop-shadow blobs | small `CanvasTexture`s (gradient / blurred rounded rectangle) | procedural, this project |
| Activity lines | `QuadraticBezierCurve3` + `LineDashedMaterial` | procedural, this project |

Palette: `src/web/config/palette.js` (own choice of muted pastels; one accent per department; light and dark themes).

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
