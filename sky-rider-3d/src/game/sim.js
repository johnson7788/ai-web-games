// src/game/sim.js — 纯逻辑核心：飞机穿环竞速。无 DOM/THREE/Date.now；随机用 seed。
// 事件总线：run.events（drainEvents 消费）。60Hz 固定步长由 main 调用。
// 判定几何全代码：环平面穿越 + 半径判定（撞环/漏环/穿环）、地面碰撞、尾流、bot AI、排名。
import { STEP, CONFIG, PLANE, BOOST, RING, SLIPSTREAM, RACE, BOT, RATING, TRACKS } from '../../config/game.config.js';
import { createCourse, ringCenter, signedD, wrap } from './track.js';

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

function makePlane(x, y, z, yaw, opts = {}) {
  return {
    pos: { x, y, z },
    yaw, pitch: 0, roll: 0, speed: PLANE.baseSpeed * (opts.skill ?? 1),
    boost: BOOST.max, boosting: false,
    ringIndex: 0, lap: 1, ringsPassed: 0, finishTime: null, finished: false,
    fx: 0, fy: 0, fz: 1, _d: null,
    skill: opts.skill ?? 1, err: opts.err ?? 0.2, errPhase: opts.phase ?? 0,
    boostT: 0, color: opts.color ?? 0xffffff,
  };
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const trackIndex = opts.trackIndex ?? 0;
  const def = TRACKS[trackIndex] || TRACKS[0];
  const track = createCourse(def);
  const rng = mulberry32(seed);

  const run = {
    seed, trackIndex, def, track,
    phase: 'countdown',   // countdown | race | finished
    countdownT: 0, time: 0,
    rank: 8, rating: 'C',
    slipstream: false, slipCd: 0,
    dist: 0, distNext: RACE.distStep,
    stats: { ringsPassed: 0, ringsTotal: CONFIG.laps * track.ringCount, hits: 0, misses: 0, crashes: 0, topSpeed: 0 },
    bots: [],
    events: [],
    rng,
    player: makePlane(0, 0, 0, 0, { skill: 1, err: 0 }),
  };

  // 起跑线：第一环正后方 60m，横排错位（留出足够距离让首环在画面里是清晰的「环」而非铺满屏幕）
  const r0 = track.rings[0];
  const slots = 8;
  for (let i = 0; i < slots; i++) {
    const lateral = (i - (slots - 1) / 2) * 4.5;
    const sx = -r0.nz * lateral, sz = r0.nx * lateral;
    const x = r0.bx - r0.nx * 60 + sx;
    const y = r0.by + 2;
    const z = r0.bz - r0.nz * 60 + sz;
    const yaw = Math.atan2(r0.nx, r0.nz);
    if (i === 0) {
      run.player.pos.x = x; run.player.pos.y = y; run.player.pos.z = z;
      run.player.yaw = yaw;
      run.player._d = signedD(run.player.pos, r0);
    } else {
      const bi = i - 1;
      const b = makePlane(x, y, z, yaw, {
        skill: BOT.skill[bi], err: BOT.err[bi], phase: rng() * Math.PI * 2, color: BOT.colors[bi],
      });
      b._d = signedD(b.pos, r0);
      run.bots.push(b);
    }
  }
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

function emit(run, type, extra) {
  run.events.push({ type, ...extra });
}

function nextRing(plane, run) {
  plane.ringIndex += 1;
  if (plane.ringIndex >= run.track.ringCount) {
    plane.ringIndex = 0;
    plane.lap += 1;
  }
}

function computeResult(run) {
  const p = run.player;
  const playerT = p.finishTime;
  const botTimes = run.bots.map((b) => {
    if (b.finishTime != null) return b.finishTime;
    const remaining = (CONFIG.laps - b.lap) * run.track.ringCount + (run.track.ringCount - b.ringIndex);
    const perRing = run.track.length / run.track.ringCount / Math.max(1, b.speed);
    return run.time + remaining * perRing;
  });
  const rank = 1 + botTimes.filter((t) => t < playerT).length;
  let rating = 'C';
  for (const [minRank, r] of RATING.rank) if (rank <= minRank) { rating = r; break; }
  if (run.stats.crashes >= RATING.crashDowngrade && (rating === 'S' || rating === 'A')) rating = 'B';
  return { rank, rating };
}

function onCross(run, plane, isPlayer, radial2) {
  const r = run.track.rings[plane.ringIndex];
  const R2 = r.radius * r.radius;
  if (isPlayer) {
    if (radial2 <= R2) {
      plane.ringsPassed += 1;
      run.stats.ringsPassed += 1;
      plane.boost = Math.min(BOOST.max, plane.boost + BOOST.refill);
      plane.speed = Math.min(plane.speed + RING.passSpeedBonus, PLANE.maxSpeed * BOOST.mul * 1.05);
      emit(run, 'ringPass', { n: plane.ringsPassed, total: run.stats.ringsTotal });
    } else if (radial2 <= R2 * RING.hitMargin * RING.hitMargin) {
      plane.speed *= RING.hitMul;
      run.stats.hits += 1;
      emit(run, 'ringHit');
    } else {
      plane.penalty = (plane.penalty || 0) + RING.missPenalty;
      run.stats.misses += 1;
      emit(run, 'ringMiss', { penalty: (plane.penalty || 0) });
    }
    nextRing(plane, run);
    if (plane.lap > CONFIG.laps) {
      plane.lap = CONFIG.laps;
      plane.finishTime = run.time;
      const { rank, rating } = computeResult(run);
      run.rank = rank; run.rating = rating;
      run.phase = 'finished';
      emit(run, 'finished', { time: run.time, ringsPassed: plane.ringsPassed, rank, rating });
      return;
    }
    emit(run, 'lap', { n: plane.lap, time: run.time });
    return;
  }
  // bot：只推进，不算惩罚
  if (radial2 <= R2 * RING.hitMargin * RING.hitMargin) plane.ringsPassed += 1;
  nextRing(plane, run);
  if (plane.lap > CONFIG.laps) {
    plane.lap = CONFIG.laps;
    plane.finishTime = run.time;
    plane.finished = true;
  }
}

function stepRing(run, plane, isPlayer) {
  const rc = ringCenter(run.track, plane.ringIndex, run.time);
  const r = run.track.rings[plane.ringIndex];
  const d = (plane.pos.x - rc.x) * r.nx + (plane.pos.y - rc.y) * r.ny + (plane.pos.z - rc.z) * r.nz;
  if (plane._d == null) { plane._d = d; return; }
  if (plane._d < 0 && d >= 0) {
    const dx = plane.pos.x - rc.x, dy = plane.pos.y - rc.y, dz = plane.pos.z - rc.z;
    const radial2 = (dx * dx + dy * dy + dz * dz) - d * d;
    onCross(run, plane, isPlayer, radial2);
  }
  plane._d = d;
}

function updatePlayer(run, input, dt) {
  const p = run.player;
  // 姿态
  p.yaw += input.yaw * PLANE.yawRate * dt;
  p.pitch = clamp(p.pitch + input.pitch * PLANE.pitchRate * dt, -PLANE.pitchMax, PLANE.pitchMax);
  p.roll = clamp(-input.yaw * PLANE.rollFactor * PLANE.rollMax, -PLANE.rollMax, PLANE.rollMax);

  // 速度
  const boosting = !!input.boost && p.boost > 0;
  let target = PLANE.baseSpeed;
  if (boosting) target *= BOOST.mul;
  if (run.slipstream) target *= SLIPSTREAM.mul;
  if (p.speed < target) p.speed += PLANE.accel * dt * (1 - 0.4 * (p.speed / target));
  else p.speed -= PLANE.decel * dt;
  p.speed += Math.sin(-p.pitch) * PLANE.gravitySpeed * dt; // 俯冲提速 / 爬升减速
  if (input.brake) p.speed -= PLANE.brake * dt;
  p.speed = clamp(p.speed, PLANE.minSpeed, PLANE.maxSpeed * BOOST.mul * 1.05);
  run.stats.topSpeed = Math.max(run.stats.topSpeed, p.speed);

  // boost 条
  if (boosting) {
    if (!p.boosting) { p.boosting = true; emit(run, 'boostStart'); }
    p.boost = Math.max(0, p.boost - BOOST.drain * dt);
    if (p.boost <= 0) { p.boosting = false; emit(run, 'boostEnd'); }
  } else if (p.boosting) {
    p.boosting = false;
    emit(run, 'boostEnd');
  }

  // 前进
  const fx = Math.sin(p.yaw) * Math.cos(p.pitch);
  const fy = Math.sin(p.pitch);
  const fz = Math.cos(p.yaw) * Math.cos(p.pitch);
  p.fx = fx; p.fy = fy; p.fz = fz;
  p.pos.x += fx * p.speed * dt;
  p.pos.y += fy * p.speed * dt;
  p.pos.z += fz * p.speed * dt;

  stepRing(run, p, true);
  if (run.phase !== 'race') return;

  // 地面碰撞
  if (p.pos.y <= PLANE.groundY) {
    p.pos.y = PLANE.groundY;
    const hard = p.speed > PLANE.crashSpeed;
    p.speed *= hard ? PLANE.crashMul : PLANE.groundMul;
    if (hard) {
      run.stats.crashes += 1;
      const rc = ringCenter(run.track, p.ringIndex, run.time);
      const r = run.track.rings[p.ringIndex];
      p.pos.x = rc.x - r.nx * 18; p.pos.y = rc.y + 8; p.pos.z = rc.z - r.nz * 18;
      p.speed = PLANE.baseSpeed * 0.5;
      p.pitch = 0.1;
      p._d = (p.pos.x - rc.x) * r.nx + (p.pos.y - rc.y) * r.ny + (p.pos.z - rc.z) * r.nz;
      emit(run, 'crash', { speed: Math.round(p.speed) });
    } else {
      p.speed *= PLANE.groundMul;
      p.pitch = Math.max(p.pitch, 0.3); // 弹起，避免贴地每帧重复触发
      p.pos.y = PLANE.groundY + 0.5;
      emit(run, 'groundHit');
    }
  }
}

function botSteer(run, b, dt) {
  const rc = ringCenter(run.track, b.ringIndex, run.time);
  const dx = rc.x - b.pos.x, dy = rc.y - b.pos.y, dz = rc.z - b.pos.z;
  const distH = Math.hypot(dx, dz) || 1;
  const targetYaw = Math.atan2(dx, dz);
  const targetPitch = Math.atan2(dy, distH);
  const yawErr = wrap(targetYaw - b.yaw) + Math.sin(run.time * 0.7 + b.errPhase) * b.err;
  const pitchErr = clamp(targetPitch - b.pitch + Math.sin(run.time * 0.9 + b.errPhase) * b.err * 0.6, -1, 1);
  b.yaw += clamp(yawErr, -1, 1) * BOT.yawRate * dt;
  b.pitch = clamp(b.pitch + clamp(pitchErr, -1, 1) * BOT.pitchRate * dt, -PLANE.pitchMax, PLANE.pitchMax);
  b.roll = clamp(-clamp(yawErr, -1, 1) * PLANE.rollFactor * PLANE.rollMax, -PLANE.rollMax, PLANE.rollMax);

  // boost 偶发
  if (b.boostT > 0) b.boostT -= dt;
  else if (run.rng() < BOT.boostChance) b.boostT = BOT.boostTime;
  const boost = b.boostT > 0;
  let target = PLANE.baseSpeed * b.skill;
  if (boost) target *= BOOST.mul;
  if (b.speed < target) b.speed += PLANE.accel * dt * (1 - 0.4 * (b.speed / target));
  else b.speed -= PLANE.decel * dt;
  b.speed += Math.sin(-b.pitch) * PLANE.gravitySpeed * dt;
  b.speed = clamp(b.speed, PLANE.minSpeed, PLANE.maxSpeed * BOOST.mul * 1.05);

  const fx = Math.sin(b.yaw) * Math.cos(b.pitch);
  const fy = Math.sin(b.pitch);
  const fz = Math.cos(b.yaw) * Math.cos(b.pitch);
  b.fx = fx; b.fy = fy; b.fz = fz;
  b.pos.x += fx * b.speed * dt;
  b.pos.y += fy * b.speed * dt;
  b.pos.z += fz * b.speed * dt;

  if (b.pos.y <= PLANE.groundY) { b.pos.y = PLANE.groundY + 2; b.pitch = Math.abs(b.pitch) * 0.5; }
}

function updateBots(run, dt) {
  // 简单避让：两两距离过近互推
  const all = [run.player, ...run.bots.filter((b) => !b.finished)];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 0 && d < BOT.separate) {
        const push = (BOT.separate - d) / BOT.separate * 0.5;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        if (!a.finished) { a.pos.x -= nx * push; a.pos.y -= ny * push * 0.3; a.pos.z -= nz * push; }
        if (!b.finished) { b.pos.x += nx * push; b.pos.y += ny * push * 0.3; b.pos.z += nz * push; }
      }
    }
  }
  for (const b of run.bots) {
    if (b.finished) continue;
    botSteer(run, b, dt);
    stepRing(run, b, false);
  }
}

