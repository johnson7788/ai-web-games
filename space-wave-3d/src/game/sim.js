// src/game/sim.js — SPACE WAVE 3D 纯逻辑核心：单键垂直穿越 + 程序化管道/门 + 连穿倍率 + 护盾/能量球。
// 无 DOM / window / localStorage / Date.now；随机用 mulberry32 seed。60Hz 由 main 调用。
import { STEP, TUNNEL, SHIP, SPEED, SCORE, segmentAt } from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ratingFor(score) {
  let r = 'C';
  for (const [name, min] of SCORE.ratings) if (score >= min) { r = name; break; }
  return r;
}

// 某门在时刻 t 的缝隙中心 y（移动柱/旋转环随时间摆动）
export function gateCenterY(gate, t) {
  const seg = segmentAt(gate.level);
  if (!seg.amp) return gate.gapY;
  return gate.gapY + Math.sin(t * seg.freq + gate.phase) * seg.amp;
}

// 门在某时刻的安全半高（极限窄缝无额外变动）
export function gateHalfH(gate) {
  return gate.gapH;
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const run = {
    seed,
    phase: 'playing', // playing | dead | finished
    time: 0,
    dist: 0,
    speed: SPEED.min,
    y: SHIP.y0,
    vy: 0,
    score: 0,
    mult: 1,
    combo: 0,
    shield: SCORE.shieldMax,
    invuln: 0,
    slowmo: 0,
    level: 1,
    nextGateDist: TUNNEL.gateEvery,
    nextOrbDist: 70 + rng() * 40,
    obstacles: [], // { x, gapY, gapH, level, phase, kind, passed }
    orbs: [],      // { x, y, taken }
    stats: { perfects: 0, nearMisses: 0, orbs: 0, topMult: 1, maxLevel: 1, firstInputT: null, firstSuccessT: null },
    events: [],
    rng,
  };
  run.tickT = 1.0; // 距离/分数持续累积的感知节拍（每 1s 一发，画面从不静止）
  emit(run, 'start');
  return run;
}

function emit(run, type, extra = {}) { run.events.push({ type, t: run.time, ...extra }); }

export function drainEvents(run) { const ev = run.events; run.events = []; return ev; }

export function getHud(run) {
  return {
    phase: run.phase, time: run.time, dist: run.dist, score: Math.round(run.score),
    mult: run.mult, combo: run.combo, shield: run.shield, speed: run.speed,
    level: run.level, slowmo: run.slowmo > 0,
  };
}

function currentSegment(run) { return segmentAt(run.level); }

// 前进速度：随里程爬升；加速段临时 boost
function computeSpeed(run) {
  const seg = currentSegment(run);
  let s = SPEED.min + (SPEED.max - SPEED.min) * clamp(run.dist / SPEED.rampDist, 0, 1);
  if (seg.boost) s *= SPEED.boostMul;
  return s;
}

function spawnGate(run) {
  const seg = currentSegment(run);
  const margin = seg.gapH + 0.4;
  const yMax = TUNNEL.range - margin;
  // 极限窄缝连穿段：缝隙更居中，便于连穿（但依然窄）
  const spread = seg.streak ? 0.55 : 1;
  // 第一道门固定居中宽缝，保证首局可读
  const first = run.obstacles.length === 0;
  const gapY = first ? 0 : clamp((run.rng() * 2 - 1) * yMax * spread, -yMax * spread, yMax * spread);
  run.obstacles.push({
    x: run.nextGateDist,
    gapY,
    gapH: first ? 3.8 : seg.gapH,
    level: run.level,
    phase: run.rng() * 6.28,
    kind: first ? 'ring' : seg.kind,
    passed: false,
  });
  run.nextGateDist += TUNNEL.gateEvery + run.rng() * TUNNEL.gateJitter;
}

function spawnOrb(run) {
  const y = (run.rng() * 2 - 1) * (TUNNEL.range - 1.2);
  run.orbs.push({ x: run.nextOrbDist, y, taken: false });
  run.nextOrbDist += 90 + run.rng() * 120;
}

