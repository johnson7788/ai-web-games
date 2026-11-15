// src/game/sim.js — 纯逻辑：第一人称穿车流。
// 无 DOM / window / localStorage / Date.now；随机用 seed（mulberry32）。
// 契约：createSim({seed}) / updateSim(sim, input) / getHud(sim) / drainEvents(sim)。
import {
  STEP, MOTO, ROAD, TRAFFIC, NEARMISS, SCORE, CHECKPOINT_EVERY, SEGMENTS, CRASH,
  clamp, lerp,
} from '../../config/game.config.js';

// 确定性随机（不引 three/base3d，保证 node --test 可跑）
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function laneIndex(x) {
  return clamp(Math.round((x - ROAD.laneX[0]) / ROAD.laneWidth), 0, ROAD.laneCount - 1);
}
export function segmentIndex(distance) {
  let s = 0;
  for (let i = 0; i < SEGMENTS.length; i++) if (distance >= SEGMENTS[i].from) s = i;
  return s;
}
export function ratingFor(distance) {
  for (const [r, min] of SCORE.ratings) if (distance >= min) return r;
  return 'D';
}

function push(sim, type, extra = {}) {
  sim.events.push({ type, ...extra });
}

function makeCar(sim, dir, z, isTruck) {
  const hw = isTruck ? TRAFFIC.truckHW : TRAFFIC.carHW;
  const len = isTruck ? TRAFFIC.truckLen : TRAFFIC.carLen;
  const lanes = dir === 1 ? ROAD.sameLaneIdx : ROAD.oncomingLaneIdx;
  const lane = lanes[(sim.rand() * lanes.length) | 0];
  const d = sim.player.distance;
  const [mn, mx] = dir === 1 ? TRAFFIC.speedSame : TRAFFIC.speedOncoming;
  const curve = Math.min(1, d / 3000);
  const speed = MOTO.topSpeed * lerp(mn, mx, curve) * (0.9 + sim.rand() * 0.2);
  return {
    lane, dir, x: ROAD.laneX[lane], z, speed, hw, len, isTruck,
    nearMissed: false, passed: false, color: (sim.rand() * 6) | 0,
  };
}

function spawnCar(sim, dir) {
  if (sim.traffic.length >= TRAFFIC.max) return;
  let dirCount = 0;
  for (const c of sim.traffic) if (c.dir === dir) dirCount++;
  if (dirCount >= TRAFFIC.maxPerDir) return;
  const p = sim.player;
  const isTruck = dir === 1 && p.distance > TRAFFIC.truckFrom && sim.rand() < TRAFFIC.truckChance;
  const z0 = TRAFFIC.spawnAhead;
  // 选前方较少占用的车道，避免同 z 两车叠
  const lanes = dir === 1 ? ROAD.sameLaneIdx : ROAD.oncomingLaneIdx;
  let bestLane = lanes[0]; let bestCount = 1e9;
  for (const li of lanes) {
    const x = ROAD.laneX[li];
    const n = sim.traffic.filter((c) => c.dir === dir && c.z > z0 - 12 && Math.abs(c.x - x) < 1.0).length;
    if (n < bestCount) { bestCount = n; bestLane = li; }
  }
  const car = makeCar(sim, dir, z0 + sim.rand() * 24, isTruck);
  car.lane = bestLane; car.x = ROAD.laneX[bestLane];
  sim.traffic.push(car);
}

function crash(sim, c) {
  const p = sim.player;
  sim.phase = 'crashed';
  sim.crashT = CRASH.slowmoTime;
  sim.timeScale = CRASH.slowmoScale;
  sim.combo = 0;
  sim.finalDistance = p.distance;
  push(sim, 'crash', { reason: c.isTruck ? 'truck' : 'car', x: p.x, z: c.z });
}

function nearMiss(sim, c) {
  const p = sim.player;
  if (sim.time - sim.lastNearMissT <= NEARMISS.comboWindow) sim.combo += 1;
  else sim.combo = 1;
  sim.lastNearMissT = sim.time;
  sim.topCombo = Math.max(sim.topCombo, sim.combo);
  const speedMult = p.speed / NEARMISS.speedDiv;
  const bonus = Math.round(NEARMISS.base * speedMult * sim.combo);
  sim.nearMissScore += bonus;
  sim.nearMisses += 1;
  c.nearMissed = true;
  push(sim, 'nearMiss', { bonus, combo: sim.combo });
  if (sim.combo >= 2) push(sim, 'combo', { n: sim.combo });
}

