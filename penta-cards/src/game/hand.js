// src/game/hand.js — 胡牌判定 / 听牌 / 向听数 / 番数（纯逻辑，不碰 DOM）。
// 还原源码 gamemgr_kwx.js + mjutils.js 的核心规则（见 docs/analysis.md）。
// 牌 id：0-8 星、9-17 轨、27-29 三元。
import { BASE_FAN, BONUS_FAN, MAX_FAN, KAWUXING_TILES } from '../../config/rules.js';

// ---------------------------------------------------------------------------
// 向听数（shanten）：standard 4 副 + 1 对。返回 -1=已胡，0=听牌，… 8=最差。
// ---------------------------------------------------------------------------

function evalShanten(melds, sets, partials, pair) {
  const totalSets = Math.min(melds + sets, 4);
  const capPartial = Math.min(partials, 4 - totalSets);
  return 8 - 2 * totalSets - capPartial - (pair ? 1 : 0);
}

function dfsShanten(c, idx, melds, sets, partials, pair) {
  while (idx <= 29 && c[idx] === 0) idx += 1;
  let best = evalShanten(melds, sets, partials, pair);
  if (best <= -1) return -1;
  if (idx > 29) return best;

  const v = c[idx];

  // 完整刻子
  if (v >= 3) {
    c[idx] -= 3;
    best = Math.min(best, dfsShanten(c, idx, melds, sets + 1, partials, pair));
    c[idx] += 3;
  }

  // 完整顺子（星/轨，跨花色用 %9 天然挡住 8→9 越界）
  if (idx < 18 && idx % 9 <= 6 && c[idx + 1] > 0 && c[idx + 2] > 0) {
    c[idx] -= 1; c[idx + 1] -= 1; c[idx + 2] -= 1;
    best = Math.min(best, dfsShanten(c, idx, melds, sets + 1, partials, pair));
    c[idx] += 1; c[idx + 1] += 1; c[idx + 2] += 1;
  }

  // 部分刻子（两张相同）
  if (v >= 2) {
    c[idx] -= 2;
    best = Math.min(best, dfsShanten(c, idx, melds, sets, partials + 1, pair));
    c[idx] += 2;
  }

  // 部分顺子（相邻）
  if (idx < 18 && idx % 9 <= 7 && c[idx + 1] > 0) {
    c[idx] -= 1; c[idx + 1] -= 1;
    best = Math.min(best, dfsShanten(c, idx, melds, sets, partials + 1, pair));
    c[idx] += 1; c[idx + 1] += 1;
  }

  // 部分顺子（跳张）
  if (idx < 18 && idx % 9 <= 6 && c[idx + 2] > 0) {
    c[idx] -= 1; c[idx + 2] -= 1;
    best = Math.min(best, dfsShanten(c, idx, melds, sets, partials + 1, pair));
    c[idx] += 1; c[idx + 2] += 1;
  }

  // 跳过孤张
  best = Math.min(best, dfsShanten(c, idx + 1, melds, sets, partials, pair));
  return best;
}

/** shanten：holds 计数 + 已碰杠的副数 melds。 */
export function shanten(count, melds = 0) {
  const c = Int8Array.from(count);
  let best = 8 - 2 * melds;
  for (let p = 0; p <= 29; p += 1) {
    if (c[p] >= 2) {
      c[p] -= 2;
      best = Math.min(best, dfsShanten(c, 0, melds, 0, 0, 1));
      c[p] += 2;
    }
  }
  best = Math.min(best, dfsShanten(c, 0, melds, 0, 0, 0));
  return best;
}

// ---------------------------------------------------------------------------
// 精确胡牌判定
// ---------------------------------------------------------------------------

function canFormSets(c, idx, needSets) {
  while (idx <= 29 && c[idx] === 0) idx += 1;
  if (needSets === 0) return idx > 29;
  if (idx > 29) return false;

  const v = c[idx];
  if (v >= 3) {
    c[idx] -= 3;
    if (canFormSets(c, idx, needSets - 1)) { c[idx] += 3; return true; }
    c[idx] += 3;
  }
  if (idx < 18 && idx % 9 <= 6 && c[idx + 1] > 0 && c[idx + 2] > 0) {
    c[idx] -= 1; c[idx + 1] -= 1; c[idx + 2] -= 1;
    if (canFormSets(c, idx, needSets - 1)) { c[idx] += 1; c[idx + 1] += 1; c[idx + 2] += 1; return true; }
    c[idx] += 1; c[idx + 1] += 1; c[idx + 2] += 1;
  }
  return false;
}

/** 标准胡：needSets 副 + 1 对。count 已含胡牌张。 */
export function canWinStandard(count, melds = 0) {
  const needSets = 4 - melds;
  const c = Int8Array.from(count);
  for (let p = 0; p <= 29; p += 1) {
    if (c[p] >= 2) {
      c[p] -= 2;
      if (canFormSets(c, 0, needSets)) { c[p] += 2; return true; }
      c[p] += 2;
    }
  }
  return false;
}

/** 对对胡：只用刻子（无顺子）。 */
export function canWinTriplets(count, melds = 0) {
  const needSets = 4 - melds;
  const c = Int8Array.from(count);
  for (let p = 0; p <= 29; p += 1) {
    if (c[p] >= 2) {
      c[p] -= 2;
      if (canFormTripletsOnly(Int8Array.from(c), needSets)) { c[p] += 2; return true; }
      c[p] += 2;
    }
  }
  return false;
}

function canFormTripletsOnly(c, needSets) {
  for (let i = 0; i <= 29 && needSets > 0; i += 1) {
    if (c[i] === 0) continue;
    if (c[i] >= 3) {
      const take = Math.min(Math.floor(c[i] / 3), needSets);
      c[i] -= take * 3;
      needSets -= take;
      i -= 1; // 再检查同一张（c[i] 可能还有 3）
    } else {
      return false;
    }
  }
  return needSets === 0;
}

