// PARK SLIDE IN · 纯逻辑仿真（无 DOM）
// 自行车模型：转向（前轮角）+ 油门（前进/倒车/滑行），SAT 碰撞，完全入位判定。
// 对外：createRun(levelIndex, {seed}) → { state, step, setInput, drainEvents, getHud }
import { WORLD, CAR, PULSE_S } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; };

// 车体世界多边形（中心 + 朝向旋转，y 向下）
export function carPolygon(car) {
  const cos = Math.cos(car.heading);
  const sin = Math.sin(car.heading);
  return CAR.LOCAL.map(([lx, ly]) => [
    car.x + lx * cos - ly * sin,
    car.y + lx * sin + ly * cos,
  ]);
}

function aabbPolygon(o) {
  const hw = o.w / 2;
  const hh = o.h / 2;
  return [
    [o.x - hw, o.y - hh],
    [o.x + hw, o.y - hh],
    [o.x + hw, o.y + hh],
    [o.x - hw, o.y + hh],
  ];
}

// SAT：两个凸多边形是否重叠
function polygonsOverlap(A, B) {
  const axes = [];
  const collect = (poly) => {
    for (let i = 0; i < poly.length; i += 1) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const ex = p2[0] - p1[0];
      const ey = p2[1] - p1[1];
      axes.push([-ey, ex]); // 边法线
    }
  };
  collect(A);
  collect(B);
  for (const [ax, ay] of axes) {
    let minA = Infinity; let maxA = -Infinity;
    for (const [x, y] of A) { const p = x * ax + y * ay; if (p < minA) minA = p; if (p > maxA) maxA = p; }
    let minB = Infinity; let maxB = -Infinity;
    for (const [x, y] of B) { const p = x * ax + y * ay; if (p < minB) minB = p; if (p > maxB) maxB = p; }
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

function polygonInsideRect(poly, rect, inset = 2) {
  const x0 = rect.x - rect.w / 2 + inset;
  const x1 = rect.x + rect.w / 2 - inset;
  const y0 = rect.y - rect.h / 2 + inset;
  const y1 = rect.y + rect.h / 2 - inset;
  for (const [x, y] of poly) {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  }
  return true;
}

function polygonPointDistance(poly, x, y) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
    t = clamp(t, 0, 1);
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    const d = Math.sqrt(dist2(x, y, px, py));
    if (d < best) best = d;
  }
  return best;
}

