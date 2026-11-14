// 纯逻辑：俯视角公交。无 DOM / window / Date.now；RNG 可注入。
import { WORLD, ROAD_W, V_ROADS, H_ROADS, BUS, STOPS, STOP_RADIUS, RULES } from '../../config/game.config.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- 道路 / 建筑几何 -------------------------------------------------------
const HW = ROAD_W / 2;
export function isOnRoad(x, y) {
  for (const vx of V_ROADS) if (Math.abs(x - vx) <= HW) return true;
  for (const hy of H_ROADS) if (Math.abs(y - hy) <= HW) return true;
  return false;
}

function segments(centers, max) {
  const segs = [];
  let prev = 0;
  for (const c of centers) {
    if (c - HW > prev) segs.push([prev, c - HW]);
    prev = c + HW;
  }
  if (prev < max) segs.push([prev, max]);
  return segs;
}
const X_SEGS = segments(V_ROADS, WORLD.WIDTH);
const Y_SEGS = segments(H_ROADS, WORLD.HEIGHT);
export const BUILDINGS = [];
for (const [x0, x1] of X_SEGS) for (const [y0, y1] of Y_SEGS) {
  if (x1 - x0 > 20 && y1 - y0 > 20) BUILDINGS.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}
const M = 16; // 碰撞外扩
function hitsBuilding(x, y) {
  for (const b of BUILDINGS) {
    if (x > b.x - M && x < b.x + b.w + M && y > b.y - M && y < b.y + b.h + M) return true;
  }
  return false;
}

// ---- 创建 ------------------------------------------------------------------
export function createRun({ seed = 1 } = {}) {
  return {
    phase: 'play',
    time: 0,
    timeLeft: RULES.shiftTime,
    money: 0,
    delivered: 0,
    bus: { x: 640, y: 360, heading: 0, speed: 0 },
    passengers: [],
    nextId: 1,
    spawnT: 1.2,
    dwell: 0,
    lastExchangeStop: -1,
    events: [],
    rng: makeRng(seed),
  };
}

function stopAt(x, y) {
  for (let i = 0; i < STOPS.length; i++) {
    if (Math.hypot(x - STOPS[i].x, y - STOPS[i].y) <= STOP_RADIUS) return i;
  }
  return -1;
}

function spawnPassenger(run, origin, dest) {
  if (origin === undefined) {
    origin = Math.floor(run.rng() * STOPS.length);
    do { dest = Math.floor(run.rng() * STOPS.length); } while (dest === origin);
  }
  const d = Math.hypot(STOPS[origin].x - STOPS[dest].x, STOPS[origin].y - STOPS[dest].y);
  const fare = 10 + Math.min(10, Math.round(d / 110) * 2);
  run.passengers.push({ id: run.nextId++, origin, dest, state: 'waiting', patience: RULES.patience, fare });
}

// ---- 上下客 ----------------------------------------------------------------
function exchange(run, s) {
  let dropped = 0, gained = 0, picked = 0;
  const aboard = () => run.passengers.filter((p) => p.state === 'aboard').length;
  for (const p of run.passengers) {
    if (p.state === 'aboard' && p.dest === s) {
      p.state = 'done';
      run.money += p.fare; gained += p.fare; dropped++; run.delivered++;
    }
  }
  for (const p of run.passengers) {
    if (p.state === 'waiting' && p.origin === s && aboard() < RULES.capacity) {
      p.state = 'aboard'; picked++;
    }
  }
  run.passengers = run.passengers.filter((p) => p.state !== 'done');
  if (dropped) run.events.push({ type: 'dropoff', count: dropped, gained });
  if (picked) run.events.push({ type: 'pickup', count: picked });
}

// ---- 主步进 ----------------------------------------------------------------
export function tick(run, dt, input = {}) {
  if (run.phase !== 'play') return;
  run.time += dt;
  run.timeLeft -= dt;
  const b = run.bus;

  // 油门 / 刹车
  if (input.up) b.speed += BUS.ACCEL * dt;
  if (input.down) b.speed -= BUS.BRAKE * dt;
  b.speed -= b.speed * BUS.DRAG * dt;
  const onRoad = isOnRoad(b.x, b.y);
  const maxS = onRoad ? BUS.MAX_SPEED : BUS.OFFROAD_MAX;
  if (!onRoad) b.speed -= b.speed * 2.5 * dt;
  b.speed = clamp(b.speed, BUS.REVERSE_MAX, maxS);
  if (!input.up && !input.down && Math.abs(b.speed) < 4) b.speed = 0;

  // 转向（速度越高转得越快，倒车反向）
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const sf = clamp(Math.abs(b.speed) / BUS.MAX_SPEED, 0, 1);
  b.heading += steer * BUS.TURN * sf * dt * (b.speed < 0 ? -1 : 1);

  // 位移 + 建筑碰撞（分轴滑动）
  const dx = Math.cos(b.heading) * b.speed * dt;
  const dy = Math.sin(b.heading) * b.speed * dt;
  let nx = b.x + dx;
  if (hitsBuilding(nx, b.y)) { if (Math.abs(b.speed) > 70) run.events.push({ type: 'bump' }); nx = b.x; b.speed *= 0.3; }
  let ny = b.y + dy;
  if (hitsBuilding(nx, ny)) { if (Math.abs(b.speed) > 70) run.events.push({ type: 'bump' }); ny = b.y; b.speed *= 0.3; }
  b.x = clamp(nx, 20, WORLD.WIDTH - 20);
  b.y = clamp(ny, 20, WORLD.HEIGHT - 20);

  // 停稳上下客
  const s = stopAt(b.x, b.y);
  if (s >= 0 && Math.abs(b.speed) < BUS.STOP_SPEED) {
    run.dwell += dt;
    if (run.dwell >= RULES.stopDwell && run.lastExchangeStop !== s) {
      exchange(run, s);
      run.lastExchangeStop = s;
    }
  } else {
    run.dwell = 0;
    run.lastExchangeStop = -1;
  }

  // 生成乘客
  run.spawnT -= dt;
  const waiting = run.passengers.filter((p) => p.state === 'waiting').length;
  if (run.spawnT <= 0 && waiting < RULES.maxWaiting) {
    spawnPassenger(run);
    run.spawnT = RULES.spawnEvery;
  }

  // 候车耐心
  for (const p of run.passengers) {
    if (p.state === 'waiting') {
      p.patience -= dt;
      if (p.patience <= 0) { p.state = 'gone'; run.events.push({ type: 'left' }); }
    }
  }
  run.passengers = run.passengers.filter((p) => p.state !== 'gone');

  if (run.timeLeft <= 0) {
    run.timeLeft = 0;
    run.phase = 'over';
    run.events.push({ type: 'shiftEnd', money: run.money, delivered: run.delivered });
  }
}

export function getHud(run) {
  return {
    phase: run.phase,
    money: run.money,
    timeLeft: Math.max(0, run.timeLeft),
    delivered: run.delivered,
    aboard: run.passengers.filter((p) => p.state === 'aboard').length,
    waiting: run.passengers.filter((p) => p.state === 'waiting').length,
    capacity: RULES.capacity,
    speed: run.bus.speed,
    heading: run.bus.heading,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { spawnPassenger, stopAt };