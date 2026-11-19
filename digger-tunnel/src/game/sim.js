// src/game/sim.js — 纯逻辑（零 DOM）：网格地形 + 钻核刚体 + 挖隧道 + 事件。
// 浏览器 main.js 与 Node 的 tools/selfplay.mjs 共用同一代码路径。
import {
  WORLD, CELL, COLS, ROWS, ORB, BRUSH_R, GOAL_R, GEM_R, STEP, GAME,
} from '../../config/game.config.js';
import { getLevel } from '../../config/levels.js';

const EMPTY = 0;
const SOIL = 1;
const ROCK = 2;

function inGrid(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

// 左/右/上边界为实心墙；下边界开放（坠落判负）。
function solidAt(grid, x, y) {
  if (x < 0 || y < 0 || x >= COLS) return true;
  if (y >= ROWS) return false;
  return grid[y * COLS + x] !== EMPTY;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// 圆形写入：把圆内单元格置为 val（carve 用 EMPTY，岩石用 ROCK）
function paintCircle(grid, cx, cy, r, val) {
  const x0 = Math.floor((cx - r) / CELL);
  const x1 = Math.floor((cx + r) / CELL);
  const y0 = Math.floor((cy - r) / CELL);
  const y1 = Math.floor((cy + r) / CELL);
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      if (!inGrid(xx, yy)) continue;
      const px = xx * CELL + CELL / 2;
      const py = yy * CELL + CELL / 2;
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= r * r) grid[yy * COLS + xx] = val;
    }
  }
}

function buildGrid(level) {
  const grid = new Uint8Array(COLS * ROWS).fill(SOIL);
  paintCircle(grid, level.startX, level.startY, 46, EMPTY);
  paintCircle(grid, level.goalX, level.goalY, GOAL_R, EMPTY);
  for (const rock of level.rocks) {
    // 岩石只覆盖土壤格，绝不覆盖已挖空的口袋
    for (let yy = 0; yy < ROWS; yy += 1) {
      for (let xx = 0; xx < COLS; xx += 1) {
        const px = xx * CELL + CELL / 2;
        const py = yy * CELL + CELL / 2;
        const dx = px - rock.x;
        const dy = py - rock.y;
        if (dx * dx + dy * dy <= rock.r * rock.r && grid[yy * COLS + xx] === SOIL) {
          grid[yy * COLS + xx] = ROCK;
        }
      }
    }
  }
  return grid;
}

function physicsSub(state, dt) {
  const o = state.orb;
  o.vy = Math.min(o.vy + ORB.GRAVITY * dt, ORB.TERMINAL);
  o.x += o.vx * dt;
  o.y += o.vy * dt;
  collide(state);
}

function collide(state) {
  const o = state.orb;
  const r = ORB.R;
  for (let iter = 0; iter < 3; iter += 1) {
    let hit = false;
    const x0 = Math.floor((o.x - r) / CELL);
    const x1 = Math.floor((o.x + r) / CELL);
    const y0 = Math.floor((o.y - r) / CELL);
    const y1 = Math.floor((o.y + r) / CELL);
    for (let gy = y0; gy <= y1; gy += 1) {
      for (let gx = x0; gx <= x1; gx += 1) {
        if (!solidAt(state.grid, gx, gy)) continue;
        const px = clamp(o.x, gx * CELL, (gx + 1) * CELL);
        const py = clamp(o.y, gy * CELL, (gy + 1) * CELL);
        const dx = o.x - px;
        const dy = o.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        let nx;
        let ny;
        const d = Math.sqrt(d2);
        if (d < 1e-6) {
          nx = 0;
          ny = -1;
          o.y = gy * CELL - r - 0.5;
        } else {
          nx = dx / d;
          ny = dy / d;
          const overlap = r - d;
          o.x += nx * overlap;
          o.y += ny * overlap;
        }
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) {
          o.vx -= vn * nx;
          o.vy -= vn * ny;
          o.vx *= ORB.FRICTION;
        }
      }
    }
    if (!hit) break;
  }
  if (o.x < r) { o.x = r; if (o.vx < 0) o.vx = 0; }
  if (o.x > WORLD.WIDTH - r) { o.x = WORLD.WIDTH - r; if (o.vx > 0) o.vx = 0; }
  if (Math.abs(o.vx) < 1) o.vx = 0;
  if (Math.abs(o.vy) < 1) o.vy = 0;
}

function calcStars(state) {
  if (state.gemsCollected >= state.gemsTotal) return 3;
  if (state.gemsCollected >= Math.ceil(state.gemsTotal / 2)) return 2;
  return 1;
}

function emit(state, type, payload = {}) {
  state.events.push({ type, t: state.time, ...payload });
}

