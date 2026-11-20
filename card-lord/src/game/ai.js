// src/game/ai.js — 贪心 AI（叫分评分 + 手牌拆解 + 同型最小压牌 + 队友配合），skill 0..1 量化难度。
// 纯逻辑：不碰 DOM / Math.random / Date.now。
import { K, typeJudge, valCount } from './rules.js';
import { sortHand } from './cards.js';
import { AI } from '../../config/gameplay.js';

function rankGroups(hand) {
  const map = new Map();
  for (const c of hand) {
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank).push(c);
  }
  return map;
}

function hasRocket(hand) {
  const ranks = new Set(hand.map((c) => c.rank));
  return ranks.has(16) && ranks.has(17);
}

// 叫分评分：火箭8 / 炸弹6 / 大王4 / 小王3 / 每张2记2
export function bidScore(hand) {
  const groups = rankGroups(hand);
  let score = 0;
  if (hasRocket(hand)) score += AI.bidWeights.rocket;
  else {
    if (groups.has(17)) score += AI.bidWeights.bigJoker;
    if (groups.has(16)) score += AI.bidWeights.smallJoker;
  }
  for (const [rank, cards] of groups) {
    if (cards.length === 4) score += AI.bidWeights.bomb;
    if (rank === 15) score += AI.bidWeights.two * cards.length;
  }
  return score;
}

export function chooseBid(hand, skill = 0.5) {
  const score = bidScore(hand);
  const pad = AI.bidSkillPad * (1 - skill);
  if (score >= AI.bidThresholds[0] + pad) return 3;
  if (score >= AI.bidThresholds[1] + pad) return 2;
  if (score >= AI.bidThresholds[2] + pad) return 1;
  return 0;
}

export function chooseDouble(hand, skill = 0.5) {
  const score = bidScore(hand);
  const threshold = 10 - 5 * skill;
  return score >= threshold;
}

// ---------- 最小/最大牌查找 ----------

function minRankGroup(groups, v, minCount, exclude4 = false) {
  let best = null;
  for (const [rank, cards] of groups) {
    if (rank <= v) continue;
    if (cards.length < minCount) continue;
    if (exclude4 && cards.length === 4) continue;
    if (!best || rank < best.rank) best = { rank, cards };
  }
  return best;
}

function maxRankGroup(groups, v, minCount, exclude4 = false) {
  let best = null;
  for (const [rank, cards] of groups) {
    if (rank <= v) continue;
    if (cards.length < minCount) continue;
    if (exclude4 && cards.length === 4) continue;
    if (!best || rank > best.rank) best = { rank, cards };
  }
  return best;
}

function pickKickers(hand, excludedRanks, n) {
  const groups = rankGroups(hand);
  const singles = [];
  const pairs = [];
  for (const [rank, cards] of groups) {
    if (excludedRanks.includes(rank)) continue;
    if (cards.length === 4) continue;
    if (cards.length >= 3) continue;
    if (cards.length === 1) singles.push(cards[0]);
    else if (cards.length === 2) pairs.push(cards[0]);
  }
  const asc = (a, b) => a.rank - b.rank;
  singles.sort(asc);
  pairs.sort(asc);
  const pool = singles.concat(pairs);
  if (pool.length < n) return null;
  return pool.slice(0, n);
}

function pickPairs(hand, excludedRanks, n) {
  const groups = rankGroups(hand);
  const pairs = [];
  for (const [rank, cards] of groups) {
    if (excludedRanks.includes(rank)) continue;
    if (cards.length === 2) pairs.push({ rank, cards });
  }
  pairs.sort((a, b) => a.rank - b.rank);
  if (pairs.length < n) return null;
  return pairs.slice(0, n).flatMap((p) => p.cards);
}

function findConsecutive(groups, len, v, minCount) {
  const maxRank = 14;
  for (let start = Math.max(3, v - len + 2); start + len - 1 <= maxRank; start += 1) {
    let ok = true;
    const picked = [];
    for (let r = start; r < start + len; r += 1) {
      const g = groups.get(r);
      if (!g || g.length < minCount) { ok = false; break; }
      picked.push(g.slice(0, minCount));
    }
    if (ok) return picked.flat();
  }
  return null;
}

