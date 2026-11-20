// src/game/sim.js — RING CYCLE · M1 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/analysis.md（事件名 / 接口签名一字不差）
// 模型：世界向下滚动（depth 增），糖球固定在屏幕 y=BALL_Y，彩环从上方下落；
//       糖球横移（steerX）到与自身颜色相同的格子穿过环得分；异色=死亡；
//       白=万能安全但随机换色；木=一次性跳板（保连击不染色）；连吃 5 同色=彩虹糖雨。
import { WORLD, STEP } from '../../config/game.config.js';
import {
  BALL, COLOR, COMBO, SCORE, NEAR_MISS, STEER,
  RINGS_PER_BAND, SPAWN, clamp, comboMult,
} from '../../config/gameplay.js';
import { BAND_COUNT, bandIndexAt, bandAt, bandNumber, sceneAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { spawnRing, updateRing } from './spawner.js';

const PX = WORLD.PX_PER_METER;

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    depth: 0,                 // 累计下滚像素
    ball: { x: BALL.START_X, vx: 0, angle: 0 },
    dye: 0,                   // 当前生命线颜色 0..COLOR.COUNT-1
    rings: [],                // { id, worldY, cellsCount, cellW, colors[], xOffset, moving, swap, resolved, ... }
    nextId: 1,
    spawn: { nextY: SPAWN.FIRST },
    score: 0,
    ringsCleared: 0,
    band: 1,
    combo: 0,
    maxCombo: 0,
    sameStreak: 0,
    maxSameStreak: 0,
    woodSaves: 0,
    lastClear: -Infinity,
    nearMissAt: -Infinity,
    _lastMile: 0,
    stats: {
      bandReached: 1,
      ringsCleared: 0,
      maxCombo: 0,
      rainbowCount: 0,
      woodSaves: 0,
    },
    events: [],
  };

  spawnUpTo(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);

  // 调试/营销物料：跳到指定带（重建环阵，环确实属于该带）
  run.jumpToBand = (n) => {
    const target = clamp(n, 1, BAND_COUNT);
    run.ringsCleared = (target - 1) * RINGS_PER_BAND;
    run.band = target;
    run.dye = (target - 1) % COLOR.COUNT;
    run.rings = [];
    run.spawn.nextY = run.depth + SPAWN.FIRST;
    spawnUpTo(run);
    run.stats.bandReached = Math.max(run.stats.bandReached, target);
    return target;
  };

  return run;
}

// 兼容旧骨架别名
export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const steerX = input.steerX == null ? null : clamp(input.steerX, 0, WORLD.WIDTH);

  updateSteer(run, steerX, dt);   // 1 转向
  scrollAndMile(run, dt);         // 2 下滚 / 深度里程碑
  spawnUpTo(run);                 // 3 生成
  updateRings(run, dt);           // 4 移动环/变色环
  resolveCrossings(run);          // 5 穿过环判定
  updateComboWindow(run);         // 6 连击窗口超时
  cull(run);                      // 7 清理已滚过环

  run.stats.ringsCleared = run.ringsCleared;
  run.stats.maxCombo = run.maxCombo;
  run.stats.bandReached = Math.max(run.stats.bandReached, run.band);
}

// ---------- 转向（缓动追踪） ----------
function updateSteer(run, steerX, dt) {
  const b = run.ball;
  if (steerX == null) {
    b.vx = 0;
  } else {
    b.vx = clamp((steerX - b.x) * STEER.LERP, -STEER.MAX_VX, STEER.MAX_VX);
    b.x += b.vx * dt;
  }
  b.x = clamp(b.x, BALL.R, WORLD.WIDTH - BALL.R);
  b.angle = clamp(b.vx * STEER.TILT_PER_VX, -STEER.MAX_TILT, STEER.MAX_TILT);
}

// ---------- 下滚 / 深度里程碑 ----------
function scrollAndMile(run, dt) {
  const band = bandAt(run.ringsCleared);
  run.depth += band.scroll * dt;

  const mile = Math.floor(run.depth / (PX * 25));
  if (mile > run._lastMile) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'depthMilestone', { depth: Math.floor(run.depth / PX) });
  }
}

// ---------- 生成 ----------
function spawnUpTo(run) {
  while (run.spawn.nextY < run.depth + SPAWN.LOOKAHEAD) {
    const y = run.spawn.nextY;
    const band = bandAt(run.ringsCleared);
    const ring = spawnRing(run, band, y);
    run.rings.push(ring);
    emit(run, 'ringApproach', { x: 0, y: ringScreenY(run, ring), band: band.index });
    run.spawn.nextY += band.gap || 520;
  }
}

function updateRings(run, dt) {
  for (const ring of run.rings) updateRing(run, ring, dt);
}

// ---------- 穿过环判定 ----------
function resolveCrossings(run) {
  for (const ring of run.rings) {
    if (ring.resolved) continue;
    if (ring.worldY <= run.depth) {
      ring.resolved = true;
      resolveRing(run, ring);
      if (run.phase !== 'playing') return;
    }
  }
}

function cellAtX(ring, ballX) {
  const local = (((ballX - ring.xOffset) % WORLD.WIDTH) + WORLD.WIDTH) % WORLD.WIDTH;
  const i = Math.min(ring.cellsCount - 1, Math.max(0, Math.floor(local / ring.cellW)));
  return { index: i, color: ring.colors[i] };
}

