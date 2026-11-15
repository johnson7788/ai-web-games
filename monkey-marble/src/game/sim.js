// src/game/sim.js — 纯逻辑核心：滚球物理 + 坡道/窄桥/移动锤/弹跳板 + 香蕉 + 检查点 + 计时评级。
// 无 DOM/THREE/Date.now；随机用 seed（当前关卡静态，seed 留作扩展）。60Hz 固定步长由 main 调用。
import { STEP, BALL, TRACK, RATING } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { createTrack } from './track.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ratingFor(netTime, targetSec) {
  if (netTime <= targetSec * RATING.s) return 'S';
  if (netTime <= targetSec * RATING.a) return 'A';
  if (netTime <= targetSec * RATING.b) return 'B';
  return 'C';
}

function emit(run, type, extra = {}) {
  run.events.push({ type, ...extra });
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const run = {
    seed,
    rng: mulberry32(seed),
    levelIndex: opts.levelIndex ?? 0,
    level: null,
    phase: 'playing', // playing | levelclear | finished
    time: 0,
    totalTime: 0,
    bananas: 0,
    totalBananas: 0,
    deaths: 0,
    rating: null,
    moved: false,
    braking: false,
    player: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false },
    bananas_list: [],
    hammers: [],
    pads: [],
    checkpoints: [],
    lastCheckpointZ: 0,
    distNext: 20,
    stats: { jumps: 0, falls: 0, hammerHits: 0, bounces: 0 },
    events: [],
  };
  loadLevel(run, run.levelIndex);
  return run;
}

function loadLevel(run, index) {
  const level = LEVELS[index];
  const lv = createTrack(level);
  run.level = lv;
  run.levelIndex = index;
  run.time = 0;
  run.bananas = 0;
  run.moved = false;
  run.braking = false;
  run.distNext = 10;
  run.bananas_list = level.bananas.map((b) => ({
    x: b.x,
    z: b.z,
    y: b.y ?? lv.surfaceY(b.z) + BALL.radius * 1.8,
    taken: false,
  }));
  run.hammers = level.hammers.map((h) => ({ ...h, cd: 0 }));
  run.pads = level.pads.map((p) => ({ ...p }));
  run.checkpoints = level.checkpoints.map((z) => ({ z, passed: false }));
  run.lastCheckpointZ = lv.spawn.z;
  const p = run.player;
  p.x = lv.spawn.x;
  p.z = lv.spawn.z;
  p.y = lv.surfaceY(lv.spawn.z) + BALL.radius + 0.15;
  p.vx = 0; p.vy = 0; p.vz = 0; p.onGround = false;
  run.stallZ = p.z;
  run.stallT = 0;
}

export function advanceLevel(run) {
  if (run.levelIndex + 1 >= LEVELS.length) return run;
  loadLevel(run, run.levelIndex + 1);
  run.phase = 'playing';
  emit(run, 'levelStart', { level: run.levelIndex + 1 });
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  return {
    phase: run.phase,
    time: run.time,
    totalTime: run.totalTime,
    level: run.levelIndex + 1,
    bananas: run.bananas,
    totalBananas: run.totalBananas,
    targetSec: run.level.targetSec,
    deaths: run.deaths,
    rating: run.rating,
    speed: Math.hypot(run.player.vx, run.player.vz),
    onGround: run.player.onGround,
  };
}

function respawn(run, { penalty = false, countDeath = true } = {}) {
  const p = run.player;
  const lv = run.level;
  p.x = lv.spawn.x;
  p.z = run.lastCheckpointZ;
  p.y = lv.surfaceY(run.lastCheckpointZ) + TRACK.checkpointHeight;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.onGround = false;
  run.stallZ = p.z;
  run.stallT = 0;
  if (penalty) {
    run.time += TRACK.fallPenalty;
    run.totalTime += TRACK.fallPenalty;
  }
  if (countDeath) {
    run.deaths++;
    run.stats.falls++;
    emit(run, 'fall', { deaths: run.deaths, penalty: penalty ? TRACK.fallPenalty : 0 });
  }
}

