// src/game/sim.js — 纯逻辑模拟：32×24×32 体素岛 / 挖 / 建 / 动物状态机 / 农田 / 每日目标 / 彩虹桥终局。
// 不碰 DOM / window / localStorage / Date.now；随机全部用 seed（mulberry32 + 坐标哈希）。
// 事件总线：sim 只发 { type, ... } 事件，render/audio/ui 各自消费。
import {
  WORLD, STEP, BLOCKS, BLOCK_DEFS, HOTBAR, RAINBOW, STAMINA, ANIMALS, FARM, GOALS,
} from '../../config/game.config.js';

// ---------------------------------------------------------------- 随机
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z, seed) {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffffff) / 0x1000000;
}

function smoothNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, az, bx, by, bz) => Math.hypot(bx - ax, by - ay, bz - az);

// ---------------------------------------------------------------- 世界存取
const idx = (x, y, z) => (y * WORLD.D + z) * WORLD.W + x;
export const getBlock = (world, x, y, z) => {
  if (x < 0 || y < 0 || z < 0 || x >= WORLD.W || y >= WORLD.H || z >= WORLD.D) return BLOCKS.AIR;
  return world[idx(x, y, z)];
};
export const setBlock = (world, x, y, z, b) => {
  if (x < 0 || y < 0 || z < 0 || x >= WORLD.W || y >= WORLD.H || z >= WORLD.D) return;
  world[idx(x, y, z)] = b;
};
export const isSolid = (b) => b !== BLOCKS.AIR && !BLOCK_DEFS[b]?.fluid;

// ---------------------------------------------------------------- 地形生成
function genTerrain(world, seed) {
  const { W, H, D, WATER_LEVEL } = WORLD;
  const CX = (W - 1) / 2, CZ = (D - 1) / 2;
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const dx = (x - CX) / CX, dz = (z - CZ) / CZ;
      let h = 9 - 6 * Math.hypot(dx, dz);
      h += (smoothNoise(x * 0.35, z * 0.35, seed) - 0.5) * 4;
      // 一处池塘
      const pd = Math.hypot(x - 8, z - 24);
      if (pd < 3.2) h = Math.min(h, WATER_LEVEL - 1);
      h = clamp(Math.round(h), 1, 14);
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === h) b = (h > WATER_LEVEL) ? BLOCKS.GRASS : BLOCKS.SAND;
        else if (y >= h - 2) b = BLOCKS.SAND;
        else b = BLOCKS.STONE;
        setBlock(world, x, y, z, b);
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) setBlock(world, x, y, z, BLOCKS.WATER);
    }
  }
  // 树木（木桩）
  for (let i = 0; i < 12; i++) {
    const x = 2 + Math.floor(hash2(i, 7, seed) * (W - 4));
    const z = 2 + Math.floor(hash2(i, 13, seed) * (D - 4));
    if (getBlock(world, x, 0, z) === BLOCKS.STONE) continue;
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (isSolid(getBlock(world, x, y, z))) { top = y; break; }
    if (top <= WATER_LEVEL) continue;
    if (getBlock(world, x, top, z) !== BLOCKS.GRASS) continue;
    const th = 2 + Math.floor(hash2(i, 31, seed) * 2);
    for (let k = 1; k <= th; k++) setBlock(world, x, top + k, z, BLOCKS.WOOD);
  }
  // 岩石（可挖的石头，保证裸露石料）
  for (let i = 0; i < 12; i++) {
    const x = 2 + Math.floor(hash2(i, 51, seed) * (W - 4));
    const z = 2 + Math.floor(hash2(i, 53, seed) * (D - 4));
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (isSolid(getBlock(world, x, y, z))) { top = y; break; }
    if (top <= WATER_LEVEL) continue;
    if (getBlock(world, x, top, z) !== BLOCKS.GRASS) continue;
    setBlock(world, x, top + 1, z, BLOCKS.STONE);
    if (hash2(i, 59, seed) > 0.5) setBlock(world, x, top + 2, z, BLOCKS.STONE);
  }
  // 花
  for (let i = 0; i < 18; i++) {
    const x = 1 + Math.floor(hash2(i, 41, seed) * (W - 2));
    const z = 1 + Math.floor(hash2(i, 43, seed) * (D - 2));
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (isSolid(getBlock(world, x, y, z))) { top = y; break; }
    if (top <= WATER_LEVEL) continue;
    if (getBlock(world, x, top, z) !== BLOCKS.GRASS) continue;
    setBlock(world, x, top + 1, z, BLOCKS.FLOWER);
  }
}

