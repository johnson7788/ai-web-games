// AI 决策：出牌 / 吃碰杠胡选择（greedy，供游戏内 AI 与 selfplay 复用）
import { canWin, getListen } from './mahjong.js';
import { isHonor, isSuited } from './tiles.js';

// 一张牌与手牌中其它牌的「亲密度」：同牌 + 相邻牌越多越值得留
function friendsOf(tile, hand) {
  let f = 0;
  for (const t of hand) {
    if (t === tile) f += 1;
    else if (isSuited(tile) && isSuited(t) && Math.abs(t - tile) === 1) f += 1;
    else if (isSuited(tile) && isSuited(t) && Math.abs(t - tile) === 2) f += 1;
  }
  return f;
}

/**
 * 最佳出牌：打掉「让剩余手牌听牌数最多」的那张（绝不打金）。
 * 分数 = 剩余听牌数 ×100 - 亲密度，越大越该打。
 */
export function bestDiscard(hand, joker) {
  const unique = [...new Set(hand.filter((t) => t !== joker))];
  if (unique.length === 0) return hand[0];
  let best = unique[0];
  let bestScore = -Infinity;
  for (const tile of unique) {
    const idx = hand.indexOf(tile);
    const hand2 = hand.slice(0, idx).concat(hand.slice(idx + 1));
    const listen = getListen(hand2, joker).length;
    const score = listen * 100 - friendsOf(tile, hand);
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

/**
 * 出牌决策：skill 概率走最优，否则随机打一张非金。
 */
export function decideDiscard(hand, joker, rng, skill = 0.7) {
  if (rng && rng() > skill) {
    const nonJoker = hand.filter((t) => t !== joker);
    if (nonJoker.length === 0) return hand[0];
    return nonJoker[Math.floor(rng() * nonJoker.length)];
  }
  return bestDiscard(hand, joker);
}

/**
 * 吃碰杠胡决策（优先级与源码机器人一致：胡 > 杠 > 碰 > 吃 > 过）。
 * @param avail {canHu, canKong, canPong, canEat, eatOptions}
 */
export function decideAction(avail, rng) {
  if (avail.canHu) return { act: 'hu' };
  if (avail.canKong) return { act: 'kong' };
  if (avail.canPong) return { act: 'pong' };
  if (avail.canEat) {
    let idx = 0;
    if (avail.eatOptions && avail.eatOptions.length > 1 && rng) {
      idx = Math.floor(rng() * avail.eatOptions.length);
    }
    return { act: 'eat', eatIndex: idx };
  }
  return { act: 'pass' };
}

/**
 * 提示：返回推荐打出的牌 + 当前听牌列表。
 */
export function hintInfo(hand, joker) {
  return {
    discard: bestDiscard(hand, joker),
    listen: getListen(hand, joker),
  };
}
