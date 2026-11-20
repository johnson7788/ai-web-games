// src/ui/hud.js — 顶部 HUD（不透明条）+ 底部控制条（下注 / 押镖 / 旋转）+ 反馈横幅。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { BET_OPTIONS, TOKEN } from '../../config/gameplay.js';

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.balance"></span><b id="hud-balance">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.bet"></span><b id="hud-bet">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.win"></span><b id="hud-win">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-level" id="hud-level">1</div>' +
      '<div class="hud-scene" id="hud-scene"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.tokens"></span><b id="hud-tokens">0</b></div>' +
      '<div class="hud-stat hidden" id="hud-free-wrap"><span class="hud-label" data-i18n="hud.freespin"></span><b id="hud-free">0</b></div>' +
      '<div class="hud-pity hidden" id="hud-pity" data-i18n="ctl.pity"></div>' +
    '</div>';

  // 底部控制条
  let controls = root.querySelector('#controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'controls';
    controls.className = 'controls hidden';
    root.appendChild(controls);
  }
  const betButtons = BET_OPTIONS.map((v) =>
    `<button class="btn btn-bet" type="button" data-bet="${v}">${v}</button>`).join('');
  controls.innerHTML =
    '<div class="controls-row">' +
      '<div class="controls-bets" id="bet-bar">' + betButtons + '</div>' +
      '<button id="btn-escort" class="btn btn-escort" type="button" data-i18n="ctl.escort"></button>' +
      '<button id="btn-spin" class="btn btn-spin" type="button" data-i18n="ctl.spin" data-i18n-aria="ctl.spin"></button>' +
    '</div>';

  // 反馈横幅
  let feedback = root.querySelector('#feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'feedback';
    feedback.className = 'feedback hidden';
    root.appendChild(feedback);
  }

  // 目标提示（始终可见，告诉玩家「匹配 3+ 即赢」）
  let goal = root.querySelector('#goal-hint');
  if (!goal) {
    goal = document.createElement('div');
    goal.id = 'goal-hint';
    goal.className = 'goal-hint hidden';
    goal.setAttribute('aria-hidden', 'true');
    goal.setAttribute('data-i18n', 'hud.goal');
    root.appendChild(goal);
  }

  const els = {
    balance: el.querySelector('#hud-balance'),
    bet: el.querySelector('#hud-bet'),
    win: el.querySelector('#hud-win'),
    level: el.querySelector('#hud-level'),
    scene: el.querySelector('#hud-scene'),
    tokens: el.querySelector('#hud-tokens'),
    freeWrap: el.querySelector('#hud-free-wrap'),
    free: el.querySelector('#hud-free'),
    pity: el.querySelector('#hud-pity'),
    betButtons: [...controls.querySelectorAll('.btn-bet')],
    escortBtn: controls.querySelector('#btn-escort'),
    spinBtn: controls.querySelector('#btn-spin'),
    betBar: controls.querySelector('#bet-bar'),
  };

  let lastWin = 0;

  function sceneLabel(scene) {
    const key = 'scene.' + scene;
    const text = t(key);
    return text !== key ? text : (scene || '');
  }

  function setHud(h) {
    h = h || {};
    els.balance.textContent = String(Math.max(0, Math.floor(h.balance ?? 0)));
    els.bet.textContent = String(h.bet ?? 1);
    els.win.textContent = String(Math.max(0, Math.floor(h.lastWin ?? lastWin ?? 0)));
    els.level.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
    els.scene.textContent = sceneLabel(h.scene);
    els.tokens.textContent = `${Math.max(0, Math.floor(h.tokens ?? 0))}/${TOKEN.PITY_TARGET}`;
    els.freeWrap.classList.toggle('hidden', !(h.freeSpins > 0));
    els.free.textContent = String(Math.max(0, Math.floor(h.freeSpins ?? 0)));
    els.pity.classList.toggle('hidden', !h.pityReady);

    for (const b of els.betButtons) {
      const v = Number(b.dataset.bet);
      b.classList.toggle('active', v === h.bet);
    }

    const escortOn = !!h.escort;
    els.escortBtn.classList.toggle('active', escortOn);
    els.escortBtn.textContent = h.escortUnlocked
      ? (escortOn ? t('ctl.escort.on') : t('ctl.escort.off'))
      : t('ctl.escort.locked', { level: 3 });
    els.escortBtn.disabled = !h.escortUnlocked;

    lastWin = h.lastWin ?? 0;
  }

  function setPhase(phase) {
    const spinning = phase === 'spinning';
    els.spinBtn.textContent = spinning ? t('ctl.stop') : t('ctl.spin');
    els.spinBtn.setAttribute('aria-label', spinning ? t('ctl.stop') : t('ctl.spin'));
    els.spinBtn.classList.toggle('stop', spinning);
    els.spinBtn.disabled = phase === 'dead';
  }

  function flashFeedback(text, cls) {
    feedback.textContent = text;
    feedback.className = 'feedback ' + (cls || '');
    void feedback.offsetWidth; // 重启动画
    feedback.classList.remove('hidden');
  }

  return {
    el,
    controls,
    feedback,
    els,
    setHud,
    setPhase,
    flashFeedback,
    show() {
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      controls.classList.remove('hidden');
      goal.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      controls.classList.add('hidden');
      feedback.classList.add('hidden');
      goal.classList.add('hidden');
    },
  };
}
