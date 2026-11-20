// src/game/board.js — 弹珠板（Galton 板）纯逻辑：骰面入珠区 → 钉子随机游走 → 落桶。
// 零依赖、确定性：同一 (laneIndex, rng 状态) 得到同一结果，可 seed 复现。
import { BOARD } from '../../config/gameplay.js';

// 入珠区 0..2 → 最终桶 0..6（Galton 游走：中心柱 1/3/5 起步，逐行 ±1，最后 clamp）
export function resolveBead(laneIndex, rng) {
  let col = 1 + laneIndex * 2; // 1, 3, 5
  const bounces = [];
  for (let r = 0; r < BOARD.ROWS; r += 1) {
    const dir = rng() < 0.5 ? -1 : 1;
    bounces.push(dir);
    col += dir;
  }
  const bucket = Math.max(0, Math.min(BOARD.BUCKETS - 1, col));
  return { bucket, bounces };
}

export function laneCenterX(laneIndex) {
  return BOARD.LANE_X[Math.max(0, Math.min(BOARD.LANES - 1, laneIndex))];
}

export function bucketIndexToX(bucket) {
  const span = BOARD.BOARD_RIGHT - BOARD.BOARD_LEFT;
  const step = span / BOARD.BUCKETS;
  return BOARD.BOARD_LEFT + step * (bucket + 0.5);
}

export function bucketMult(bucket) {
  return BOARD.BUCKET_MULT[Math.max(0, Math.min(BOARD.BUCKETS - 1, bucket))];
}

// 供渲染/测试使用：逐行钉子的 x 位置（第 r 行偏移半格交错）
export function pegX(row, col) {
  const span = BOARD.BOARD_RIGHT - BOARD.BOARD_LEFT;
  const step = span / (BOARD.BUCKETS + 1); // 8 列钉子位
  const offset = (row % 2 === 0) ? step : step / 2;
  return BOARD.BOARD_LEFT + offset + col * step;
}
