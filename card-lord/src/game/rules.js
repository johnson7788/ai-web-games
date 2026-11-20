// src/game/rules.js — 牌型判定 + 压牌（斗地主标准规则，纯逻辑）
// 牌型枚举与源码 1:1；修正源码 4 张分支缺失 isThreeWithOne 的 bug。
import { sortHand } from './cards.js';

export const K = {
  ONE: 1,
  PAIRS: 2,
  THREE: 3,
  THREE_ONE: 4,
  THREE_PAIRS: 5,
  STRAIGHT: 6,
  STRAIGHT_PAIRS: 7,
  PLANE: 8,
  PLANE_ONE: 9,
  PLANE_PAIRS: 10,
  FOUR_TWO: 11,
  FOUR_TWO_PAIRS: 12,
  BOMB: 13,
  ROCKET: 14,
};

export const KIND_NAME = {
  [K.ONE]: 'single',
  [K.PAIRS]: 'pair',
  [K.THREE]: 'triple',
  [K.THREE_ONE]: 'triple+1',
  [K.THREE_PAIRS]: 'triple+pair',
  [K.STRAIGHT]: 'straight',
  [K.STRAIGHT_PAIRS]: 'straight-pairs',
  [K.PLANE]: 'plane',
  [K.PLANE_ONE]: 'plane+1',
  [K.PLANE_PAIRS]: 'plane+pairs',
  [K.FOUR_TWO]: 'four+2',
  [K.FOUR_TWO_PAIRS]: 'four+2pairs',
  [K.BOMB]: 'bomb',
  [K.ROCKET]: 'rocket',
};

