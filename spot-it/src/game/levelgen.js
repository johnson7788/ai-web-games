// src/game/levelgen.js — 关卡生成（纯逻辑，零 DOM）：按种子挑目标 / 放物品 / 加诱饵。
// 契约：generateLevel({ level, seed }) → { level, scenePack, checklist, items, decoys }。
// 单测 tests/levelgen.test.mjs 校验：每关目标物必在场上、密度达标、诱饵只孪生目标物。
import { WORLD } from '../../config/game.config.js';
import { levelAt } from '../../config/levels.js';
import { ITEMS, itemById } from '../../config/items.js';
import { mulberry32, randInt, pick } from './rng.js';

const PAD = 12; // 物品距离画布边缘的最小间距

/** 从物品池中挑 targetCount 个互不相同的目标 id。 */
function pickTargets(rng, count) {
  const pool = ITEMS.map((i) => i.id);
  const chosen = [];
  const rest = pool.slice();
  for (let i = 0; i < count && rest.length; i += 1) {
    const k = randInt(rng, 0, rest.length - 1);
    chosen.push(rest.splice(k, 1)[0]);
  }
  return chosen;
}

/** 挑一个填充物 id（不在 exclude 集合里）。 */
function pickFiller(rng, exclude) {
  const pool = ITEMS.filter((i) => !exclude.has(i.id));
  if (!pool.length) return ITEMS[0].id;
  return pick(rng, pool).id;
}

/** 拒绝采样放置：不与已放置物品重叠。返回 {x,y} 或 null（多次失败放弃）。 */
function place(rng, items, s, region) {
  const minX = region.left + s;
  const maxX = region.right - s;
  const minY = region.top + s;
  const maxY = region.bottom - s;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    let ok = true;
    for (const it of items) {
      const dx = it.x - x;
      const dy = it.y - y;
      const minDist = (it.s + s) * 0.82;
      if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  return null;
}

export function generateLevel({ level = 1, seed = 1 } = {}) {
  const cfg = levelAt(level);
  const rng = mulberry32((seed >>> 0) + level * 2654435761);
  const scale = cfg.scale;
  const region = { left: WORLD.PLAY_LEFT, right: WORLD.PLAY_RIGHT, top: WORLD.PLAY_TOP, bottom: WORLD.PLAY_BOTTOM };

  const targetIds = pickTargets(rng, cfg.targetCount);
  const targetSet = new Set(targetIds);
  const checklist = targetIds.map((id) => ({ itemId: id, need: cfg.copies, found: 0 }));

  const items = [];
  let nextId = 1;

  // 1) 目标物（每类 copies 份，variant 0 = 正品）
  for (const id of targetIds) {
    const def = itemById(id);
    const s = def.s * scale;
    for (let c = 0; c < cfg.copies; c += 1) {
      const p = place(rng, items, s, region);
      if (p) items.push({ id: nextId++, itemId: id, x: p.x, y: p.y, s, variant: 0, isTarget: true, isDecoy: false, found: false });
    }
  }

  // 2) 真假孪生诱饵（variant 1 = 少一个细节；只孪生目标物）
  for (const id of targetIds) {
    if (rng() >= cfg.decoyRate) continue;
    const def = itemById(id);
    const s = def.s * scale;
    const p = place(rng, items, s, region);
    if (p) items.push({ id: nextId++, itemId: id, x: p.x, y: p.y, s, variant: 1, isTarget: false, isDecoy: true, found: false });
  }

  // 3) 填充物（非目标、非诱饵，凑密度）
  while (items.length < cfg.density) {
    const id = pickFiller(rng, targetSet);
    const def = itemById(id);
    const s = def.s * scale;
    const p = place(rng, items, s, region);
    if (p) items.push({ id: nextId++, itemId: id, x: p.x, y: p.y, s, variant: 0, isTarget: false, isDecoy: false, found: false });
    else break;
  }

  return {
    level,
    scenePack: cfg.scenePack,
    timeSec: cfg.timeSec,
    scale,
    checklist,
    items,
    decoys: items.filter((i) => i.isDecoy).length,
    targetOnField: targetIds.every((id) => items.filter((i) => i.isTarget && i.itemId === id).length >= cfg.copies),
  };
}