function hitGate(run, gate) {
  // 判定：船 z 平面与门 x 重合（一次性，用 passed 去重）
  const center = gateCenterY(gate, run.time);
  const half = gateHalfH(gate);
  const dy = Math.abs(run.y - center);
  const collided = dy > half;

  if (collided) {
    if (run.invuln > 0) { gate.passed = true; return; }
    if (run.shield > 0) {
      run.shield -= 1;
      run.invuln = SCORE.invulnSec;
      run.combo = 0;
      run.mult = 1;
      emit(run, 'shield', { y: run.y });
      gate.passed = true;
      return;
    }
    run.phase = 'dead';
    emit(run, 'fail', { score: Math.round(run.score), rating: ratingFor(run.score) });
    gate.passed = true;
    return;
  }

  // 穿越成功
  gate.passed = true;
  if (dy <= SCORE.perfectTol) {
    run.combo += 1;
    run.mult = Math.min(SCORE.multMax, run.combo);
    run.stats.topMult = Math.max(run.stats.topMult, run.mult);
    run.stats.perfects += 1;
    if (run.stats.firstSuccessT == null) run.stats.firstSuccessT = run.time;
    const add = SCORE.perfect * run.mult;
    run.score += add;
    // 签名：极限窄缝连穿，时间凝滞 0.2s
    const slow = currentSegment(run).streak;
    emit(run, 'perfect', { mult: run.mult, add, y: run.y, slow });
    if (slow) run.slowmo = SCORE.slowmoSec;
    else if (run.combo >= 2) emit(run, 'combo', { mult: run.mult });
  } else if (dy <= SCORE.nearTol) {
    run.stats.nearMisses += 1;
    run.score += SCORE.nearBonus * run.mult;
    emit(run, 'nearMiss', { add: Math.round(SCORE.nearBonus * run.mult) });
  } else {
    // 普通穿越：连穿链断开
    run.combo = 0;
    run.mult = 1;
    emit(run, 'pass');
  }
}

function hitOrb(run, orb) {
  if (Math.abs(run.y - orb.y) > 1.0) return false;
  orb.taken = true;
  run.stats.orbs += 1;
  if (run.stats.firstSuccessT == null) run.stats.firstSuccessT = run.time;
  if (run.shield < SCORE.shieldMax) {
    run.shield += 1;
    emit(run, 'orb', { shield: true });
  } else {
    run.score += SCORE.orbScore * run.mult;
    emit(run, 'orb', { add: SCORE.orbScore * run.mult });
  }
  return true;
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { hold: false, ...input };
  const t = run.time;
  const scale = run.slowmo > 0 ? SCORE.slowmoScale : 1;
  const dts = dt * scale;
  run.slowmo = Math.max(0, run.slowmo - dt);
  run.invuln = Math.max(0, run.invuln - dt);

  if (run.phase !== 'playing') return run;

  // 首次有效输入打点（bot 遥测用）
  if (input.hold && run.stats.firstInputT == null) {
    run.stats.firstInputT = t;
    emit(run, 'first_input');
  }

  // 垂直物理：按住上升，松手下坠
  run.vy += (input.hold ? SHIP.thrust : -SHIP.gravity) * dts;
  run.vy = clamp(run.vy, -SHIP.vmax, SHIP.vmax);
  run.y += run.vy * dts;
  if (run.y > TUNNEL.range) { run.y = TUNNEL.range; run.vy = 0; }
  if (run.y < -TUNNEL.range) { run.y = -TUNNEL.range; run.vy = 0; }

  // 前进 + 速度
  run.speed = computeSpeed(run);
  run.dist += run.speed * dts;
  run.score += run.speed * dts * SCORE.distPerMeter;
  run.time += dt;

  // 分数持续累积的可感知节拍
  run.tickT -= dt;
  if (run.tickT <= 0) { run.tickT = 1.0; emit(run, 'dist', { m: Math.round(run.dist) }); }

  // 段切换
  const level = 1 + Math.floor(run.dist / SCORE.segmentLen);
  if (level !== run.level) {
    run.level = level;
    run.stats.maxLevel = Math.max(run.stats.maxLevel, level);
    emit(run, 'segment', { level });
  }

  // 生成门 / 球
  while (run.nextGateDist < run.dist + TUNNEL.lookAhead) spawnGate(run);
  if (currentSegment(run).orb) {
    while (run.nextOrbDist < run.dist + TUNNEL.lookAhead) spawnOrb(run);
  }

  // 碰撞判定（只判穿过船 z 平面附近、尚未结算的门）
  for (let i = run.obstacles.length - 1; i >= 0; i--) {
    const g = run.obstacles[i];
    if (g.passed) { if (g.x < run.dist - TUNNEL.despawnBehind) run.obstacles.splice(i, 1); continue; }
    if (g.x <= run.dist) hitGate(run, g);
  }
  for (let i = run.orbs.length - 1; i >= 0; i--) {
    const o = run.orbs[i];
    if (o.taken || o.x < run.dist - TUNNEL.despawnBehind) { run.orbs.splice(i, 1); continue; }
    if (o.x <= run.dist) hitOrb(run, o);
  }

  if (run.phase !== 'playing') {
    emit(run, 'session_end', { dist: Math.round(run.dist) });
    return run;
  }
  return run;
}