function groundAt(sim, x, z) {
  const xi = clamp(Math.floor(x), 0, WORLD.W - 1);
  const zi = clamp(Math.floor(z), 0, WORLD.D - 1);
  let top = 0;
  for (let y = WORLD.H - 1; y >= 0; y--) {
    if (isSolid(getBlock(sim.world, xi, y, zi))) { top = y; break; }
  }
  const above = getBlock(sim.world, xi, top + 1, zi);
  const inWater = above !== BLOCKS.AIR && BLOCK_DEFS[above]?.fluid;
  return { y: inWater ? WORLD.WATER_LEVEL : top + 1, inWater };
}

// ---------------------------------------------------------------- 每日目标
function pickGoals(seed, day) {
  const rng = mulberry32((seed ^ Math.imul(day + 1, 0x9E3779B9)) >>> 0);
  const pool = GOALS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map((g) => ({ ...g, done: false, progress: 0 }));
}

// ---------------------------------------------------------------- 创建
export function createSim({ seed = 1 } = {}) {
  const world = new Uint8Array(WORLD.W * WORLD.H * WORLD.D);
  genTerrain(world, seed);
  const p = {
    x: WORLD.SPAWN.x, z: WORLD.SPAWN.z, yaw: Math.PI * 0.25, pitch: -0.2,
    stamina: STAMINA.max, gold: 0, slot: 0,
    inventory: {},       // blockId -> count（可放置方块）
    rainbow: { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 },
    carrots: 0,
  };
  const spawnGround = groundAt({ world }, p.x, p.z);
  p.y = spawnGround.y;

  const animals = ANIMALS.spawn.map((s) => {
    const g = groundAt({ world }, s.x, s.z);
    return {
      id: s.id, type: s.type, x: s.x, z: s.z, y: g.y, yaw: hash2(s.x, s.z, seed) * Math.PI * 2,
      state: 'wander', t: 0, tx: s.x, tz: s.z, homeX: s.x, homeZ: s.z,
      fedToday: false, fan: false, fanT: 0, anim: 0,
    };
  });

  const crops = FARM.tiles.map((t) => ({ x: t.x, z: t.z, stage: 0, mature: false }));

  const sim = {
    seed,
    world,
    dims: { w: WORLD.W, h: WORLD.H, d: WORLD.D },
    player: p,
    animals,
    crops,
    time: 0,
    day: 0,
    timeOfDay: 0,
    phase: 'playing',      // playing | won
    won: false,
    canBuild: false,
    rainbowNext: 0,
    stats: {
      digs: 0, places: 0, feeds: 0, harvests: 0, deaths: 0,
      stonesDug: 0, blocksPlaced: 0, animalsFed: 0, eggsCollected: 0,
      carrotsHarvested: 0, goldEarned: 0, woolCollected: 0, goldEggsCollected: 0,
      totalGoalsCompleted: 0,
    },
    goals: pickGoals(seed, 0),
    events: [],
  };
  return sim;
}

// ---------------------------------------------------------------- 射线（体素 DDA）
export function raycast(sim, ox, oy, oz, dx, dy, dz, maxDist = WORLD.REACH) {
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tDeltaX) : Infinity;
  let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tDeltaY) : Infinity;
  let tMaxZ = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ) : Infinity;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  for (let i = 0; i < 128; i++) {
    const b = getBlock(sim.world, x, y, z);
    if (b !== BLOCKS.AIR) return { hit: true, x, y, z, block: b, nx, ny, nz, dist: t };
    if (t > maxDist) break;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
  }
  return { hit: false, dist: t };
}

