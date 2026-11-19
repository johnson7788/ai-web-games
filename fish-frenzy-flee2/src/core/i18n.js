// 国际化：en 默认，zh 必做。语言来源：?lang= → localStorage → navigator → defaultLang。
import { locales } from '../../config/locales.js';
import { CONFIG } from '../../config/game.config.js';

function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && locales[q]) return q;
  } catch { /* noop */ }
  try {
    const saved = localStorage.getItem(CONFIG.langStorageKey);
    if (saved && locales[saved]) return saved;
  } catch { /* noop */ }
  try {
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (locales[nav]) return nav;
  } catch { /* noop */ }
  return CONFIG.defaultLang;
}

export const i18n = { lang: detectLang(), dir: 'ltr' };

export function t(key, params) {
  const table = locales[i18n.lang] || locales.en || {};
  let s = table[key];
  if (s == null) s = (locales.en || {})[key];
  if (s == null) s = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function setLang(code) {
  if (!locales[code]) return;
  i18n.lang = code;
  try { localStorage.setItem(CONFIG.langStorageKey, code); } catch { /* noop */ }
  syncDocumentLang();
}

export function syncDocumentLang() {
  document.documentElement.lang = i18n.lang;
  document.documentElement.dir = i18n.lang === 'ar' ? 'rtl' : 'ltr';
}
