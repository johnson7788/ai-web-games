// LAUNCH LEGENDS · 关卡生成器（纯逻辑，零 DOM/window/Date.now）
// 职责：用 seed 确定性地生成每一层的分段障碍条（cloud 云絮 / steel 钢棚 / empty 空档），
//       并保证一条「安全通道」（corridor，每层一个安全列，永不落钢棚）供 greedy bot 与可解性校验使用。
// 依赖：config/levels.js（LEVELS）。随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORLD } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ------------------------------------------------------------------ 单层生成
function makeLayer(level, i, safeCol, rng) {
  const cols = level.cols;
  const seg = new Array(cols).fill('empty');

  // 全钢棚层：整条都是 steel，只有炽热态能烧穿（corridor 不生效）
  if (level.steelBarrierEvery && i > 0 && (i % level.steelBarrierEvery) === 0) {
    return seg.fill('steel');
  }

  // 安全通道列：云絮概率 corridorCloudP（云絮可撞碎、永远安全）
  seg[safeCol] = (rng() < (level.corridorCloudP ?? 0.35)) ? 'cloud' : 'empty';

  const cloudP = level.cloudP ?? 0.3;
  const steelP = level.steelP ?? 0.1;
  for (let c = 0; c < cols; c += 1) {
    if (c === safeCol) continue;
    const roll = rng();
    if (roll < cloudP) seg[c] = 'cloud';
    else if (roll < cloudP + steelP) seg[c] = 'steel';
    else seg[c] = 'empty';
  }
  return seg;
}

// ------------------------------------------------------------------ 主入口
// 返回 { level, layers, corridor, cols, targetHeight, segW }
//   layers: 二维数组 layers[layerIndex][col] ∈ {'empty','cloud','steel'}
//   corridor: 每层安全列（corridor[layerIndex] 永远不是 steel，除非该层是全钢棚层）
export function generateLevel(levelIndex = 0, seed = 1) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const rng = mulberry32(seed >>> 0);
  const cols = level.cols;
  const layerCount = level.targetHeight + 8; // 多生成 8 层缓冲，供过关后渲染

  const layers = [];
  const corridor = [];
  let col = Math.floor(cols / 2);

  for (let i = 0; i < layerCount; i += 1) {
    // 安全通道随机游走（每次最多左右挪 1 列）
    const roll = rng();
    if (roll < 0.45) col = clamp(col - 1, 0, cols - 1);
    else if (roll < 0.9) col = clamp(col + 1, 0, cols - 1);
    corridor.push(col);
    layers.push(makeLayer(level, i, col, rng));
  }

  return {
    level,
    layers,
    corridor,
    cols,
    targetHeight: level.targetHeight,
    segW: WORLD.WIDTH / cols,
  };
}
