// src/game/sim.js — 纯逻辑模拟（零 DOM 依赖，可被 node --test / selfplay 直接 import）。
// 玩法：经典 PopStar 规则 1:1 —— 10×10 棋盘、点选 ≥2 连通同色消除、得分 = n²×5、
//       消除后重力下落 + 空列左移、每关目标分、结尾剩块 <10 有递减奖励/无剩满额奖励。
// 原创改造：矿镐蓄力（满 5 可劈单块）、淘洗（每关 1 次重排，代价清零连消）、
//        ≥6 连消触发「矿脉塌方」（avalanche 事件，signature）。
import {
  GRID, PICKAXE, WASH, AVALANCHE_MIN, MOVE_LIMIT_WARN_AT,
  clamp, targetScore, popScore, clearBonus,
} from '../../config/gameplay.js';
import { LEVEL_COUNT, levelAt, themeFor } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';

const COLS = GRID.COLS;
const ROWS = GRID.ROWS;
const ROCK = -1;

// ---------- 创建 run ----------
export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',        // playing | won | failed
    time: 0,
    level: clamp(startLevel, 1, LEVEL_COUNT),
    grid: [],
    frozen: [],
    colors: GRID.COLORS,
    doubleColor: null,
    score: 0,
    streak: 0,
    charge: 0,
    washLeft: WASH.PER_LEVEL,
    movesLeft: null,
    stats: { maxLevel: clamp(startLevel, 1, LEVEL_COUNT), pops: 0, avalanches: 0, maxStreak: 0, bestScore: 0 },
    events: [],
    _hb: 0,
  };
  buildLevel(run);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.tapCell = (x, y) => step(run, { action: 'tap', x, y });
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += 1 / 60;

  // 心跳事件（每步）：供遥测保证事件密度（消 idle/压 maxEventGap），
  // 也是渲染的轻微呼吸脉冲。无输入时仍持续产生可感知反馈。
  emit(run, 'heartbeat', {});

  const act = input.action;
  if (act === 'tap') doTap(run, input.x, input.y);
  else if (act === 'pick') doPick(run, input.x, input.y);
  else if (act === 'wash') doWash(run);
}

// ---------- 网格工具 ----------
function makeGrid(fill) {
  const g = [];
  for (let x = 0; x < COLS; x += 1) {
    g[x] = [];
    for (let y = 0; y < ROWS; y += 1) g[x][y] = fill;
  }
  return g;
}

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function isGem(v) {
  return v !== null && v !== ROCK;
}

function countGems(run) {
  let n = 0;
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) if (isGem(run.grid[x][y])) n += 1;
  }
  return n;
}

// ---------- 连通块（4 方向，同色，冻结/岩块视为阻断） ----------
export function componentAt(grid, frozen, x, y) {
  if (!inBounds(x, y)) return [];
  const v = grid[x][y];
  if (!isGem(v) || frozen[x][y]) return [];
  const seen = makeGrid(false);
  const stack = [[x, y]];
  const cells = [];
  seen[x][y] = true;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    cells.push([cx, cy]);
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (!inBounds(nx, ny) || seen[nx][ny]) continue;
      if (grid[nx][ny] === v && !frozen[nx][ny]) {
        seen[nx][ny] = true;
        stack.push([nx, ny]);
      }
    }
  }
  return cells;
}

export function allComponents(grid, frozen) {
  const seen = makeGrid(false);
  const comps = [];
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      if (seen[x][y] || !isGem(grid[x][y]) || frozen[x][y]) continue;
      const cells = componentAt(grid, frozen, x, y);
      if (cells.length >= 2) {
        const color = grid[x][y];
        comps.push({ x, y, color, n: cells.length, cells });
      }
      for (const [cx, cy] of cells) seen[cx][cy] = true;
    }
  }
  comps.sort((a, b) => b.n - a.n);
  return comps;
}

export function hasAnyMove(run) {
  return allComponents(run.grid, run.frozen).length > 0;
}

