/* eslint-disable @typescript-eslint/no-explicit-any */
// client/src/setupHttpGuards.ts
/* DEV 가드: /device 등 잘못된 절대경로 호출을 /api/... 로 자동 교정 + 경고 로그 */

const API_PREFIX = "/api";

// 1) fetch 가드
const _fetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : String((input as any)?.url ?? input);
  const fixed = raw
    .replace(/^\/device\b/, `${API_PREFIX}/device`)
    .replace(/^\/cable\b/, `${API_PREFIX}/cable`)
    .replace(/^\/ports\b/, `${API_PREFIX}/ports`)
    .replace(/^\/port\b/, `${API_PREFIX}/port`);
  if (fixed !== raw) console.warn("⚠️ fixed fetch URL:", raw, "→", fixed);
  return _fetch(typeof input === "string" ? fixed : new Request(fixed, (input as any).init ?? init), init);
};

// 2) XHR(axios 포함) 가드
const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
  const fixed = String(url)
    .replace(/^\/device\b/, `${API_PREFIX}/device`)
    .replace(/^\/cable\b/, `${API_PREFIX}/cable`)
    .replace(/^\/ports\b/, `${API_PREFIX}/ports`)
    .replace(/^\/port\b/, `${API_PREFIX}/port`);
  if (fixed !== url) console.warn("⚠️ fixed XHR URL:", url, "→", fixed);
  // @ts-expect-error - apply 원본 시그니처 유지
  return open.apply(this, [method, fixed, ...rest]);
};
