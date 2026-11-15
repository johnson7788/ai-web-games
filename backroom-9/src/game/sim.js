// src/game/sim.js — BACKROOM 9 纯逻辑模拟（无 DOM/window/Date.now，随机全部 seed）。
// 职责：程序化后室迷宫生成 / 玩家移动与碰撞 / 体力 / 实体 AI（漫游·听觉·视觉追逐）/ 躲藏 /
//       9 出口推进 + 每 2 出口重组 / 荧光灯闪烁 / 体力药 / 事件总线。
// 调用方：main.js（真实输入）、tools/selfplay.mjs（bot）、tests/*.test.mjs。
import { STEP, WORLD, PLAYER, ENTITY, PICKUP, MAZE, FX } from '../../config/game.config.js';

// ---------------------------------------------------------------- 随机（seed）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

/** 每日 seed（日期哈希 → 全球同题）；date 由 main 传入，保持纯逻辑。 */
export function dailySeed(date) {
  return hashSeed(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
}

const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// ---------------------------------------------------------------- 几何工具
function distPointSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}

function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function hasLOS(x1, z1, x2, z2, walls) {
  for (const w of walls) if (segIntersect(x1, z1, x2, z2, w.x1, w.z1, w.x2, w.z2)) return false;
  return true;
}

function resolveCollisions(p, r, walls) {
  const Wx = WORLD.GRID_W * WORLD.CELL, Hz = WORLD.GRID_H * WORLD.CELL;
  for (let iter = 0; iter < 3; iter++) {
    for (const w of walls) {
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1;
      const l2 = dx * dx + dz * dz;
      let t = l2 ? ((p.x - w.x1) * dx + (p.z - w.z1) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = w.x1 + dx * t, cz = w.z1 + dz * t;
      const nx = p.x - cx, nz = p.z - cz;
      const dist = Math.hypot(nx, nz);
      if (dist < r && dist > 1e-6) {
        const push = (r - dist) / dist;
        p.x += nx * push; p.z += nz * push;
      } else if (dist <= 1e-6) {
        if (dx === 0) p.x += r; else p.z += r;
      }
    }
  }
  p.x = Math.max(r, Math.min(Wx - r, p.x));
  p.z = Math.max(r, Math.min(Hz - r, p.z));
}

function moveCircle(p, dx, dz, r, walls) {
  p.x += dx; p.z += dz;
  resolveCollisions(p, r, walls);
}

// ---------------------------------------------------------------- 迷宫生成
function cellCenter(i, j) {
  const C = WORLD.CELL;
  return { x: (i + 0.5) * C, z: (j + 0.5) * C };
}

/** 生成树（保证连通）+ 额外开门（环线/房间感）→ 墙段数组。 */
function generateMaze(rnd) {
  const W = WORLD.GRID_W, H = WORLD.GRID_H, C = WORLD.CELL;
  const N = W * H;
  const parent = Array.from({ length: N }, (_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };

  const walls = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (i < W - 1) walls.push({ a: j * W + i, b: j * W + i + 1, axis: 'v', i, j, open: false });
    if (j < H - 1) walls.push({ a: j * W + i, b: (j + 1) * W + i, axis: 'h', i, j, open: false });
  }
  const order = walls.map((_, idx) => idx);
  for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; }
  for (const idx of order) {
    const w = walls[idx];
    if (find(w.a) !== find(w.b)) { union(w.a, w.b); w.open = true; }
  }
  for (const w of walls) if (!w.open && rnd() < MAZE.extraDoors) w.open = true;

  const segs = [];
  // openE[j][i]：房间 (i,j) 与其东邻之间是否打通；openS 同理（南邻），供小地图/连通判定
  const openE = Array.from({ length: H }, () => Array(W).fill(false));
  const openS = Array.from({ length: H }, () => Array(W).fill(false));
  for (const w of walls) {
    if (!w.open) {
      if (w.axis === 'v') { const x = (w.i + 1) * C, z = w.j * C; segs.push({ x1: x, z1: z, x2: x, z2: z + C }); }
      else { const z = (w.j + 1) * C, x = w.i * C; segs.push({ x1: x, z1: z, x2: x + C, z2: z }); }
    } else if (w.axis === 'v') openE[w.j][w.i] = true;
    else openS[w.j][w.i] = true;
  }
  const Wx = W * C, Hz = H * C;
  segs.push({ x1: 0, z1: 0, x2: 0, z2: Hz });
  segs.push({ x1: Wx, z1: 0, x2: Wx, z2: Hz });
  segs.push({ x1: 0, z1: 0, x2: Wx, z2: 0 });
  segs.push({ x1: 0, z1: Hz, x2: Wx, z2: Hz });
  return { walls: segs, W, H, C, openE, openS };
}