// ---------------------------------------------------------------- 动作
function eyePos(sim) {
  const p = sim.player;
  return { x: p.x, y: p.y + WORLD.EYE, z: p.z };
}

function inReach(sim, x, y, z) {
  const e = eyePos(sim);
  return dist(e.x, e.y, e.z, x + 0.5, y + 0.5, z + 0.5) <= WORLD.REACH;
}

function doDig(sim, x, y, z) {
  const p = sim.player;
  const b = getBlock(sim.world, x, y, z);
  if (b === BLOCKS.AIR || !BLOCK_DEFS[b]?.solid || BLOCK_DEFS[b]?.fluid) return;
  if (!inReach(sim, x, y, z)) return;
  if (p.stamina < STAMINA.digCost) { collapse(sim); return; }
  setBlock(sim.world, x, y, z, BLOCKS.AIR);
  p.inventory[b] = (p.inventory[b] || 0) + 1;
  p.stamina -= STAMINA.digCost;
  sim.stats.digs++;
  if (b === BLOCKS.STONE) sim.stats.stonesDug++;
  sim.events.push({ type: 'dig', x, y, z, block: b });
}

function doPlace(sim, x, y, z, block) {
  const p = sim.player;
  if (!BLOCK_DEFS[block]?.placeable) return;
  if (getBlock(sim.world, x, y, z) !== BLOCKS.AIR) return;
  if (!inReach(sim, x, y, z)) return;
  if ((p.inventory[block] || 0) <= 0) return;
  // 不放进玩家占据的格子
  const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
  if (x === fx && z === fz && (y === fy || y === fy + 1)) return;
  setBlock(sim.world, x, y, z, block);
  p.inventory[block] -= 1;
  p.stamina = Math.max(0, p.stamina - STAMINA.placeCost);
  sim.stats.places++;
  sim.stats.blocksPlaced++;
  sim.events.push({ type: 'place', x, y, z, block });
}

function collapse(sim) {
  const p = sim.player;
  sim.stats.deaths++;
  p.stamina = 60;
  p.gold = Math.max(0, p.gold - STAMINA.collapseGoldLoss);
  p.x = WORLD.SPAWN.x; p.z = WORLD.SPAWN.z;
  p.y = groundAt(sim, p.x, p.z).y;
  sim.events.push({ type: 'collapse', x: p.x, z: p.z });
}

function doInteract(sim) {
  const p = sim.player;
  // 优先喂动物（有萝卜时）
  let bestA = null, bestD = ANIMALS.feedRange;
  for (const a of sim.animals) {
    if (a.fedToday) continue;
    const d = dist(p.x, p.y, p.z, a.x, a.y, a.z);
    if (d < bestD) { bestD = d; bestA = a; }
  }
  if (bestA && p.carrots > 0) {
    bestA.fedToday = true;
    p.carrots--;
    sim.stats.feeds++;
    sim.stats.animalsFed++;
    sim.events.push({ type: 'feed', id: bestA.id, type2: bestA.type, x: bestA.x, y: bestA.y, z: bestA.z });
    return;
  }
  // 再收萝卜
  let bestC = null, bestCd = FARM.harvestRange;
  for (const c of sim.crops) {
    if (!c.mature) continue;
    const d = dist(p.x, p.y, p.z, c.x + 0.5, p.y, c.z + 0.5);
    if (d < bestCd) { bestCd = d; bestC = c; }
  }
  if (bestC) {
    bestC.mature = false; bestC.stage = 0;
    p.carrots++;
    sim.stats.harvests++;
    sim.stats.carrotsHarvested++;
    sim.events.push({ type: 'harvest', x: bestC.x, z: bestC.z });
  }
}

function doAction(sim, action) {
  if (!action) return;
  if (action.kind === 'dig') doDig(sim, action.x, action.y, action.z);
  else if (action.kind === 'place') doPlace(sim, action.x, action.y, action.z, action.block);
  else if (action.kind === 'interact') doInteract(sim);
}

