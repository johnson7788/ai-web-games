// 国际化：?lang=zh|en > localStorage > 浏览器语言；所有可见文字走 t()
import { locales, LANG_LIST } from '../../config/locales.js';
import { LANG_KEY } from '../../config/game.config.js';

function detectLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && LANG_LIST.includes(q)) return q;
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && LANG_LIST.includes(saved)) return saved;
    const nav = (navigator.language || 'zh').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

let lang = detectLang();

export const i18n = {
  get lang() {
    return lang;
  },
  get list() {
    return LANG_LIST;
  },
  t(key, vars) {
    const table = locales[lang] || locales.en;
    let s = table[key] ?? locales.en[key] ?? key;
    if (vars && typeof s === 'string') {
      s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
    }
    return s;
  },
  setLang(next) {
    if (!LANG_LIST.includes(next) || next === lang) return false;
    lang = next;
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* 隐私模式降级 */
    }
    return true;
  },
};

export const t = (key, vars) => i18n.t(key, vars);
