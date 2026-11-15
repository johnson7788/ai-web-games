// src/game/sim.js — 纯逻辑核心：点对点拉力（车辆物理 / 漂移 / 车损 / 路书 / 5 赛段）。
// 无 DOM/THREE/Date.now；随机用 seed。60Hz 固定步长由 main 调用。
import { STEP, CONFIG, CAR, DAMAGE, SCORE, PACE, STAGES, STAGE_TARGETS } from '../../config/game.config.js';
import { createStage, mulberry32 } from './track.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function ratingFor(score, busted) {
  let r = 'C';
  for (const [name, min] of SCORE.ratings) if (score >= min) { r = name; break; }
  if (busted && (r === 'S' || r === 'A')) r = 'B';
  return r;
}

function resetStagePlayer(run) {
  run.player = { s: 0, t: 0, angle: 0, speed: 0, steerSmooth: 0, offTrack: false, drifting: false };
  run.time = 0;
  run.nextNoteIdx = 0;
  run.lastNote = null;
  run.distNext = 40;
  run.driftTick = 0;
  run.prevSurface = null;
  run.prevGear = 0;
  for (const o of run.track.obstacles) o.hit = false;
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const startStage = clamp(opts.stage ?? 1, 1, CONFIG.stages);
  const run = {
    seed,
    stage: startStage,
    phase: 'driving',            // driving | busted | finished
    time: 0, totalTime: 0,
    score: 0, damage: 0,
    steerBias: 0, biasT: 0,
    driftSec: 0,
    stageTimes: [], stageScores: [],
    stats: { driftSec: 0, pacePerfect: 0, hits: 0, offTrackSec: 0 },
    rng: mulberry32(seed),
    events: [],
    track: createStage(STAGES[startStage - 1]),
  };
  resetStagePlayer(run);
  return run;
}

export function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

function emit(run, type, extra = {}) { run.events.push({ type, ...extra }); }

function gearOf(speed) {
  let gear = 4;
  for (let g = 1; g < CAR.gearSpeeds.length; g++) if (speed <= CAR.gearSpeeds[g]) { gear = g; break; }
  return gear;
}

export function getHud(run) {
  const p = run.player;
  return {
    phase: run.phase, stage: run.stage, stageTotal: CONFIG.stages,
    time: run.time, totalTime: run.totalTime,
    kmh: Math.round(p.speed * 3.6),
    score: Math.round(run.score), damage: Math.round(run.damage),
    gear: gearOf(p.speed), drifting: p.drifting, offTrack: p.offTrack,
    note: run.lastNote, stageBest: null,
  };
}

function damage(run, amount, reason) {
  if (run.phase !== 'driving') return;
  const before = run.damage;
  run.damage = clamp(run.damage + amount, 0, DAMAGE.max);
  if (run.damage >= DAMAGE.max) {
    run.phase = 'busted';
    emit(run, 'busted', { score: Math.round(run.score), rating: 'DNF', damage: run.damage, reason });
  } else if (before < 50 && run.damage >= 50 && amount > 0) {
    emit(run, 'damageWarn', { damage: Math.round(run.damage) });
  }
}

function applyHit(run, kind) {
  const d = DAMAGE[kind];
  run.player.speed *= d.speedMul;
  run.steerBias = (run.rng() < 0.5 ? -1 : 1) * d.bias;
  run.biasT = d.biasTime;
  run.stats.hits++;
  damage(run, d.dmg, kind);
  emit(run, 'hit', { kind });
}

function updateCar(run, input, dt) {
  const p = run.player;
  const maxSpeed = CAR.maxSpeed * clamp(1 - run.damage * DAMAGE.maxSpeedMulPerDmg, DAMAGE.minMaxSpeedMul, 1);

  if (input.brake) p.speed = Math.max(0, p.speed - CAR.brake * dt);
  else if (input.throttle) p.speed += CAR.accel * dt * (1 - 0.5 * (p.speed / CAR.maxSpeed));
  else p.speed = Math.max(0, p.speed - CAR.accel * 0.25 * dt);
  p.speed = clamp(p.speed, 0, maxSpeed * 1.05);
  if (input.shiftDown) p.speed *= CAR.downshiftBrake; // 手动降档（发动机制动）

  const wantDrift = input.handbrake && p.speed > CAR.driftMinSpeed;
  const steerRate = wantDrift ? CAR.driftSteer : CAR.steer;
  const spdFactor = 1 - 0.5 * (p.speed / CAR.maxSpeed);
  p.steerSmooth += (input.steer - p.steerSmooth) * Math.min(1, (wantDrift ? 9 : 12) * dt);
  p.angle += p.steerSmooth * steerRate * spdFactor * dt;
  const grip = wantDrift ? CAR.driftGrip : run.track.gripAt(p.s);
  p.angle -= p.angle * Math.min(1, grip * dt);
  p.angle = clamp(p.angle, -CAR.angleMax, CAR.angleMax);
  if (run.biasT > 0) p.angle += run.steerBias * dt; // 车损后转向偏

  const wasDrifting = p.drifting;
  p.drifting = wantDrift && Math.abs(p.angle) > CAR.driftAngleMin;
  if (p.drifting && !wasDrifting) emit(run, 'driftStart');
  if (!p.drifting && wasDrifting) emit(run, 'driftEnd');
  if (p.drifting) p.speed *= Math.max(0.5, 1 - CAR.driftScrub * dt);

  const kappa = run.track.curvatureAt(p.s);
  p.angle -= kappa * CAR.curveForce * p.speed * dt;
  p.s += p.speed * Math.cos(p.angle) * dt;
  p.t += p.speed * Math.sin(p.angle) * dt;
  p.s = Math.max(0, p.s);
}

