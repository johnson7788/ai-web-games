// MERGE 2048 · 模拟/玩法核心（纯逻辑，零依赖）
// 契约：createRun({seed, levelIndex}) → run（run.step / run.getHud / run.drainEvents / run.phase）
// 输入：step({dir:'up|down|left|right'}) 或 step({warp:[r1,c1,r2,c2]})
// 数字=殖民舰吨位；同值滑动合并值翻倍；引力井锁定滑入的数字；跃迁引擎强制合并任意两个同值格。
import { GRID, SPAWN, GRAVITY, WARP, MOVE_SEC, BUILDINGS, clamp } from '../../config/gameplay.js';
import { LEVELS, LEVEL_COUNT, levelAt } from '../../config/levels.js';
import { mulberry32, pick } from './rng.js';

const WALL = Symbol('wall');

// ---------- 创建 run ----------
export function createRun({ seed = 1, levelIndex = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    levelIndex: clamp(levelIndex, 1, LEVEL_COUNT),
    level: null,
    grid: [],
    rows: GRID.ROWS,
    cols: GRID.COLS,
    blocked: new Set(),
    spawnSet: SPAWN.VALUES.slice(),
    mirror: false,
    gravityEvery: 0,
    gravity: null,
    moves: 0,
    score: 0,
    best: 0,          // 本关最高吨位（对 target）
    runBest: 0,       // 全程最高吨位
    warpLeft: WARP.PER_LEVEL,
    won: false,
    nextId: 1,
    unlocked: new Set(),
    stats: { maxLevel: levelIndex, merges: 0, warps: 0, locks: 0 },
    events: [],
  };
  loadLevel(run, levelIndex);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 关卡装载 ----------
function loadLevel(run, index) {
  const lv = levelAt(index);
  run.levelIndex = lv.index;
  run.level = lv;
  run.rows = lv.rows;
  run.cols = lv.cols;
  run.spawnSet = lv.spawn.slice();
  run.mirror = !!lv.mirror;
  run.gravityEvery = lv.gravityEvery || 0;
  run.blocked = new Set();
  run.gravity = null;
  run.moves = 0;
  run.best = 0;
  run.warpLeft = WARP.PER_LEVEL;
  run.grid = emptyGrid(run.rows, run.cols);

  // 初始障碍格（随机，不重复）
  const cells = [];
  for (let r = 0; r < run.rows; r += 1) for (let c = 0; c < run.cols; c += 1) cells.push([r, c]);
  for (let i = 0; i < Math.min(lv.obstacles || 0, cells.length - SPAWN.START_TILES); i += 1) {
    const k = Math.floor(run.rng() * cells.length);
    const [r, c] = cells.splice(k, 1)[0];
    run.blocked.add(r + ':' + c);
  }

  for (let i = 0; i < SPAWN.START_TILES; i += 1) spawnTile(run);
}

function emptyGrid(rows, cols) {
  const g = [];
  for (let r = 0; r < rows; r += 1) {
    g.push(new Array(cols).fill(null));
  }
  return g;
}

// ---------- 每步 ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  if (input.warp) {
    doWarp(run, input.warp);
    return;
  }
  if (input.dir) {
    doMove(run, input.dir);
  }
}

function mapDir(run, dir) {
  if (run.mirror) {
    if (dir === 'left') return 'right';
    if (dir === 'right') return 'left';
  }
  return dir;
}

function doMove(run, dir) {
  resolveGravity(run);
  const mapped = mapDir(run, dir);
  const res = slideGrid(run.grid, mapped, {
    rows: run.rows,
    cols: run.cols,
    blocked: run.blocked,
    gravity: run.gravity,
  });
  if (!res.moved) {
    emit(run, 'blocked', { dir: mapped });
    checkLose(run);
    return;
  }
  run.grid = res.grid;
  run.moves += 1;
  run.time += MOVE_SEC;
  emit(run, 'move', { dir: mapped });
  for (const m of res.merges) {
    run.score += m.value;
    run.stats.merges += 1;
    emit(run, 'merge', { value: m.value, row: m.row, col: m.col });
  }
  applyGravityLock(run);
  spawnTile(run);
  maybeSpawnGravity(run);
  afterBoardChange(run);
}

function afterBoardChange(run) {
  if (run.phase !== 'playing') return;
  updateBest(run);
  checkWin(run);
  checkLevelClear(run);
  if (run.phase === 'playing') checkLose(run);
}

