// src/game/ai.js — 敌方 AI + 玩家 greedy bot 共享的纯决策函数（零 DOM，可 node 直测）。
// AI 强度由 level.aiStrength 映射：<0.45 纯贪心、≥0.45 一步前瞻、≥0.55 会滴营养、≥0.62 会放噬菌体。
// 玩家 bot（selfplay 用）始终全工具箱 + 一步前瞻，保证可打败前 3 皿的弱 AI。
import { OWNER } from '../../config/gameplay.js';
import { listFrontier, neighbors, resolveInfect, resolvePhage, inBounds } from './board.js';

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ o: cell.o, d: cell.d })));
}

/** 模拟一次感染，返回 { r, c, gain, power }（gain = 占领格数）。 */
export function evaluateInfect(board, size, r, c, side, auraBonus = 0) {
  const copy = cloneBoard(board);
  const res = resolveInfect(copy, size, r, c, side, auraBonus);
  return { r, c, gain: res.captured.length, power: res.power };
}

/**
 * 最佳感染格。
 * opts: { lookahead, rng, noise }
 * lookahead=true 时，得分减去对手最佳回应 gain * PENALTY（一步前瞻）。
 */
export function bestInfect(board, size, side, aura = null, opts = {}) {
  const frontier = listFrontier(board, size, side);
  const oppSide = side === OWNER.PLAYER ? OWNER.ENEMY : OWNER.PLAYER;
  let best = null;
  for (const [r, c] of frontier) {
    const auraBonus = aura ? aura[r][c] : 0;
    const res = evaluateInfect(board, size, r, c, side, auraBonus);
    let score = res.gain * 100 + res.power;
    if (opts.lookahead) {
      const copy = cloneBoard(board);
      resolveInfect(copy, size, r, c, side, auraBonus);
      const oppBest = bestInfect(copy, size, oppSide, null, { lookahead: false });
      score -= (oppBest ? oppBest.gain : 0) * 40;
    }
    if (opts.rng) score += opts.rng() * (opts.noise ?? 0);
    if (!best || score > best.score) best = { r, c, gain: res.gain, power: res.power, score };
  }
  return best;
}

/** 最佳营养滴位置：aura（目标格 + 4 邻）覆盖最多前沿格。 */
export function bestNutrient(board, size, side) {
  const frontier = new Set(listFrontier(board, size, side).map(([r, c]) => `${r},${c}`));
  let best = null;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (board[r][c].o === OWNER.VOID) continue;
      let cover = 0;
      const cells = [[r, c], ...neighbors(size, r, c)];
      for (const [ar, ac] of cells) if (frontier.has(`${ar},${ac}`)) cover += 1;
      if (!best || cover > best.cover) best = { r, c, cover };
    }
  }
  return best;
}

/** 最佳噬菌体锚点：2×2 内 oppSide 格最多。 */
export function bestPhage(board, size, oppSide, phSize = 2) {
  let best = null;
  for (let r = 0; r <= size - phSize; r += 1) {
    for (let c = 0; c <= size - phSize; c += 1) {
      let count = 0;
      for (let dr = 0; dr < phSize; dr += 1) {
        for (let dc = 0; dc < phSize; dc += 1) {
          if (board[r + dr][c + dc].o === oppSide) count += 1;
        }
      }
      if (!best || count > best.count) best = { r, c, count };
    }
  }
  return best;
}

export function aiFlags(strength) {
  return {
    lookahead: strength >= 0.45,
    nutrient: strength >= 0.55,
    phage: strength >= 0.62,
  };
}

/**
 * 敌方 AI 决策：返回 { kind: 'infect'|'nutrient'|'phage', r, c } 或 null（无路可走）。
 * 敌方有自己的营养/噬菌体资源（run.enemyNutrientAvailable / run.enemyPhage）。
 */
export function chooseEnemyAction(run) {
  const side = OWNER.ENEMY;
  const flags = aiFlags(run.level.aiStrength);

  if (flags.phage && run.enemyPhage.ready) {
    const ph = bestPhage(run.board, run.size, OWNER.PLAYER);
    if (ph && ph.count >= 3) return { kind: 'phage', r: ph.r, c: ph.c };
  }

  const best = bestInfect(run.board, run.size, side, null, {
    lookahead: flags.lookahead,
    rng: run.rng,
    noise: 25,
  });

  if (flags.nutrient && run.enemyNutrientAvailable && best && best.gain < 2) {
    const n = bestNutrient(run.board, run.size, side);
    if (n && n.cover >= 2) return { kind: 'nutrient', r: n.r, c: n.c };
  }

  if (best) return { kind: 'infect', r: best.r, c: best.c };
  return null;
}

/**
 * 玩家 greedy bot 决策（selfplay 用）：全工具箱 + 一步前瞻。
 * 这是「正常打法」参考：能赢前 3 皿。
 */
export function choosePlayerAction(run) {
  const side = OWNER.PLAYER;

  if (run.playerPhage.ready) {
    const ph = bestPhage(run.board, run.size, OWNER.ENEMY);
    if (ph && ph.count >= 3) return { kind: 'phage', r: ph.r, c: ph.c };
  }

  const best = bestInfect(run.board, run.size, side, run.aura, {
    lookahead: true,
    rng: run.rng,
    noise: 10,
  });

  if (run.playerNutrientAvailable && best && best.gain < 2) {
    const n = bestNutrient(run.board, run.size, side);
    if (n && n.cover >= 2) return { kind: 'nutrient', r: n.r, c: n.c };
  }

  if (best) return { kind: 'infect', r: best.r, c: best.c };
  return null;
}