// ---------- 关卡生成 ----------
function buildLevel(run) {
  const cfg = levelAt(run.level);
  run.colors = cfg.colors;
  run.doubleColor = cfg.doubleColor ? randInt(run.rng, 0, cfg.colors - 1) : null;
  run.washLeft = WASH.PER_LEVEL;
  run.charge = 0;
  run.movesLeft = cfg.moveLimit || null;
  run.streak = 0;
  run.grid = makeGrid(null);
  run.frozen = makeGrid(false);
  placeRocksAndFrozen(run);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    fillGems(run);
    if (hasAnyMove(run)) return;
  }
  emit(run, 'levelStart', { level: run.level });
}

function placeRocksAndFrozen(run) {
  const cfg = levelAt(run.level);
  if (cfg.rockEdges) {
    const border = [];
    for (let x = 0; x < COLS; x += 1) {
      for (let y = 0; y < ROWS; y += 1) {
        if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) border.push([x, y]);
      }
    }
    shuffle(run.rng, border);
    for (let i = 0; i < Math.min(10, border.length); i += 1) run.grid[border[i][0]][border[i][1]] = ROCK;
  }
  if (cfg.rocks > 0) {
    const interior = [];
    for (let x = 0; x < COLS; x += 1) {
      for (let y = 0; y < ROWS; y += 1) {
        if (run.grid[x][y] === null && x !== 0 && x !== COLS - 1 && y !== 0 && y !== ROWS - 1) interior.push([x, y]);
      }
    }
    shuffle(run.rng, interior);
    for (let i = 0; i < Math.min(cfg.rocks, interior.length); i += 1) run.grid[interior[i][0]][interior[i][1]] = ROCK;
  }
  if (cfg.frozen > 0) {
    const free = [];
    for (let x = 0; x < COLS; x += 1) {
      for (let y = 0; y < ROWS; y += 1) if (run.grid[x][y] === null) free.push([x, y]);
    }
    shuffle(run.rng, free);
    for (let i = 0; i < Math.min(cfg.frozen, free.length); i += 1) run.frozen[free[i][0]][free[i][1]] = true;
  }
}

function fillGems(run) {
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      if (run.grid[x][y] === null) run.grid[x][y] = randInt(run.rng, 0, run.colors - 1);
    }
  }
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// ---------- 动作 ----------
function doTap(run, x, y) {
  const cells = componentAt(run.grid, run.frozen, x, y);
  if (cells.length < 2) {
    emit(run, 'tap', { x, y, ok: false, n: cells.length });
    return;
  }
  const color = run.grid[x][y];
  doPop(run, cells, color);
}

function doPop(run, cells, color) {
  const n = cells.length;
  for (const [x, y] of cells) {
    run.grid[x][y] = null;
    run.frozen[x][y] = false;
  }
  thawAround(run, cells);

  const gained = popScore(n, color, run.doubleColor);
  run.score += gained;
  run.streak += 1;
  run.stats.pops += 1;
  run.stats.maxStreak = Math.max(run.stats.maxStreak, run.streak);
  const cfg = levelAt(run.level);
  run.charge = clamp(run.charge + (cfg.chargeRate || PICKAXE.CHARGE_RATE), 0, PICKAXE.MAX_CHARGE);
  const avalanche = n >= AVALANCHE_MIN;
  if (avalanche) run.stats.avalanches += 1;

  const cx = cells.reduce((s, c) => s + c[0], 0) / n;
  const cy = cells.reduce((s, c) => s + c[1], 0) / n;
  emit(run, 'pop', { x: cx, y: cy, n, color, score: gained, streak: run.streak, avalanche });
  if (avalanche) emit(run, 'avalanche', { x: cx, y: cy, n });
  if (run.charge >= PICKAXE.MAX_CHARGE) emit(run, 'pickReady', {});

  settle(run, 'pop');
}

function doPick(run, x, y) {
  if (run.charge < PICKAXE.MAX_CHARGE) { emit(run, 'pickFail', { charge: run.charge }); return; }
  if (!inBounds(x, y) || !isGem(run.grid[x][y])) { emit(run, 'pickFail', { charge: run.charge }); return; }
  run.grid[x][y] = null;
  run.frozen[x][y] = false;
  run.charge = 0;
  emit(run, 'pickUse', { x, y });
  settle(run, 'pick');
}