function findStraight(hand, v, len) { return findConsecutive(rankGroups(hand), len, v, 1); }
function findStraightPairs(hand, v, len) { return findConsecutive(rankGroups(hand), len, v, 2); }
function findPlane(hand, v, len) { return findConsecutive(rankGroups(hand), len, v, 3); }

function findBomb(hand, v) {
  const g = minRankGroup(rankGroups(hand), v, 4, false);
  return g ? g.cards : null;
}

// 队友/地主判断
function isFarmer(seat, ctx) { return ctx && seat !== ctx.landlord; }
function partnerPlayed(seat, ctx) {
  return ctx && ctx.lastPlaySeat >= 0 && ctx.lastPlaySeat !== seat && ctx.lastPlaySeat !== ctx.landlord;
}

// ---------- 领出 ----------

export function chooseLead(hand, skill = 0.5, ctx = null) {
  const whole = typeJudge(hand);
  if (whole) return hand.slice();

  const sorted = sortHand(hand);
  const groups = rankGroups(hand);

  // 低顺子（含最小牌且不太大）优先甩掉长链
  if (skill >= 0.3) {
    for (let len = 5; len <= 12; len += 1) {
      const st = findStraight(hand, 0, len);
      if (st && Math.max(...st.map((c) => c.rank)) <= 11) return st;
    }
  }
  if (skill >= 0.35) {
    for (let len = 3; len <= 8; len += 1) {
      const sp = findStraightPairs(hand, 0, len);
      if (sp && Math.max(...sp.map((c) => c.rank)) <= 11) return sp;
    }
  }
  if (skill >= 0.4) {
    for (let len = 2; len <= 4; len += 1) {
      const pl = findPlane(hand, 0, len);
      if (pl && Math.max(...pl.map((c) => c.rank)) <= 11) return pl;
    }
  }

  const triple = minRankGroup(groups, 0, 3, true);
  if (triple) {
    if (skill >= 0.25) {
      const kicker = pickKickers(hand, [triple.rank], 1);
      if (kicker) return triple.cards.concat(kicker);
    }
    return triple.cards;
  }

  const pair = minRankGroup(groups, 0, 2, true);
  if (pair) return pair.cards;

  return [sorted[sorted.length - 1]];
}

// ---------- 跟牌 ----------