// 点数统计（升序）
export function valCount(cards) {
  const map = new Map();
  for (const c of cards) map.set(c.rank, (map.get(c.rank) || 0) + 1);
  const out = [];
  for (const [rank, count] of map) out.push({ rank, count });
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

function getMaxValOf(cards, n) {
  const vc = valCount(cards);
  let max = 0;
  for (const g of vc) if (g.count === n && g.rank > max) max = g.rank;
  return max;
}

function consecutiveRanks(groups, from = 0) {
  for (let i = from; i < groups.length - 1; i += 1) {
    if (groups[i].rank + 1 !== groups[i + 1].rank) return false;
  }
  return true;
}

function isStraight(sorted, n) {
  if (n < 5 || n > 12) return false;
  if (sorted.some((c) => c.rank >= 15)) return false; // 2 / 王不进顺
  for (let i = 0; i < n - 1; i += 1) {
    if (sorted[i].rank !== sorted[i + 1].rank + 1) return false;
  }
  return true;
}

function isStraightPairs(sorted, n) {
  if (n < 6 || n > 20 || n % 2 !== 0) return false;
  const vc = valCount(sorted);
  if (vc.length !== n / 2) return false;
  for (const g of vc) if (g.count !== 2 || g.rank >= 15) return false;
  return consecutiveRanks(vc);
}

function isPlane(sorted, n) {
  if (n < 6 || n % 3 !== 0) return false;
  const vc = valCount(sorted);
  if (vc.length !== n / 3) return false;
  for (const g of vc) if (g.count !== 3 || g.rank >= 15) return false;
  return consecutiveRanks(vc);
}

function isThreePairs(sorted, n) {
  if (n !== 5) return false;
  const vc = valCount(sorted);
  if (vc.length !== 2) return false;
  return (vc[0].count === 3 && vc[1].count === 2) || (vc[0].count === 2 && vc[1].count === 3);
}

function isPlaneOne(sorted, n) {
  if (n < 8 || n % 4 !== 0) return false;
  const N = n / 4;
  const vc = valCount(sorted);
  const triples = vc.filter((g) => g.count === 3);
  const singles = vc.filter((g) => g.count === 1);
  if (triples.length !== N || singles.length !== N || vc.length !== 2 * N) return false;
  for (const g of triples) if (g.rank >= 15) return false;
  return consecutiveRanks(triples);
}

function isPlanePairs(sorted, n) {
  if (n < 10 || n % 5 !== 0) return false;
  const N = n / 5;
  const vc = valCount(sorted);
  const triples = vc.filter((g) => g.count === 3);
  const pairs = vc.filter((g) => g.count === 2);
  if (triples.length !== N || pairs.length !== N || vc.length !== 2 * N) return false;
  for (const g of triples) if (g.rank >= 15) return false;
  return consecutiveRanks(triples);
}

function isFourTwo(sorted, n) {
  if (n !== 6) return false;
  const vc = valCount(sorted);
  return vc.some((g) => g.count === 4);
}

function isFourTwoPairs(sorted, n) {
  if (n !== 8) return false;
  const vc = valCount(sorted);
  const four = vc.some((g) => g.count === 4);
  const twoPairs = vc.filter((g) => g.count === 2).length === 2;
  return four && twoPairs && vc.length === 3;
}

/** 判定一手牌：合法返回 { kind, val, size }，非法返回 null。 */
export function typeJudge(cards) {
  if (!cards || cards.length === 0) return null;
  const sorted = sortHand(cards);
  const n = sorted.length;
  if (n === 1) return { kind: K.ONE, val: sorted[0].rank, size: 1 };
  if (n === 2) {
    if (sorted[0].rank === sorted[1].rank) return { kind: K.PAIRS, val: sorted[0].rank, size: 2 };
    const ranks = sorted.map((c) => c.rank);
    if (ranks.includes(16) && ranks.includes(17)) return { kind: K.ROCKET, val: 17, size: 2 };
    return null;
  }
  if (n === 3) {
    if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
      return { kind: K.THREE, val: sorted[0].rank, size: 3 };
    }
    return null;
  }
  if (n === 4) {
    const vc = valCount(sorted);
    if (vc.length === 1 && vc[0].count === 4) return { kind: K.BOMB, val: vc[0].rank, size: 4 };
    if (vc.length === 2 && (vc[0].count === 3 || vc[1].count === 3)) {
      return { kind: K.THREE_ONE, val: getMaxValOf(sorted, 3), size: 4 };
    }
    return null;
  }

  if (isStraight(sorted, n)) return { kind: K.STRAIGHT, val: sorted[0].rank, size: n };
  if (isStraightPairs(sorted, n)) return { kind: K.STRAIGHT_PAIRS, val: sorted[0].rank, size: n };
  if (isPlane(sorted, n)) return { kind: K.PLANE, val: getMaxValOf(sorted, 3), size: n };
  if (isThreePairs(sorted, n)) return { kind: K.THREE_PAIRS, val: getMaxValOf(sorted, 3), size: n };
  if (isPlaneOne(sorted, n)) return { kind: K.PLANE_ONE, val: getMaxValOf(sorted, 3), size: n };
  if (isPlanePairs(sorted, n)) return { kind: K.PLANE_PAIRS, val: getMaxValOf(sorted, 3), size: n };
  if (isFourTwo(sorted, n)) return { kind: K.FOUR_TWO, val: getMaxValOf(sorted, 4), size: n };
  if (isFourTwoPairs(sorted, n)) return { kind: K.FOUR_TWO_PAIRS, val: getMaxValOf(sorted, 4), size: n };
  return null;
}

/** prev 为当前牌池最大牌（typeJudge 结果或 null），cur 为要出的牌（typeJudge 结果）。 */
export function canBeat(prev, cur) {
  if (!cur) return false;
  if (cur.kind === K.ROCKET) return !prev || prev.kind !== K.ROCKET;
  if (cur.kind === K.BOMB) {
    if (!prev) return true;
    if (prev.kind === K.ROCKET) return false;
    if (prev.kind === K.BOMB) return cur.val > prev.val;
    return true;
  }
  if (!prev) return true; // 领出
  if (prev.kind === K.BOMB || prev.kind === K.ROCKET) return false;
  return cur.kind === prev.kind && cur.size === prev.size && cur.val > prev.val;
}
