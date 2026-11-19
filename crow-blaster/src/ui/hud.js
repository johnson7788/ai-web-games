// src/ui/hud.js — 顶部不透明 HUD 条（分数/关卡/乌鸦/弹药/时间/连击）。
import { t } from '../core/i18n.js';

export function createHud(root) {
  const hud = document.getElementById('hud');
  const els = {
    score: hud.querySelector('#hud-score'),
    level: hud.querySelector('#hud-level'),
    crows: hud.querySelector('#hud-crows'),
    ammo: hud.querySelector('#hud-ammo'),
    time: hud.querySelector('#hud-time'),
    combo: hud.querySelector('#hud-combo'),
  };

  function setHud(h) {
    if (!h) return;
    const timeLeft = Math.ceil(h.timeLeft ?? 0);
    els.score.textContent = `${t('hud.score')} ${Math.floor(h.score ?? 0)}`;
    els.level.textContent = `${t('hud.level')} ${h.level ?? 1}`;
    els.crows.textContent = `${t('hud.crows')} ${Math.max(0, h.crowsRemaining ?? 0)}/${h.crowsTotal ?? 0}`;
    els.ammo.textContent = `${t('hud.ammo')} ${Math.max(0, h.ammo ?? 0)}`;
    els.time.textContent = `${t('hud.time')} ${timeLeft}s`;
    els.combo.textContent = `${t('hud.combo')} ×${h.combo ?? 0}`;
    els.ammo.classList.toggle('low', (h.ammo ?? 0) <= 5);
    els.time.classList.toggle('low', timeLeft <= 10);
    els.combo.classList.toggle('off', (h.combo ?? 0) === 0);
  }

  return {
    els,
    setHud,
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },
  };
}