function carveAt(state, x, y) {
  const grid = state.grid;
  let removed = 0;
  let hitRock = false;
  const x0 = Math.floor((x - BRUSH_R) / CELL);
  const x1 = Math.floor((x + BRUSH_R) / CELL);
  const y0 = Math.floor((y - BRUSH_R) / CELL);
  const y1 = Math.floor((y + BRUSH_R) / CELL);
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      if (!inGrid(xx, yy)) continue;
      const px = xx * CELL + CELL / 2;
      const py = yy * CELL + CELL / 2;
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > BRUSH_R * BRUSH_R) continue;
      const idx = yy * COLS + xx;
      if (grid[idx] === SOIL) {
        grid[idx] = EMPTY;
        removed += 1;
        state.carvedCells += 1;
      } else if (grid[idx] === ROCK) {
        hitRock = true;
      }
    }
  }
  if (removed > 0) emit(state, 'carve', { x: Math.round(x), y: Math.round(y), removed });
  if (hitRock) { emit(state, 'rock', { x: Math.round(x), y: Math.round(y) }); state.shake = GAME.SHAKE_AMP; }
  return { ok: removed > 0 || hitRock, removed, hitRock };
}

function stepRun(state, dt) {
  if (state.phase !== 'playing') return;
  const sub = state._sub;
  const h = dt / sub;
  for (let i = 0; i < sub; i += 1) physicsSub(state, h);

  state.time += dt;
  state.timeLeft = Math.max(0, state.level.time - state.time);
  state.shake = Math.max(0, state.shake - dt * 90);

  const speed = Math.hypot(state.orb.vx, state.orb.vy);
  if (speed > 120 && !state.falling) {
    state.falling = true;
    emit(state, 'fall', { speed: Math.round(speed) });
  } else if (speed < ORB.REST_EPS) {
    state.falling = false;
  }

  for (const g of state.gems) {
    if (g.collected) continue;
    const dx = state.orb.x - g.x;
    const dy = state.orb.y - g.y;
    const rr = ORB.R + GEM_R;
    if (dx * dx + dy * dy <= rr * rr) {
      g.collected = true;
      state.gemsCollected += 1;
      if (state.time <= state.comboUntil) {
        state.combo += 1;
        emit(state, 'combo', { combo: state.combo });
      } else {
        state.combo = 1;
      }
      state.comboUntil = state.time + GAME.COMBO_WINDOW;
      state.score += 100 * state.combo;
      emit(state, 'gem', { x: g.x, y: g.y, gems: state.gemsCollected, combo: state.combo, score: state.score });
    }
  }

  const gdx = state.orb.x - state.level.goalX;
  const gdy = state.orb.y - state.level.goalY;
  const gd2 = gdx * gdx + gdy * gdy;
  if (!state.nearGoal && gd2 <= (GOAL_R * 2.2) * (GOAL_R * 2.2)) {
    state.nearGoal = true;
    emit(state, 'near', {});
  }
  if (gd2 <= GOAL_R * GOAL_R) {
    state.phase = 'won';
    state.stars = calcStars(state);
    emit(state, 'win', { stars: state.stars, score: state.score, gems: state.gemsCollected });
    return;
  }
  if (state.orb.y - ORB.R > WORLD.HEIGHT) {
    state.phase = 'lost';
    state.loseReason = 'fellOut';
    emit(state, 'lose', { reason: 'fellOut' });
    return;
  }
  if (state.timeLeft <= 0) {
    state.phase = 'lost';
    state.loseReason = 'timeOut';
    emit(state, 'lose', { reason: 'timeOut' });
  }
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = getLevel(levelIndex);
  const grid = buildGrid(level);

  const state = {
    levelIndex,
    level,
    phase: 'playing',
    loseReason: null,
    grid,
    orb: { x: level.startX, y: level.startY, vx: 0, vy: 0 },
    time: 0,
    timeLeft: level.time,
    gems: level.gems.map((g) => ({ x: g.x, y: g.y, r: GEM_R, collected: false })),
    gemsCollected: 0,
    gemsTotal: level.gems.length,
    combo: 0,
    comboUntil: 0,
    score: 0,
    stars: 0,
    carvedCells: 0,
    events: [],
    shake: 0,
    falling: false,
    nearGoal: false,
    _sub: 2,
  };

  // 预沉降：钻核在起点口袋落到静止（不计时、不产生事件）
  for (let i = 0; i < 50; i += 1) physicsSub(state, STEP / 2);
  state.events = [{ type: 'start', t: 0 }];

  return {
    state,
    step(dt = STEP) { stepRun(state, dt); },
    carve(x, y) { return carveAt(state, x, y); },
    drainEvents() { const e = state.events; state.events = []; return e; },
    getHud() {
      return {
        phase: state.phase,
        level: state.levelIndex + 1,
        time: state.time,
        timeLeft: state.timeLeft,
        gems: state.gemsCollected,
        gemsTotal: state.gemsTotal,
        score: state.score,
        combo: state.combo,
      };
    },
  };
}

export { SOIL, ROCK, EMPTY };
