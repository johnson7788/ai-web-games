// ABYSS EEL · M1 生成器：墙/食物模式化排布（单墙/墙阵留缝/走廊串珠/左右分叉/海胆阵/Boss）
// 纯逻辑：所有随机来自传入的 mulberry32 rng，同 seed 同结果
import { WORLD, WALL, URCHIN, BOSS, clamp, wallValueAt } from '../../config/gameplay.js';
import { zoneAt } from '../../config/levels.js';
import { randInt, pick } from './rng.js';

// 墙值：公式结果再 clamp 到当前带的墙值范围
export function wallValueFor(rng, depth, zone) {
  return clamp(wallValueAt(depth, rng), zone.wallValue[0], zone.wallValue[1]);
}

function randomFood(rng, zone, y, x) {
  const kind = pick(rng, zone.foods);
  return { x: x ?? randInt(rng, 80, WORLD.WIDTH - 80), worldY: y, kind };
}

// 单墙（可选移动墙）
export function spawnSingle(rng, zone, depth, y, opts = {}) {
  const w = randInt(rng, WALL.W_MIN, WALL.W_MAX);
  const x = randInt(rng, 60, WORLD.WIDTH - 60 - w);
  const wall = {
    x, worldY: y, w, h: WALL.H,
    value: wallValueFor(rng, depth, zone),
    kind: 'coral',
  };
  if (opts.moving) {
    wall.moving = true;
    wall.vx = rng() < 0.5 ? -WALL.MOVE_SPEED : WALL.MOVE_SPEED;
  }
  const foods = [];
  if (rng() < 0.7) foods.push(randomFood(rng, zone, y));
  // 墙间散珠：给下一段路一个织行目标（保持总有事可做）
  if (rng() < 0.85) foods.push(randomFood(rng, zone, y + 110));
  if (rng() < 0.85) foods.push(randomFood(rng, zone, y + 220));
  return { walls: [wall], foods };
}

// 移动墙（zone2+）
export function spawnMoving(rng, zone, depth, y) {
  return spawnSingle(rng, zone, depth, y, { moving: true });
}

// 墙阵留缝：左右两墙留一道可通过的缝
export function spawnGap(rng, zone, depth, y) {
  const gapCenter = randInt(rng, 280, WORLD.WIDTH - 280);
  const gapW = randInt(rng, 240, 340);
  const leftX = gapCenter - gapW / 2;
  const rightX = gapCenter + gapW / 2;
  const walls = [
    { x: 0, worldY: y, w: Math.round(leftX), h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
    { x: Math.round(rightX), worldY: y, w: Math.round(WORLD.WIDTH - rightX), h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
  ];
  const foods = [randomFood(rng, zone, y, gapCenter)];
  if (rng() < 0.5) foods.push(randomFood(rng, zone, y, gapCenter));
  return { walls, foods };
}

// 走廊串珠：窄缝 + 一串 Z 字走向的食物（织行有手感）
export function spawnCorridor(rng, zone, depth, y) {
  const gapCenter = randInt(rng, 300, WORLD.WIDTH - 300);
  const gapW = randInt(rng, 180, 240);
  const leftX = gapCenter - gapW / 2;
  const rightX = gapCenter + gapW / 2;
  const walls = [
    { x: 0, worldY: y, w: Math.round(leftX), h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
    { x: Math.round(rightX), worldY: y, w: Math.round(WORLD.WIDTH - rightX), h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
  ];
  const count = randInt(rng, 4, 6);
  const foods = [];
  let side = rng() < 0.5 ? -1 : 1;
  for (let i = 0; i < count; i += 1) {
    const sway = randInt(rng, 30, 55) * side;
    side = -side;
    foods.push(randomFood(rng, zone, y + i * 52, gapCenter + sway));
  }
  return { walls, foods };
}

// 左右分叉：中间墙 + 左右两条缝，两条缝各放食物
export function spawnFork(rng, zone, depth, y) {
  const g1 = randInt(rng, 200, 380); // 左缝中心
  const g2 = randInt(rng, 760, 1040); // 右缝中心
  const gapW = randInt(rng, 180, 240);
  const w1 = Math.round(g1 - gapW / 2); // 左墙宽
  const midX = Math.round(g1 + gapW / 2); // 中墙左缘
  const midW = Math.round(g2 - gapW / 2 - midX); // 中墙宽
  const rightX = Math.round(g2 + gapW / 2); // 右墙左缘
  const walls = [
    { x: 0, worldY: y, w: w1, h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
    { x: midX, worldY: y, w: midW, h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
    { x: rightX, worldY: y, w: Math.round(WORLD.WIDTH - rightX), h: WALL.H, value: wallValueFor(rng, depth, zone), kind: 'coral' },
  ];
  return {
    walls,
    foods: [randomFood(rng, zone, y, g1), randomFood(rng, zone, y, g2)],
  };
}

// 海胆阵（zone4+）
export function spawnUrchins(rng, zone, depth, y) {
  const count = randInt(rng, 2, 4);
  const walls = [];
  for (let i = 0; i < count; i += 1) {
    walls.push({
      x: randInt(rng, 60, WORLD.WIDTH - 60 - URCHIN.W),
      worldY: y,
      w: URCHIN.W,
      h: URCHIN.H,
      value: URCHIN.VALUE,
      kind: 'urchin',
    });
  }
  return { walls, foods: [] };
}

// Boss 墙：宽 1280 分 5 段，每段 value = 当前带墙值 ×8
export function spawnBossSpecs(rng, depth, y) {
  const zone = zoneAt(depth);
  const base = wallValueFor(rng, depth, zone);
  const segW = Math.round(WORLD.WIDTH / BOSS.SEGMENTS);
  const parts = [];
  for (let i = 0; i < BOSS.SEGMENTS; i += 1) {
    parts.push({
      x: i * segW,
      worldY: y,
      w: i === BOSS.SEGMENTS - 1 ? WORLD.WIDTH - i * segW : segW,
      h: BOSS.H,
      value: base * BOSS.VALUE_MULT,
      kind: 'bossPart',
      partIndex: i,
    });
  }
  return parts;
}

const PATTERNS = {
  single: spawnSingle,
  gap: spawnGap,
  corridor: spawnCorridor,
  fork: spawnFork,
  urchin: spawnUrchins,
  moving: spawnMoving,
};

// 按带模式随机挑一个生成（sim 每波调用）
export function spawnWave(rng, zone, depth, y) {
  const name = pick(rng, zone.patterns);
  return PATTERNS[name](rng, zone, depth, y);
}