// ---------------------------------------------------------------- 动物
function updateAnimals(sim, dt) {
  const p = sim.player;
  for (const a of sim.animals) {
    a.t -= dt;
    if (a.fan) {
      a.fanT -= dt;
      if (a.fanT <= 0) { a.fan = false; }
      continue;
    }
    const dPlayer = dist(p.x, p.y, p.z, a.x, a.y, a.z);
    // flee：玩家贴太近时逃跑
    if (a.state !== 'flee' && dPlayer < 2.0 && Math.random() < 0.05) {
      a.state = 'flee'; a.t = 1.2;
      const away = Math.atan2(a.z - p.z, a.x - p.x);
      a.tx = clamp(a.x + Math.cos(away) * 4, 1, WORLD.W - 1);
      a.tz = clamp(a.z + Math.sin(away) * 4, 1, WORLD.D - 1);
    }
    if (a.state === 'wander') {
      const dx = a.tx - a.x, dz = a.tz - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3 || a.t <= 0) {
        a.state = 'eat'; a.t = 0.6 + Math.random() * 0.6;
      } else {
        const sp = ANIMALS.speed;
        a.x += (dx / d) * sp * dt;
        a.z += (dz / d) * sp * dt;
        a.yaw = Math.atan2(dx, dz);
        a.anim += dt;
      }
    } else if (a.state === 'eat') {
      if (a.t <= 0) {
        a.state = 'wander';
        a.t = 1.5 + Math.random() * 2.5;
        const ang = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 3;
        a.tx = clamp(a.homeX + Math.cos(ang) * r, 1, WORLD.W - 1);
        a.tz = clamp(a.homeZ + Math.sin(ang) * r, 1, WORLD.D - 1);
      }
    } else if (a.state === 'flee') {
      const dx = a.tx - a.x, dz = a.tz - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3 || a.t <= 0) { a.state = 'wander'; a.t = 0; }
      else {
        const sp = ANIMALS.speed * 1.6;
        a.x += (dx / d) * sp * dt;
        a.z += (dz / d) * sp * dt;
        a.yaw = Math.atan2(dx, dz);
      }
    }
    a.y = groundAt(sim, a.x, a.z).y;
    // 孔雀开屏：喂饱 + 玩家靠近 + 概率
    if (a.type === 'peacock' && a.fedToday && !a.fan && dPlayer < 5 && Math.random() < 0.02) {
      a.fan = true; a.fanT = 2.0;
      sim.events.push({ type: 'peacock_fan', id: a.id, x: a.x, y: a.y, z: a.z });
      sim.events.push({ type: 'gold_egg', id: a.id, x: a.x, y: a.y, z: a.z, gold: ANIMALS.produce.peacock.gold });
    }
  }
}

function updateCrops(sim, dt) {
  for (const c of sim.crops) {
    if (!c.mature) {
      c.stage += dt / FARM.growSec;
      if (c.stage >= 1) { c.stage = 1; c.mature = true; }
    }
  }
}

// ---------------------------------------------------------------- 日更 / 目标
function checkGoals(sim) {
  for (const g of sim.goals) {
    if (g.done) continue;
    g.progress = Math.min(g.target, sim.stats[g.metric] || 0);
    if (g.progress >= g.target) {
      g.done = true;
      sim.stats.goldEarned += g.gold;
      sim.player.gold += g.gold;
      const color = RAINBOW.colors[sim.rainbowNext % RAINBOW.colors.length];
      sim.rainbowNext++;
      sim.player.rainbow[color] += RAINBOW.goalReward;
      sim.stats.totalGoalsCompleted++;
      sim.events.push({ type: 'goal_complete', id: g.id, gold: g.gold, color });
      updateCanBuild(sim);
    }
  }
}

function updateCanBuild(sim) {
  sim.canBuild = RAINBOW.colors.every((c) => sim.player.rainbow[c] >= RAINBOW.need);
}

