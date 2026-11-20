import ru from './ru.ts';
import zh from './zh.ts';

/**
 * Interface language. The pipygames kit (config/locales.js + src/core/i18n.js) owns the choice: its `window.I18N.lang`
 * is read at load, `?lang=` overrides, and the kit button reloads the page with the new language. Without the kit the
 * stored choice (`malina.lang`) or the browser language is used. Source strings are English; `t()` looks them up in
 * the Russian (src/i18n/ru.ts) or Chinese (src/i18n/zh.ts) dictionary. Works without DOM (Node, headless battle).
 */
export type Lang = 'en' | 'ru' | 'zh';
export const LANG_KEY = 'malina.lang';
export const LANGS: readonly Lang[] = ['en', 'ru', 'zh'];

const g = globalThis as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void }; navigator?: { language?: string }; I18N?: { lang?: string } };

/** Stored choice, or null when the player has not chosen yet */
export function storedLang(): Lang | null {
  try { const v = g.localStorage?.getItem(LANG_KEY); return v === 'ru' || v === 'en' || v === 'zh' ? v : null; } catch { return null; }
}

function detect(): Lang {
  // the kit layer (injected into the page head) resolves ?lang= and its own storage first
  try { const k = g.I18N?.lang; if (k === 'zh' || k === 'en' || k === 'ru') return k; } catch { /* no kit */ }
  const s = storedLang();
  if (s) return s;
  try { if (g.navigator?.language?.toLowerCase().startsWith('ru')) return 'ru'; } catch { /* no navigator */ }
  return 'en';
}

/** Language of this page load */
export const LANG: Lang = detect();

/** Remember the choice; the caller reloads the page */
export function setLang(l: Lang): void {
  try { g.localStorage?.setItem(LANG_KEY, l); } catch { /* storage closed */ }
}

/**
 * Translate an English source string; `{name}` placeholders are filled from `params`.
 * Unknown strings fall back to the English source.
 */
export function t(s: string, params?: Record<string, string | number>): string {
  let r = LANG === 'ru' ? (ru[s] ?? s) : LANG === 'zh' ? (zh[s] ?? s) : s;
  if (params) for (const k of Object.keys(params)) r = r.split(`{${k}}`).join(String(params[k]));
  return r;
}

/** Russian → English source key for a stored string (e.g. a map name saved while the page ran in Russian); unknown strings pass through */
let back: Map<string, string> | null = null;
export function untranslate(s: string): string {
  back ??= new Map(Object.entries(ru).map(([k, v]) => [v, k]));
  return back.get(s) ?? s;
}