function doWarp(run, [r1, c1, r2, c2]) {
  const a = tileAt(run, r1, c1);
  const b = tileAt(run, r2, c2);
  if (run.warpLeft <= 0) return;
  if (!a || !b || a.value !== b.value) return;
  if (r1 === r2 && c1 === c2) return;

  const value = a.value * 2;
  run.grid[r1][c1] = null;
  run.grid[r2][c2] = { id: run.nextId++, value, locked: false };
  run.warpLeft -= 1;
  run.score += value;
  run.stats.warps += 1;
  emit(run, 'warp', { value, row: r2, col: c2 });
  afterBoardChange(run);
}

function tileAt(run, r, c) {
  return (run.grid[r] && run.grid[r][c]) || null;
}

// ---------- 引力井 ----------
function resolveGravity(run) {
  if (!run.gravity) return;
  run.gravity.movesLeft -= 1;
  if (run.gravity.movesLeft <= 0) {
    run.gravity = null;
    unlockAll(run);
    emit(run, 'gravityExpire', {});
  }
}

function applyGravityLock(run) {
  if (!run.gravity) return;
  const t = tileAt(run, run.gravity.row, run.gravity.col);
  if (t && !t.locked) {
    t.locked = true;
    run.stats.locks += 1;
    emit(run, 'gravityLock', { row: run.gravity.row, col: run.gravity.col });
  }
}

function unlockAll(run) {
  for (let r = 0; r < run.rows; r += 1) {
    for (let c = 0; c < run.cols; c += 1) {
      const t = run.grid[r][c];
      if (t) t.locked = false;
    }
  }
}

function maybeSpawnGravity(run) {
  if (run.gravityEvery <= 0) return;
  if (run.gravity) return;
  if (run.moves % run.gravityEvery !== 0) return;
  const cells = emptyCells(run, true);
  if (!cells.length) return;
  const [r, c] = pick(run.rng, cells);
  run.gravity = { row: r, col: c, movesLeft: GRAVITY.DURATION };
  emit(run, 'gravitySpawn', { row: r, col: c });
}

// ---------- 生成新格 ----------
function emptyCells(run, excludeGravity = false) {
  const cells = [];
  for (let r = 0; r < run.rows; r += 1) {
    for (let c = 0; c < run.cols; c += 1) {
      if (run.blocked.has(r + ':' + c)) continue;
      if (run.grid[r][c]) continue;
      if (excludeGravity && run.gravity && run.gravity.row === r && run.gravity.col === c) continue;
      cells.push([r, c]);
    }
  }
  return cells;
}

function spawnValue(run) {
  const set = run.spawnSet;
  if (set.length === 1) return set[0];
  if (set[0] === 2 && set[1] === 4) return run.rng() < SPAWN.FOUR_CHANCE ? 4 : 2;
  return pick(run.rng, set);
}

function spawnTile(run) {
  const cells = emptyCells(run, true);
  if (!cells.length) return;
  const [r, c] = pick(run.rng, cells);
  const value = spawnValue(run);
  run.grid[r][c] = { id: run.nextId++, value, locked: false };
  emit(run, 'spawn', { value, row: r, col: c });
}

// ---------- 里程碑 / 胜负 ----------
function updateBest(run) {
  for (let r = 0; r < run.rows; r += 1) {
    for (let c = 0; c < run.cols; c += 1) {
      const t = run.grid[r][c];
      if (!t) continue;
      if (t.value > run.best) run.best = t.value;
      if (t.value > run.runBest) run.runBest = t.value;
    }
  }
  for (const b of BUILDINGS) {
    if (run.runBest >= b.value && !run.unlocked.has(b.value)) {
      run.unlocked.add(b.value);
      emit(run, 'unlock', { value: b.value, key: b.key });
    }
  }
}

function checkWin(run) {
  if (run.phase !== 'playing') return;
  if (run.runBest >= 2048) {
    run.phase = 'won';
    emit(run, 'win', {});
  }
}

function checkLevelClear(run) {
  if (run.phase !== 'playing') return;
  if (run.best < run.level.target) return;
  if (run.levelIndex >= LEVEL_COUNT) {
    run.phase = 'won';
    emit(run, 'win', {});
    return;
  }
  const cleared = run.levelIndex;
  emit(run, 'levelClear', { level: cleared, target: run.level.target });
  loadLevel(run, cleared + 1);
  run.stats.maxLevel = Math.max(run.stats.maxLevel, run.levelIndex);
  emit(run, 'levelEnter', { level: run.levelIndex });
}

function checkLose(run) {
  if (!hasMoves(run)) {
    run.phase = 'dead';
    emit(run, 'lose', {});
  }
}

