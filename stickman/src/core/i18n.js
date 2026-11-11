import { CONFIG } from '../../config/game.config.js';
import { LOCALES } from '../../config/locales.js';

let lang = 'zh';
const listeners = new Set();

function queryLang() {
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    return value && LOCALES[value] ? value : null;
  } catch { return null; }
}

function detectLang(requested) {
  const fromQuery = queryLang();
  if (fromQuery) return fromQuery;
  if (requested && requested !== 'auto' && LOCALES[requested]) return requested;
  if (requested === 'auto') {
    const nav = typeof navigator !== 'undefined' ? (navigator.language || 'zh') : 'zh';
    return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return (CONFIG.lang && LOCALES[CONFIG.lang]) ? CONFIG.lang : 'zh';
}

export function setLang(next) {
  const resolved = detectLang(next);
  const changed = resolved !== lang;
  lang = resolved;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyI18n(document);
  }
  if (changed) listeners.forEach((fn) => fn(lang));
  return lang;
}

export function getLang() { return lang; }

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars = {}) {
  let text = LOCALES[lang]?.[key] ?? LOCALES.en[key] ?? key;
  if (typeof text !== 'string') return key;
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function applyI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    if (!element.dataset.i18nOriginal) element.dataset.i18nOriginal = element.dataset.i18n;
    element.textContent = t(element.dataset.i18n);
  });
}

setLang(CONFIG.lang);
