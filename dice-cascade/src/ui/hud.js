// src/ui/hud.js — 顶部 HUD + 底部操作条（押注骰位 / 掷骰 / 收手保分）。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

export function createHud(root) {
  let hud = root.querySelector('#hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    root.appendChild(hud);
  }
  hud.className = 'hud hidden';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.pot"></span><b id="hud-pot">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-stage" id="hud-stage"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rolls"></span><b id="hud-rolls">0</b></div>' +
      '<div class="rune-meter" id="rune-meter">' +
        '<span class="rune-label" data-i18n="hud.rune"></span><b id="rune-level">0</b>' +
        '<div class="rune-track"><i class="rune-fill" id="rune-fill"></i></div>' +
        '<span class="rune-count" id="rune-count">0/5</span>' +
      '</div>' +
    '</div>';

  let bar = root.querySelector('#action-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'action-bar';
    root.appendChild(bar);
  }
  bar.className = 'action-bar hidden';
  bar.innerHTML =
    '<div class="bet-slots" id="bet-slots">' +
      '<button class="bet-slot" data-bet="0" type="button"><i class="bet-die">1</i><em class="bet-cost"></em></button>' +
      '<button class="bet-slot" data-bet="1" type="button"><i class="bet-die">2</i><em class="bet-cost"></em></button>' +
      '<button class="bet-slot" data-bet="2" type="button"><i class="bet-die">3</i><em class="bet-cost"></em></button>' +
    '</div>' +
    '<button id="btn-roll" class="btn btn-roll" type="button" data-i18n="btn.roll"></button>' +
    '<button id="btn-bank" class="btn btn-bank" type="button" data-i18n="btn.bank"></button>';

  const scoreEl = hud.querySelector('#hud-score');
  const potEl = hud.querySelector('#hud-pot');
  const targetEl = hud.querySelector('#hud-target');
  const rollsEl = hud.querySelector('#hud-rolls');
  const stageEl = hud.querySelector('#hud-stage');
  const runeFill = hud.querySelector('#rune-fill');
  const runeLevel = hud.querySelector('#rune-level');
  const runeCount = hud.querySelector('#rune-count');
  const betSlots = [...bar.querySelectorAll('.bet-slot')];
  const btnRoll = bar.querySelector('#btn-roll');
  const btnBank = bar.querySelector('#btn-bank');

  let last = {};

  function stageName(scene, stage) {
    const text = t(`scene.${scene}`);
    return text !== `scene.${scene}` ? text : String(stage);
  }

  function setHud(h) {
    last = h = h || {};
    scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
    potEl.textContent = String(Math.max(0, Math.floor(h.pot ?? 0)));
    targetEl.textContent = String(Math.max(0, Math.floor(h.target ?? 0)));
    rollsEl.textContent = String(Math.max(0, Math.floor(h.rollsLeft ?? 0)));
    stageEl.textContent = `${stageName(h.scene, h.stage)} ${h.stage || 1}/12`;
    runeLevel.textContent = String(h.runeLevel ?? 0);
    runeCount.textContent = `${h.runeShards ?? 0}/${h.runeNeed || 5}`;
    runeFill.style.width = `${Math.min(100, ((h.runeShards ?? 0) / Math.max(1, h.runeNeed || 1)) * 100).toFixed(1)}%`;

    // 操作条
    const sel = new Set(h.betSel || []);
    const affordable = (h.pot ?? 0) >= (h.betCost ?? 0);
    const canBank = (h.pot ?? 0) >= (h.target ?? 0);
    betSlots.forEach((btn, i) => {
      const visible = i < (h.diceCount ?? 1);
      btn.classList.toggle('hidden', !visible);
      btn.classList.toggle('on', sel.has(i));
      const costEl = btn.querySelector('.bet-cost');
      costEl.textContent = t('hud.betCost') + ' ' + (h.betCost ?? 0);
      btn.disabled = !!h.rolling || !affordable;
    });
    btnRoll.disabled = !!h.rolling || (h.rollsLeft ?? 0) <= 0;
    btnBank.disabled = !!h.rolling || !canBank;
  }

  return {
    el: hud,
    bar,
    setHud,
    get els() {
      return { betSlots, btnRoll, btnBank };
    },
    show() { hud.classList.remove('hidden'); bar.classList.remove('hidden'); hud.setAttribute('aria-hidden', 'false'); },
    hide() { hud.classList.add('hidden'); bar.classList.add('hidden'); hud.setAttribute('aria-hidden', 'true'); },
  };
}
