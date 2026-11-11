// 赤色要塞 · UI（M3）—— DOM UI / HUD / 屏幕 / 触屏控件。
// 只操作 #ui-root；数据只来自 showScreen/setHud 入参；不碰 canvas/sim/main。
import { t, i18n } from '../core/i18n.js';
import { save } from '../core/save.js';

const DEADZONE = 0.15;

// 内联 SVG 图标（stroke 继承 currentColor；名字来自我方常量，无注入面）。
const ICON = {
  grenade: '<circle cx="12" cy="13.5" r="6.5"/><path d="M11 3v3"/><rect x="9.2" y="6" width="5.6" height="2"/><path d="M9.5 5.5h5"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14"/><rect x="13.4" y="5" width="3.6" height="14"/>',
  danger: '<path d="M12 3.5 20 18H4z"/><path d="M12 10v4"/><path d="M12 16.6h.01"/>',
  pierce: '<circle cx="6.5" cy="12" r="4.5"/><path d="M12 12h8"/><path d="M17 8.5 20.5 12 17 15.5"/>',
  spread: '<path d="M5 18 12 6l7 12"/><path d="M5 18h14"/><path d="M12 6v4"/>',
  demo: '<path d="M12 3l2.2 5.2L19.5 10l-5.3 1.8L12 17l-2.2-5.2L4.5 10l5.3-1.8z"/>',
  turbo: '<path d="M4 8.5 9.5 12 4 15.5z"/><path d="M11 8.5 16.5 12 11 15.5z"/>',
  armor: '<path d="M12 3.5 18.5 6v5.5c0 3.6-2.6 6.6-6.5 9-3.9-2.4-6.5-5.4-6.5-9V6z"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.2-5"/><path d="M17 2.5V7h-4.5"/>',
  repair: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  magnet: '<path d="M7 5h3.5v6.5a1.5 1.5 0 0 0 3 0V5H17v6.5a5 5 0 0 1-10 0z"/>',
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function svgEl(name, cls) {
  const span = el('span', `icon ${cls || ''}`);
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  return span;
}

function button(label, cls = 'btn') {
  const b = el('button', cls, label);
  b.type = 'button';
  return b;
}

function stat(label, value) {
  const w = el('div', 'stat');
  w.append(el('span', 'stat-label', label), el('span', 'stat-value', value));
  return w;
}

// 只增删/切换 class，绝不每帧重建。
function syncPips(container, count, onCount, cls) {
  count = Math.max(0, count | 0);
  while (container.children.length < count) container.append(el('i', cls));
  while (container.children.length > count) container.removeChild(container.lastChild);
  for (let i = 0; i < count; i += 1) container.children[i].classList.toggle('on', i < onCount);
}

function isPortrait() {
  try { return window.matchMedia('(orientation: portrait)').matches; }
  catch { return window.innerHeight > window.innerWidth; }
}

export function initUI(hooks) {
  const root = document.getElementById('ui-root');
  root.innerHTML = '';

  const state = {
    screen: 'none', data: null, lang: i18n.lang,
    touchMode: false, settingsBack: 'title', rotateDismissed: false,
  };

  // ---------- 触屏输入状态 ----------
  const touchState = { mx: 0, my: 0, aimDX: 0, aimDY: 0, fire: false, grenade: false, active: false };
  let moveActive = false;
  let aimActive = false;

  function emitTouch() {
    touchState.active = moveActive || aimActive;
    hooks.onTouch && hooks.onTouch({ ...touchState });
  }

  function makeStick(cls, ariaLabel) {
    const stick = el('div', `stick ${cls}`);
    stick.setAttribute('role', 'button');
    stick.setAttribute('aria-label', ariaLabel);
    const base = el('div', 'stick-base');
    const thumb = el('div', 'stick-thumb');
    const label = el('span', 'stick-label', ariaLabel);
    stick.append(base, thumb, label);

    const isLeft = cls.indexOf('left') >= 0;
    let pid = null;
    let cx = 0;
    let cy = 0;
    let radius = 54;

    function onDown(e) {
      if (pid !== null) return;
      pid = e.pointerId;
      try { stick.setPointerCapture(pid); } catch { /* 老浏览器 */ }
      const rect = base.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      radius = Math.max(1, rect.width / 2);
      onMove(e);
    }
    function onMove(e) {
      if (e.pointerId !== pid) return;
      const rx = (e.clientX - cx) / radius;
      const ry = (e.clientY - cy) / radius;
      const rlen = Math.hypot(rx, ry);
      const cl = rlen > 1 ? { x: rx / rlen, y: ry / rlen } : { x: rx, y: ry };
      thumb.style.transform = `translate(${cl.x * radius * 0.9}px, ${cl.y * radius * 0.9}px)`;
      if (isLeft) {
        moveActive = true;
        if (rlen < DEADZONE) { touchState.mx = 0; touchState.my = 0; }
        else { touchState.mx = rx / rlen; touchState.my = ry / rlen; }
      } else {
        aimActive = true;
        if (rlen < DEADZONE) { touchState.aimDX = 0; touchState.aimDY = 0; touchState.fire = false; }
        else { touchState.aimDX = rx / rlen; touchState.aimDY = ry / rlen; touchState.fire = true; }
      }
      emitTouch();
    }
    function onUp(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      thumb.style.transform = 'translate(0,0)';
      if (isLeft) { moveActive = false; touchState.mx = 0; touchState.my = 0; }
      else { aimActive = false; touchState.aimDX = 0; touchState.aimDY = 0; touchState.fire = false; }
      emitTouch();
    }

    stick.addEventListener('pointerdown', onDown);
    stick.addEventListener('pointermove', onMove);
    stick.addEventListener('pointerup', onUp);
    stick.addEventListener('pointercancel', onUp);
    return stick;
  }

  // ---------- HUD（持久节点，setHud 只 diff） ----------
  const hud = el('div', 'hud hidden');

  const hudTl = el('div', 'hud-tl');
  const stageEl = el('div', 'hud-stage', '');

  const armorLine = el('div', 'hud-line');
  const armorLabel = el('span', 'hud-label', t('hp'));
  const armorPips = el('span', 'pips');
  const armorNum = el('span', 'hud-sub', '');
  armorLine.append(armorLabel, armorPips, armorNum);

  const grenLine = el('div', 'hud-line');
  const grenLabel = el('span', 'hud-label', t('grenades'));
  const grenNum = el('span', 'hud-sub', '');
  grenLine.append(grenLabel, svgEl('grenade', 'hud-ic'), grenNum);

  const powLine = el('div', 'hud-line');
  const powLabel = el('span', 'hud-label', t('pow'));
  const powPips = el('span', 'pips powpips');
  const deliveredNum = el('span', 'hud-sub', '');
  powLine.append(powLabel, powPips, deliveredNum);

  hudTl.append(stageEl, armorLine, grenLine, powLine);

  const hudMid = el('div', 'hud-mid');
  const progress = el('div', 'progress');
  const progressFill = el('div', 'progress-fill');
  const progressTicks = el('div', 'progress-ticks');
  for (let i = 0; i < 4; i += 1) progressTicks.append(el('i'));
  progress.append(progressFill, progressTicks);
  hudMid.append(progress);

  const hudTr = el('div', 'hud-tr');
  const scoreLine = el('div', 'hud-score');
  const scoreLabel = el('span', 'hud-label', t('score'));
  const scoreNum = el('span', 'hud-score-num', '0');
  scoreLine.append(scoreLabel, scoreNum);
  const livesLine = el('div', 'hud-lives');
  const livesLabel = el('span', 'hud-label', t('lives'));
  const livesNum = el('span', '', '3');
  livesLine.append(livesLabel, livesNum);
  hudTr.append(scoreLine, livesLine);

  hud.append(hudTl, hudMid, hudTr);

  const bossBar = el('div', 'bossbar hidden');
  const bossLabel = el('span', 'bossbar-label', t('bossName'));
  const bossShield = el('span', 'bossbar-shield');
  const bossTrack = el('div', 'bossbar-track');
  const bossFill = el('div', 'bossbar-fill');
  bossTrack.append(bossFill);
  bossBar.append(bossLabel, bossShield, bossTrack);

  const toastWrap = el('div', 'toasts');
  const overlay = el('div', 'overlay hidden');

  // ---------- 触屏控件 ----------
  const touch = el('div', 'touch hidden');
  const moveStick = makeStick('stick-left', t('touchMove'));
  const aimStick = makeStick('stick-right', t('touchAim'));

  const grenadeBtn = el('button', 'touch-grenade');
  grenadeBtn.type = 'button';
  grenadeBtn.setAttribute('aria-label', t('touchGrenade'));
  grenadeBtn.append(svgEl('grenade'));

  const pauseBtn = el('button', 'touch-pause');
  pauseBtn.type = 'button';
  pauseBtn.setAttribute('aria-label', t('touchPause'));
  pauseBtn.append(svgEl('pause'));
  pauseBtn.addEventListener('click', () => hooks.onPause && hooks.onPause());

  touch.append(moveStick, aimStick, grenadeBtn, pauseBtn);

  const rotateHint = el('div', 'rotate-hint hidden');
  const rotateText = el('span', '', t('horizontalHint'));
  const rotateClose = el('button', 'rotate-close', '×');
  rotateClose.type = 'button';
  rotateClose.setAttribute('aria-label', t('close'));
  rotateClose.addEventListener('click', () => {
    state.rotateDismissed = true;
    rotateHint.classList.add('hidden');
  });
  rotateHint.append(rotateText, rotateClose);

  root.append(hud, bossBar, toastWrap, overlay, touch, rotateHint);

  // HUD diff 状态
  const h = {
    hp: -1, maxHp: -1, lives: -1, grenades: -1,
    pow: -1, powCap: -1, delivered: -1, deliverGoal: -1,
    score: -1, stageText: null, progress: -1, bossKey: null,
  };

  grenadeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touchState.grenade = true;
    emitTouch();
    // ponytail: 边沿触发——按住约 3 帧后复位；sim 冷却防止连投。
    window.setTimeout(() => {
      touchState.grenade = false;
      emitTouch();
    }, 50);
  });

  // ---------- 渲染辅助 ----------
  let screenShownAt = 0;
  function beginScreen(clickAdvance) {
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');
    overlay.onclick = null;
    overlay.classList.toggle('overlay-click', !!clickAdvance);
    screenShownAt = performance.now();
    if (clickAdvance) {
      // 防同一击穿透：点「开始/升级卡」时新屏立刻出现，同一个 click 不应再触发跳过
      overlay.onclick = (ev) => {
        if (performance.now() - screenShownAt < 160) return;
        clickAdvance(ev);
      };
    }
  }

  function closeOverlay() {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
    overlay.onclick = null;
    overlay.classList.remove('overlay-click');
  }

  function renderHudLabels() {
    armorLabel.textContent = t('hp');
    grenLabel.textContent = t('grenades');
    powLabel.textContent = t('pow');
    scoreLabel.textContent = t('score');
    livesLabel.textContent = t('lives');
    bossLabel.textContent = t('bossName');
  }

  function renderTouchLabels() {
    moveStick.querySelector('.stick-label').textContent = t('touchMove');
    aimStick.querySelector('.stick-label').textContent = t('touchAim');
    moveStick.setAttribute('aria-label', t('touchMove'));
    aimStick.setAttribute('aria-label', t('touchAim'));
    grenadeBtn.setAttribute('aria-label', t('touchGrenade'));
    pauseBtn.setAttribute('aria-label', t('touchPause'));
    rotateText.textContent = t('horizontalHint');
    rotateClose.setAttribute('aria-label', t('close'));
  }

  function updateTouchVisibility() {
    touch.classList.toggle('hidden', !(state.touchMode && state.screen === 'hud'));
  }

  function updateRotateHint() {
    rotateHint.classList.toggle('hidden', !(state.touchMode && !state.rotateDismissed && isPortrait()));
  }

  function pressEnter() {
    // ponytail: main 未暴露 intro 跳过 hook，合成 Enter 触发其 keydown 处理。
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  }

  // ---------- 屏幕 ----------
  function titleScreen() {
    state.screen = 'title';
    beginScreen(null);
    const s = el('div', 'screen title-screen anim-in');
    const logo = el('div', 'logo');
    logo.append(el('span', 'logo-zh', t('title')), el('span', 'logo-en', t('subtitle')));
    s.append(logo, el('p', 'tagline', t('tagline')));

    const start = button(t('start'), 'btn btn-primary btn-big');
    start.addEventListener('click', () => hooks.onStart && hooks.onStart('normal'));
    s.append(start);

    const stats = el('div', 'title-stats');
    stats.append(
      el('span', '', `${t('best')} ${save.get('bestScore', 0)}`),
      el('span', '', `${t('bestStage')} ${save.get('bestStage', 0)}`),
      el('span', '', `${t('rescuedTotal')} ${save.get('totalRescued', 0)}`),
    );
    s.append(stats);

    const actions = el('div', 'title-actions');
    const settingsBtn = button(t('settings'), 'btn btn-ghost');
    settingsBtn.addEventListener('click', () => settingsScreen('title'));
    actions.append(settingsBtn);
    if (save.get('cleared', false)) {
      const hard = button(t('hard'), 'btn btn-ghost');
      hard.addEventListener('click', () => hooks.onStart && hooks.onStart('hard'));
      actions.append(hard);
    } else {
      const locked = el('span', 'hard-locked', `${t('hard')} · ${t('locked')}`);
      locked.title = t('hardLocked');
      actions.append(locked);
    }
    s.append(actions);

    s.append(el('p', 'hint', t('startHint')));
    s.append(el('p', 'press-start', t('pressStart')));
    overlay.append(s);
  }

  function introScreen(data) {
    beginScreen(() => pressEnter());
    const s = el('div', 'screen intro-screen anim-in');
    s.append(el('div', 'intro-kicker', t('stage', { n: data.stage })));
    s.append(el('h1', 'intro-title', t(data.nameKey)));
    s.append(el('p', 'intro-desc', t(data.descKey)));
    if (data.radioKey) s.append(el('p', 'intro-radio', t(data.radioKey)));
    s.append(el('div', 'intro-hint', t('continueHint')));
    overlay.append(s);
  }

  function pausedScreen() {
    state.screen = 'paused';
    beginScreen(null);
    const s = el('div', 'screen panel paused-screen anim-in');
    s.append(el('h2', '', t('paused')));
    const resume = button(t('resume'), 'btn btn-primary');
    resume.addEventListener('click', () => hooks.onResume && hooks.onResume());
    const restart = button(t('restart'), 'btn');
    restart.addEventListener('click', () => hooks.onRestart && hooks.onRestart());
    const settings = button(t('settings'), 'btn btn-ghost');
    settings.addEventListener('click', () => settingsScreen('pause'));
    const quit = button(t('quit'), 'btn btn-ghost');
    quit.addEventListener('click', () => hooks.onQuit && hooks.onQuit());
    s.append(resume, restart, settings, quit);
    overlay.append(s);
  }

  function upgradeScreen(data) {
    beginScreen(null);
    const s = el('div', 'screen panel upgrade-screen anim-in');
    s.append(el('h2', '', t('upgradeTitle')));
    const cards = el('div', 'upgrade-cards');
    (data.choices || []).forEach((u, i) => {
      const card = el('button', 'upgrade-card');
      card.type = 'button';
      card.append(el('span', 'upgrade-index', String(i + 1)));
      card.append(svgEl(u.icon, 'upgrade-icon'));
      card.append(el('span', 'upgrade-name', t(u.nameKey)));
      card.append(el('span', 'upgrade-desc', t(u.descKey)));
      card.addEventListener('click', () => hooks.onUpgradePick && hooks.onUpgradePick(u.id));
      cards.append(card);
    });
    s.append(cards);
    s.append(el('p', 'hint', t('upgradeHint')));
    overlay.append(s);
  }

  function clearScreen(data) {
    beginScreen(() => hooks.onNextStage && hooks.onNextStage());
    const s = el('div', 'screen panel clear-screen anim-in');
    const isFinal = !!data.last;
    s.append(el('div', 'kicker', t('stageClear')));
    s.append(el('h2', '', t(isFinal ? 'stageClearFinal' : 'stage', { n: data.stage })));
    s.append(el('p', '', t(isFinal ? 'stageClearFinalDesc' : 'stageClearDesc')));
    const rows = el('div', 'score-rows');
    rows.append(stat(t('time'), `${Math.round(data.time || 0)}s`));
    rows.append(stat(t('timeBonus'), `+${data.timeBonus || 0}`));
    rows.append(stat(t('delivered'), String(data.delivered || 0)));
    rows.append(stat(t('totalScore'), String(data.score || 0)));
    s.append(rows);
    s.append(el('p', 'hint', t('continueHint')));
    overlay.append(s);
  }

  function deadScreen(data) {
    const final = !!data.final;
    beginScreen(() => { if (final) hooks.onQuit && hooks.onQuit(); else hooks.onRetry && hooks.onRetry(); });
    const s = el('div', 'screen panel dead-screen anim-in');
    s.append(svgEl('danger', 'danger-ic'));
    // ponytail: locales 无「吉普被毁」专属 key，用 gameOver 兜底（交付说明已列）。
    s.append(el('h1', 'danger', t('deadTitle')));
    s.append(el('p', '', `${t('lives')} ${data.lives}`));
    if (!final) s.append(button(t('retry'), 'btn btn-primary'));
    overlay.append(s);
  }

  function gameoverScreen(data) {
    beginScreen(() => hooks.onQuit && hooks.onQuit());
    const s = el('div', 'screen panel gameover-screen anim-in');
    s.append(el('h1', 'danger', t('gameOver')));
    s.append(el('p', '', t('gameOverDesc')));
    if ((data.score || 0) > 0 && (data.score || 0) >= (data.best || 0)) {
      s.append(el('div', 'new-record', t('newRecord')));
    }
    s.append(el('div', 'big-score', String(data.score || 0)));
    const rows = el('div', 'score-rows');
    rows.append(stat(t('best'), String(data.best || 0)));
    rows.append(stat(t('rescuedTotal'), String(data.rescued || 0)));
    s.append(rows);
    s.append(button(t('quit'), 'btn btn-primary'));
    overlay.append(s);
  }

  function endingScreen(data) {
    beginScreen(() => hooks.onQuit && hooks.onQuit());
    const s = el('div', 'screen panel ending-screen anim-in');
    s.append(el('div', 'kicker', t('endingStats')));
    s.append(el('h1', 'gold', t('endingTitle')));
    s.append(el('p', '', t('endingDesc', { n: data.rescued || 0 })));
    if ((data.score || 0) > 0 && (data.score || 0) >= (data.best || 0)) {
      s.append(el('div', 'new-record', t('newRecord')));
    }
    const grid = el('div', 'ending-grid');
    grid.append(el('span', '', t('score')), el('span', '', String(data.score || 0)));
    grid.append(el('span', '', t('rescuedTotal')), el('span', '', String(data.rescued || 0)));
    grid.append(el('span', '', t('kills')), el('span', '', String(data.kills || 0)));
    grid.append(el('span', '', t('time')), el('span', '', `${Math.round(data.time || 0)}s`));
    s.append(grid);
    s.append(button(t('quit'), 'btn btn-primary'));
    overlay.append(s);
  }

  function settingRow(labelText, fill) {
    const row = el('div', 'setting-row');
    row.append(el('span', 'setting-label', labelText));
    const wrap = el('div', 'setting-ctl');
    fill(wrap);
    row.append(wrap);
    return row;
  }

  function settingsScreen(backTo = 'title') {
    state.screen = 'settings';
    state.settingsBack = backTo;
    beginScreen(null);
    const cfg = save.settings();
    const s = el('div', 'screen panel settings-screen anim-in');
    s.append(el('h2', '', t('settings')));
    const rows = el('div', 'settings-rows');

    rows.append(settingRow(t('language'), (wrap) => {
      const seg = el('div', 'seg');
      for (const lang of i18n.list) {
        const b = el('button', 'seg-btn' + (i18n.lang === lang ? ' is-on' : ''), lang.toUpperCase());
        b.addEventListener('click', () => hooks.onLangChange && hooks.onLangChange(lang));
        seg.append(b);
      }
      wrap.append(seg);
    }));

    for (const [key, labelKey] of [['music', 'music'], ['sfx', 'sfx']]) {
      rows.append(settingRow(t(labelKey), (wrap) => {
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '1';
        range.step = '0.05';
        range.value = String(cfg[key] ?? 0.7);
        range.addEventListener('input', () => hooks.onSettingChange && hooks.onSettingChange(key, Number(range.value)));
        wrap.append(range);
      }));
    }

    rows.append(settingRow(t('sound'), (wrap) => {
      const b = el('button', 'seg-btn' + (cfg.muted ? '' : ' is-on'), cfg.muted ? t('off') : t('on'));
      b.addEventListener('click', () => {
        hooks.onSettingChange && hooks.onSettingChange('muted', !save.settings().muted);
        settingsScreen(backTo);
      });
      wrap.append(b);
    }));

    rows.append(settingRow(t('shake'), (wrap) => {
      const b = el('button', 'seg-btn' + (cfg.shake ? ' is-on' : ''), cfg.shake ? t('on') : t('off'));
      b.addEventListener('click', () => {
        hooks.onSettingChange && hooks.onSettingChange('shake', !save.settings().shake);
        settingsScreen(backTo);
      });
      wrap.append(b);
    }));

    rows.append(settingRow(t('quality'), (wrap) => {
      const seg = el('div', 'seg');
      for (const q of ['low', 'high']) {
        const b = el('button', 'seg-btn' + (cfg.quality === q ? ' is-on' : ''), t(q));
        b.addEventListener('click', () => {
          hooks.onSettingChange && hooks.onSettingChange('quality', q);
          settingsScreen(backTo);
        });
        seg.append(b);
      }
      wrap.append(seg);
    }));

    s.append(rows);

    const reset = button(t('resetSave'), 'btn btn-ghost');
    reset.addEventListener('click', () => {
      if (reset.dataset.confirm !== '1') {
        reset.dataset.confirm = '1';
        reset.textContent = t('yes');
        reset.classList.add('btn-confirm');
        window.setTimeout(() => {
          delete reset.dataset.confirm;
          reset.textContent = t('resetSave');
          reset.classList.remove('btn-confirm');
        }, 3000);
        return;
      }
      save.reset();
      ['music', 'sfx', 'muted', 'shake', 'quality'].forEach((k) => {
        hooks.onSettingChange && hooks.onSettingChange(k, save.settings()[k]);
      });
      settingsScreen(backTo);
    });

    const back = button(t('back'), 'btn');
    back.addEventListener('click', () => {
      if (backTo === 'pause') pausedScreen();
      else titleScreen();
    });

    s.append(back, reset);
    overlay.append(s);
  }

  // ---------- 公共 API ----------
  function showScreen(name, data = null) {
    state.screen = name;
    state.data = data;
    hud.classList.toggle('hidden', !(name === 'hud' || name === 'paused'));
    if (name !== 'hud' && name !== 'paused') {
      bossBar.classList.add('hidden');
      h.bossKey = null;
    }
    updateTouchVisibility();
    updateRotateHint();

    switch (name) {
      case 'title': titleScreen(); break;
      case 'intro': introScreen(data || {}); break;
      case 'hud': closeOverlay(); break;
      case 'paused': pausedScreen(); break;
      case 'upgrade': upgradeScreen(data || {}); break;
      case 'clear': clearScreen(data || {}); break;
      case 'dead': deadScreen(data || {}); break;
      case 'gameover': gameoverScreen(data || {}); break;
      case 'ending': endingScreen(data || {}); break;
      case 'settings': settingsScreen(state.settingsBack || 'title'); break;
      case 'none':
      default: closeOverlay(); break;
    }
  }

  function setHud(hudData) {
    if (!hudData) return;

    const stageText = `${t('stage', { n: (hudData.stage || 0) + 1 })} · ${hudData.stageNameKey ? t(hudData.stageNameKey) : ''}`;
    if (h.stageText !== stageText) { h.stageText = stageText; stageEl.textContent = stageText; }

    if (h.maxHp !== hudData.maxHp || h.hp !== hudData.hp) {
      h.maxHp = hudData.maxHp; h.hp = hudData.hp;
      syncPips(armorPips, hudData.maxHp, hudData.hp, 'pip');
      armorNum.textContent = `${hudData.hp}/${hudData.maxHp}`;
      hud.classList.toggle('low-hp', hudData.hp <= 2);
    }
    if (h.grenades !== hudData.grenades) {
      h.grenades = hudData.grenades;
      grenNum.textContent = String(hudData.grenades);
    }
    if (h.powCap !== hudData.powCap || h.pow !== hudData.pow) {
      h.powCap = hudData.powCap; h.pow = hudData.pow;
      syncPips(powPips, hudData.powCap, hudData.pow, 'powpip');
    }
    if (h.delivered !== hudData.delivered || h.deliverGoal !== hudData.deliverGoal) {
      h.delivered = hudData.delivered; h.deliverGoal = hudData.deliverGoal;
      deliveredNum.textContent = `${hudData.delivered}/${hudData.deliverGoal}`;
    }
    if (h.score !== hudData.score) {
      h.score = hudData.score;
      scoreNum.textContent = String(hudData.score);
    }
    if (h.lives !== hudData.lives) {
      h.lives = hudData.lives;
      livesNum.textContent = String(hudData.lives);
    }

    const prog = Math.round(Math.max(0, Math.min(1, hudData.progress || 0)) * 100);
    if (h.progress !== prog) {
      h.progress = prog;
      progressFill.style.width = `${prog}%`;
    }

    const boss = hudData.boss;
    if (boss) {
      bossBar.classList.remove('hidden');
      const key = `${boss.hp}|${boss.maxHp}|${boss.shield}|${boss.active}|${boss.phase}`;
      if (h.bossKey !== key) {
        h.bossKey = key;
        bossFill.style.width = `${Math.round((boss.hp / Math.max(1, boss.maxHp)) * 100)}%`;
        bossTrack.classList.toggle('is-active', !!boss.active);
        const shield = Math.max(0, boss.shield | 0);
        syncPips(bossShield, shield, shield, 'shieldseg');
        bossBar.classList.toggle('is-shield', shield > 0);
      }
    } else if (h.bossKey !== null) {
      h.bossKey = null;
      bossBar.classList.add('hidden');
    }
  }

  let lastToast = { text: '', at: 0 };
  function toast(text, kind = 'info') {
    const now = performance.now();
    if (text === lastToast.text && now - lastToast.at < 900) return; // 去重：连续交付只弹一次
    lastToast = { text, at: now };
    const node = el('div', `toast toast-${kind}`, text);
    toastWrap.append(node);
    requestAnimationFrame(() => node.classList.add('show'));
    window.setTimeout(() => {
      node.classList.remove('show');
      window.setTimeout(() => node.remove(), 260);
    }, 1900);
    while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
  }

  function setLang() {
    state.lang = i18n.lang;
    renderHudLabels();
    renderTouchLabels();
    h.stageText = null;
    if (state.screen && state.screen !== 'none') showScreen(state.screen, state.data);
  }

  function setTouchMode(on) {
    state.touchMode = !!on;
    if (on) emitTouch();
    updateTouchVisibility();
    updateRotateHint();
  }

  window.addEventListener('resize', updateRotateHint);
  try {
    window.matchMedia('(orientation: portrait)').addEventListener('change', updateRotateHint);
  } catch { /* 老浏览器降级 */ }

  return {
    showScreen,
    hideAll: () => showScreen('none'),
    setHud,
    toast,
    setLang,
    setTouchMode,
  };
}