/** 七对（无碰杠，14 张成 7 对）。 */
export function isSevenPairs(count) {
  let total = 0;
  for (let i = 0; i <= 29; i += 1) {
    total += count[i];
    if (count[i] !== 0 && count[i] !== 2 && count[i] !== 4) return false;
  }
  return total === 14;
}

/** 胡牌类型：'7pairs' | 'duidui' | 'normal' | null。 */
export function winPattern(count, melds = 0) {
  if (melds === 0 && isSevenPairs(count)) return '7pairs';
  if (canWinTriplets(count, melds)) return 'duidui';
  if (canWinStandard(count, melds)) return 'normal';
  return null;
}

/** 听牌列表：holds 打出任意一张后能胡的牌（0-29，仅三种花色）。 */
export function tingList(holds, melds = 0) {
  const base = countOf(holds);
  const waits = [];
  for (let t = 0; t <= 29; t += 1) {
    if (t >= 18 && t <= 26) continue; // 无万
    if (t >= 27 && t > 29) continue;
    if (t >= 30) continue;
    base[t] += 1;
    if (winPattern(base, melds)) waits.push(t);
    base[t] -= 1;
  }
  return waits;
}

export function countOf(holds) {
  const c = new Int8Array(30);
  for (const t of holds) c[t] += 1;
  return c;
}

// ---------------------------------------------------------------------------
// 番数
// ---------------------------------------------------------------------------

function isQingYiSe(holds, meldTiles) {
  let suit = -1;
  for (const t of holds) {
    const s = t < 9 ? 0 : t < 18 ? 1 : 2;
    if (suit === -1) suit = s;
    else if (suit !== s) return false;
  }
  for (const t of meldTiles) {
    const s = t < 9 ? 0 : t < 18 ? 1 : 2;
    if (suit === -1) suit = s;
    else if (suit !== s) return false;
  }
  return true;
}

function honorCounts(holds, meldTiles) {
  const out = [0, 0, 0];
  for (const t of holds) if (t >= 27 && t <= 29) out[t - 27] += 1;
  for (const t of meldTiles) if (t >= 27 && t <= 29) out[t - 27] += 3;
  return out;
}

function isDaSanYuan(honors) {
  return honors[0] >= 3 && honors[1] >= 3 && honors[2] >= 3;
}
function isXiaoSanYuan(honors) {
  const trips = honors.filter((n) => n >= 3).length;
  const pair = honors.filter((n) => n === 2).length;
  return trips === 2 && pair === 1;
}

function isKaWuXing(countWithWin, winTile) {
  if (!KAWUXING_TILES.includes(winTile)) return false;
  return countWithWin[winTile - 1] > 0 && countWithWin[winTile + 1] > 0;
}

function isMingSiGui(count, pengs) {
  for (const p of pengs) if (count[p] === 1) return true;
  return false;
}

function isAnSiGui(count) {
  for (let i = 0; i <= 29; i += 1) if (count[i] === 4) return true;
  return false;
}

function isSanYuan7Pairs(count) {
  return count[27] >= 2 && count[28] >= 2 && count[29] >= 2;
}

/**
 * 计算番数。opts: { isZimo, gangBonus(杠开/杠上炮/抢杠), hasMingPai, isHaiDi, type }
 * countWithWin：含胡牌张的计数。holdsLenBeforeWin：胡牌前手牌数（含副），用于手抓一。
 * meldTiles：碰/杠的牌（每副算 1 张代表）。
 */
export function computeFan({
  countWithWin, winTile, pattern, meldTiles = [], pengs = [],
  holdsLen, gangBonus = false, hasMingPai = false, isHaiDi = false, type = 'xykwx',
}) {
  let fan = BASE_FAN[pattern] ?? 0;
  const holds = []; // 从 countWithWin 重建用于清一色（近似）
  for (let i = 0; i <= 29; i += 1) for (let k = 0; k < countWithWin[i]; k += 1) holds.push(i);

  if (isQingYiSe(holds, meldTiles)) fan += BONUS_FAN.qingyise;
  if (holdsLen <= 2) fan += BONUS_FAN.jingouhu; // 手抓一

  if (pattern === '7pairs') {
    let dragon = 0;
    for (let i = 0; i <= 29; i += 1) if (countWithWin[i] === 4) dragon += 1;
    if (dragon === 3) fan += 5;
    else if (dragon === 2) fan += 3;
    else if (isSanYuan7Pairs(countWithWin)) fan += 3;
    else if (dragon === 1) fan += 1;
  } else {
    const honors = honorCounts(holds, meldTiles);
    if (isDaSanYuan(honors)) fan += BONUS_FAN.dasanyuan;
    else if (isXiaoSanYuan(honors)) fan += BONUS_FAN.xiaosanyuan;

    if (isKaWuXing(countWithWin, winTile)) {
      fan += type === 'sykwx' ? 2 : BONUS_FAN.kawuxing;
    }

    if (isMingSiGui(countWithWin, pengs)) fan += BONUS_FAN.mingsigui;
    else if (isAnSiGui(countWithWin)) fan += BONUS_FAN.ansigui;
  }

  if (isHaiDi) fan += BONUS_FAN.haidi;
  if (hasMingPai) fan += BONUS_FAN.mingpai;
  if (gangBonus) fan += BONUS_FAN.gang;

  return Math.max(0, Math.min(MAX_FAN, fan));
}

/** 番 → 分（2^fan × baseScore）。 */
export function fanScore(fan, baseScore) {
  return (1 << Math.max(0, Math.min(MAX_FAN, fan))) * baseScore;
}
