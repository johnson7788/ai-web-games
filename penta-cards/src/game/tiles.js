// src/game/tiles.js — 牌面工具（纯逻辑，不碰 DOM）。牌 id：0-8 星、9-17 轨、27-29 三元。
import { SUITS, HONOR_NAMES, suitOf } from '../../config/rules.js';

export const NUM_SUITS = 2; // 星 / 轨 可组成顺子；三元只能成刻。

export function rankOf(id) {
  if (id < 27) return (id % 9) + 1;
  return null;
}

export function tileName(id, lang = 'en') {
  if (id >= 27 && id <= 29) return HONOR_NAMES[id];
  const s = suitOf(id);
  const r = rankOf(id);
  return `${SUITS[s].labelKey}.${r}`;
}

export function suitLabelKey(id) {
  return SUITS[suitOf(id)].labelKey;
}

/** 是否可组成顺子（星/轨数字牌）。 */
export function isNumberTile(id) {
  return id >= 0 && id < 18;
}

/** 计数：holds → Int8Array(30) */
export function countMap(holds) {
  const c = new Int8Array(30);
  for (const t of holds) c[t] += 1;
  return c;
}

export function countTotal(count) {
  let n = 0;
  for (let i = 0; i < 30; i += 1) n += count[i];
  return n;
}

/** 排序（星/轨按数字，三元靠后）。 */
export function sortTiles(holds) {
  return holds.slice().sort((a, b) => a - b);
}

/** 七对判定：无碰杠且 14 张 = 7 对。 */
export function isSevenPairs(count) {
  let total = 0;
  for (let i = 0; i < 30; i += 1) {
    total += count[i];
    if (count[i] !== 0 && count[i] !== 2 && count[i] !== 4) return false;
  }
  return total === 14;
}

/** 三元牌数量（27/28/29 各计持有+碰杠）。 */
export function honorCounts(seat, count) {
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    const id = 27 + i;
    out[i] = (count[id] || 0)
      + (seat.pengs.includes(id) ? 3 : 0)
      + (seat.gangs.includes(id) ? 4 : 0);
  }
  return out;
}