function advanceDay(sim) {
  // 产出：喂饱的动物次晨产蛋/毛/金蛋，自动卖金币
  for (const a of sim.animals) {
    if (!a.fedToday) continue;
    const prod = ANIMALS.produce[a.type];
    sim.player.gold += prod.gold;
    sim.stats.goldEarned += prod.gold;
    if (a.type === 'chicken') sim.stats.eggsCollected++;
    if (a.type === 'sheep') sim.stats.woolCollected++;
    if (a.type === 'peacock') sim.stats.goldEggsCollected++;
    a.fedToday = false;
    sim.events.push({ type: 'produce', id: a.id, type2: a.type, good: prod.good, gold: prod.gold });
  }
  checkGoals(sim);
  // 重置每日指标 + 新目标
  sim.stats.stonesDug = 0; sim.stats.blocksPlaced = 0; sim.stats.animalsFed = 0;
  sim.stats.eggsCollected = 0; sim.stats.carrotsHarvested = 0; sim.stats.goldEarned = 0;
  sim.goals = pickGoals(sim.seed, sim.day + 1);
  sim.events.push({ type: 'day', day: sim.day + 1 });
}

// ---------------------------------------------------------------- 主更新
export function updateSim(sim, input = {}, dt = STEP) {
  const p = sim.player;
  sim.time += dt;
  sim.timeOfDay = sim.time % WORLD.DAY_SECONDS;

  if (input.yaw != null) p.yaw = input.yaw;
  if (input.pitch != null) p.pitch = input.pitch;
  if (input.slot != null) p.slot = input.slot;

  // 移动（WASD / 触屏摇杆，世界坐标相对朝向）
  const mx = input.move?.x || 0, mz = input.move?.z || 0;
  let f = mz, s = mx;
  const ml = Math.hypot(f, s); if (ml > 1) { f /= ml; s /= ml; }
  const SPEED = 5;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wx = (s * cos - f * sin) * SPEED;
  const wz = (-f * cos - s * sin) * SPEED;
  p.x = clamp(p.x + wx * dt, 0.5, WORLD.W - 0.5);
  p.z = clamp(p.z + wz * dt, 0.5, WORLD.D - 0.5);
  p.y = groundAt(sim, p.x, p.z).y;

  if (input.action) doAction(sim, input.action);
  if (input.interact) doInteract(sim);

  p.stamina = Math.min(STAMINA.max, p.stamina + STAMINA.regen * dt);

  updateAnimals(sim, dt);
  updateCrops(sim, dt);
  checkGoals(sim);

  const newDay = Math.floor(sim.time / WORLD.DAY_SECONDS);
  if (newDay > sim.day) { sim.day = newDay; advanceDay(sim); }
  return sim;
}

// ---------------------------------------------------------------- 事件 / HUD
export function drainEvents(sim) {
  const evs = sim.events;
  sim.events = [];
  return evs;
}

export function getHud(sim) {
  const p = sim.player;
  return {
    time: sim.time, day: sim.day, timeOfDay: sim.timeOfDay,
    gold: p.gold, stamina: Math.round(p.stamina), slot: p.slot, carrots: p.carrots,
    inventory: { ...p.inventory },
    rainbow: RAINBOW.colors.map((c) => ({ id: c, n: p.rainbow[c], need: RAINBOW.need })),
    canBuild: sim.canBuild,
    goals: sim.goals.map((g) => ({ id: g.id, metric: g.metric, target: g.target, progress: g.progress, done: g.done })),
    phase: sim.phase,
    deaths: sim.stats.deaths,
    totalGoalsCompleted: sim.stats.totalGoalsCompleted,
  };
}

// 供 UI/验收调用：直接建造彩虹桥（终局）
export function buildBridge(sim) {
  if (sim.phase === 'won') return;
  updateCanBuild(sim);
  if (!sim.canBuild) return;
  sim.phase = 'won';
  sim.won = true;
  sim.events.push({ type: 'win' });
}

// 供验收 demo 快速到达终局
export function forceWin(sim) {
  for (const c of RAINBOW.colors) sim.player.rainbow[c] = Math.max(sim.player.rainbow[c], RAINBOW.need);
  updateCanBuild(sim);
  buildBridge(sim);
}
