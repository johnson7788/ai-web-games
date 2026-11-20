// src/game/spawner.js — 彩环生成（纯逻辑）：每环一格一色，至少含 targetCells 个同色安全格。
// 颜色：0..3 为染色，-1 白（万能），-2 木（一次性跳板）。
import { WORLD } from '../../config/game.config.js';
import { COLOR, RING } from '../../config/gameplay.js';
import { shuffle } from './rng.js';

/**
 * 给 cells 个格子分配颜色。
 * 保证：恰好 targetCells 个格子 = dye（同色安全目标）；其余按 whiteProb/woodProb 与随机异色填充。
 */
export function assignColors(rng, dye, cells, targetCells, whiteProb, woodProb) {
  const n = Math.max(2, cells);
  const target = Math.max(1, Math.min(n - 1, targetCells));
  const colors = new Array(n).fill(0);
  const idx = shuffle(rng, Array.from({ length: n }, (_, i) => i));

  for (let k = 0; k < target; k += 1) colors[idx[k]] = dye;

  const wProb = whiteProb ?? RING.WHITE_PROB;
  const dProb = woodProb ?? RING.WOOD_PROB;
  for (let k = target; k < n; k += 1) {
    const r = rng();
    if (r < wProb) {
      colors[idx[k]] = COLOR.WHITE;
    } else if (r < wProb + dProb) {
      colors[idx[k]] = COLOR.WOOD;
    } else {
      let c = Math.floor(rng() * COLOR.COUNT);
      // 避免额外塞入与目标同色（非目标格染成同色会让 greedy 出现歧义），落到同色就顺延
      if (c === dye) c = (c + 1) % COLOR.COUNT;
      colors[idx[k]] = c;
    }
  }
  return colors;
}

/** 生成一环（横向色条，占据全宽）。worldY 为世界纵坐标（越大越靠前/下方）。 */
export function spawnRing(run, band, worldY) {
  const cells = Math.max(2, band.cells || RING.CELLS);
  const targetCells = Math.max(1, Math.min(cells - 1, band.targetCells ?? RING.TARGET_CELLS));
  const cellW = WORLD.WIDTH / cells;

  const colors = assignColors(
    run.rng,
    run.dye,
    cells,
    targetCells,
    band.whiteProb ?? RING.WHITE_PROB,
    band.woodProb ?? RING.WOOD_PROB,
  );

  const ring = {
    id: run.nextId++,
    worldY,
    band: band.index,
    cellsCount: cells,
    targetCells,
    cellW,
    colors,              // cellsCount 长度，颜色数组
    whiteProb: band.whiteProb ?? RING.WHITE_PROB,
    woodProb: band.woodProb ?? RING.WOOD_PROB,
    xOffset: 0,          // 移动环横向 marquee 偏移（px，随时间增大）
    moving: !!band.moving,
    moveSpeed: band.moveSpeed || 0,
    movePhase: run.rng() * Math.PI * 2,
    swap: !!band.swap,
    swapEvery: band.swapEvery || 0,
    swapTimer: band.swapEvery || 0,
    resolved: false,
  };
  return ring;
}

/** 移动环/变色环的每 tick 更新：推进 marquee 偏移；变色环到点重洗格色。 */
export function updateRing(run, ring, dt) {
  if (ring.moving && ring.moveSpeed > 0) {
    ring.xOffset = (ring.xOffset + ring.moveSpeed * dt) % WORLD.WIDTH;
  }
  if (ring.swap && ring.swapEvery > 0) {
    ring.swapTimer -= dt;
    if (ring.swapTimer <= 0) {
      ring.swapTimer = ring.swapEvery;
      ring.colors = assignColors(
        run.rng,
        run.dye,
        ring.cellsCount,
        ring.targetCells,
        ring.whiteProb,
        ring.woodProb,
      );
    }
  }
}