/** 从池子里按「离已选点越远越好」贪心挑 count 个点。 */
function pickFarPoints(rnd, count, fromX, fromZ) {
  const W = WORLD.GRID_W, H = WORLD.GRID_H, C = WORLD.CELL;
  const pool = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = cellCenter(i, j);
    pool.push(p);
  }
  const chosen = [];
  while (chosen.length < count && pool.length) {
    let best = -1, bestDist = -1;
    for (let k = 0; k < pool.length; k++) {
      const p = pool[k];
      let d = chosen.length === 0 ? Math.hypot(p.x - fromX, p.z - fromZ) : Infinity;
      for (const c of chosen) d = Math.min(d, Math.hypot(p.x - c.x, p.z - c.z));
      if (d > bestDist) { bestDist = d; best = k; }
    }
    chosen.push(pool.splice(best, 1)[0]);
  }
  return chosen;
}

/** 首出口落在起点 (0,0) 相邻且已打通（生成树保证至少其一）的房间——出生第一眼就能看到发光门。 */
function firstExitPoint(rnd, maze) {
  const cand = [];
  if (maze.openE[0][0]) cand.push(cellCenter(1, 0));
  if (maze.openS[0][0]) cand.push(cellCenter(0, 1));
  if (!cand.length) return cellCenter(1, 0);
  return cand[Math.floor(rnd() * cand.length)];
}

function placeTables(rnd) {
  const W = WORLD.GRID_W, H = WORLD.GRID_H;
  const tables = [];
  const want = MAZE.tablesPerSegment;
  let guard = 0;
  while (tables.length < want && guard++ < 200) {
    const p = cellCenter(Math.floor(rnd() * W), Math.floor(rnd() * H));
    if (tables.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > WORLD.CELL * 1.6)) tables.push(p);
  }
  return tables;
}

function placePickups(rnd) {
  const W = WORLD.GRID_W, H = WORLD.GRID_H;
  const pickups = [];
  let guard = 0;
  while (pickups.length < PICKUP.count && guard++ < 200) {
    const p = cellCenter(Math.floor(rnd() * W), Math.floor(rnd() * H));
    pickups.push({ x: p.x, z: p.z, active: true });
  }
  return pickups;
}