export function createRun(levelIndex, opts = {}) {
  const idx = clamp(levelIndex | 0, 0, LEVEL_COUNT - 1);
  const lv = LEVELS[idx];

  const moving = (lv.moving || []).map((m) => ({
    ...m,
    y: m.y,
    dir: 1,
    phase: m.phase || 0,
  }));

  const car = {
    x: lv.car.x,
    y: lv.car.y,
    heading: lv.car.heading,
    speed: 0,
    steer: 0,
  };

  const state = {
    phase: 'playing', // playing | won | lost | timeout
    level: idx + 1,
    time: 0,
    car,
    input: { throttle: 0, steerDir: 0 },
    bay: lv.bay,
    entry: lv.entry,
    obstacles: lv.obstacles || [],
    orbs: (lv.orbs || []).map((o) => ({ ...o })),
    shields: (lv.shields || []).map((s) => ({ ...s })),
    moving,
    collisions: 0,
    orbsCollected: 0,
    orbTotal: (lv.orbs || []).length,
    shield: 0,
    shieldMax: 1,
    combo: 0,
    stars: 0,
    par: lv.par || 30,
    invuln: 0,
    pulseT: 0,
    nearMissT: 0,
  };

  const events = [];
  const push = (type, payload = {}) => events.push({ type, ...payload });

  push('start', { level: state.level });

  function setInput(next) {
    const inp = state.input;
    const throttle = clamp(next.throttle ?? 0, -1, 1);
    const steerDir = clamp(next.steerDir ?? 0, -1, 1);
    const changed = throttle !== inp.throttle || steerDir !== inp.steerDir;
    if (!changed) return false;
    if (throttle !== 0 && inp.throttle === 0) push('throttleOn', { dir: throttle });
    if (throttle === 0 && inp.throttle !== 0) push('slide');
    if (steerDir !== 0 && inp.steerDir === 0) push('steerOn', { dir: steerDir });
    inp.throttle = throttle;
    inp.steerDir = steerDir;
    return true;
  }

  function collide() {
    if (state.invuln > 0) return;
    if (state.shield > 0) {
      state.shield -= 1;
      state.collisions += 1;
      state.invuln = 0.6;
      car.speed = 0;
      push('shieldBreak', { shield: state.shield });
      return;
    }
    state.phase = 'lost';
    push('lose', { reason: 'crash', level: state.level });
  }

  function step(dt) {
    if (state.phase !== 'playing') return;

    const d = Math.min(dt, 0.1);
    state.time += d;

    // 1) 转向：目标角 = steerDir * MAX_STEER，向目标逼近，过零吸附
    const targetSteer = state.input.steerDir * CAR.MAX_STEER;
    const maxDelta = CAR.STEER_RATE * d;
    if (targetSteer === 0) {
      if (Math.abs(car.steer) <= maxDelta) car.steer = 0;
      else car.steer -= Math.sign(car.steer) * maxDelta;
    } else {
      const diff = targetSteer - car.steer;
      if (Math.abs(diff) <= maxDelta) car.steer = targetSteer;
      else car.steer += Math.sign(diff) * maxDelta;
    }

    // 2) 速度：油门加速 + 恒定滑行摩擦
    car.speed += state.input.throttle * CAR.ACCEL * d;
    if (car.speed !== 0) {
      const fwd = car.speed > 0 ? 1 : -1;
      const decel = CAR.FRICTION * d;
      if (Math.abs(car.speed) <= decel) car.speed = 0;
      else car.speed -= fwd * decel;
    }
    car.speed = clamp(car.speed, -CAR.MAX_SPEED, CAR.MAX_SPEED);

    // 3) 朝向（自行车模型）
    if (Math.abs(car.speed) > 1e-4 && Math.abs(car.steer) > 1e-5) {
      car.heading += (car.speed / CAR.WHEELBASE) * Math.tan(car.steer) * d;
    }

    // 4) 位移
    car.x += car.speed * Math.cos(car.heading) * d;
    car.y += car.speed * Math.sin(car.heading) * d;

    // 5) 移动障碍
    for (const m of state.moving) {
      m.y += m.dir * m.speed * d;
      if (m.y >= m.max) { m.y = m.max; m.dir = -1; }
      else if (m.y <= m.min) { m.y = m.min; m.dir = 1; }
    }

    if (state.invuln > 0) state.invuln -= d;

    // 6) 碰撞检测
    const poly = carPolygon(car);
    let crashed = false;
    if (state.invuln <= 0) {
      for (const o of state.obstacles) {
        if (polygonsOverlap(poly, aabbPolygon(o))) { crashed = true; break; }
      }
      if (!crashed) {
        for (const m of state.moving) {
          if (polygonsOverlap(poly, aabbPolygon(m))) { crashed = true; break; }
        }
      }
      if (!crashed) {
        // 边界墙
        for (const [x, y] of poly) {
          if (x < 2 || x > WORLD.WIDTH - 2 || y < 2 || y > WORLD.HEIGHT - 2) { crashed = true; break; }
        }
      }
      if (crashed) collide();
    }

    if (state.phase !== 'playing') return;

    // 7) 近距（near-miss 反馈）
    if (state.nearMissT <= 0) {
      for (const o of state.obstacles) {
        const dmin = polygonPointDistance(aabbPolygon(o), car.x, car.y);
        if (dmin < 14) { state.nearMissT = 1.2; push('nearMiss', { dist: Math.round(dmin) }); break; }
      }
    }
    if (state.nearMissT > 0) state.nearMissT -= d;

    // 8) 收集能量球 / 护盾
    const carR2 = (34 * 34);
    state.orbs = state.orbs.filter((o) => {
      if (dist2(car.x, car.y, o.x, o.y) < carR2) {
        state.orbsCollected += 1;
        state.combo += 1;
        push('orb', { combo: state.combo, collected: state.orbsCollected });
        if (state.combo >= 2) push('combo', { combo: state.combo });
        return false;
      }
      return true;
    });
    state.shields = state.shields.filter((s) => {
      if (dist2(car.x, car.y, s.x, s.y) < carR2) {
        if (state.shield < state.shieldMax) {
          state.shield += 1;
          push('shield', { shield: state.shield });
        } else {
          push('orb', { combo: state.combo, collected: state.orbsCollected }); // 已满时当作能量球
        }
        return false;
      }
      return true;
    });

    // 9) 心跳 pulse（可感知反馈密度）
    state.pulseT += d;
    if (state.pulseT >= PULSE_S) {
      state.pulseT = 0;
      push('pulse', { t: Math.round(state.time) });
    }

    // 10) 成功判定：完全入位且基本停稳
    if (polygonInsideRect(poly, state.bay, 2) && Math.abs(car.speed) <= CAR.PARK_SPEED) {
      state.stars = 1;
      if (state.collisions === 0) state.stars += 1;
      if (state.time <= state.par) state.stars += 1;
      state.stars = clamp(state.stars, 1, 3);
      state.phase = 'won';
      push('win', {
        level: state.level,
        stars: state.stars,
        time: Math.round(state.time * 10) / 10,
        orbs: state.orbsCollected,
        collisions: state.collisions,
      });
      return;
    }

    // 11) 超时
    if (state.time > 90) {
      state.phase = 'timeout';
      push('lose', { reason: 'timeout', level: state.level });
    }
  }

  function drainEvents() {
    const out = events.splice(0, events.length);
    return out;
  }

  function getHud() {
    return {
      time: state.time,
      level: state.level,
      orbs: state.orbsCollected,
      orbTotal: state.orbTotal,
      shield: state.shield,
      combo: state.combo,
      speed: car.speed,
    };
  }

  return {
    state,
    setInput,
    step,
    drainEvents,
    getHud,
    _level: lv,
    _index: idx,
  };
}
