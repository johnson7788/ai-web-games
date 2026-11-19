// src/ui/index.js — DOM UI：标题/暂停/结算/HUD/触屏控制 + 多语言
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { createTutorial } from './tutorial.js';

const $ = (id) => document.getElementById(id);

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
}

export function createUI(root, handlers = {}, opts = {}) {
  const el = {
    hud: $('hud'),
    hudLevel: $('hud-level'),
    hudHearts: $('hud-hearts'),
    hudEnemies: $('hud-enemies'),
    hudCombo: $('hud-combo'),
    hudDash: $('hud-dash-fill'),
    hudScore: $('hud-score'),
    btnMute: $('btn-mute'),
    title: $('screen-title'),
    titleText: $('title-text'),
    subtitle: $('subtitle-text'),
    titleBest: $('title-best'),
    titleHint: $('title-hint'),
    btnStart: $('btn-start'),
    pause: $('screen-pause'),
    pauseTitle: $('pause-title'),
    btnResume: $('btn-resume'),
    btnRestart: $('btn-restart'),
    btnHome: $('btn-home'),
    result: $('screen-result'),
    resultTitle: $('result-title'),
    resultStars: $('result-stars'),
    resultScore: $('result-score'),
    resultCombo: $('result-combo'),
    resultHint: $('result-hint'),
    btnRetry: $('btn-retry'),
    btnHome2: $('btn-home2'),
    levelBanner: $('level-banner'),
    rotate: $('rotate-screen'),
    rotateText: $('rotate-text'),
    touchControls: $('touch-controls'),
    tutorial: $('tutorial'),
    tutCard: $('tut-card'),
    tutTitle: $('tut-title'),
    tutText: $('tut-text'),
    tutSkip: $('tut-skip'),
    tutNext: $('tut-next'),
    langSelects: [$('lang-select'), $('lang-select-pause')],
  };

  const screens = {
    title: el.title,
    playing: null,
    paused: el.pause,
    victory: el.result,
    dead: el.result,
  };

  const touch = { left: false, right: false };

  function show(screen, payload = {}) {
    for (const s of [el.title, el.pause, el.result]) s.classList.add('hidden');
    el.hud.classList.add('hidden');
    el.touchControls.classList.add('hidden');

    if (screen === 'title') {
      el.title.classList.remove('hidden');
    } else if (screen === 'paused') {
      el.pause.classList.remove('hidden');
    } else if (screen === 'victory' || screen === 'dead') {
      el.result.classList.remove('hidden');
      el.resultTitle.textContent = screen === 'victory' ? t('result.victory') : t('result.gameover');
      el.resultStars.textContent = '★'.repeat(payload.stars || 0) + '☆'.repeat(Math.max(0, 9 - (payload.stars || 0)));
      el.resultScore.textContent = `${t('result.score')}: ${payload.score || 0}`;
      el.resultCombo.textContent = `${t('result.bestCombo')}: ×${payload.bestCombo || 0}`;
      el.resultHint.textContent = t('result.hint');
      el.btnRetry.textContent = t('btn.retry');
      el.btnHome2.textContent = t('btn.home');
    } else if (screen === 'playing') {
      el.hud.classList.remove('hidden');
      if (isTouchDevice()) el.touchControls.classList.remove('hidden');
    }
    applyLang();
  }

  function applyLang() {
    syncDocumentLang();
    el.titleText.textContent = t('title.logo');
    el.subtitle.textContent = t('title.tagline');
    el.titleHint.textContent = t('title.hint');
    el.btnStart.textContent = t('btn.start');
    el.pauseTitle.textContent = t('pause.title');
    el.btnResume.textContent = t('btn.resume');
    el.btnRestart.textContent = t('btn.restart');
    el.btnHome.textContent = t('btn.home');
    el.rotateText.textContent = t('rotate.text');
    const rotateSkip = $('btn-rotate-skip');
    if (rotateSkip) rotateSkip.textContent = t('rotate.skip');
    el.tutSkip.textContent = t('btn.skip');
    for (const sel of el.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.setAttribute('aria-label', t('lang'));
    }
    // HUD 文案（setHud 里也会刷新数值，这里只刷标签）
    setHud(lastHud);
  }

  let lastHud = null;

  function setHud(hud) {
    lastHud = hud;
    if (!hud) return;
    el.hudLevel.textContent = `${t('hud.level')} ${hud.level}`;
    el.hudEnemies.textContent = `${t('hud.enemies')} ${hud.enemiesLeft}`;
    el.hudScore.textContent = `${t('hud.score')} ${hud.score}`;
    el.hudHearts.textContent = '♥'.repeat(Math.max(0, hud.hp)) + '♡'.repeat(Math.max(0, hud.maxHp - hud.hp));
    el.hudDash.style.width = `${Math.round(hud.dash * 100)}%`;
    el.hudCombo.textContent = hud.combo >= 2 ? `${t('hud.combo')} ×${hud.combo}` : '';
    el.hudCombo.classList.toggle('active', hud.combo >= 2);
  }

  function setBest(stars) {
    el.titleBest.textContent = t('title.best', { stars });
  }

  function setMuted(m) {
    el.btnMute.textContent = m ? '🔇' : '🔊';
  }

  function setBanner(text) {
    if (!text) { el.levelBanner.classList.add('hidden'); return; }
    el.levelBanner.textContent = text;
    el.levelBanner.classList.remove('hidden');
  }

  // ---- 事件绑定 ----
  el.btnStart.addEventListener('click', () => handlers.onStart && handlers.onStart());
  el.btnResume.addEventListener('click', () => handlers.onResume && handlers.onResume());
  el.btnRestart.addEventListener('click', () => handlers.onRestart && handlers.onRestart());
  el.btnHome.addEventListener('click', () => handlers.onHome && handlers.onHome());
  el.btnRetry.addEventListener('click', () => handlers.onRetry && handlers.onRetry());
  el.btnHome2.addEventListener('click', () => handlers.onHome && handlers.onHome());
  el.btnMute.addEventListener('click', () => handlers.onMute && handlers.onMute());
  const howButtons = [el.btnHow || $('btn-how'), el.btnHow2 || $('btn-how2'), document.querySelector('[data-tutorial-replay]')].filter(Boolean);
  howButtons.forEach((b) => b.addEventListener('click', () => handlers.onHow && handlers.onHow()));

  for (const sel of el.langSelects) {
    if (sel) sel.addEventListener('change', (e) => handlers.onLang && handlers.onLang(e.target.value));
  }

  // 触屏控制
  if (el.touchControls) {
    const bindTouch = (btn, onDown, onUp) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers.onUnlock && handlers.onUnlock(); onDown(); });
      btn.addEventListener('pointerup', onUp);
      btn.addEventListener('pointercancel', onUp);
      btn.addEventListener('pointerleave', onUp);
    };
    el.touchControls.querySelectorAll('[data-dir]').forEach((b) => {
      const dir = b.dataset.dir;
      bindTouch(b, () => { touch[dir] = true; }, () => { touch[dir] = false; });
    });
    el.touchControls.querySelectorAll('[data-act]').forEach((b) => {
      const act = b.dataset.act;
      bindTouch(b, () => handlers.onAct && handlers.onAct(act), () => {});
    });
  }

  // 教程
  const tutorial = createTutorial({
    overlay: el.tutorial,
    card: el.tutCard,
    titleEl: el.tutTitle,
    textEl: el.tutText,
    nextBtn: el.tutNext,
    skipBtn: el.tutSkip,
    t,
    save: opts.save,
  });
  el.tutNext.addEventListener('click', () => tutorial.next());
  el.tutSkip.addEventListener('click', () => tutorial.skip());

  return {
    el,
    show,
    applyLang,
    setHud,
    setBest,
    setMuted,
    setBanner,
    getTouch: () => touch,
    tutorial,
  };
}
