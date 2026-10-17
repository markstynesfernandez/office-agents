// providers/index.mjs — picks the model and image providers (ENGINE-PLAN.md §2.3, §2.5).
//   mock  scripted replies and procedural images, fake usage priced at $0; reads no key (E1–E5)
//   live  E6 step a0: Anthropic text (official SDK, providers/anthropic.mjs). Built only when STATION_PROVIDER=live is in
//         this process's environment, never in demo mode, and only with ANTHROPIC_API_KEY set. E6 step b0: the web
//         backend is Anthropic's server-side web search / fetch through that provider (providers/anthropic-web.mjs).
//         OpenRouter images (step c0) are not built yet: they refuse with "not built".
import { createMockText, createMockImage } from './mock.mjs';
import { createAnthropicText } from './anthropic.mjs';
import { createAnthropicWeb } from './anthropic-web.mjs';

export class ProviderLocked extends Error { constructor(mode) { super('provider mode "' + mode + '" is not known: use STATION_PROVIDER=mock (or live, for an approved E6 step only).'); this.code = 'LOCKED'; } }
export class ProviderNotBuilt extends Error { constructor(what) { super(what + ' is not built yet on the live provider (E6 plan: images in step c0); no call was made'); this.code = 'NOT_BUILT'; } }

export function createProviders({ mode = process.env.STATION_PROVIDER || 'mock', script, delayMs = 0, log, engineCfg = null, halt = null, demo = false, env = process.env, client = null } = {}) {
  if (mode === 'live') {
    const text = createAnthropicText({ engineCfg, env, demo, halt, log, client });
    const web = createAnthropicWeb({ text, engineCfg, log });
    log && log.warn('providers: LIVE (Anthropic text and web; images not built)', { models: text.models, web: web.settings.model });
    const image = { id: 'not-built', get calls() { return 0; }, async generate() { throw new ProviderNotBuilt('image generation (OpenRouter)'); } };
    return { mode, text, image, web };
  }
  if (mode !== 'mock') throw new ProviderLocked(mode);
  log && log.info('providers: mock (scripted replies, $0, no keys read)');
  // researchers' web backend: canned results in the mock (E6 wires Anthropic's server-side web search and fetch, Q6)
  const web = async (name, args) => ({ text: (script && script.web ? await script.web(name, args) : 'mock ' + name + ' result for ' + JSON.stringify(args)), usd: 0, priceSource: 'mock' });
  return { mode, text: createMockText({ script, delayMs }), image: createMockImage({ delayMs }), web };
}
