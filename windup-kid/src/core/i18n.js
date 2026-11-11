// 极简 i18n：扁平 key + 变量插值，缺失回落英文
import { LOCALES } from '../../config/locales.js';
import { CONFIG } from '../../config/game.config.js';

let lang = CONFIG.lang || 'en';

export function setLang(next) {
  lang = LOCALES[next] ? next : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}
export function getLang() { return lang; }

export function t(key, vars) {
  const table = LOCALES[lang] || LOCALES.en;
  let s = table[key] ?? LOCALES.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function applyI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}