// ---------- 滑动核心（纯函数，供 sim / AI / 测试复用） ----------
export function slideGrid(grid, dir, opts) {
  const { rows, cols, blocked, gravity } = opts;
  const lines = linesFor(dir, rows, cols);
  const orig = grid;
  const next = grid.map((row) => row.slice());

  const merges = [];
  for (const line of lines) {
    const cells = line.map(([r, c]) => next[r][c]);
    const { result, merges: lineMerges } = slideLine(cells, line, blocked, gravity);
    line.forEach(([r, c], i) => {
      const o = result[i];
      next[r][c] = o === WALL ? cells[i] : o;
    });
    for (const m of lineMerges) merges.push(m);
  }

  let moved = false;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (orig[r][c] !== next[r][c]) moved = true;
    }
  }
  return { grid: next, moved, merges };
}

function slideLine(cells, line, blocked, gravity) {
  const n = cells.length;
  const work = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const [r, c] = line[i];
    const t = cells[i];
    if (blocked.has(r + ':' + c)) work[i] = WALL;
    else if (t && t.locked) work[i] = WALL;
    else work[i] = t;
  }

  const result = new Array(n).fill(null);
  const merges = [];
  let i = 0;
  while (i < n) {
    if (work[i] === WALL) { result[i] = WALL; i += 1; continue; }
    let j = i;
    const seg = [];
    while (j < n && work[j] !== WALL) { seg.push(work[j]); j += 1; }
    const { out, m2 } = compactMerge(seg);
    for (let k = 0; k < out.length; k += 1) result[i + k] = out[k];
    for (const m of m2) {
      const [r, c] = line[i + m.localIndex];
      merges.push({ value: m.value, row: r, col: c });
    }
    i = j;
  }
  return { result, merges };
}

function compactMerge(seg) {
  const tiles = seg.filter((t) => t != null);
  const out = [];
  const merges = [];
  let i = 0;
  let localIndex = 0;
  while (i < tiles.length) {
    const a = tiles[i];
    if (i + 1 < tiles.length && tiles[i + 1].value === a.value) {
      const b = tiles[i + 1];
      out.push({ id: a.id, value: a.value * 2, locked: false, mergedFrom: b.id });
      merges.push({ value: a.value * 2, localIndex });
      i += 2;
    } else {
      out.push(a);
      i += 1;
    }
    localIndex += 1;
  }
  while (out.length < seg.length) out.push(null);
  return { out, m2: merges };
}

function linesFor(dir, rows, cols) {
  const lines = [];
  if (dir === 'left') {
    for (let r = 0; r < rows; r += 1) { const l = []; for (let c = 0; c < cols; c += 1) l.push([r, c]); lines.push(l); }
  } else if (dir === 'right') {
    for (let r = 0; r < rows; r += 1) { const l = []; for (let c = cols - 1; c >= 0; c -= 1) l.push([r, c]); lines.push(l); }
  } else if (dir === 'up') {
    for (let c = 0; c < cols; c += 1) { const l = []; for (let r = 0; r < rows; r += 1) l.push([r, c]); lines.push(l); }
  } else {
    for (let c = 0; c < cols; c += 1) { const l = []; for (let r = rows - 1; r >= 0; r -= 1) l.push([r, c]); lines.push(l); }
  }
  return lines;
}

export function hasMoves(run) {
  const dirs = ['left', 'right', 'up', 'down'];
  for (const d of dirs) {
    const res = slideGrid(run.grid, d, {
      rows: run.rows,
      cols: run.cols,
      blocked: run.blocked,
      gravity: run.gravity,
    });
    if (res.moved) return true;
  }
  return false;
}

// 调试/QA：把二维数字数组（0=空格）直接载入当前 run 的棋盘（用于 verify 制造死局/胜局）
export function loadBoardValues(run, values) {
  run.rows = values.length;
  run.cols = values[0].length;
  run.blocked = new Set();
  run.gravity = null;
  run.mirror = false;
  run.spawnSet = SPAWN.VALUES.slice();
  run.grid = values.map((row) => row.map((v) => (v ? { id: run.nextId++, value: v, locked: false } : null)));
  run.best = 0;
  run.runBest = 0;
  run.unlocked = new Set();
  updateBest(run);
}

export function maxTile(grid) {
  let m = 0;
  for (const row of grid) for (const t of row) if (t && t.value > m) m = t.value;
  return m;
}

export function cloneGrid(grid) {
  return grid.map((row) => row.map((t) => (t ? { ...t } : null)));
}

export function emptyCount(run) {
  return emptyCells(run, false).length;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    phase: run.phase,
    score: run.score,
    best: run.best,
    runBest: run.runBest,
    level: run.levelIndex,
    levelName: run.level.name,
    target: run.level.target,
    moves: run.moves,
    warpLeft: run.warpLeft,
    gravity: run.gravity ? { row: run.gravity.row, col: run.gravity.col, movesLeft: run.gravity.movesLeft } : null,
    mirror: run.mirror,
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