function clearLevel(run) {
  const lv = run.level;
  const net = Math.max(0, run.time - run.bananas * TRACK.bananaBonus);
  const rating = ratingFor(net, lv.targetSec);
  run.totalBananas += run.bananas;
  emit(run, 'levelCleared', {
    level: run.levelIndex + 1,
    time: Math.round(run.time * 10) / 10,
    bananas: run.bananas,
    rating,
    net: Math.round(net * 10) / 10,
  });
  if (run.levelIndex + 1 >= LEVELS.length) {
    run.phase = 'finished';
    run.rating = rating;
    emit(run, 'finished', {
      time: Math.round(run.totalTime * 10) / 10,
      bananas: run.totalBananas,
      rating,
      deaths: run.deaths,
    });
  } else {
    run.phase = 'levelclear';
  }
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { moveX: 0, moveZ: 0, jump: false, brake: false, respawn: false, ...input };
  if (run.phase !== 'playing') return run;

  const p = run.player;
  const lv = run.level;
  const B = BALL;

  run.time += dt;
  run.totalTime += dt;

  // 首次移动 → 教学“滚”步骤
  if (!run.moved && (input.moveX !== 0 || input.moveZ !== 0)) {
    run.moved = true;
    emit(run, 'roll');
  }

  // 手动回检查点
  if (input.respawn) {
    respawn(run, { penalty: false, countDeath: false });
    return run;
  }

  const onTrack = Math.abs(p.x) <= lv.halfWidthAt(p.z) + B.radius * 0.5 && p.z >= -2 && p.z <= lv.length + 2;
  const groundY = lv.surfaceY(p.z) + B.radius;

  // ---- 水平运动（速度目标模型：稳定无振荡，空中转向受限）----
  const control = p.onGround ? 1 : B.airControl;
  const rate = Math.min(1, B.steerRate * control * dt);
  p.vx += (input.moveX * B.latSpeed - p.vx) * rate;
  p.vz += (input.moveZ * B.maxSpeed - p.vz) * rate;

  // 坡道：下坡加速、上坡减速
  p.vz -= lv.slopeAt(p.z) * B.gravity * B.slopeGravity * dt;

  // 刹车
  if (input.brake) {
    const d = Math.max(0, 1 - B.brakeDecel * dt);
    p.vx *= d; p.vz *= d;
    if (!run.braking) { run.braking = true; emit(run, 'brake'); }
  } else {
    run.braking = false;
  }

  // 滚动阻力（无输入且在地面）
  if (!input.moveX && !input.moveZ && !input.brake && p.onGround) {
    const d = Math.max(0, 1 - B.friction * dt);
    p.vx *= d; p.vz *= d;
  }

  // 速度上限
  const hsp = Math.hypot(p.vx, p.vz);
  if (hsp > B.maxSpeed) { const k = B.maxSpeed / hsp; p.vx *= k; p.vz *= k; }

  // 跳跃
  if (input.jump && p.onGround) {
    p.vy = B.jumpVel;
    p.onGround = false;
    run.stats.jumps++;
    emit(run, 'jump');
  }

  // 重力 + 积分
  p.vy -= B.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;

  // 地面碰撞
  const wasGround = p.onGround;
  if (onTrack && p.y <= groundY && p.vy <= 0) {
    p.y = groundY;
    p.vy = 0;
    p.onGround = true;
  } else if (!onTrack && p.y >= groundY) {
    // 滚出边缘但仍在轨道平面上方（刚离开）→ 悬空
    p.onGround = false;
  } else {
    p.onGround = false;
  }
  if (p.onGround && !wasGround) emit(run, 'land');

  // 摔出赛道 → 回检查点
  if (!onTrack && p.y < lv.surfaceY(p.z) - 6) {
    respawn(run, { penalty: true, countDeath: true });
    return run;
  }

  // 不作为/卡死 → 赛道塌陷判死（原地不动超时，补「不作为也会失败」的失败态）
  if (p.z > run.stallZ + TRACK.stallMinProgress) {
    run.stallZ = p.z;
    run.stallT = 0;
  } else {
    run.stallT += dt;
  }
  if (run.stallT > TRACK.stallTimeout) {
    respawn(run, { penalty: true, countDeath: true });
    return run;
  }

  // 弹跳板
  if (p.onGround) {
    for (const pad of run.pads) {
      if (Math.abs(p.z - pad.z) < 0.6 && Math.abs(p.x) < pad.halfWidth) {
        p.vy = B.bounceVel;
        p.onGround = false;
        run.stats.bounces++;
        emit(run, 'bounce');
      }
    }
  }

  // 移动锤
  for (const h of run.hammers) {
    h.cd = Math.max(0, h.cd - dt);
    const barX = Math.sin(h.phase + run.time * h.freq * Math.PI * 2) * h.arm;
    const barY = lv.surfaceY(h.z) + B.radius;
    h.barX = barX;
    h.barY = barY;
    const hitX = Math.abs(p.x - barX) < (0.26 + B.radius);
    const hitZ = Math.abs(p.z - h.z) < 0.34;
    const hitY = p.y < barY + B.radius; // 跳得不够高才会被砸中
    if (h.cd <= 0 && hitX && hitZ && hitY) {
      h.cd = 0.6;
      run.stats.hammerHits++;
      p.vx += Math.sign(p.x - barX || 1) * 6;
      p.vz -= 5;
      p.vy += 4;
      p.onGround = false;
      emit(run, 'hammerHit', { z: h.z });
    }
  }

  // 吃香蕉
  for (const b of run.bananas_list) {
    if (b.taken) continue;
    const dx = p.x - b.x, dy = p.y - b.y, dz = p.z - b.z;
    if (dx * dx + dy * dy + dz * dz < TRACK.bananaRadius * TRACK.bananaRadius) {
      b.taken = true;
      run.bananas++;
      emit(run, 'pickup', { bananas: run.bananas });
    }
  }

  // 检查点
  for (const cp of run.checkpoints) {
    if (!cp.passed && p.z >= cp.z) {
      cp.passed = true;
      run.lastCheckpointZ = cp.z;
      emit(run, 'checkpoint', { z: cp.z });
    }
  }

  // 距离事件（保持反馈密度）
  if (p.z >= run.distNext) {
    run.distNext += 10;
    emit(run, 'dist', { z: Math.round(p.z) });
  }

  // 终点
  if (p.z >= lv.length - 1) {
    clearLevel(run);
  }

  return run;
}
