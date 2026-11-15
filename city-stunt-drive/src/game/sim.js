// src/game/sim.js — 纯逻辑核心：3D 特技车（油门/转向/空中翻转/氮气/落地连击/金币/翻车）。
// 无 DOM/THREE/Date.now；随机不进判定（赛道与金币全 config 确定）。60Hz 由 main 调用。
import { STEP, WORLD, CARS, CAR_COMMON, RAMPS, TRACK, COINS, LAND, RATINGS } from '../../config/game.config.js';
import { createTrack } from './track.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function ratingFor(score) {
  for (const [name, min] of RATINGS) if (score >= min) return name;
  return 'C';
}

export function createSim(opts = {}) {
  const track = createTrack({ ramps: RAMPS, track: TRACK, coins: COINS, gravity: WORLD.gravity });
  const run = {
    seed: opts.seed ?? 1,
    car: opts.car ?? 0,
    phase: 'run',          // run | finished
    time: 0,
    score: 0,
    combo: 0,
    coins: 0,              // 本局吃到的金币数
    currency: 0,           // 本局赚到的货币（结算入账）
    nitro: 0,
    boostT: 0,
    zoneIdx: 0,
    zoneReached: 0,
    distNext: TRACK.distEvery,
    deaths: 0,
    player: {
      x: 0, y: WORLD.carY, z: 0,
      vx: 0, vy: 0, vz: 0,
      roll: 0, pitch: 0, yaw: 0,
      grounded: true, airborne: false,
      airRoll: 0, airYaw: 0, overturnT: 0,
    },
    stats: { topCombo: 0, farthestFlip: 0, perfects: 0, flips: 0, wrecks: 0 },
    track,
    events: [],
  };
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  const p = run.player;
  return {
    phase: run.phase, time: run.time,
    score: Math.round(run.score), combo: run.combo,
    coins: run.coins, nitro: run.nitro,
    boost: run.boostT > 0,
    kmh: Math.round(Math.max(0, p.vz) * 3.6),
    zone: Math.max(1, Math.min(5, run.zoneReached + 1)), zoneTotal: 5,
    flips: run.stats.flips,
  };
}

function spec(run) { return { ...CAR_COMMON, ...(CARS[run.car] || CARS[0]) }; }

function emit(run, type, extra) { run.events.push({ type, ...extra }); }

function land(run, s) {
  const p = run.player;
  const rollN = Math.abs(normAngle(p.roll));
  const pitchN = Math.abs(normAngle(p.pitch));
  const yawN = Math.abs(normAngle(p.yaw));
  const circles = Math.round(Math.abs(p.airRoll) / (2 * Math.PI));
  const aligned = p.vz > 1;
  if (rollN < LAND.perfectAngle && pitchN < LAND.perfectAngle && yawN < LAND.perfectYaw && aligned) {
    run.combo = Math.min(LAND.comboMax, run.combo + 1);
    const gain = circles * LAND.circlesScore * run.combo + LAND.perfectBonus * run.combo;
    run.score += gain;
    run.stats.perfects++;
    run.stats.topCombo = Math.max(run.stats.topCombo, run.combo);
    run.stats.farthestFlip = Math.max(run.stats.farthestFlip, circles);
    if (circles > 0) run.stats.flips += circles;
    run.nitro = Math.min(s.nitroMax, run.nitro + 0.35);
    emit(run, 'perfect', { combo: run.combo, circles, gain: Math.round(gain) });
    if (circles > 0) emit(run, 'flip', { circles, combo: run.combo });
  } else {
    run.combo = 0;
    if (circles > 0) run.score += circles * LAND.circlesScore;
    p.vz *= s.crashSpeedMul;
    emit(run, 'badLand', { circles });
  }
  p.airRoll = 0; p.airYaw = 0;
}

function wreck(run) {
  run.deaths++;
  run.combo = 0;
  run.stats.wrecks++;
  const p = run.player;
  const ramp = RAMPS[Math.min(run.zoneIdx, RAMPS.length - 1)] || RAMPS[0];
  p.x = 0; p.y = WORLD.carY; p.z = ramp.z - 16;
  p.vx = 0; p.vy = 0; p.vz = 8;
  p.roll = 0; p.pitch = 0; p.yaw = 0;
  p.overturnT = 0; p.grounded = true; p.airborne = false; p.airRoll = 0; p.airYaw = 0;
  emit(run, 'wreck', { deaths: run.deaths });
}