export function createSim({ seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const sim = {
    seed,
    rand,
    phase: 'running',           // running | crashed | over
    time: 0,
    timeScale: 1,
    crashT: 0,
    player: {
      x: ROAD.laneX[3],         // 最右同向车道起步
      lane: 3,
      speed: MOTO.baseSpeed * 0.6,
      distance: 0,
      nitro: MOTO.nitroMax,
      nitroFull: true,
      boosting: false,
      wasBoosting: false,
      windDone: false,
      steer: 0,
    },
    traffic: [],
    nextSameSpawn: 20,
    nextOncomingSpawn: 16,
    events: [],
    score: 0,
    nearMissScore: 0,
    nearMisses: 0,
    topCombo: 0,
    combo: 0,
    lastNearMissT: -999,
    lastCheckpoint: 0,
    segment: 0,
    finalDistance: 0,
  };

  // 预铺车流（前方 15–200m，双向），开局不空场、事件即时产生
  for (let i = 0; i < 12; i++) {
    const dir = i % 3 === 0 ? -1 : 1;
    const isTruck = false;
    sim.traffic.push(makeCar(sim, dir, 15 + i * 16 + rand() * 8, isTruck));
  }

  push(sim, 'start');
  return sim;
}

export function crashNow(sim) {
  if (sim.phase !== 'running') return;
  const c = { isTruck: false, x: sim.player.x, z: 0 };
  crash(sim, c);
}

export function updateSim(sim, input) {
  if (sim.phase === 'over') return;
  const dt = STEP;
  const inp = input || {};
  const p = sim.player;

  // 慢镜头回放：世界继续，输入/碰撞冻结
  if (sim.phase === 'crashed') {
    const ts = sim.timeScale;
    for (const c of sim.traffic) c.z -= (p.speed - c.dir * c.speed) * dt * ts;
    p.distance += p.speed * dt * ts;
    sim.time += dt * ts;
    sim.crashT -= dt;
    if (sim.crashT <= 0) {
      sim.phase = 'over';
      sim.timeScale = 1;
      push(sim, 'gameover');
    }
    sim.traffic = sim.traffic.filter((c) => c.z > -TRAFFIC.despawnBehind);
    return;
  }

  // --- 速度（油门/刹车/氮气） ---
  const steering = clamp(inp.steer || 0, -1, 1);
  p.boosting = !!inp.nitro && p.nitro > 0 && !inp.brake;
  if (p.boosting) {
    p.nitro = Math.max(0, p.nitro - MOTO.nitroBurn * dt);
    p.nitroFull = false;
    if (!p.wasBoosting) push(sim, 'boost');
  } else {
    p.nitro = Math.min(MOTO.nitroMax, p.nitro + MOTO.nitroRecharge * dt);
    if (p.wasBoosting) push(sim, 'boostEnd');
    if (p.nitro >= MOTO.nitroMax - 1e-6 && !p.nitroFull) { p.nitroFull = true; push(sim, 'nitro-ready'); }
  }
  p.wasBoosting = p.boosting;

  let target;
  if (inp.brake) target = MOTO.minSpeed;
  else if (p.boosting) target = MOTO.nitroTop;
  else target = inp.throttle ? MOTO.topSpeed : MOTO.baseSpeed;

  if (p.speed < target) p.speed = Math.min(target, p.speed + MOTO.accel * dt);
  else p.speed = Math.max(target, p.speed - (inp.brake ? MOTO.brake : MOTO.coastDecel) * dt);

  // --- 横向连续变道 ---
  p.steer = steering;
  p.x += steering * MOTO.steerSpeed * dt;
  p.x = clamp(p.x, ROAD.xMin, ROAD.xMax);
  const li = laneIndex(p.x);
  if (li !== p.lane) { p.lane = li; push(sim, 'lane', { lane: li }); }

  // --- 距离 / 速度感 ---
  p.distance += p.speed * dt;
  if (!p.windDone && p.speed > MOTO.windSpeed) { p.windDone = true; push(sim, 'wind'); }

  // --- 生成车流（按距离推进） ---
  sim.nextSameSpawn -= p.speed * dt;
  if (sim.nextSameSpawn <= 0) { spawnCar(sim, 1); sim.nextSameSpawn = TRAFFIC.sameGap(p.distance) * (0.75 + sim.rand() * 0.5); }
  sim.nextOncomingSpawn -= p.speed * dt;
  if (sim.nextOncomingSpawn <= 0) { spawnCar(sim, -1); sim.nextOncomingSpawn = TRAFFIC.oncomingGap(p.distance) * (0.75 + sim.rand() * 0.5); }

  // --- 移动车流 ---
  for (const c of sim.traffic) c.z -= (p.speed - c.dir * c.speed) * dt;

  // --- 碰撞 / 擦身 / 通过 ---
  for (const c of sim.traffic) {
    const dz = c.z;
    const halfLen = (MOTO.length + c.len) / 2;
    const dx = Math.abs(p.x - c.x);
    if (Math.abs(dz) < halfLen * 0.9 && dx < (MOTO.halfW + c.hw) * 0.9) { crash(sim, c); break; }
    if (!c.nearMissed && Math.abs(dz) < halfLen && dx >= (MOTO.halfW + c.hw) && dx < (MOTO.halfW + c.hw + NEARMISS.gap)) {
      nearMiss(sim, c);
    }
    if (dz < 0 && !c.passed) {
      c.passed = true;
      if (c.dir === -1) push(sim, 'oncoming');
      else if (!c.nearMissed) push(sim, 'overtake');
    }
  }

  // 回收后方车
  sim.traffic = sim.traffic.filter((c) => c.z > -TRAFFIC.despawnBehind);

  // --- 检查点 / 视觉段 ---
  const cp = Math.floor(p.distance / CHECKPOINT_EVERY);
  if (cp > sim.lastCheckpoint) { sim.lastCheckpoint = cp; push(sim, 'checkpoint', { n: cp, m: cp * CHECKPOINT_EVERY }); }
  const seg = segmentIndex(p.distance);
  if (seg > sim.segment) { sim.segment = seg; push(sim, 'segment', { name: SEGMENTS[seg].name }); }

  // --- 分数 / 时间 ---
  sim.score = Math.round(p.distance * SCORE.distPerM + sim.nearMissScore);
  sim.time += dt;
}

export function getHud(sim) {
  const p = sim.player;
  return {
    score: sim.score,
    distance: p.distance,
    meters: Math.floor(p.distance),
    kmh: Math.round(p.speed * 3.6),
    speed: p.speed,
    nitro: p.nitro,
    combo: sim.combo,
    nearMisses: sim.nearMisses,
    topCombo: sim.topCombo,
    segment: sim.segment,
    levelsReached: Math.min(5, Math.floor(p.distance / CHECKPOINT_EVERY) + 1),
    phase: sim.phase,
    time: sim.time,
  };
}

export function drainEvents(sim) {
  return sim.events.splice(0, sim.events.length);
}
