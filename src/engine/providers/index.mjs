// providers/index.mjs — picks the model and image providers (ENGINE-PLAN.md §2.3, §2.5).
//   mock  scripted replies and procedural images, fake usage priced at $0; reads no key (E1–E5)
//   live  Anthropic (official SDK) for text and vision, OpenRouter for images; LOCKED in this build until E6, which
//         needs the owner's go-ahead (Q1 billing, Q2 caps, Q3 products). Asking for it throws before any key is read.
import { createMockText, createMockImage } from './mock.mjs';

export class ProviderLocked extends Error { constructor() { super('live providers are locked until E6 (DECISIONS.md: Q1 billing, Q2 caps and Q3 products block E6). Use STATION_PROVIDER=mock.'); this.code = 'LOCKED'; } }

export function createProviders({ mode = process.env.STATION_PROVIDER || 'mock', script, delayMs = 0, log } = {}) {
  if (mode !== 'mock') throw new ProviderLocked();
  log && log.info('providers: mock (scripted replies, $0, no keys read)');
  // researchers' web backend: canned results in the mock (E6 wires Anthropic's server-side web search and fetch, Q6)
  const web = async (name, args) => ({ text: (script && script.web ? await script.web(name, args) : 'mock ' + name + ' result for ' + JSON.stringify(args)), usd: 0, priceSource: 'mock' });
  return { mode, text: createMockText({ script, delayMs }), image: createMockImage({ delayMs }), web };
}