// ---------------------------------------------------------------- createRun
export function createRun({ seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  const spawn = cellCenter(0, 0);
  const run = {
    seed,
    rnd,                     // 本轮随机源（seed 派生）
    phase: 'playing',        // playing | won
    time: 0,                 // 有效时长（已含被抓惩罚）
    penalty: 0,
    segment: 1,
    exitIndex: 0,            // 当前要寻找的出口全局序号（0..8）
    totalExits: WORLD.EXITS,
    caught: 0,
    events: [{ type: 'start' }],
    maze: null,
    activeExit: null,
    segStart: { x: spawn.x, z: spawn.z },
    explored: {},           // cellIdx -> true（小地图只显示已探索区域）
    player: {
      x: spawn.x, z: spawn.z, yaw: 0, pitch: 0,
      stamina: PLAYER.staminaMax,
      pantT: 0,               // 剩余喘气时间
      regenT: 0,              // 体力回满前延迟
      hidden: false,
      stepAcc: 0,
      moved: false, sprinted: false, hiddenOnce: false,
    },
    entity: {
      x: cellCenter(5, 5).x, z: cellCenter(5, 5).z, yaw: 0,
      state: 'wander',        // wander | chase | search
      tx: 0, tz: 0, repickT: 0,
      stare: 0, searchT: 0,
      lastX: 0, lastZ: 0,
    },
    fx: { on: false, t: 0 },
  };
  regenMaze(run, true);
  // 出生面朝首个出口，第一眼就看到发光门（教学/截图可读性）
  const ex = run.activeExit;
  run.player.yaw = Math.atan2(-(ex.x - run.player.x), -(ex.z - run.player.z));
  return run;
}

/** 生成（或重组）当前段迷宫：墙/桌/体力药 + 出口落位。keepPlayer=true 时玩家原地不动。 */
function regenMaze(run, initial) {
  const rnd = run.rnd;
  run.maze = {
    ...generateMaze(rnd),
    tables: placeTables(rnd),
    pickups: placePickups(rnd),
    exits: [],
  };
  const localCount = Math.min(WORLD.REGEN_EVERY, WORLD.EXITS - run.exitIndex);
  let cells;
  if (run.segment === 1 && run.exitIndex === 0) {
    cells = [firstExitPoint(rnd, run.maze)];
    if (localCount > 1) cells = cells.concat(pickFarPoints(rnd, localCount - 1, cells[0].x, cells[0].z));
  } else {
    cells = pickFarPoints(rnd, localCount, run.player.x, run.player.z);
  }
  run.maze.exits = cells;
  run.activeExit = cells[0];
  if (!initial) run.segStart = { x: run.player.x, z: run.player.z };
  // 实体刷到远处，避免刚重组就贴脸
  const far = pickFarPoints(rnd, 1, run.player.x, run.player.z)[0] || cellCenter(5, 5);
  run.entity.x = far.x; run.entity.z = far.z;
  run.entity.state = 'wander'; run.entity.stare = 0; run.entity.repickT = 0;
}

// ---------------------------------------------------------------- updateSim
export function updateSim(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  const p = run.player;

  // 视角
  p.yaw += input.lookDX || 0;
  p.pitch = Math.max(PLAYER.pitchMin, Math.min(PLAYER.pitchMax, p.pitch + (input.lookDY || 0)));

  // 移动方向（局部）
  let mx = Math.max(-1, Math.min(1, input.moveX || 0));
  let mz = Math.max(-1, Math.min(1, input.moveZ || 0));
  const moving = !!(Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01);

  // 体力：喘气锁定 / 奔跑消耗 / 延迟回
  const panting = p.pantT > 0;
  if (panting) {
    p.pantT -= dt;
    if (p.pantT <= 0) p.pantT = 0;
  }
  let sprinting = false;
  if (!p.hidden && !panting && moving && input.sprint && p.stamina > 0) sprinting = true;
  if (sprinting) {
    p.stamina = Math.max(0, p.stamina - PLAYER.sprintDrain * dt);
    p.regenT = PLAYER.regenDelay;
    p.sprinted = true;
    if (p.stamina <= 0) { p.pantT = PLAYER.pantSec; run.events.push({ type: 'panting' }); }
  } else if (moving && p.regenT > 0) {
    p.regenT -= dt;
  } else if (!panting) {
    p.stamina = Math.min(PLAYER.staminaMax, p.stamina + PLAYER.regen * dt);
  }

  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let vx = 0, vz = 0;
  if (!p.hidden && moving) {
    vx = (fx * mz + rx * mx) * speed;
    vz = (fz * mz + rz * mx) * speed;
  }

  // 躲藏：靠近桌子 + 按 E 切换
  if (input.hide) {
    const nearTable = run.maze.tables.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < PLAYER.reachTable);
    if (nearTable || p.hidden) {
      p.hidden = !p.hidden;
      if (p.hidden) { p.hiddenOnce = true; run.events.push({ type: 'hidden' }); }
      else run.events.push({ type: 'unhidden' });
    }
  }

  const beforeX = p.x, beforeZ = p.z;
  moveCircle(p, vx * dt, vz * dt, PLAYER.radius, run.maze.walls);
  const ci = Math.floor(p.x / WORLD.CELL), cj = Math.floor(p.z / WORLD.CELL);
  run.explored[cj * WORLD.GRID_W + ci] = true;
  const movedDist = Math.hypot(p.x - beforeX, p.z - beforeZ);
  if (movedDist > 0.02) {
    p.moved = true;
    p.stepAcc += movedDist;
    if (p.stepAcc >= PLAYER.stepStride) { p.stepAcc -= PLAYER.stepStride; run.events.push({ type: 'footstep' }); }
  }

  // 体力药
  for (const pk of run.maze.pickups) {
    if (!pk.active) continue;
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < PLAYER.reachPickup) {
      pk.active = false;
      p.stamina = Math.min(PLAYER.staminaMax, p.stamina + PICKUP.staminaRestore);
      p.pantT = 0;
      run.events.push({ type: 'pickup' });
    }
  }

  // 到达当前出口
  if (Math.hypot(run.activeExit.x - p.x, run.activeExit.z - p.z) < PLAYER.reachExit) {
    const idx = run.exitIndex + 1;
    run.exitIndex++;
    run.events.push({ type: 'exit_found', index: idx });
    if (run.exitIndex >= WORLD.EXITS) {
      run.phase = 'won';
      run.events.push({ type: 'win' });
      return;
    }
    if (run.exitIndex % WORLD.REGEN_EVERY === 0) {
      run.segment++;
      regenMaze(run, false);
      run.events.push({ type: 'maze_regen', segment: run.segment });
    } else {
      run.activeExit = run.maze.exits[1];
    }
  }

  // 实体 AI
  updateEntity(run, sprinting || panting);

  // 荧光灯闪烁
  run.fx.t -= dt;
  if (run.fx.t <= 0) {
    if (run.fx.on) { run.fx.on = false; run.fx.t = FX.flickerMin + run.rnd() * (FX.flickerMax - FX.flickerMin); }
    else { run.fx.on = true; run.fx.t = FX.flickerOn; run.events.push({ type: 'flicker' }); }
  }
}

