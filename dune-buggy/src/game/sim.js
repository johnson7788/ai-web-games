// DUNE BUGGY · 模拟/玩法核心（纯逻辑，零依赖；不碰 DOM/window/localStorage/Date.now）
// 契约：docs/dune-buggy/analysis.md（事件名 / 接口签名）
import { STEP } from '../../config/game.config.js';
import {
  CAR, PRESSURE, DEFAULT_PRESSURE, JUMP, STAGE, FEEDBACK,
  clamp, effectiveGrip, effectiveMaxSpeed, ratingFor,
} from '../../config/gameplay.js';
import { STAGE_COUNT, stageAt } from '../../config/levels.js';
import { buildTrack, buildCheckpoints, segmentAt } from './track.js';
import { mulberry32 } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, stageIndex = 1, pressure = DEFAULT_PRESSURE } = {}) {
  const run = {
    rng: mulberry32(seed),
    seed: seed >>> 0,
    phase: 'playing',      // playing | won | dead
    time: 0,               // 总时长（s）
    stage: clamp(stageIndex, 1, STAGE_COUNT),
    stageTime: 0,          // 当前赛段用时（s）
    position: 0,           // 当前赛段内已跑距离（m）
    distance: 0,
    playerX: 0,            // 横向位置（-1..1，中心为 0）
    speed: 0,              // m/s
    pressure: PRESSURE[pressure] ? pressure : DEFAULT_PRESSURE,
    airborne: false,
    airborneT: 0,
    segments: [],
    checkpoints: [],
    nextCheckpoint: 0,
    _tuneHeld: false,
    _lastMile: -1,
    _lastRidgeAt: -Infinity,
    _lastOffAt: -Infinity,
    _lastNearAt: -Infinity,
    _jumpCooldownUntil: -Infinity,
    _lastTerrain: null,
    stats: {
      maxStage: stageIndex,
      stageTimes: [],
      ratings: [],
      totalTime: 0,
      fastestStage: 0,
      totalScore: 0,
    },
    events: [],
  };

  startStage(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 进入一个赛段 ----------
function startStage(run) {
  const stage = stageAt(run.stage);
  run.position = 0;
  run.distance = 0;
  run.stageTime = 0;
  run.playerX = 0;
  run.speed = 0;
  run.airborne = false;
  run.segments = buildTrack(stage, run.seed);
  run.checkpoints = buildCheckpoints(stage.length);
  run.nextCheckpoint = 0;
  run._lastMile = -1;
  run._lastRidgeAt = -Infinity;
  run._lastOffAt = -Infinity;
  run._lastNearAt = -Infinity;
  run._lastTerrain = null;
  emit(run, 'stageStart', { stage: run.stage, name: stage.name });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  run.stageTime += dt;

  // 胎压切换（边沿）
  const tune = !!input.tune;
  if (tune && !run._tuneHeld) {
    run.pressure = run.pressure === 'high' ? 'low' : 'high';
    emit(run, 'tune', { pressure: run.pressure });
  }
  run._tuneHeld = tune;

  const stage = stageAt(run.stage);
  const seg = segmentAt(run.segments, run.position);

  // 地形切换事件（岩区/绿洲/跳台等可感知过渡）
  if (seg.terrain !== run._lastTerrain) {
    run._lastTerrain = seg.terrain;
    emit(run, 'terrainEnter', { terrain: seg.terrain });
  }

  const onRidge = seg.ridge && Math.abs(run.playerX - seg.ridgeX) < CAR.RIDGE_HALF;
  const offTrack = Math.abs(run.playerX) > CAR.OFFTRACK_X;
  const grip = effectiveGrip(run.pressure, seg.terrain, stage.storm);
  let maxSpeed = effectiveMaxSpeed(run.pressure, seg.terrain, stage.storm);
  if (onRidge) maxSpeed *= CAR.RIDGE_BOOST;

  // 油门 / 刹车
  const throttle = clamp(Number(input.throttle) || 0, 0, 1);
  const brake = clamp(Number(input.brake) || 0, 0, 1);
  if (throttle > 0) run.speed += CAR.ACCEL * grip * throttle * dt;
  if (brake > 0) run.speed -= CAR.BRAKE * brake * dt;
  run.speed -= CAR.DRAG * run.speed * dt;                 // 自然阻力
  if (offTrack) run.speed -= CAR.OFFTRACK_DRAG * run.speed * dt;
  if (onRidge) run.speed += CAR.RIDGE_ACCEL * dt;         // 骑脊持续加速
  run.speed = clamp(run.speed, 0, maxSpeed);

  // 转向（转向速率随速度缩放，与原作 MotorCtr 的 factor 一致）
  const steer = clamp(Number(input.steer) || 0, -1, 1);
  const speedFactor = run.speed / CAR.MAX_SPEED;
  run.playerX += steer * CAR.STEER_RATE * speedFactor * grip * dt;
  run.playerX += seg.curve * run.speed * dt * CAR.CENTRIFUGAL; // 弯道离心外抛
  run.playerX = clamp(run.playerX, -2.2, 2.2);

  // 前进
  run.position += run.speed * dt;
  run.distance = run.position;

  // 跳台（腾空）
  if (seg.terrain === 'jump' && !run.airborne && run.time >= run._jumpCooldownUntil) {
    run.airborne = true;
    run.airborneT = JUMP.DURATION;
    run._jumpCooldownUntil = run.time + JUMP.LAND_GRACE;
    emit(run, 'jump', {});
  }
  if (run.airborne) {
    run.airborneT -= dt;
    if (run.airborneT <= 0) {
      run.airborne = false;
      emit(run, 'land', {});
    }
  }

  emitProgressEvents(run, onRidge, offTrack);

  // 检查点
  while (run.nextCheckpoint < run.checkpoints.length && run.position >= run.checkpoints[run.nextCheckpoint]) {
    emit(run, 'checkpoint', { index: run.nextCheckpoint, total: run.checkpoints.length, meters: run.checkpoints[run.nextCheckpoint] });
    run.nextCheckpoint += 1;
  }

  // 赛段完成 / 超时 DNF
  if (run.position >= stage.length) {
    clearStage(run);
  } else if (run.stageTime > stage.parSec + STAGE.DNF_GRACE) {
    die(run);
  }

  if (run.stage > run.stats.maxStage) run.stats.maxStage = run.stage;
}

// ---------- 赛段完成 ----------
function clearStage(run) {
  const stage = stageAt(run.stage);
  const rating = ratingFor(run.stageTime, stage.parSec);
  run.stats.stageTimes.push(run.stageTime);
  run.stats.ratings.push(rating);
  run.stats.maxStage = run.stage;
  run.stats.fastestStage = run.stats.stageTimes.length ? Math.min(...run.stats.stageTimes) : run.stageTime;
  emit(run, 'stageClear', { stage: run.stage, time: run.stageTime, parSec: stage.parSec, rating });

  if (run.stage >= STAGE_COUNT) {
    run.phase = 'won';
    run.stats.totalTime = run.time;
    emit(run, 'champion', { totalTime: run.time, stages: STAGE_COUNT });
    return;
  }
  run.stage += 1;
  startStage(run);
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { stage: run.stage });
}

// ---------- 细粒度反馈（保证事件密度） ----------
function emitProgressEvents(run, onRidge, offTrack) {
  const mile = Math.floor(run.position / FEEDBACK.MILESTONE_EVERY);
  if (mile > run._lastMile) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'speedMilestone', { meters: mile * FEEDBACK.MILESTONE_EVERY });
  }
  if (onRidge && run.time - run._lastRidgeAt >= FEEDBACK.RIDGE_THROTTLE) {
    run._lastRidgeAt = run.time;
    emit(run, 'ridgeBoost', { speed: run.speed });
  }
  if (offTrack && run.time - run._lastOffAt >= FEEDBACK.OFFTRACK_THROTTLE) {
    run._lastOffAt = run.time;
    emit(run, 'offTrack', {});
  }
  const ax = Math.abs(run.playerX);
  if (!offTrack && ax >= FEEDBACK.NEARMISS_BAND[0] && ax <= FEEDBACK.NEARMISS_BAND[1]
      && run.time - run._lastNearAt >= FEEDBACK.NEARMISS_THROTTLE) {
    run._lastNearAt = run.time;
    emit(run, 'nearMiss', {});
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const stage = stageAt(run.stage);
  const seg = segmentAt(run.segments, run.position);
  const onRidge = seg.ridge && Math.abs(run.playerX - seg.ridgeX) < CAR.RIDGE_HALF;
  const offTrack = Math.abs(run.playerX) > CAR.OFFTRACK_X;
  return {
    phase: run.phase,
    stage: run.stage,
    stageName: stage.name,
    scenePack: stage.scenePack,
    storm: stage.storm,
    time: run.stageTime,
    parSec: stage.parSec,
    progress: clamp(run.position / stage.length, 0, 1),
    speed: run.speed,
    speedKmh: Math.round(run.speed * 3.6),
    playerX: run.playerX,
    pressure: run.pressure,
    onRidge,
    offTrack,
    airborne: run.airborne,
    maxStage: run.stats.maxStage,
    fastestStage: run.stats.fastestStage,
    totalTime: run.time,
    totalScore: run.stats.totalScore,
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
