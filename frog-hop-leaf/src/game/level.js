// FROG HOP LEAF · 关卡生成（纯逻辑、零 DOM、可复现）
// 生成一条从池底（alt=0）到「莲花门」的荷叶梯：相邻荷叶 x 方向重叠 ≥ OVERLAP_MIN，
// 保证「走到下一片正下方再起跳、笔直落回」永远可攀爬。敌人/尖刺/香蒲稀疏分布。
// 依赖：config/levels.js（LEVELS/SCENES）、config/game.config.js（WORLD/LEAF/PHYS）。

import { LEVELS, SCENES } from '../../config/levels.js';
import { WORLD, LEAF, PHYS } from '../../config/game.config.js';

export { LEVELS, SCENES };

// ---------------------------------------------------------------- RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, a, b) {
  return a + rng() * (b - a);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pickDistinctIndices(rng, count, lo, hi) {
  const pool = [];
  for (let i = lo; i <= hi; i += 1) pool.push(i);
  const out = [];
  while (out.length < count && pool.length) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

function leafKindForIndex(i, springIdx, goldenIdx) {
  if (springIdx.includes(i)) return 'spring';
  if (goldenIdx.includes(i)) return 'golden';
  return 'leaf';
}

// ---------------------------------------------------------------- 关卡生成
export function generateLevel(level, seed) {
  const rng = mulberry32(seed >>> 0);
  const { steps } = level;
  const leaves = [];

  // 池底大荷叶（alt=0，横贯全宽）
  leaves.push({ id: 0, x: 0, y: 0, w: WORLD.WIDTH, h: LEAF.H, kind: 'leaf' });

  let prev = leaves[0];
  // 特殊荷叶的候选下标：不放在最下面 2 片，也不放在最顶 2 片（给起跳/冲刺留安全）
  const lo = Math.max(3, 2);
  const hi = Math.max(lo, steps - 3);
  const springIdx = level.springLeaves > 0 ? pickDistinctIndices(rng, level.springLeaves, lo, hi) : [];
  const goldenIdx = level.goldenLeaves > 0 ? pickDistinctIndices(rng, level.goldenLeaves, lo, hi) : [];

  for (let i = 1; i <= steps; i += 1) {
    const gap = randRange(rng, level.gapMin, level.gapMax);
    const w = Math.round(randRange(rng, level.leafWMin, level.leafWMax));
    const alt = prev.y + gap;
    // 竖直「叶梯」：下一片叶中心在上一片 ±SHIFT 内随机，宽度足够大 → 大量重叠，
    // 保证从当前叶任意点起跳都能落上下一片（自动行走 + 竖直下落也能稳定爬升）。
    const SHIFT = 45;
    const prevCenter = prev.x + prev.w / 2;
    const center = clamp(prevCenter + randRange(rng, -SHIFT, SHIFT), WORLD.MARGIN + w / 2, WORLD.WIDTH - WORLD.MARGIN - w / 2);
    const x = Math.round(center - w / 2);
    leaves.push({
      id: i,
      x,
      y: alt,
      w,
      h: LEAF.H,
      kind: leafKindForIndex(i, springIdx, goldenIdx),
    });
    prev = leaves[leaves.length - 1];
  }

  // 莲花门就立在最高叶上：青蛙落到最高叶即过关（goalY = 顶叶顶面）。
  const goalY = prev.y;

  // 敌人：瓢虫 / 滚石（在叶的半边往复巡逻，留出中央爬升走廊）
  const enemies = [];
  const enemyLeafPool = pickDistinctIndices(rng, level.ladybugs + level.pebbles, 3, steps - 2);
  let poolPtr = 0;
  for (let k = 0; k < level.ladybugs; k += 1) {
    const leafId = enemyLeafPool[poolPtr++] ?? 3;
    const leaf = leaves[leafId];
    if (!leaf) continue;
    const speed = 40;
    const w = 30;
    const center = leaf.x + leaf.w / 2;
    const side = rng() < 0.5 ? -1 : 1;
    const minX = side < 0 ? leaf.x + 10 : center + 22;
    const maxX = side < 0 ? center - 22 - w : leaf.x + leaf.w - 10 - w;
    const dir = side < 0 ? 1 : -1;
    enemies.push({
      id: `ladybug-${k}`,
      kind: 'ladybug',
      leafId,
      x: minX + randRange(rng, 0, Math.max(4, maxX - minX)),
      y: leaf.y + 10,
      dir,
      speed,
      w,
      h: 18,
      minX,
      maxX,
      pauseT: 0,
    });
  }
  for (let k = 0; k < level.pebbles; k += 1) {
    const leafId = enemyLeafPool[poolPtr++] ?? 4;
    const leaf = leaves[leafId];
    if (!leaf) continue;
    const speed = 60;
    const w = 36;
    const center = leaf.x + leaf.w / 2;
    const side = rng() < 0.5 ? -1 : 1;
    const minX = side < 0 ? leaf.x + 12 : center + 26;
    const maxX = side < 0 ? center - 26 - w : leaf.x + leaf.w - 12 - w;
    const dir = side < 0 ? 1 : -1;
    enemies.push({
      id: `pebble-${k}`,
      kind: 'pebble',
      leafId,
      x: minX + randRange(rng, 0, Math.max(4, maxX - minX)),
      y: leaf.y + 12,
      dir,
      speed,
      w,
      h: 22,
      minX,
      maxX,
      pauseT: 0,
    });
  }

  // 尖刺：固定在部分叶面上
  const thorns = [];
  const thornIdx = pickDistinctIndices(rng, level.thorns, 4, steps - 2);
  for (let k = 0; k < level.thorns; k += 1) {
    const leaf = leaves[thornIdx[k]];
    if (!leaf) continue;
    const tw = 74;
    const tx = randRange(rng, leaf.x + 16, leaf.x + leaf.w - 16 - tw);
    thorns.push({ id: `thorn-${k}`, leafId: thornIdx[k], x: tx, w: tw });
  }

  // 香蒲：从叶边喷横向气泡
  const cattails = [];
  const catIdx = pickDistinctIndices(rng, level.cattails, 5, steps - 2);
  for (let k = 0; k < level.cattails; k += 1) {
    const leafId = catIdx[k];
    const leaf = leaves[leafId];
    if (!leaf) continue;
    const side = rng() < 0.5 ? -1 : 1;
    cattails.push({
      id: `cattail-${k}`,
      leafId,
      side,
      x: side < 0 ? leaf.x + 10 : leaf.x + leaf.w - 10,
      y: leaf.y,
      phase: rng() * 2.4,
      period: 2.4,
    });
  }

  // 萤火虫：悬浮在部分荷叶上方
  const fireflies = [];
  const flyIdx = pickDistinctIndices(rng, level.fireflies, 2, steps - 1);
  for (let k = 0; k < level.fireflies && k < flyIdx.length; k += 1) {
    const leaf = leaves[flyIdx[k]];
    if (!leaf) continue;
    fireflies.push({
      id: `firefly-${k}`,
      x: randRange(rng, leaf.x + 20, leaf.x + leaf.w - 20),
      y: leaf.y + randRange(rng, 46, 78),
      taken: false,
    });
  }

  return {
    level,
    scene: level.scene,
    seed: seed >>> 0,
    leaves,
    goalY,
    enemies,
    thorns,
    cattails,
    fireflies,
    // 预计算一份便于 bot/渲染查询的「叶顶 alt → 叶」映射
    leafByAlt: null,
  };
}

// 判断某个 x 在叶面高度 alt 处是否落在某片叶顶（供 bot 判断安全落点）
export function leafAt(leaves, x, alt, tol = 6) {
  for (const lf of leaves) {
    if (Math.abs(lf.y - alt) <= tol && x >= lf.x && x <= lf.x + lf.w) return lf;
  }
  return null;
}
