// src/core/i18n.js — 轻量双语层（classic 版，适配开源模板改造批）
// 词典在 config/locales.js（window.LOCALES = { en:{...}, zh:{...} }，键=英文原文）。
// 机制：data-i18n 元素整段替换 + 文本节点精确匹配翻译 + MutationObserver 覆盖动态 UI。
// 默认 en；?lang= 覆盖；选择持久化；右上角悬浮 EN/中文 切换。
(function () {
  'use strict';
  var L = window.LOCALES || { en: {} };
  var saved = null;
  try { saved = localStorage.getItem('pipy-lang'); } catch (e) { /* 隐私模式 */ }
  var q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* noop */ }
  var lang = (q && L[q]) ? q : (saved && L[saved] ? saved : 'en');
  if (!L[lang]) lang = 'en';

  function t(s) {
    if (s == null) return s;
    var d = L[lang] || {};
    var key = String(s).trim();
    return (d[key] != null) ? d[key] : s;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('data-i18n')) {
      var k = root.getAttribute('data-i18n');
      var v = (L[lang] || {})[k];
      if (v != null && root.textContent !== v) root.textContent = v;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || SKIP[p.tagName]) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('[data-i18n-skip]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = walker.nextNode())) {
      var raw = n.nodeValue;
      var trimmed = raw.trim();
      if (!trimmed) continue;
      var tr = t(trimmed);
      if (tr !== trimmed) n.nodeValue = raw.replace(trimmed, tr);
    }
    // title / placeholder / aria-label
    if (root.querySelectorAll) {
      root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(function (el) {
        ['title', 'placeholder', 'aria-label'].forEach(function (a) {
          var v = el.getAttribute(a);
          if (v && t(v) !== v) el.setAttribute(a, t(v));
        });
      });
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; walk(document.body); }, 60);
  }

  function setLang(l) {
    if (!L[l]) return;
    lang = l;
    try { localStorage.setItem('pipy-lang', l); } catch (e) { /* noop */ }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
    walk(document.body);
    if (btn) btn.textContent = l === 'zh' ? 'EN' : '中文';
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } })); } catch (e) { /* noop */ }
  }

  var btn = null;
  function mount() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    walk(document.body);
    var mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    // 语言切换按钮（右上角，不遮游戏 HUD 主体）
    btn = document.createElement('button');
    btn.id = 'pipy-lang-btn';
    btn.textContent = lang === 'zh' ? 'EN' : '中文';
    btn.setAttribute('aria-label', 'Switch language');
    btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;padding:5px 12px;font:600 12px/1.2 system-ui,sans-serif;'
      + 'color:#fff;background:rgba(20,24,32,.72);border:1px solid rgba(255,255,255,.35);border-radius:8px;cursor:pointer;';
    btn.addEventListener('click', function () { setLang(lang === 'zh' ? 'en' : 'zh'); });
    document.body.appendChild(btn);
  }

  window.I18N = { t: t, setLang: setLang, get lang() { return lang; }, apply: function () { walk(document.body); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();