// ---------------------------------------------------------------- 实体 AI
function updateEntity(run, noisy) {
  const e = run.entity, p = run.player;
  const dx = p.x - e.x, dz = p.z - e.z;
  const dist = Math.hypot(dx, dz);
  const noiseDist = noisy ? (p.pantT > 0 ? ENTITY.hearDist : ENTITY.sprintHearDist) : 0;

  // 视觉：直视 3s 触发追逐
  if (!p.hidden && dist < ENTITY.visionDist && hasLOS(e.x, e.z, p.x, p.z, run.maze.walls)) {
    const toP = Math.atan2(-dx, -dz); // 朝向玩家所需 yaw
    const diff = Math.abs(wrapAngle(e.yaw - toP));
    if (diff < ENTITY.visionFov || dist < ENTITY.catchDist * 2) {
      e.stare += STEP;
      if (e.stare >= ENTITY.stareSec && e.state !== 'chase') {
        e.state = 'chase'; e.lastX = p.x; e.lastZ = p.z;
        run.events.push({ type: 'chase' });
      }
    }
  } else {
    e.stare = Math.max(0, e.stare - ENTITY.stareDecay * STEP);
  }

  // 听觉：跑/喘引它
  if (!p.hidden && noisy && dist < noiseDist && e.state !== 'chase') {
    e.state = 'chase'; e.lastX = p.x; e.lastZ = p.z;
    run.events.push({ type: 'chase' });
  }

  if (e.state === 'chase') {
    const see = !p.hidden && dist < ENTITY.visionDist && hasLOS(e.x, e.z, p.x, p.z, run.maze.walls);
    if (see) { e.lastX = p.x; e.lastZ = p.z; }
    // 躲桌底查桌（50%）
    if (p.hidden && dist < ENTITY.hideCheckDist) {
      if (run.rnd() < ENTITY.hideCheckChance) { catchPlayer(run); return; }
      e.state = 'search'; e.searchT = ENTITY.searchSec; run.events.push({ type: 'search' });
      return;
    }
    // 追到就抓
    if (!p.hidden && dist < ENTITY.catchDist) { catchPlayer(run); return; }
    // 朝目标走
    const tx = p.hidden ? e.lastX : (see ? p.x : e.lastX);
    const tz = p.hidden ? e.lastZ : (see ? p.z : e.lastZ);
    steerTo(e, tx, tz, ENTITY.chaseSpeed, run.maze.walls);
    if (!see && Math.hypot(e.x - tx, e.z - tz) < 0.8) { e.state = 'search'; e.searchT = ENTITY.searchSec; run.events.push({ type: 'search' }); }
    return;
  }

  if (e.state === 'search') {
    e.searchT -= STEP;
    steerTo(e, e.lastX, e.lastZ, ENTITY.wanderSpeed * 0.6, run.maze.walls);
    if (e.searchT <= 0) { e.state = 'wander'; e.repickT = 0; run.events.push({ type: 'wander' }); }
    return;
  }

  // wander
  e.repickT -= STEP;
  if (e.repickT <= 0 || Math.hypot(e.tx - e.x, e.tz - e.z) < 0.7) {
    const c = cellCenter(Math.floor(run.rnd() * WORLD.GRID_W), Math.floor(run.rnd() * WORLD.GRID_H));
    e.tx = c.x; e.tz = c.z; e.repickT = ENTITY.pathRepickSec + run.rnd() * 2;
  }
  steerTo(e, e.tx, e.tz, ENTITY.wanderSpeed, run.maze.walls);
}

function steerTo(e, tx, tz, speed, walls) {
  const dx = tx - e.x, dz = tz - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.02) return;
  const desired = Math.atan2(-dx, -dz);
  e.yaw = desired; // 实体直接面朝目标（剪影，无需转身动画）
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  moveCircle(e, fx * speed * STEP, fz * speed * STEP, ENTITY.radius, walls);
}

function catchPlayer(run) {
  run.caught++;
  run.penalty += FX.caughtPenalty;
  run.player.x = run.segStart.x; run.player.z = run.segStart.z;
  run.player.hidden = false;
  run.player.stamina = PLAYER.staminaMax;
  run.player.pantT = 0;
  run.entity.state = 'wander'; run.entity.stare = 0; run.entity.repickT = 0;
  const far = pickFarPoints(run.rnd, 1, run.player.x, run.player.z)[0] || cellCenter(5, 5);
  run.entity.x = far.x; run.entity.z = far.z;
  run.events.push({ type: 'caught' });
}

// ---------------------------------------------------------------- 读取接口
export function getHud(run) {
  return {
    time: run.time,
    exitsFound: run.exitIndex,
    totalExits: run.totalExits,
    segment: run.segment,
    caught: run.caught,
    stamina: run.player.stamina,
    staminaMax: PLAYER.staminaMax,
    hidden: run.player.hidden,
    panting: run.player.pantT > 0,
    entityState: run.entity.state,
    flicker: run.fx.on,
    phase: run.phase,
  };
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export default { createRun, updateSim, getHud, drainEvents, dailySeed, hashSeed, mulberry32 };