export function slipstreamActive(p, bots) {
  for (const b of bots) {
    if (b.finished) continue;
    const dx = b.pos.x - p.pos.x, dy = b.pos.y - p.pos.y, dz = b.pos.z - p.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 0 && d < SLIPSTREAM.dist) {
      const dot = (dx * p.fx + dy * p.fy + dz * p.fz) / d;
      if (dot > SLIPSTREAM.angleCos) return true;
    }
  }
  return false;
}

function updateSlipstream(run, dt) {
  run.slipCd = Math.max(0, run.slipCd - dt);
  const active = slipstreamActive(run.player, run.bots);
  const was = run.slipstream;
  run.slipstream = active;
  if (active && run.slipCd <= 0) {
    run.slipCd = SLIPSTREAM.eventCd;
    emit(run, 'slipstream');
  }
  if (was && !active) run.slipstream = false;
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { pitch: 0, yaw: 0, boost: false, brake: false, ...input };

  if (run.phase === 'countdown') {
    const prev = run.countdownT;
    run.countdownT += dt;
    for (const at of [0.5, 1.0, 1.5, 2.0]) {
      if (prev < at && run.countdownT >= at) emit(run, 'countdown', { n: Math.ceil(at / 0.5) });
    }
    if (run.countdownT >= RACE.countdown) {
      run.phase = 'race';
      run.time = 0;
      emit(run, 'raceStart');
    }
    return run;
  }
  if (run.phase !== 'race') return run;

  run.time += dt;
  updatePlayer(run, input, dt);
  if (run.phase !== 'race') return run;
  updateBots(run, dt);
  updateSlipstream(run, dt);

  run.dist += run.player.speed * dt;
  if (run.dist >= run.distNext) {
    run.distNext += RACE.distStep;
    emit(run, 'dist', { m: Math.round(run.dist) });
  }
  return run;
}

export function getHud(run) {
  const p = run.player;
  const rc = ringCenter(run.track, p.ringIndex, run.time);
  // 下一环相对机头的水平方位（HUD 箭头）
  const dx = rc.x - p.pos.x, dy = rc.y - p.pos.y, dz = rc.z - p.pos.z;
  const fh = Math.hypot(p.fx, p.fz) || 1;
  const bearing = wrap(Math.atan2(dx, dz) - Math.atan2(p.fx, p.fz));
  const deg = Math.round(bearing * 180 / Math.PI);
  const above = dy > Math.sin(p.pitch) * 4;
  return {
    phase: run.phase, simPhase: run.phase, time: run.time, countdown: run.countdownT,
    lap: Math.min(p.lap, CONFIG.laps), laps: CONFIG.laps,
    ring: p.ringIndex + 1, ringCount: run.track.ringCount,
    speed: p.speed, kmh: Math.round(p.speed * 3.6),
    boost: p.boost, boosting: p.boosting,
    ringsPassed: p.ringsPassed, penalty: p.penalty || 0,
    arrowDeg: deg, above,
    trackIndex: run.trackIndex,
  };
}

export function ratingFor(run) {
  return run.rating || 'C';
}
