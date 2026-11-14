// src/game/sim.js — 纯逻辑核心：车辆物理 + 连击倍率 + 警车追缉 + 车流 + 路障。
// 无 DOM/THREE/Date.now；随机用 seed。60Hz 固定步长由 main 调用。
import { STEP, CAR, POLICE, SCORE, TRAFFIC, BLOCKS, LAUNCH, TRACK_DEF, PERKS } from '../../config/game.config.js';
import { createTrack } from './track.js';

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

export function ratingFor(score, busted) {
  let r = 'C';
  for (const [name, min] of SCORE.ratings) if (score >= min) { r = name; break; }
  if (busted && (r === 'S' || r === 'A')) r = 'B';
  return r;
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const perks = new Set(opts.perks || []);
  const track = createTrack(TRACK_DEF);
  const run = {
    seed, perks, track, car: opts.car ?? 0,
    phase: 'lights', lightT: 0, time: 0,
    lap: 1, heat: 1, lapTimes: [], lapStart: 0,
    score: 0, mult: 1, noDriftT: 0, chainT: 99,
    nitro: 0, boostT: 0,
    player: { s: 0, t: 0, angle: 0, speed: 0, steerSmooth: 0, drifting: false, offTrack: false },
    cops: [], traffic: [], blocks: [],
    launch: { result: null },
    stats: { driftSec: 0, nearMisses: 0, crashes: 0, topMult: 1 },
    spawnT: 1.2, crashCd: 0, bustT: 0, copCloseCd: 0, ghostUsed: false,
    trafficId: 0, distNext: 100,
    events: [],
    rng: mulberry32(seed),
  };
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

export function getHud(run) {
  const gapMin = run.cops.length ? Math.min(...run.cops.map((c) => run.player.s - c.s)) : 99;
  return {
    phase: run.phase, time: run.time, lap: run.lap, heat: run.heat,
    kmh: Math.round(run.player.speed * 3.6),
    score: Math.round(run.score), mult: run.mult,
    nitro: run.nitro, boost: run.boostT > 0,
    gap: Math.max(0, gapMin), drifting: run.player.drifting,
    launch: run.launch.result,
  };
}

function emit(run, type, extra) { run.events.push({ type, ...extra }); }

function applyPerkStats(run) {
  const p = run.perks;
  return {
    maxSpeed: CAR.maxSpeed * (p.has('engine-tune') ? 1.08 : 1),
    accel: CAR.accel * (p.has('light-chassis') ? 1.12 : 1),
    nitroMul: p.has('turbo-kit') ? 1.25 : 1,
    scrub: CAR.driftScrub * (p.has('grip-tires') ? 0.15 : 1),
  };
}

function startCops(run, gap) {
  run.cops = [{ s: run.player.s - gap, t: 0, speed: 0, age: 0 }];
}

function crash(run, reason) {
  if (run.crashCd > 0) return;
  run.crashCd = TRAFFIC.crashCooldown;
  run.player.speed *= TRAFFIC.crashSpeedMul;
  run.stats.crashes++;
  const keep = run.perks.has('ghost-bump') && !run.ghostUsed;
  if (keep) run.ghostUsed = true;
  else run.mult = 1;
  for (const c of run.cops) { c.s += POLICE.crashGap; c.stun = 1.2; } // 警车逼近但也会避让事故现场
  emit(run, 'crash', { reason, kept: keep });
}

function updateCar(run, input, dt, st) {
  const p = run.player;
  const c = CAR;
  const maxSpeed = st.maxSpeed * (run.boostT > 0 ? c.boostMul : 1);

  if (input.brake) p.speed = Math.max(0, p.speed - c.brake * dt);
  else if (p.speed < maxSpeed) p.speed += st.accel * dt * (1 - 0.55 * (p.speed / maxSpeed));
  else p.speed -= 14 * dt;
  p.speed = clamp(p.speed, 0, maxSpeed * 1.05);

  if (run.boostT > 0) {
    run.boostT -= dt;
    if (run.boostT <= 0) emit(run, 'boostEnd');
  }
  if (input.nitro && run.nitro >= CAR.nitroMax && run.boostT <= 0) {
    run.boostT = c.boostTime;
    run.nitro = 0;
    p.speed = Math.min(maxSpeed, p.speed * 1.12);
    if (run.perks.has('cop-shaker')) for (const cop of run.cops) cop.s -= 10;
    emit(run, 'boostStart');
  }

  const wantDrift = input.drift && p.speed > c.driftMinSpeed;
  const steerRate = wantDrift ? c.driftSteer : c.steer;
  const spdFactor = 1 - 0.5 * (p.speed / c.maxSpeed);
  p.steerSmooth += (input.steer - p.steerSmooth) * Math.min(1, (wantDrift ? 9 : 12) * dt);
  p.angle += p.steerSmooth * steerRate * spdFactor * dt;
  const grip = wantDrift ? c.driftGrip : c.grip;
  p.angle -= p.angle * Math.min(1, grip * dt);
  p.angle = clamp(p.angle, -c.angleMax, c.angleMax);

  const wasDrifting = p.drifting;
  p.drifting = wantDrift && Math.abs(p.angle) > 0.10;
  if (p.drifting && !wasDrifting) {
    // 连击链：上次漂移结束 2.5s 内再漂 → 倍率 +1
    if (run.chainT <= SCORE.chainWindow) run.mult = Math.min(SCORE.multMax, run.mult + 1);
    run.stats.topMult = Math.max(run.stats.topMult, run.mult);
    emit(run, 'driftStart', { mult: run.mult });
  }
  if (!p.drifting && wasDrifting) { run.chainT = 0; emit(run, 'driftEnd'); }

  // 漂移掉速（得分与生存的对立）
  if (p.drifting) p.speed *= Math.max(0.5, 1 - st.scrub * dt);

  const kappa = run.track.curvatureAt(p.s);
  p.angle -= kappa * c.curveForce * p.speed * dt;

  p.s += p.speed * Math.cos(p.angle) * dt;
  p.t += p.speed * Math.sin(p.angle) * dt;

  const hw = run.track.halfWidth;
  const outside = Math.abs(p.t) > hw;
  if (outside) {
    p.t = clamp(p.t, -hw, hw);
    p.speed *= Math.max(0.55, 1 - 1.6 * dt);
    p.angle *= Math.max(0.4, 1 - 3.0 * dt);
    if (!p.offTrack) emit(run, 'offTrack');
  }
  p.offTrack = outside;

  // 漂移得分 + 充氮
  if (p.drifting) {
    const add = p.speed * Math.abs(p.angle) * dt * SCORE.driftRate * run.mult;
    run.score += add;
    const prevNitro = run.nitro;
    run.nitro = Math.min(CAR.nitroMax, run.nitro + Math.abs(p.angle) * p.speed * CAR.nitroPerSlip * st.nitroMul * dt);
    if (prevNitro < CAR.nitroMax && run.nitro >= CAR.nitroMax) emit(run, 'nitroReady');
    run.stats.driftSec += dt;
    run.noDriftT = 0;
    run.driftTick = (run.driftTick || 0) + dt;
    if (run.driftTick >= 0.5) { run.driftTick = 0; emit(run, 'driftTick', { add: Math.round(add * 2) }); }
  } else {
    run.noDriftT += dt;
    run.chainT += dt;
    if (!run.perks.has('chain-lock') && run.noDriftT > SCORE.noDriftReset && run.mult > 1) {
      run.mult = 1;
      emit(run, 'multReset', { reason: 'decay' });
    }
  }
}

function updateTraffic(run, dt) {
  const p = run.player;
  const tr = TRAFFIC;
  run.spawnT -= dt;
  if (run.spawnT <= 0 && run.traffic.length < tr.max) {
    run.spawnT = tr.spawnEvery[run.heat - 1] * (0.7 + run.rng() * 0.6);
    const lane = tr.lanes[(run.rng() * tr.lanes.length) | 0];
    run.traffic.push({
      id: run.trafficId++,
      s: p.s + tr.spawnAheadMin + run.rng() * (tr.spawnAheadMax - tr.spawnAheadMin),
      t: lane, lane,
      speed: tr.speedMin + run.rng() * (tr.speedMax - tr.speedMin),
      passed: false,
    });
  }
  for (let i = run.traffic.length - 1; i >= 0; i--) {
    const car = run.traffic[i];
    car.s += car.speed * dt;
    const ds = car.s - p.s;
    if (ds < -tr.despawnBehind) { run.traffic.splice(i, 1); continue; }
    const dtl = car.t - p.t;
    if (Math.abs(ds) < tr.hitDs && Math.abs(dtl) < tr.hitDt) { crash(run, 'traffic'); car.passed = true; continue; }
    if (!car.passed && ds <= 0) {
      car.passed = true;
      if (Math.abs(dtl) > tr.nearDtMin && Math.abs(dtl) < tr.nearDtMax) {
        const master = run.perks.has('nearmiss-master');
        const bonus = SCORE.nearMiss * run.mult * (master ? 2 : 1);
        run.score += bonus;
        run.nitro = Math.min(CAR.nitroMax, run.nitro + SCORE.nearMissNitro * (master ? 2 : 1));
        run.stats.nearMisses++;
        emit(run, 'nearMiss', { bonus: Math.round(bonus) });
      } else {
        run.score += 20 * run.mult;
        emit(run, 'pass', { bonus: 20 * run.mult });
      }
    }
  }
}

function updateBlocks(run, dt) {
  const p = run.player;
  for (const b of run.blocks) {
    const ds = b.s - p.s;
    if (Math.abs(ds) < BLOCKS.hitDs && Math.abs(p.t - b.openLane) > BLOCKS.hitDt) crash(run, 'block');
  }
}

function spawnBlocks(run, lap) {
  const L = run.track.length;
  run.blocks = BLOCKS.fractions.map((f) => ({
    s: (lap - 1 + f) * L,
    openLane: TRAFFIC.lanes[(run.rng() * TRAFFIC.lanes.length) | 0],
  }));
}

function updateCops(run, dt) {
  const p = run.player;
  const st = applyPerkStats(run);
  for (const cop of run.cops) {
    cop.age = (cop.age || 0) + dt;
    let speed = st.maxSpeed * (POLICE.baseRatio + POLICE.heatAdd * (run.heat - 1));
    if (run.heat >= 3) speed *= POLICE.heat3Mul;
    const gap = p.s - cop.s;
    if (gap > POLICE.rubberFar) speed += POLICE.rubberFarAdd;
    if (gap < POLICE.rubberNear) speed -= POLICE.rubberNearSub;
    speed *= Math.min(1, cop.age / 2.5); // 警车也要起步，初始距离才有意义
    if (cop.stun > 0) { cop.stun -= dt; speed *= 0.45; }
    cop.speed = speed;
    cop.s += speed * dt;
    cop.t += (p.t - cop.t) * Math.min(1, 1.2 * dt);
  }
  const gapMin = Math.min(...run.cops.map((c) => p.s - c.s));
  if (gapMin <= POLICE.bustGap) run.bustT += dt; else run.bustT = 0;
  run.copCloseCd = Math.max(0, run.copCloseCd - dt);
  if (gapMin < 12 && run.copCloseCd <= 0) { run.copCloseCd = 4; emit(run, 'copClose', { gap: Math.round(gapMin) }); }
  if (run.bustT >= POLICE.bustHold) {
    run.phase = 'busted';
    emit(run, 'busted', { score: Math.round(run.score), rating: ratingFor(run.score, true) });
  }
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { steer: 0, drift: false, nitro: false, brake: false, launch: false, ...input };
  const st = applyPerkStats(run);
  run.crashCd = Math.max(0, run.crashCd - dt);

  if (run.phase === 'lights') {
    const prevLight = run.lightT;
    run.lightT += dt;
    for (const [i, at] of [0.2, 1.2, 2.2, 3.0].entries()) {
      if (prevLight < at && run.lightT >= at) emit(run, 'light', { n: i + 1 });
    }
    if (input.launch && run.launch.result == null) {
      run.launch.result = 'jump';
      emit(run, 'launchJump');
    }
    if (run.lightT >= LAUNCH.greenAt) {
      run.phase = 'race';
      run.time = 0;
      const gap = run.launch.result === 'jump' ? POLICE.gapJump : POLICE.gapNormal;
      startCops(run, gap);
      if (run.launch.result == null) run.launch.result = 'normal';
      if (run.launch.result !== 'jump') emit(run, 'launchNormal');
    }
    return run;
  }
  if (run.phase !== 'race') return run;

  run.time += dt;
  if (run.launch.result === 'normal' && run.time <= LAUNCH.perfectWindow && input.launch) {
    run.launch.result = 'perfect';
    run.boostT = LAUNCH.perfectBoost;
    run.nitro = Math.min(CAR.nitroMax, run.nitro + LAUNCH.perfectNitro);
    for (const c of run.cops) c.s -= LAUNCH.perfectGap;
    emit(run, 'launchPerfect');
  }

  updateCar(run, input, dt, st);
  if (run.player.s >= run.distNext) {
    run.score += 50;
    run.distNext += 100;
    emit(run, 'dist', { m: Math.round(run.player.s) });
  }
  updateTraffic(run, dt);
  if (run.heat >= 3) updateBlocks(run, dt);
  updateCops(run, dt);
  if (run.phase !== 'race') return run;

  const L = run.track.length;
  const newLap = Math.floor(run.player.s / L) + 1;
  if (newLap > run.lap) {
    run.lapTimes.push(run.time - run.lapStart);
    run.lapStart = run.time;
    const bonus = SCORE.lapBonus * run.mult;
    run.score += bonus;
    emit(run, 'lap', { n: run.lap, bonus: Math.round(bonus), time: run.lapTimes[run.lapTimes.length - 1] });
    run.lap = newLap;
    if (newLap > 3) {
      run.phase = 'finished';
      emit(run, 'finished', { score: Math.round(run.score), rating: ratingFor(run.score, false) });
      return run;
    }
    run.heat = newLap;
    if (newLap === 2) {
      const gapMin = Math.min(...run.cops.map((c) => run.player.s - c.s));
      run.cops.push({ s: run.player.s - gapMin - POLICE.secondCopOffset, t: 0, speed: 0 });
    }
    if (newLap === 3) spawnBlocks(run, 3);
    emit(run, 'heat', { n: newLap });
  }
  return run;
}