function updateObstacles(run) {
  const p = run.player;
  for (const o of run.track.obstacles) {
    if (o.hit) continue;
    if (Math.abs(o.s - p.s) < o.r + 2.2 && Math.abs(o.t - p.t) < o.r + 1.0) {
      o.hit = true;
      applyHit(run, o.kind);
    }
  }
}

function updateNotes(run) {
  const notes = run.track.notes;
  const p = run.player;
  if (run.nextNoteIdx < notes.length) {
    const note = notes[run.nextNoteIdx];
    const look = Math.max(PACE.minLookahead, p.speed * PACE.lookaheadSec);
    if (note.s - p.s <= look) {
      run.lastNote = note;
      run.nextNoteIdx++;
      emit(run, 'paceNote', { dir: note.dir, gear: note.gear, next: note.next });
    }
  }
  if (run.lastNote && !run.lastNote.scored && p.s >= run.lastNote.cornerS) {
    run.lastNote.scored = true;
    const gearSpeed = CAR.gearSpeeds[run.lastNote.gear] || 40;
    if (p.speed <= gearSpeed + PACE.perfectTol) {
      run.score += SCORE.pacePerfect;
      run.stats.pacePerfect++;
      emit(run, 'pacePerfect', { gear: run.lastNote.gear });
    }
  }
}

function completeStage(run) {
  run.stageTimes.push(run.time);
  run.stageScores.push(Math.round(run.score));
  const target = STAGE_TARGETS[run.stage - 1] || 60;
  const timeBonus = Math.max(0, Math.round((target - run.time) * SCORE.timeRate));
  run.score += SCORE.stageClear + timeBonus;
  if (run.stage >= CONFIG.stages) {
    run.phase = 'finished';
    emit(run, 'finished', { score: Math.round(run.score), rating: ratingFor(run.score, false), time: run.totalTime });
  } else {
    emit(run, 'stageClear', { stage: run.stage, time: run.time, score: Math.round(run.score) });
    run.stage++;
    run.track = createStage(STAGES[run.stage - 1]);
    resetStagePlayer(run);
  }
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { throttle: false, brake: false, steer: 0, handbrake: false, shiftDown: false, ...input };
  if (run.phase !== 'driving') return run;

  run.time += dt;
  run.totalTime += dt;
  run.biasT = Math.max(0, run.biasT - dt);
  updateCar(run, input, dt);

  const p = run.player;
  const hw = run.track.halfWidth;
  const soft = hw + 8;                 // 草地软边界：出界扣分但可碾到路边树/石
  const outside = Math.abs(p.t) > hw;
  if (outside) {
    p.t = clamp(p.t, -soft, soft);
    p.speed *= Math.max(0.55, 1 - CAR.offTrackScrub * dt);
    p.angle *= Math.max(0.4, 1 - 3.0 * dt);
    if (!p.offTrack) emit(run, 'offTrack');
    p.offTrack = true;
  } else p.offTrack = false;
  if (p.offTrack) {
    run.stats.offTrackSec += dt;
    damage(run, DAMAGE.offTrackDps * dt, 'offTrack');
  }
  if (run.track.inBumpy(p.s) && p.speed > DAMAGE.bumpSpeedMin) damage(run, DAMAGE.bumpDps * dt, 'bump');

  updateObstacles(run);

  if (p.drifting) {
    const add = p.speed * Math.abs(p.angle) * dt * SCORE.driftRate;
    run.score += add;
    run.stats.driftSec += dt;
    run.driftSec += dt;
    run.driftTick = (run.driftTick || 0) + dt;
    if (run.driftTick >= 0.5) { run.driftTick = 0; emit(run, 'driftTick', { add: Math.round(add * 2) }); }
  }

  if (p.s >= run.distNext) {
    run.score += SCORE.distPer100 * 0.4;
    run.distNext += 40;
    emit(run, 'dist', { m: Math.round(p.s) });
  }
  const surface = run.track.surfaceAt(p.s);
  if (surface !== run.prevSurface) {
    run.prevSurface = surface;
    emit(run, 'surface', { type: surface });
  }
  const gear = gearOf(p.speed);
  if (gear !== run.prevGear) {
    run.prevGear = gear;
    emit(run, 'gear', { gear });
  }
  updateNotes(run);

  if (p.s >= run.track.length) completeStage(run);
  return run;
}
