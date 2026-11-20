// CORGI DASH · 生成器：障碍/羊拾取物模式化排布（纯逻辑，随机来自传入 rng）
import { WORLD, SPAWN } from '../../config/gameplay.js';
import { randInt, pick } from './rng.js';

export const OBSTACLE_KINDS = ['fence', 'hay', 'puddle', 'pen', 'doubleFence', 'bridge', 'row'];

const GROUND = WORLD.GROUND_Y;

// 单个地面障碍
function ground(kind, x, w, h, extra = {}) {
  return { kind, x, y: GROUND - h, w, h, passed: false, cleared: false, ...extra };
}

// 桥洞：头顶横梁（底部留出通道），玩家贴地通过即可
function bridge(rng, x) {
  const beamH = 90;
  const beamBottom = GROUND - 150; // 梁底到地面留 150px 通道
  return { kind: 'bridge', x, y: beamBottom - beamH, w: randInt(rng, 150, 220), h: beamH, passed: false, cleared: false };
}

// 按段允许的障碍类型随机生成一组（doubleFence / row 展开成多实体）
export function spawnObstacles(rng, seg, worldX) {
  const kind = pick(rng, seg.obstacles);
  const out = [];
  if (kind === 'doubleFence') {
    const w = randInt(rng, 40, 52);
    const gap = randInt(rng, 92, 122);
    out.push(ground('fence', worldX, w, 72));
    out.push(ground('fence', worldX + w + gap, w, 72));
  } else if (kind === 'row') {
    const gap = randInt(rng, 200, 240);
    for (let i = 0; i < 3; i += 1) out.push(ground('puddle', worldX + i * gap, randInt(rng, 110, 150), 28));
  } else if (kind === 'bridge') {
    out.push(bridge(rng, worldX));
  } else if (kind === 'pen') {
    const w = randInt(rng, 56, 72);
    out.push(ground('pen', worldX, w, 110, { moving: true, penVx: 70 * (rng() < 0.5 ? -1 : 1) }));
  } else if (kind === 'puddle') {
    out.push(ground('puddle', worldX, randInt(rng, 120, 170), 28));
  } else if (kind === 'hay') {
    out.push(ground('hay', worldX, randInt(rng, 48, 64), 96));
  } else { // fence
    out.push(ground('fence', worldX, randInt(rng, 36, 56), 72));
  }
  return out;
}

// 羊拾取物（地面高度，跑过即收集）
export function spawnSheepPickup(rng, worldX) {
  const w = 34;
  const h = 34;
  return { kind: 'sheep', x: worldX, y: GROUND - h - 4, w, h, taken: false };
}