function collectCoins(run, s) {
  const p = run.player;
  const r2 = COINS.radius * COINS.radius;
  for (const c of run.track.coins) {
    if (c.taken) continue;
    if (Math.abs(c.z - p.z) > COINS.radius + 3) continue;
    const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z;
    if (dx * dx + dy * dy + dz * dz < r2) {
      c.taken = true;
      run.coins++;
      run.currency += COINS.currency;
      run.score += COINS.score * Math.max(1, run.combo);
      run.nitro = Math.min(s.nitroMax, run.nitro + COINS.nitro);
      emit(run, 'coin', { n: run.coins, value: COINS.score * Math.max(1, run.combo) });
    }
  }
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  if (run.phase !== 'run') return run;
  input = { throttle: 0, steer: 0, flip: 0, yaw: 0, nitro: false, ...input };
  run.time += dt;
  const s = spec(run);
  const p = run.player;

  // 氮气
  if (run.boostT > 0) run.boostT -= dt;
  if (input.nitro && run.nitro >= s.nitroMax && run.boostT <= 0) {
    run.nitro = 0;
    run.boostT = s.nitroTime;
    emit(run, 'nitro');
  }
  const maxSpeed = s.maxSpeed * (run.boostT > 0 ? s.nitroMul : 1);

  if (p.grounded) {
    const slope = run.track.slopeAt(p.z);
    if (Math.abs(normAngle(p.roll)) < s.overturnThreshold) {
      // 正常行驶
      if (input.throttle > 0) p.vz += s.accel * input.throttle * dt * (1 - 0.45 * (p.vz / maxSpeed));
      else if (input.throttle < 0) p.vz = Math.max(-8, p.vz - s.brake * -input.throttle * dt);
      p.vz = clamp(p.vz, -8, maxSpeed * 1.05);
      const spd = clamp(p.vz / s.maxSpeed, 0, 1);
      const vxT = input.steer * s.steer * spd;
      p.vx += (vxT - p.vx) * Math.min(1, s.steerLerp * dt);
      // 车身回正：沿最短路径（用归一化角度，避免从 2π 回 0 时扫过 180° 被误判翻车）
      p.roll -= normAngle(p.roll) * Math.min(1, 8 * dt);
      const pitchT = Math.atan2(slope, 1);
      p.pitch += (pitchT - normAngle(p.pitch)) * Math.min(1, 8 * dt);
      p.yaw -= normAngle(p.yaw) * Math.min(1, 6 * dt);
      p.overturnT = 0;
      p.vy = p.vz * slope;   // 沿坡面切线（上坡获得向上速度）
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const gy = run.track.groundY(p.z) + WORLD.carY;
      if (p.y <= gy + 0.4) {
        p.y = gy;
      } else {
        // 坡顶起飞（地面突然回落）
        p.grounded = false; p.airborne = true;
        p.airRoll = 0; p.airYaw = 0;
        emit(run, 'launch');
      }
      if (Math.abs(p.x) > run.track.halfWidth) {
        p.x = clamp(p.x, -run.track.halfWidth, run.track.halfWidth);
        p.vx *= 0.4;
      }
    } else {
      // 翻车（屋顶朝地）
      p.overturnT += dt;
      if (input.flip !== 0) p.roll += input.flip * s.flipRecover * dt;
      p.vz *= (1 - 1.5 * dt);
      p.vx *= (1 - 1.5 * dt);
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.y = run.track.groundY(p.z) + WORLD.carY;
      if (p.overturnT >= s.wreckTime) wreck(run);
    }
  } else {
    // 空中
    p.vy -= WORLD.gravity * dt;
    p.vz *= (1 - WORLD.airDrag * dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (input.flip !== 0) { const d = input.flip * s.airRoll * dt; p.roll += d; p.airRoll += d; }
    if (input.yaw !== 0) { const d = input.yaw * s.airYaw * dt; p.yaw += d; p.airYaw += d; }
    p.pitch += (0 - p.pitch) * Math.min(1, s.pitchLevel * dt);
    const gy = run.track.groundY(p.z) + WORLD.carY;
    if (p.y <= gy && p.vy <= 0) {
      p.y = gy; p.vy = 0;
      p.grounded = true; p.airborne = false;
      land(run, s);
    }
    if (p.z < -2) { p.z = -2; p.vz = Math.max(0, p.vz); }
  }

  collectCoins(run, s);

  if (p.z >= run.distNext) { run.distNext += TRACK.distEvery; run.score += TRACK.distScore; emit(run, 'dist', { m: Math.round(p.z) }); }

  while (run.zoneIdx < run.track.zoneZ.length && p.z >= run.track.zoneZ[run.zoneIdx]) {
    run.zoneIdx++;
    run.zoneReached = run.zoneIdx;
    run.score += TRACK.zoneBonus;
    emit(run, 'zone', { n: run.zoneIdx, bonus: TRACK.zoneBonus });
  }

  if (p.z >= run.track.finishZ) {
    run.phase = 'finished';
    emit(run, 'finish', { score: Math.round(run.score), rating: ratingFor(run.score) });
  }

  return run;
}