function doWash(run) {
  if (run.washLeft <= 0) { emit(run, 'washFail', {}); return; }
  run.washLeft -= 1;
  const cells = [];
  const colors = [];
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      if (isGem(run.grid[x][y])) { cells.push([x, y]); colors.push(run.grid[x][y]); }
    }
  }
  shuffle(run.rng, colors);
  for (let i = 0; i < cells.length; i += 1) run.grid[cells[i][0]][cells[i][1]] = colors[i];
  run.streak = 0;
  emit(run, 'wash', { washLeft: run.washLeft });
  // 淘洗也可能把自己洗进死局（重排后无 2+ 连通），此时照常结算。
  if (!hasAnyMove(run)) resolveRound(run, 'noMoves');
}

// ---------- 消除后的稳定化（重力 → 空列左移 → 沉底补新矿 → 结算） ----------
function settle(run, reason) {
  applyGravity(run);
  collapseColumns(run);
  const cfg = levelAt(run.level);
  if (cfg.sinking) applySinking(run);

  if (run.movesLeft != null) {
    run.movesLeft -= 1;
    if (run.movesLeft <= MOVE_LIMIT_WARN_AT && run.movesLeft > 0) emit(run, 'moveLimitWarn', { left: run.movesLeft });
    if (run.movesLeft <= 0) { resolveRound(run, 'moves'); return; }
  }
  if (!hasAnyMove(run)) resolveRound(run, 'noMoves');
}

function applyGravity(run) {
  for (let x = 0; x < COLS; x += 1) {
    let write = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y -= 1) {
      const v = run.grid[x][y];
      if (v === ROCK) {
        write = y - 1;
      } else if (v !== null) {
        if (write !== y) {
          run.grid[x][write] = v;
          run.frozen[x][write] = !!run.frozen[x][y];
          run.grid[x][y] = null;
          run.frozen[x][y] = false;
        }
        write -= 1;
      }
    }
  }
}

function columnEmpty(run, x) {
  for (let y = 0; y < ROWS; y += 1) if (run.grid[x][y] !== null) return false;
  return true;
}

function collapseColumns(run) {
  let write = 0;
  for (let x = 0; x < COLS; x += 1) {
    if (columnEmpty(run, x)) continue;
    if (write !== x) {
      for (let y = 0; y < ROWS; y += 1) {
        run.grid[write][y] = run.grid[x][y];
        run.frozen[write][y] = !!run.frozen[x][y];
        run.grid[x][y] = null;
        run.frozen[x][y] = false;
      }
    }
    write += 1;
  }
}

function applySinking(run) {
  for (let x = 0; x < COLS; x += 1) {
    if (run.grid[x][0] === null) {
      run.grid[x][0] = randInt(run.rng, 0, run.colors - 1);
      run.frozen[x][0] = false;
    }
  }
}

function thawAround(run, cells) {
  let thawed = 0;
  for (const [x, y] of cells) {
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (inBounds(nx, ny) && run.frozen[nx][ny]) {
        run.frozen[nx][ny] = false;
        thawed += 1;
      }
    }
  }
  if (thawed > 0) emit(run, 'thaw', { n: thawed });
}

// ---------- 结算 ----------
function resolveRound(run, reason) {
  const remaining = countGems(run);
  const bonus = clearBonus(remaining);
  run.score += bonus;
  emit(run, 'roundEnd', { remaining, bonus, reason });
  if (run.score >= targetScore(run.level)) {
    if (run.level >= LEVEL_COUNT) {
      run.phase = 'won';
      emit(run, 'win', { level: run.level, score: run.score });
    } else {
      emit(run, 'levelClear', { level: run.level, score: run.score, bonus });
      run.level += 1;
      run.stats.maxLevel = Math.max(run.stats.maxLevel, run.level);
      run.stats.bestScore = Math.max(run.stats.bestScore, run.score);
      buildLevel(run);
    }
  } else {
    run.phase = 'failed';
    emit(run, 'fail', { level: run.level, score: run.score, remaining });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const theme = themeFor(run.level);
  return {
    score: run.score,
    target: targetScore(run.level),
    level: run.level,
    streak: run.streak,
    charge: run.charge,
    chargeMax: PICKAXE.MAX_CHARGE,
    washLeft: run.washLeft,
    movesLeft: run.movesLeft,
    phase: run.phase,
    theme,
    scene: `scene.${theme}`,
    feat: `feat.${run.level}`,
    doubleColor: run.doubleColor,
    colors: run.colors,
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
