// GET ON BUS 3D · 纯逻辑模拟（可无头测试 / selfplay）
// 玩法（源自参考源码 P0 1:1）：
//   - 公交车沿固定路线自动前进（怠速永不停止），玩家只控制「油门/刹车」一个键。
//   - 在接客点接乘客、送客点送客并赚钱；横穿车撞上即翻车（护盾可挡一次）。
//   - 原创新机制：贴脸擦过（near-miss）连击加成、护盾/氮气/金币道具、星级结算。
import { WORLD, PHYS, HOST, COUNTDOWN, REWARD } from '../../config/game.config.js';
import { buildLevel, calcStars } from '../../config/levels.js';

// mulberry32（确定性 PRNG，状态显式存于 st.rng.s，便于 clone 做前瞻）
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngNext(st) {
  let s = (st.rngSeed + 0x6D2B79F5) | 0;
  st.rngSeed = s;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function initState(level, seed) {
  return {
    levelIndex: level.index - 1,
    level: level.index,              // 1-based 显示
    phase: 'countdown',              // countdown | running | crashed | won
    t: 0,                            // 自 running 起累计（横穿车调度用）
    countdown: COUNTDOWN,
    dist: 0,
    speed: 0,
    gas: false,
    hostingT: 0,
    hostKind: null,
    turboT: 0,
    x: level.points[0].x,
    y: level.points[0].y,
    heading: { x: 0, y: 1 },
    ptr: 1,                          // 下一路线点索引
    coins: 0,
    shield: 0,
    passengers: 0,
    delivered: 0,
    nearMisses: 0,
    deaths: 0,
    stars: 0,
    cars: [],
    crossings: level.crossings.map((c) => ({ ...c })),
    pickups: level.pickups.map((p) => ({ ...p, taken: false })),
    points: level.points,
    totalPassengers: level.passengers,
    totalCoinsMax: level.length,     // 占位，非关键
    _carId: 1,
    rngSeed: seed >>> 0,
  };
}

export function cloneState(st) {
  return {
    ...st,
    heading: { ...st.heading },
    cars: st.cars.map((c) => ({ ...c })),
    crossings: st.crossings.map((c) => ({ ...c })),
    pickups: st.pickups.map((p) => ({ ...p })),
    points: st.points,
  };
}

// 沿路线推进，触发接客/送客/终点
function advanceAlongRoute(st, stepDist, onEvent) {
  st.dist += stepDist;
  const pts = st.points;
  while (st.ptr < pts.length && st.dist >= pts[st.ptr].dist) {
    st.dist = pts[st.ptr].dist;
    triggerWaypoint(st, pts[st.ptr], onEvent);
    st.ptr += 1;
    if (st.phase !== 'running') break;
  }
  recomputePos(st);
}

function triggerWaypoint(st, pt, onEvent) {
  switch (pt.type) {
    case 'pickup':
      st.passengers += 1;
      st.hostingT = HOST.PICKUP;
      st.hostKind = 'pickup';
      st.speed = 0;
      onEvent && onEvent('pickup', { passengers: st.passengers, total: st.totalPassengers });
      break;
    case 'dropoff': {
      const combo = Math.min(st.nearMisses, REWARD.COMBO_CAP);
      const base = Math.floor(
        REWARD.BASE + st.level / REWARD.LEVEL_DIV + rngNext(st) * REWARD.RAND_MAX,
      );
      const reward = Math.floor(base * (1 + combo));
      st.coins += reward;
      st.delivered += 1;
      st.hostingT = HOST.DROPOFF;
      st.hostKind = 'dropoff';
      st.speed = 0;
      onEvent && onEvent('dropoff', { coins: reward, delivered: st.delivered, total: st.totalPassengers });
      onEvent && onEvent('coin', { coins: reward });
      break;
    }
    case 'end':
      st.phase = 'won';
      st.stars = calcStars(st.levelIndex, st.coins, st.nearMisses);
      onEvent && onEvent('win', { coins: st.coins, stars: st.stars, nearMisses: st.nearMisses, delivered: st.delivered });
      break;
    default:
      break;
  }
}

function recomputePos(st) {
  const pts = st.points;
  let i = st.ptr;
  if (i < 1) i = 1;
  while (i < pts.length && pts[i].dist <= st.dist) i += 1;
  st.ptr = i;
  if (i >= pts.length) {
    const last = pts[pts.length - 1];
    st.x = last.x;
    st.y = last.y;
    return;
  }
  const a = pts[i - 1];
  const b = pts[i];
  const segLen = b.dist - a.dist;
  const k = segLen > 0 ? (st.dist - a.dist) / segLen : 0;
  st.x = a.x + (b.x - a.x) * k;
  st.y = a.y + (b.y - a.y) * k;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  st.heading = { x: dx / len, y: dy / len };
}

function updateCars(st, dt) {
  for (const c of st.crossings) {
    while (st.t >= c.nextSpawn) {
      const x0 = c.dir === 1 ? -WORLD.MARGIN : WORLD.MARGIN;
      st.cars.push({
        id: st._carId++,
        x: x0,
        y: c.y,
        vx: c.dir * c.speed,
        r: c.r || WORLD.CAR_R,
        nearMissed: false,
      });
      c.nextSpawn += c.interval;
    }
  }
  for (let i = st.cars.length - 1; i >= 0; i -= 1) {
    const car = st.cars[i];
    car.x += car.vx * dt;
    if (Math.abs(car.x) > WORLD.MARGIN + 140) st.cars.splice(i, 1);
  }
}

function applyPickup(st, pk, onEvent) {
  switch (pk.type) {
    case 'shield':
      st.shield += 1;
      onEvent && onEvent('shield', { shields: st.shield });
      break;
    case 'turbo':
      st.turboT = PHYS.TURBO_TIME;
      onEvent && onEvent('turbo', {});
      break;
    case 'coin':
      st.coins += REWARD.COIN_PICKUP;
      onEvent && onEvent('coin', { coins: REWARD.COIN_PICKUP });
      break;
    default:
      break;
  }
}

function checkCollisions(st, onEvent) {
  const bx = st.x;
  const by = st.y;
  for (let i = st.cars.length - 1; i >= 0; i -= 1) {
    const car = st.cars[i];
    const dx = car.x - bx;
    const dy = car.y - by;
    const d2 = dx * dx + dy * dy;
    const collideR = WORLD.BUS_R + car.r;
    if (d2 < collideR * collideR) {
      if (st.shield > 0) {
        st.shield -= 1;
        st.cars.splice(i, 1);
        onEvent && onEvent('shieldBreak', { shields: st.shield });
      } else {
        st.phase = 'crashed';
        st.deaths = 1;
        onEvent && onEvent('crash', {});
        return;
      }
    } else if (!car.nearMissed && d2 < WORLD.NEAR_R * WORLD.NEAR_R) {
      car.nearMissed = true;
      st.nearMisses += 1;
      onEvent && onEvent('nearMiss', { nearMisses: st.nearMisses });
    }
  }
}

// 主步进：固定/任意 dt 均可，纯逻辑、无 DOM。
export function stepState(st, dt, onEvent) {
  if (st.phase === 'countdown') {
    st.countdown -= dt;
    if (st.countdown <= 0) {
      st.phase = 'running';
      st.speed = PHYS.MIN_SPEED;
      onEvent && onEvent('go', {});
    }
    return;
  }
  if (st.phase !== 'running') return;

  st.t += dt;

  if (st.hostingT > 0) {
    st.hostingT -= dt;
    st.speed = 0;
    if (st.hostingT <= 0) {
      st.hostingT = 0;
      st.hostKind = null;
      st.speed = PHYS.MIN_SPEED;
    }
  } else {
    if (st.turboT > 0) {
      st.turboT -= dt;
      st.speed = PHYS.TURBO_SPEED;
    } else {
      st.speed += (st.gas ? PHYS.ACCEL : PHYS.BRAKE) * dt;
      if (st.speed < PHYS.MIN_SPEED) st.speed = PHYS.MIN_SPEED;
      if (st.speed > PHYS.MAX_SPEED) st.speed = PHYS.MAX_SPEED;
    }
    advanceAlongRoute(st, st.speed * dt, onEvent);
    for (const pk of st.pickups) {
      if (!pk.taken && st.dist >= pk.d) {
        pk.taken = true;
        applyPickup(st, pk, onEvent);
      }
    }
  }

  updateCars(st, dt);
  if (st.phase === 'running') checkCollisions(st, onEvent);
}

function makeRun(st) {
  const pending = [];
  const onEvent = (type, data) => {
    pending.push({ type, ...data });
  };
  return {
    get state() {
      return st;
    },
    // 输入：true=油门 / false=刹车。每次调用都被接受（返回 ok）。
    gas(v) {
      st.gas = !!v;
      return { ok: true };
    },
    step(dt) {
      stepState(st, dt, onEvent);
    },
    drainEvents() {
      return pending.splice(0);
    },
    clone() {
      return cloneState(st);
    },
  };
}

// 创建一个新 run（levelIndex 0-based）
export function createRun(levelIndex, opts = {}) {
  const seed = opts.seed ?? 1;
  const level = buildLevel(levelIndex);
  const st = initState(level, seed);
  return makeRun(st);
}
