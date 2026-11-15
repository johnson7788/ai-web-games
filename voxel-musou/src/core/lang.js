// Language layer (game side). Default English; the platform kit (src/core/i18n.js + config/locales.js) owns the
// EN / 中文 switcher and the dictionary (key = English source text). Render sites call these at draw time:
//   L(pair)  pick from the game's bilingual { zh, en } data (chars, chapters, armies, story lines)
//   t(en)    dictionary lookup for strings that were Chinese-only in the original (zh restores the original)
//   sub(en)  the original design prints a small English line under the Chinese one; English mode shows none
// main.js re-renders the active screen on the kit's 'langchange' event, so every site stays in sync.
export const isZh = () => (window.I18N ? window.I18N.lang === 'zh' : false);
export const L = (p) => (isZh() ? p.zh : p.en) ?? p.en ?? p.zh;
export const t = (s) => (window.I18N ? window.I18N.t(s) : s);
export const sub = (en) => (isZh() ? en : '');