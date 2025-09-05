/* eslint-disable @typescript-eslint/no-explicit-any */
// client/src/setupHttpGuards.ts
/* DEV guard: auto-correct mistaken absolute paths (/device, /cable, etc.)
   to /api/... and emit a warning to help catch incorrect callers. */

const API_PREFIX = '/api';

// 1) fetch guard
const _fetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : String((input as any)?.url ?? input);
  const fixed = raw
    .replace(/^\/device\b/, `${API_PREFIX}/device`)
    .replace(/^\/cable\b/, `${API_PREFIX}/cable`)
    .replace(/^\/ports\b/, `${API_PREFIX}/ports`)
    .replace(/^\/port\b/, `${API_PREFIX}/port`);
  if (fixed !== raw) console.warn('⚠️ fixed fetch URL:', raw, '→', fixed);
  return _fetch(
    typeof input === 'string' ? fixed : new Request(fixed, (input as any).init ?? init),
    init,
  );
};

// 2) XHR (covers axios under the hood) guard
const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
  const fixed = String(url)
    .replace(/^\/device\b/, `${API_PREFIX}/device`)
    .replace(/^\/cable\b/, `${API_PREFIX}/cable`)
    .replace(/^\/ports\b/, `${API_PREFIX}/ports`)
    .replace(/^\/port\b/, `${API_PREFIX}/port`);
  if (fixed !== url) console.warn('⚠️ fixed XHR URL:', url, '→', fixed);
  // @ts-expect-error - keep original signature for apply
  return open.apply(this, [method, fixed, ...rest]);
};
