/**
 * Solo player build: dev tools (editor, F-key debug panel) are off.
 */
export const DEV_TOOLS = false;

/**
 * Solo player build: always render normally (the upstream Playwright optimization that skips drawing is disabled —
 * the shipped game must draw every frame, including under automation).
 */
export const AUTOMATED = false;

export function wantsEditor(): boolean {
  return DEV_TOOLS && new URLSearchParams(window.location.search).get('dev') === 'editor';
}

/** Straight into the game, past the main menu: a map (?map=…) or the playground (?dev=playground) is open */
export function wantsGame(): boolean {
  const q = new URLSearchParams(window.location.search);
  return q.has('map') || q.get('dev') === 'playground';
}

/** Came into battle from the main menu (?from=menu): pause on Esc, "To camp", no debug hints */
export function fromMenu(): boolean {
  return new URLSearchParams(window.location.search).get('from') === 'menu';
}

export function openEditor(): void {
  const u = new URL(window.location.href);
  u.searchParams.set('dev', 'editor');
  window.location.href = u.toString();
}
