// Build metadata injected at compile time via vite.config.ts `define`.
// The Vercel deployment caches aggressively; the BuildStamp footer reads
// these values so the user can verify they are not looking at stale UI.

declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const COMMIT_HASH: string = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
export const BUILD_TIME:  string = typeof __BUILD_TIME__  !== 'undefined' ? __BUILD_TIME__  : new Date().toISOString();

/** Human-readable build label, e.g. "v0.0.1 · 5420707a · 2026-05-14 03:32 UTC" */
export function buildLabel(): string {
  const d = new Date(BUILD_TIME);
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `v${APP_VERSION} · ${COMMIT_HASH} · ${date} ${time} UTC`;
}