function findBeater(hand, prev, skill) {
  const groups = rankGroups(hand);
  const v = prev.val;
  const size = prev.size;

  switch (prev.kind) {
    case K.ONE: {
      const g = minRankGroup(groups, v, 1);
      if (g) return g.cards.slice(0, 1);
      if (skill >= 0.4) {
        const pair = minRankGroup(groups, v, 2);
        if (pair) return pair.cards.slice(0, 1);
        const tri = minRankGroup(groups, v, 3, true);
        if (tri) return tri.cards.slice(0, 1);
      }
      return null;
    }
    case K.PAIRS: {
      const g = minRankGroup(groups, v, 2, true);
      if (g) return g.cards.slice(0, 2);
      if (skill >= 0.5) {
        const tri = minRankGroup(groups, v, 3, true);
        if (tri) return tri.cards.slice(0, 2);
      }
      return null;
    }
    case K.THREE: {
      const g = minRankGroup(groups, v, 3, true);
      return g ? g.cards : null;
    }
    case K.THREE_ONE: {
      const tri = minRankGroup(groups, v, 3, true);
      if (tri) {
        const kicker = pickKickers(hand, [tri.rank], 1);
        if (kicker) return tri.cards.concat(kicker);
      }
      return null;
    }
    case K.THREE_PAIRS: {
      const tri = minRankGroup(groups, v, 3, true);
      if (tri) {
        const pair = pickPairs(hand, [tri.rank], 1);
        if (pair) return tri.cards.concat(pair);
      }
      return null;
    }
    case K.STRAIGHT: {
      return v < 14 ? findStraight(hand, v, size) : null;
    }
    case K.STRAIGHT_PAIRS: {
      return v < 14 ? findStraightPairs(hand, v, size / 2) : null;
    }
    case K.PLANE: {
      return v < 14 ? findPlane(hand, v, size / 3) : null;
    }
    case K.PLANE_ONE: {
      if (v >= 14) return null;
      const pl = findPlane(hand, v, size / 4);
      if (pl) {
        const ranks = [...new Set(pl.map((c) => c.rank))];
        const kickers = pickKickers(hand, ranks, size / 4);
        if (kickers) return pl.concat(kickers);
      }
      return null;
    }
    case K.PLANE_PAIRS: {
      if (v >= 14) return null;
      const pl = findPlane(hand, v, size / 5);
      if (pl) {
        const ranks = [...new Set(pl.map((c) => c.rank))];
        const pairs = pickPairs(hand, ranks, size / 5);
        if (pairs) return pl.concat(pairs);
      }
      return null;
    }
    case K.FOUR_TWO: {
      const four = minRankGroup(groups, v, 4);
      if (four) {
        const kickers = pickKickers(hand, [four.rank], 2);
        if (kickers) return four.cards.concat(kickers);
      }
      return null;
    }
    case K.FOUR_TWO_PAIRS: {
      const four = minRankGroup(groups, v, 4);
      if (four) {
        const pairs = pickPairs(hand, [four.rank], 2);
        if (pairs) return four.cards.concat(pairs);
      }
      return null;
    }
    case K.BOMB: {
      const bomb = findBomb(hand, v);
      if (bomb) return bomb;
      if (hasRocket(hand)) return [rankGroups(hand).get(16)[0], rankGroups(hand).get(17)[0]];
      return null;
    }
    case K.ROCKET:
      return null;
    default:
      return null;
  }
}

function shouldBomb(hand, prev, skill, ctx) {
  if (prev.kind === K.BOMB || prev.kind === K.ROCKET) return false;
  if (skill < 0.4) return false;
  // 地主/对手即将出完，或自己即将出完 → 用炸弹
  if (ctx) {
    const oppCount = ctx.handCounts ? ctx.handCounts[ctx.landlord] : 99;
    if (oppCount <= 2) return true;
  }
  const groups = rankGroups(hand);
  const bombs = [...groups.values()].filter((c) => c.length === 4).length;
  return hand.length <= AI.bombShortCards && (bombs > 0 || hasRocket(hand));
}

export function chooseFollow(hand, prev, skill = 0.5, ctx = null) {
  if (!prev) return chooseLead(hand, skill, ctx);
  if (prev.kind === K.ROCKET) return null;

  const beater = findBeater(hand, prev, skill);

  // 农民配合：队友出的牌，不压（除非能直接出完或地主快出完）
  if (beater && ctx && ctx.seat !== ctx.landlord && partnerPlayed(ctx.seat, ctx)) {
    if (beater.length === hand.length) return beater; // 能赢
    const oppCount = ctx.handCounts ? ctx.handCounts[ctx.landlord] : 99;
    if (oppCount <= 2) return beater;
    return null;
  }

  if (beater) return beater;

  // 无同型可压 → 考虑炸弹/王炸
  if (shouldBomb(hand, prev, skill, ctx)) {
    const bomb = findBomb(hand, 0);
    if (bomb) return bomb;
    if (hasRocket(hand)) return [rankGroups(hand).get(16)[0], rankGroups(hand).get(17)[0]];
  }
  return null;
}

/** 提示：跟牌或领出（给 UI 用）。 */
export function hint(hand, prev, skill = 1, ctx = null) {
  return prev ? chooseFollow(hand, prev, skill, ctx) : chooseLead(hand, skill, ctx);
}

export function isBombPlay(cards) {
  const j = typeJudge(cards);
  return !!j && (j.kind === K.BOMB || j.kind === K.ROCKET);
}

export { valCount };
