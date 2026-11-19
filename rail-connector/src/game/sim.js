// sim.js — 纯逻辑仿真（零 DOM，Node/浏览器通用，可被 selfplay 与 node --test 直接 import）。
//
// 玩法 P0（来自参考「火车轨道」逆向）：网格铁轨上两列火车自动行驶；玩家切换道岔
// 把红/蓝车各自导向同色能量核心(cargo)并送到同色终端(terminal)投递；填满进度条过关。
// 事故（撞车/撞岩/走死路/送错终端）扣分并重置列车。超时失败。
// 新机制：①星级评价(按失误数 1–3 星) ②岩石障碍 ③霜冻减速道具（投递充能，一键慢速）。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { DX, DY, opposite, exitOf } from './track.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

const isTrackCell = (cell) =>
  cell && (cell.type === 'straight' || cell.type === 'curve' || cell.type === 'switch');

function activeShape(cell) {
  if (!cell) return null;
  if (cell.type === 'straight' || cell.type === 'curve') return { kind: cell.type, rot: cell.rot };
  if (cell.type === 'switch') return cell.states[cell.stateIndex] || null;
  return null;
}

export function createRun(levelIndex, opts = {}) {
  const level = LEVELS[levelIndex];
  if (!level) throw new Error(`level ${levelIndex} 不存在`);

  const grid = clone(level.grid);
  const switches = level.switches.map((s) => ({ r: s.r, c: s.c }));

  const state = {
    level: levelIndex,
    phase: 'playing', // playing | won | lost
    rows: level.rows,
    cols: level.cols,
    grid,
    switches,
    trains: [],
    cargos: clone(level.cargos),
    terminals: clone(level.terminals),
    rocks: clone(level.rocks || []),
    score: 0,
    totalScore: level.totalScore,
    timeLimit: level.timeLimit,
    timeLeft: level.timeLimit,
    speed: level.speed,
    goodsScore: level.goodsScore,
    errorScore: level.errorScore,
    trainCount: level.trainCount || 2,
    combo: 0,
    errors: 0,
    deliveries: 0,
    stars: 0,
    frost: {
      charges: level.frostCharges || 1,
      max: 3,
      active: 0,        // >0 表示减速生效中
      activeTimer: 0,   // 减速剩余秒数
    },
    name: level.name,
  };

  for (const t of level.trains) {
    state.trains.push({
      color: t.color,
      x: t.c,
      y: t.r,
      nx: t.c + DX[t.dir],
      ny: t.r + DY[t.dir],
      dir: t.dir,
      t: 0,             // 0..1 当前段进度
      hasCargo: false,
      spawn: { x: t.c, y: t.r, dir: t.dir },
    });
  }

  const events = [];

  function cellAt(x, y) {
    return state.grid[y] && state.grid[y][x];
  }

  function cargoAt(x, y) {
    return state.cargos.find((c) => c.c === x && c.r === y) || null;
  }
  function terminalAt(x, y) {
    return state.terminals.find((c) => c.c === x && c.r === y) || null;
  }

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function resetTrains() {
    for (const t of state.trains) {
      t.x = t.spawn.x;
      t.y = t.spawn.y;
      t.dir = t.spawn.dir;
      t.nx = t.x + DX[t.dir];
      t.ny = t.y + DY[t.dir];
      t.t = 0;
      t.hasCargo = false;
    }
  }

  function penalty(reason, color) {
    state.score = Math.max(0, state.score - state.errorScore);
    state.errors += 1;
    state.combo = 0;
    emit(reason === 'rock' ? 'rockCrash' : 'boom', { color, reason });
    resetTrains();
  }

  function deliver(color) {
    state.score += state.goodsScore;
    state.deliveries += 1;
    state.combo += 1;
    if (state.frost.charges < state.frost.max) state.frost.charges += 1;
    emit('deliver', { color });
    if (state.combo >= 2) emit('combo', { combo: state.combo });
    if (state.score >= state.totalScore) {
      state.score = state.totalScore;
      win();
    }
  }

  function win() {
    state.phase = 'won';
    state.stars = state.errors === 0 ? 3 : state.errors <= 2 ? 2 : 1;
    state.frost.active = 0;
    emit('win', { stars: state.stars, errors: state.errors });
  }

  function lose() {
    state.phase = 'lost';
    state.frost.active = 0;
    emit('lose', { reason: 'timeout' });
  }

  // 推进单个火车 dist（格数）；事故返回 true 表示本子步已产生 boom 并复位。
  function moveTrain(train, dist) {
    train.t += dist;
    while (train.t >= 1) {
      train.t -= 1;
      train.x = train.nx;
      train.y = train.ny;
      emit('cross', { color: train.color, x: train.x, y: train.y });

      const cargo = cargoAt(train.x, train.y);
      if (cargo && cargo.color === train.color && !train.hasCargo) {
        train.hasCargo = true;
        emit('pickup', { color: train.color });
      } else if (cargo && cargo.color !== train.color && !train.hasCargo) {
        state.errors += 1;
        state.combo = 0;
        emit('wrongPickup', { color: train.color, want: cargo.color });
      }

      const terminal = terminalAt(train.x, train.y);
      if (terminal && terminal.color === train.color && train.hasCargo) {
        train.hasCargo = false;
        deliver(train.color);
      } else if (terminal && terminal.color !== train.color) {
        penalty('wrongTerminal', train.color);
        return true;
      }

      const cell = cellAt(train.x, train.y);
      const shape = activeShape(cell);
      const from = opposite(train.dir);
      const exit = shape ? exitOf(shape, from) : null;
      if (exit == null) {
        penalty('deadEnd', train.color);
        return true;
      }
      train.dir = exit;
      train.nx = train.x + DX[exit];
      train.ny = train.y + DY[exit];
      const nextCell = cellAt(train.nx, train.ny);
      if (!nextCell || nextCell.type === 'empty') {
        penalty('deadEnd', train.color);
        return true;
      }
      if (nextCell.type === 'rock') {
        penalty('rock', train.color);
        return true;
      }
    }
    return false;
  }

  function stepTrains(dist) {
    for (const train of state.trains) {
      if (moveTrain(train, dist)) return true; // 已发生事故并复位
    }
    return false;
  }

  function checkCollisions() {
    const red = state.trains.filter((t) => t.color === 'red');
    const blue = state.trains.filter((t) => t.color === 'blue');
    for (const r of red) {
      for (const b of blue) {
        const sameCell = r.x === b.x && r.y === b.y;
        const headOn = r.nx === b.x && r.ny === b.y && b.nx === r.x && b.ny === r.y
          && r.t > 0.5 && b.t > 0.5;
        if (sameCell || headOn) {
          penalty('collision', 'red');
          return;
        }
      }
    }
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    if (!(dt > 0)) return;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      lose();
      return;
    }

    if (state.frost.active > 0) {
      state.frost.activeTimer -= dt;
      if (state.frost.activeTimer <= 0) state.frost.active = 0;
    }

    const speed = state.speed * (state.frost.active > 0 ? 0.5 : 1);
    let rem = dt;
    while (rem > 1e-9) {
      const h = Math.min(rem, 1 / 60);
      rem -= h;
      if (stepTrains(speed * h)) break;
      checkCollisions();
    }
  }

  function toggleSwitch(i) {
    if (state.phase !== 'playing') return { ok: false };
    const sw = state.switches[i];
    if (!sw) return { ok: false };
    const cell = state.grid[sw.r][sw.c];
    if (!cell || cell.type !== 'switch') return { ok: false };
    cell.stateIndex = (cell.stateIndex + 1) % cell.states.length;
    emit('switch', { index: i, stateIndex: cell.stateIndex });
    return { ok: true };
  }

  function useFrost() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.frost.charges < 1) return { ok: false };
    state.frost.charges -= 1;
    state.frost.active = 1;
    state.frost.activeTimer = 3;
    emit('frost', { charges: state.frost.charges });
    return { ok: true };
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  function getHud() {
    return {
      phase: state.phase,
      level: state.level,
      score: state.score,
      totalScore: state.totalScore,
      timeLeft: state.timeLeft,
      combo: state.combo,
      errors: state.errors,
      deliveries: state.deliveries,
      stars: state.stars,
      frostCharges: state.frost.charges,
      frostActive: state.frost.active > 0,
    };
  }

  const run = {
    state,
    step,
    drainEvents,
    getHud,
    toggleSwitch,
    useFrost,
    _level: level,
  };
  // 自对弈 / 调试便捷别名
  run.step = step;
  run.drainEvents = drainEvents;
  run.getHud = getHud;
  run.toggleSwitch = toggleSwitch;
  run.useFrost = useFrost;
  return run;
}

export { LEVELS, LEVEL_COUNT, isTrackCell, activeShape };
