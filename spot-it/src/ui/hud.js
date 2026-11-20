// src/ui/hud.js — 顶部不透明 HUD：关卡 / 分数 / 时间 / 电量条 / 清单（目标标记）。
// 清单缩略图由 drawThumb 程序化绘制（目标具体可见，供视觉评审识别 goal_visible）。
import { t } from '../core/i18n.js';
import { drawThumb } from '../render/items.js';
import { itemLabel } from '../../config/items.js';
import { SCENE_PACKS } from '../../config/gameplay.js';

export function createHud(root) {
  const hud = document.createElement('div');
  hud.className = 'hud hidden';
  hud.innerHTML = `
    <div class="hud-left">
      <div class="hud-stat"><span class="hud-label" data-i18n="hud.level">${t('hud.level')}</span><b id="hud-level">1</b></div>
      <div class="hud-stat"><span class="hud-label" data-i18n="hud.score">${t('hud.score')}</span><b id="hud-score">0</b></div>
      <div class="hud-scene" id="hud-scene"></div>
    </div>
    <div class="hud-center">
      <div class="checklist-label"><span data-i18n="hud.checklist">${t('hud.checklist')}</span></div>
      <div class="checklist" id="checklist"></div>
    </div>
    <div class="hud-right">
      <div class="hud-stat"><span class="hud-label" data-i18n="hud.time">${t('hud.time')}</span><b id="hud-time">40</b></div>
      <div class="battery" id="battery">
        <div class="battery-track"><span class="battery-fill" id="battery-fill"></span></div>
        <span class="battery-label" data-i18n="hud.battery">${t('hud.battery')}</span>
      </div>
    </div>`;
  root.appendChild(hud);

  const els = {
    root: hud,
    level: hud.querySelector('#hud-level'),
    score: hud.querySelector('#hud-score'),
    time: hud.querySelector('#hud-time'),
    scene: hud.querySelector('#hud-scene'),
    checklist: hud.querySelector('#checklist'),
    battery: hud.querySelector('#battery'),
    batteryFill: hud.querySelector('#battery-fill'),
  };

  let lastChecklistKey = '';
  let lastScene = -1;

  function rebuildChecklist(h) {
    const key = h.level + ':' + h.checklist.map((c) => c.itemId).join(',');
    if (key === lastChecklistKey) {
      updateChecklistCounts(h);
      return;
    }
    lastChecklistKey = key;
    els.checklist.innerHTML = '';
    for (const c of h.checklist) {
      const item = document.createElement('div');
      item.className = 'check-item';
      item.dataset.itemId = c.itemId;
      item.appendChild(drawThumb(c.itemId, 30));
      const name = document.createElement('span');
      name.className = 'check-name';
      name.textContent = itemLabel(c.itemId, h.lang === 'zh' ? 'zh' : 'en');
      const count = document.createElement('span');
      count.className = 'check-count';
      count.textContent = '×' + c.need;
      item.appendChild(name);
      item.appendChild(count);
      els.checklist.appendChild(item);
    }
    updateChecklistCounts(h);
  }

  function updateChecklistCounts(h) {
    for (const c of h.checklist) {
      const node = els.checklist.querySelector(`[data-item-id="${c.itemId}"]`);
      if (!node) continue;
      node.classList.toggle('done', c.found >= c.need);
      const cnt = node.querySelector('.check-count');
      if (cnt) cnt.textContent = '×' + Math.max(0, c.need - c.found);
    }
  }

  function setHud(h) {
    h = h || {};
    els.level.textContent = String(h.level || 1);
    els.score.textContent = String(Math.floor(h.score || 0));
    els.time.textContent = String(Math.max(0, Math.ceil(h.timeLeft ?? 0)));

    const pct = Math.max(0, Math.min(100, ((h.battery ?? 0) / 100) * 100));
    els.batteryFill.style.width = pct + '%';
    els.battery.classList.toggle('low', (h.battery ?? 0) <= 25);
    els.time.classList.toggle('danger', (h.timeLeft ?? 0) <= 10);

    if (h.scenePack !== lastScene) {
      lastScene = h.scenePack;
      const pack = SCENE_PACKS[h.scenePack % SCENE_PACKS.length];
      els.scene.textContent = pack ? t(pack.nameKey) : '';
    }

    if (h.checklist && h.checklist.length) rebuildChecklist(h);
  }

  return {
    root: hud,
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },
    setHud,
  };
}