function resolveRing(run, ring) {
  const x = run.ball.x;
  const y = WORLD.BALL_Y;
  const cell = cellAtX(ring, x);
  const color = cell.color;

  if (color === COLOR.WOOD) {
    // 木环跳板：救急，不染色不得分，保连击
    run.woodSaves += 1;
    run.stats.woodSaves = run.woodSaves;
    emit(run, 'ringBounce', { x, y, score: run.score });
    return;
  }

  if (color === COLOR.WHITE) {
    clearRing(run, ring, cell, 'white', x, y);
    return;
  }

  // 染色格 0..3
  if (color === run.dye) {
    clearRing(run, ring, cell, 'match', x, y);
  } else {
    die(run);
  }
}

function clearRing(run, ring, cell, kind, x, y) {
  run.ringsCleared += 1;
  run.combo += 1;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  run.lastClear = run.time;

  if (kind === 'white') {
    run.score += SCORE.WHITE;
    run.sameStreak = 0;
    const old = run.dye;
    let nd = old;
    while (nd === old) nd = Math.floor(run.rng() * COLOR.COUNT);
    run.dye = nd;
    emit(run, 'ringClear', { x, y, kind: 'white', color: COLOR.WHITE, score: run.score });
    emit(run, 'dyeShift', { dye: run.dye });
  } else {
    run.score += SCORE.CLEAR;
    run.sameStreak += 1;
    run.maxSameStreak = Math.max(run.maxSameStreak, run.sameStreak);
    if (run.combo % 3 === 0) emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
    if (run.sameStreak >= COMBO.RAINBOW_STREAK) {
      run.sameStreak = 0;
      run.score += SCORE.RAINBOW;
      run.stats.rainbowCount += 1;
      emit(run, 'rainbow', { x, y, score: run.score });
    }
    emit(run, 'ringClear', { x, y, kind: 'match', color: cell.color, score: run.score });
    maybeNearMiss(run, ring, x);
  }

  // 带推进：每 RINGS_PER_BAND 环进一带，染料轮转 +1（颜色随进度轮转）
  const newBand = bandNumber(run.ringsCleared);
  if (newBand !== run.band) {
    run.band = newBand;
    run.dye = (run.dye + 1) % COLOR.COUNT;
    emit(run, 'dyeShift', { dye: run.dye });
    emit(run, 'bandEnter', { band: run.band, name: `band.${run.band}` });
  }

  // 里程碑（反馈密度）
  if (run.ringsCleared % SCORE.MILESTONE_EVERY === 0) {
    emit(run, 'ringMilestone', { rings: run.ringsCleared, score: run.score });
  }
}

// ---------- nearMiss ----------
function isDeadly(color, dye) {
  return color >= 0 && color !== dye;
}

function maybeNearMiss(run, ring, ballX) {
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  const local = (((ballX - ring.xOffset) % WORLD.WIDTH) + WORLD.WIDTH) % WORLD.WIDTH;
  const i = Math.min(ring.cellsCount - 1, Math.max(0, Math.floor(local / ring.cellW)));
  const within = local - i * ring.cellW;
  let gap = Infinity;
  if (i > 0 && isDeadly(ring.colors[i - 1], run.dye)) gap = Math.min(gap, within);
  if (i < ring.cellsCount - 1 && isDeadly(ring.colors[i + 1], run.dye)) gap = Math.min(gap, ring.cellW - within);
  if (gap < NEAR_MISS.GAP) {
    run.nearMissAt = run.time;
    emit(run, 'nearMiss', { x: ballX, y: WORLD.BALL_Y });
  }
}

// ---------- 死亡 ----------
function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { x: run.ball.x, y: WORLD.BALL_Y });
}

// ---------- 连击窗口超时 ----------
function updateComboWindow(run) {
  if (run.combo > 0 && run.time - run.lastClear > COMBO.WINDOW) {
    run.combo = 0;
    run.lastClear = -Infinity;
    run.sameStreak = 0;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 清理 ----------
function cull(run) {
  run.rings = run.rings.filter((r) => r.worldY > run.depth - 400);
}

// ---------- 屏幕坐标 ----------
function ringScreenY(run, ring) {
  return WORLD.BALL_Y + (run.depth - ring.worldY);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const band = bandAt(run.ringsCleared);
  const scene = sceneAt(bandIndexAt(run.ringsCleared));
  const nextBandRings = RINGS_PER_BAND - (run.ringsCleared % RINGS_PER_BAND);
  return {
    score: run.score,
    band: run.band,
    bandName: `band.${run.band}`,
    bandTotal: BAND_COUNT,
    sceneName: scene.name,
    sceneId: scene.id,
    combo: run.combo,
    sameStreak: run.sameStreak,
    dye: run.dye,
    ringsCleared: run.ringsCleared,
    nextBandRings,
    phase: run.phase,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// 供渲染 / greedy bot 复用：环内第 i 格的屏幕中心 x（含 marquee 偏移，无 wrap）
export function cellScreenX(ring, i) {
  return ring.xOffset + i * ring.cellW + ring.cellW / 2;
}

export function cellColor(ring, i) {
  return ring.colors[i];
}
