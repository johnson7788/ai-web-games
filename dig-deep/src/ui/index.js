// src/ui/index.js — DIG DEEP UI：标题/暂停/结算/地心/HUD + 首次交互引导
import { i18n, t } from '../core/i18n.js';
import { TOOLS } from '../../config/gameplay.js';
import Sdk from '../core/sdk.js';

function el(id) { return document.getElementById(id); }

export function createUI(uiRoot, cb) {
  uiRoot.innerHTML = `
    <div id="screen-title" class="screen">
      <select id="lang-select" class="lang-select" aria-label="Language"></select>
      <div class="title-badge">DIG DEEP</div>
      <h1 class="title-h1" data-i18n="title"></h1>
      <p class="subtitle" data-i18n="subtitle"></p>
      <p class="tagline" data-i18n="tagline"></p>
      <div class="title-actions">
        <button id="btn-start" class="btn primary" data-i18n="start"></button>
        <button id="btn-howto" class="btn ghost" data-tutorial-replay data-i18n="howto"></button>
      </div>
      <div class="best-line"><span data-i18n="hud.best"></span>: <span id="title-best">0</span></div>
    </div>

    <div id="hud" class="hud hidden">
      <div class="hud-left">
        <div class="hud-row"><span class="hud-label" data-i18n="hud.depth"></span><span id="hud-depth">0</span></div>
        <div class="hud-row"><span class="hud-label" data-i18n="hud.layer"></span><span id="hud-layer">1</span></div>
      </div>
      <div class="hud-center">
        <div class="stamina-bar"><div id="stamina-fill" class="stamina-fill"></div><span id="stamina-text">40</span></div>
        <div class="flood-line"><span data-i18n="hud.flood"></span> <span id="flood-text">—</span></div>
      </div>
      <div class="hud-right">
        <div class="hud-row"><span class="hud-label" data-i18n="hud.score"></span><span id="hud-score">0</span></div>
        <div class="tool-row" id="tool-row"></div>
      </div>
    </div>

    <div id="screen-pause" class="screen hidden">
      <h2 data-i18n="paused"></h2>
      <button id="btn-resume" class="btn primary" data-i18n="resume"></button>
      <button id="btn-pause-title" class="btn ghost" data-i18n="dead.title2"></button>
      <select id="lang-select-pause" class="lang-select" aria-label="Language"></select>
    </div>

    <div id="screen-dead" class="screen hidden">
      <h2 id="dead-title" data-i18n="dead.title"></h2>
      <p id="dead-reason" class="dead-reason"></p>
      <div class="dead-stats">
        <div><span data-i18n="dead.depth"></span>: <b id="dead-depth">0</b></div>
        <div><span data-i18n="dead.score"></span>: <b id="dead-score">0</b></div>
        <div><span data-i18n="dead.best"></span>: <b id="dead-best">0</b></div>
      </div>
      <div id="dead-record" class="dead-record hidden" data-i18n="dead.newRecord"></div>
      <button id="btn-retry" class="btn primary" data-i18n="dead.retry"></button>
      <button id="btn-title" class="btn ghost" data-i18n="dead.title2"></button>
    </div>

    <div id="screen-core" class="screen hidden">
      <h2 class="core-title" data-i18n="core.title"></h2>
      <p class="core-sub" data-i18n="core.sub"></p>
      <div class="core-achievement" data-i18n="core.achievement"></div>
      <button id="btn-core-title" class="btn primary" data-i18n="dead.title2"></button>
    </div>

    <div id="screen-tutorial" class="screen tut hidden" data-tutorial>
      <div class="tut-card">
        <div class="tut-title" data-i18n="tut.title"></div>
        <div class="tut-step" id="tut-step"></div>
        <div class="tut-dots" id="tut-dots"></div>
        <div class="tut-actions">
          <button id="tut-skip" class="btn ghost" data-tutorial-skip data-i18n="tut.skip"></button>
          <button id="tut-next" class="btn primary" data-i18n="dead.retry"></button>
        </div>
      </div>
    </div>
  `;

  // ---------- 语言下拉 ----------
  const langSelect = el('lang-select');
  const langSelectPause = el('lang-select-pause');
  function fillLangOptions() {
    for (const sel of [langSelect, langSelectPause]) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      node.textContent = t(key);
    });
    fillLangOptions();
    buildToolRow();
  }

  // ---------- 工具按钮 ----------
  const toolRow = el('tool-row');
  function buildToolRow() {
    if (!toolRow) return;
    toolRow.innerHTML = '';
    TOOLS.forEach((tool, idx) => {
      const b = document.createElement('button');
      b.className = 'tool-btn';
      b.id = `btn-tool-${idx}`;
      b.textContent = `${idx + 1} ${t('tool.' + tool.id)}`;
      b.addEventListener('click', () => cb.onTool(idx));
      toolRow.appendChild(b);
    });
  }

  // ---------- 引导机器 ----------
  const STEPS = ['tut.0', 'tut.1', 'tut.2', 'tut.3'];
  const tutorial = {
    active: false,
    step: 0,
    steps: ['move', 'dig', 'collect', 'flood'],
    _cb: null,
    get current() { return STEPS[this.step] || STEPS[0]; },
    show() {
      this.active = true;
      this.step = 0;
      el('screen-tutorial').classList.remove('hidden');
      this.render();
    },
    hide() {
      this.active = false;
      el('screen-tutorial').classList.add('hidden');
    },
    next() {
      if (this.step < STEPS.length - 1) {
        this.step += 1;
        this.render();
      } else {
        this.finish(false);
      }
    },
    skip() {
      this.finish(true);
    },
    finish(skipped) {
      this.hide();
      try { Sdk.save('tutorial-done', true); } catch { /* noop */ }
      if (this._cb) this._cb({ skipped });
    },
    onDone(fn) { this._cb = fn; },
    render() {
      el('tut-step').textContent = t(STEPS[this.step]);
      const dots = el('tut-dots');
      dots.innerHTML = '';
      STEPS.forEach((_, i) => {
        const d = document.createElement('span');
        d.className = 'tut-dot' + (i === this.step ? ' on' : '');
        dots.appendChild(d);
      });
      el('tut-next').textContent = this.step < STEPS.length - 1 ? t('dead.retry') + ' →' : t('dead.retry');
    },
    onGameEvent(ev) {
      if (!this.active) return;
      if (ev.type === 'move' && this.step === 0) this.next();
      else if ((ev.type === 'dig' || ev.type === 'cellBreak') && this.step === 1) this.next();
      else if ((ev.type === 'diamond' || ev.type === 'fossil') && this.step === 2) this.next();
    },
  };

  tutorial.shouldAutoShow = () => !Sdk.load('tutorial-done', false);

  // ---------- 事件绑定 ----------
  el('btn-start').addEventListener('click', () => cb.onStart());
  el('btn-howto').addEventListener('click', () => cb.onHow());
  el('btn-resume').addEventListener('click', () => cb.onResume());
  el('btn-pause-title').addEventListener('click', () => cb.onTitle());
  el('btn-retry').addEventListener('click', () => cb.onStart());
  el('btn-title').addEventListener('click', () => cb.onTitle());
  el('btn-core-title').addEventListener('click', () => cb.onTitle());
  el('tut-skip').addEventListener('click', () => tutorial.skip());
  el('tut-next').addEventListener('click', () => tutorial.next());
  for (const sel of [langSelect, langSelectPause]) {
    sel.addEventListener('change', (e) => cb.onLang(e.target.value));
  }

  // ---------- 屏切换 ----------
  const screens = ['screen-title', 'screen-pause', 'screen-dead', 'screen-core', 'screen-tutorial'];
  function show(screen, data = {}) {
    for (const id of screens) el(id).classList.add('hidden');
    el('hud').classList.add('hidden');
    if (screen === 'title') {
      el('screen-title').classList.remove('hidden');
      applyLang();
    } else if (screen === 'playing') {
      el('hud').classList.remove('hidden');
    } else if (screen === 'paused') {
      el('screen-pause').classList.remove('hidden');
      applyLang();
    } else if (screen === 'dead') {
      el('screen-dead').classList.remove('hidden');
      el('dead-depth').textContent = data.depth ?? 0;
      el('dead-score').textContent = data.score ?? 0;
      el('dead-best').textContent = data.best ?? 0;
      el('dead-reason').textContent = t('dead.reason.' + (data.reason || 'exhaust'));
      el('dead-record').classList.toggle('hidden', !data.newRecord);
      applyLang();
    } else if (screen === 'core') {
      el('screen-core').classList.remove('hidden');
      applyLang();
    }
  }

  function setHud(hud) {
    el('hud-depth').textContent = hud.depth;
    el('hud-layer').textContent = `${hud.layer} · ${t('layer.' + hud.layer)}`;
    el('hud-score').textContent = hud.score;
    const pct = Math.max(0, Math.min(100, (hud.stamina / hud.staminaMax) * 100));
    el('stamina-fill').style.width = `${pct}%`;
    el('stamina-text').textContent = hud.stamina;
    el('flood-text').textContent = hud.flood >= hud.depth - 20 ? '⚠' : '—';
    // 工具按钮状态
    TOOLS.forEach((tool, idx) => {
      const b = el(`btn-tool-${idx}`);
      if (!b) return;
      b.classList.toggle('locked', idx > hud.maxTool);
      b.classList.toggle('on', idx === hud.tool);
      if (idx === 2) b.textContent = `3 ${t('tool.laser')} ×${hud.laserCharges}`;
    });
  }

  function setBest(best) {
    el('title-best').textContent = best;
  }

  applyLang();
  return { show, setHud, setBest, applyLang, tutorial };
}
