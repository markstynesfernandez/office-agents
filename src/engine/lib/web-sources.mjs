// lib/web-sources.mjs — the v1 scout source rule (owner, 17/10/2026; DECISIONS.md "E6 step b0: owner decisions"): store
// chart, browse and streaming sites are out. config/engine.json webSources.blockedDomains lists them as bare domains.
//   - The live web relay sends the list as blocked_domains on BOTH web_search and web_fetch (providers/anthropic-web.mjs),
//     for every agent with web tools (they share the relay).
//   - The engine refuses a web_fetch to a listed host or any of its subdomains before anything is reserved or sent
//     (tools/index.mjs), on the mock as on the live provider.
// Domain format follows the API's domain filtering rules (platform docs, server tools, read 17/10/2026): no scheme, ASCII
// only, no wildcard in the domain (the API rejects "*.example.com" with a 400), and a bare domain covers its subdomains.

export class WebSourceError extends Error { constructor(msg) { super(msg); this.code = 'CONFIG'; } }

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// the configured list, checked (a malformed entry refuses: the API would reject it, and a typo would silently not block)
export function blockedDomains(engineCfg) {
  const ws = engineCfg && engineCfg.webSources;
  const list = ws && ws.blockedDomains;
  if (list == null) return [];
  if (!Array.isArray(list)) throw new WebSourceError('config/engine.json webSources.blockedDomains must be a list');
  for (const d of list) if (typeof d !== 'string' || !DOMAIN_RE.test(d)) throw new WebSourceError('config/engine.json webSources.blockedDomains: "' + d + '" is not a bare lower-case ASCII domain (no scheme, path or wildcard)');
  if (new Set(list).size !== list.length) throw new WebSourceError('config/engine.json webSources.blockedDomains has a duplicate');
  return [...list];
}

// the listed domain a URL's host falls under (the host itself or a subdomain), or null. An unparsable URL counts as
// blocked (fail closed). The URL parser lower-cases the host and turns non-ASCII into punycode, so a look-alike
// Unicode host never equals a listed domain.
export function blockedBy(url, domains) {
  let host;
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/\.+$/, ''); } catch (_) { return '(unparsable URL)'; }
  for (const d of domains) if (host === d || host.endsWith('.' + d)) return d;
  return null;
}
