// SPIN PINGPONG · 纯逻辑 sim（无 DOM，node --test / selfplay 直接 import）
//
// P0 玩法（对参考源 1:1 保留）：
//   一个 (grid+2)² 的棋盘，外圈是「出口门」，内部格可放「棱镜」。
//   棱镜朝向 1="/" 2="\"，光子撞上后按 90° 镜面反弹；最终必落在外圈某个门。
//   玩家先短暂看棱镜（记忆），棱镜消失后从起点箭头猜光子的出口门。
// 新机制：① 三星评级（正确/快速/未窥视）② 跨关连击得分 ③ 窥视道具（重新显示一次）。
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// ---- 方向 ----
export const DIR = { LEFT: 1, RIGHT: 2, TOP: 3, BOTTOM: 4 };
export const OPPOSITE = { [DIR.LEFT]: DIR.RIGHT, [DIR.RIGHT]: DIR.LEFT, [DIR.TOP]: DIR.BOTTOM, [DIR.BOTTOM]: DIR.TOP };
const DX = { [DIR.LEFT]: -1, [DIR.RIGHT]: 1, [DIR.TOP]: 0, [DIR.BOTTOM]: 0 };
const DY = { [DIR.LEFT]: 0, [DIR.RIGHT]: 0, [DIR.TOP]: -1, [DIR.BOTTOM]: 1 };

/** 镜面反射：mirror 1="/" 2="\"，dir 为入射方向，返回出射方向（P0 join 映射） */
export function reflect(mirror, dir) {
  if (mirror === 1) {
    if (dir === DIR.LEFT) return DIR.TOP;
    if (dir === DIR.RIGHT) return DIR.BOTTOM;
    if (dir === DIR.TOP) return DIR.LEFT;
    return DIR.RIGHT; // BOTTOM
  }
  if (dir === DIR.LEFT) return DIR.BOTTOM;
  if (dir === DIR.RIGHT) return DIR.TOP;
  if (dir === DIR.TOP) return DIR.RIGHT;
  return DIR.LEFT; // BOTTOM
}

export function stepDir(p, dir) {
  return { x: p.x + DX[dir], y: p.y + DY[dir] };
}

export function key(p) {
  return `${p.x},${p.y}`;
}

// ---- 种子 RNG（mulberry32，可复现）----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 棋盘工具 ----
function isCorner(x, y, size) {
  return (x === 0 || x === size - 1) && (y === 0 || y === size - 1);
}
function isBorder(x, y, size) {
  return x === 0 || y === 0 || x === size - 1 || y === size - 1;
}
function isInterior(x, y, size) {
  return x >= 1 && x <= size - 2 && y >= 1 && y <= size - 2;
}
function existsPoint(p, arr) {
  return arr.some((q) => q.x === p.x && q.y === p.y);
}

// ---- 关卡生成（回溯放置棱镜，路径不交叉、直达出口）----
function randomStart(size, rng) {
  const starts = [];
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (isCorner(i, j, size)) continue;
      if (isBorder(i, j, size)) starts.push({ x: i, y: j });
    }
  }
  const sp = starts[Math.floor(rng() * starts.length)];
  let arrow;
  if (sp.x === 0) arrow = DIR.RIGHT;
  else if (sp.y === 0) arrow = DIR.BOTTOM;
  else if (sp.x === size - 1) arrow = DIR.LEFT;
  else arrow = DIR.TOP;
  return { pos: sp, arrow };
}

function sideCanPoints(start, size, invalids) {
  const pts = [];
  let p = stepDir(start.p, start.d);
  while (p.x >= 0 && p.x < size && p.y >= 0 && p.y < size) {
    if (!isInterior(p.x, p.y, size)) break;
    if (!existsPoint(p, invalids)) pts.push({ x: p.x, y: p.y });
    p = stepDir(p, start.d);
  }
  return pts;
}

function calcPath(dir, from, to) {
  const pts = [];
  let p = stepDir(from, dir);
  for (;;) {
    pts.push({ x: p.x, y: p.y });
    if (p.x === to.x && p.y === to.y) break;
    p = stepDir(p, dir);
  }
  return pts;
}

function calcStep(size, cur, max, start, d, ballPath, walls, rng, out) {
  if (max === cur) {
    const p = start;
    const al = walls.map((w) => w.p);
    let e = { x: p.x, y: p.y };
    for (;;) {
      const nx = { x: e.x + DX[d], y: e.y + DY[d] };
      if (nx.x < 0 || nx.y < 0 || nx.x >= size || nx.y >= size) break;
      if (existsPoint(nx, al)) return false; // 出口路上有棱镜挡着
      e = nx;
      if (isBorder(nx.x, nx.y, size)) break;
    }
    out.end = e;
    return true;
  }

  const tempPoints = shuffle(sideCanPoints({ p: start, d }, size, ballPath), rng);
  for (const point of tempPoints) {
    const wallDs = shuffle([1, 2], rng);
    for (const wall_d of wallDs) {
      const nd = reflect(wall_d, d);
      const next = stepDir(point, nd);
      if (isInterior(next.x, next.y, size)) {
        const myPath = calcPath(d, start, point);
        const intersection = myPath.filter((q) => existsPoint(q, walls.map((w) => w.p)));
        if (intersection.length === 0) {
          for (const q of myPath) ballPath.push(q);
          walls.push({ p: point, d: wall_d });
          if (calcStep(size, cur + 1, max, point, nd, ballPath, walls, rng, out)) {
            return true;
          }
          walls.pop();
          ballPath.splice(ballPath.length - myPath.length, myPath.length);
        }
      }
    }
  }
  return false;
}

function computeVisited(start, arrow, mirrors, end) {
  const visited = new Set();
  const mirrorMap = new Map(mirrors.map((m) => [key(m), m.d]));
  let pos = { ...start };
  let dir = arrow;
  visited.add(key(pos));
  let guard = 0;
  while (!(pos.x === end.x && pos.y === end.y) && guard++ < 200) {
    pos = stepDir(pos, dir);
    visited.add(key(pos));
    if (mirrorMap.has(key(pos))) dir = reflect(mirrorMap.get(key(pos)), dir);
  }
  return visited;
}

function generateBoard(level, rng) {
  const size = level.grid + 2;
  for (let pad = level.pad; pad >= 1; pad -= 1) {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const start = randomStart(size, rng);
      const walls = [];
      const ballPath = [];
      const out = { end: null };
      if (calcStep(size, 0, pad, start.pos, start.arrow, ballPath, walls, rng, out) && out.end) {
        return buildBoard(size, start, out.end, walls, level, rng);
      }
    }
  }
  // 兜底：单棱镜手工盘（几乎不会走到）
  return buildBoard(4, { pos: { x: 0, y: 1 }, arrow: DIR.RIGHT }, { x: 1, y: 0 }, [{ p: { x: 1, y: 1 }, d: 1 }], { voidCount: 0 }, rng);
}

function buildBoard(size, start, end, mirrors, level, rng) {
  const grid = [];
  for (let x = 0; x < size; x += 1) {
    grid[x] = [];
    for (let y = 0; y < size; y += 1) {
      if (isCorner(x, y, size)) grid[x][y] = { kind: 'corner' };
      else if (isBorder(x, y, size)) grid[x][y] = { kind: 'gate' };
      else grid[x][y] = { kind: 'empty' };
    }
  }
  for (const m of mirrors) grid[m.p.x][m.p.y] = { kind: 'mirror', mirror: m.d };
  grid[start.pos.x][start.pos.y].start = true;
  grid[end.x][end.y].end = true;

  const visited = computeVisited(start.pos, start.arrow, mirrors.map((m) => m.p), end);
  const mirrorSet = new Set(mirrors.map((m) => key(m.p)));
  const voidCells = [];
  if (level.voidCount > 0) {
    const candidates = [];
    for (let x = 1; x <= size - 2; x += 1) {
      for (let y = 1; y <= size - 2; y += 1) {
        if (mirrorSet.has(key({ x, y }))) continue;
        if (visited.has(key({ x, y }))) continue;
        candidates.push({ x, y });
      }
    }
    const chosen = shuffle(candidates, rng).slice(0, level.voidCount);
    for (const v of chosen) {
      grid[v.x][v.y] = { kind: 'void' };
      voidCells.push(v);
    }
  }

  const path = [start.pos, ...mirrors.map((m) => ({ x: m.p.x, y: m.p.y })), end];
  return { size, grid, start: start.pos, arrow: start.arrow, end, mirrors: mirrors.map((m) => ({ x: m.p.x, y: m.p.y, d: m.d })), path, voidCells };
}

// ---- run ----
export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const seed = opts.seed == null ? 1 : (opts.seed | 0);
  const rng = mulberry32(seed || 1);
  const board = generateBoard(level, rng);

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  const state = {
    level: idx + 1,
    levelIndex: idx,
    phase: 'countdown',            // countdown | memorize | predict | resolving | won | lost
    size: board.size,
    grid: board.grid,
    start: board.start,
    arrow: board.arrow,
    end: board.end,
    mirrors: board.mirrors,
    path: board.path,
    voidCells: board.voidCells,
    mirrorsVisible: false,
    countdown: GAME.COUNTDOWN,
    memorizeT: 0,
    peekT: 0,
    peekUsed: false,
    timeLeft: level.duration,
    totalTime: level.duration,
    predicted: null,
    mistakes: 0,
    stars: 0,
    score: 0,
    combo: opts.combo || 0,
    ball: null,                    // { from:{x,y}, to:{x,y}, t:0..1 } 用于 render
    result: null,
  };

  function enterMemorize() {
    state.phase = 'memorize';
    state.mirrorsVisible = true;
    state.memorizeT = level.memorizeSec;
    emit('memorizeStart', {});
  }

  function enterPredict() {
    state.phase = 'predict';
    state.mirrorsVisible = false;
    emit('memorizeEnd', {});
  }

  function lose(reason) {
    state.phase = 'lost';
    state.combo = 0;
    state.score = 0;
    state.result = { won: false, reason, stars: 0, score: 0, combo: 0 };
    emit('lose', { reason });
  }

  function win() {
    state.phase = 'won';
    const fast = state.timeLeft >= state.totalTime * GAME.STAR_TIME_RATIO;
    const noPeek = !state.peekUsed;
    let stars = 1;
    if (fast) stars = 2;
    if (fast && noPeek) stars = 3;
    state.stars = stars;
    state.combo += 1;
    state.score = Math.round(10 * stars * (1 + state.combo * 0.1));
    state.result = { won: true, reason: 'correct', stars, score: state.score, combo: state.combo };
    emit('star', { stars });
    emit('combo', { combo: state.combo });
    emit('win', { stars, score: state.score });
  }

  function finishResolve() {
    const correct = !!state.predicted && state.predicted.x === board.end.x && state.predicted.y === board.end.y;
    if (correct) win();
    else lose('wrong');
  }

  function advanceBall(dt) {
    if (!state.ball) return;
    const b = state.ball;
    b.t += dt / GAME.BALL_SEG_SEC;
    let guard = 0;
    while (b.t >= 1 && guard++ < 512) {
      b.t -= 1;
      b.i += 1;
      if (b.i >= board.path.length - 1) {
        b.i = board.path.length - 1;
        finishResolve();
        return;
      }
      emit('bounce', { x: board.path[b.i].x, y: board.path[b.i].y });
    }
  }

  return {
    state,
    getHud() {
      return {
        level: state.level,
        phase: state.phase,
        timeLeft: Math.max(0, state.timeLeft),
        stars: state.stars,
        score: state.score,
        combo: state.combo,
        peekUsed: state.peekUsed,
        mirrorsVisible: state.mirrorsVisible,
      };
    },
    step(dt) {
      if (state.phase === 'won' || state.phase === 'lost') return;
      if (state.phase === 'countdown') {
        const prev = Math.ceil(state.countdown);
        state.countdown -= dt;
        state.timeLeft -= dt;
        const now = Math.ceil(state.countdown);
        if (state.countdown <= 0) enterMemorize();
        else if (now !== prev) emit('countdownTick', { timeLeft: now });
      } else if (state.phase === 'memorize') {
        state.memorizeT -= dt;
        state.timeLeft -= dt;
        if (state.memorizeT <= 0) enterPredict();
      } else if (state.phase === 'predict') {
        state.timeLeft -= dt;
        if (state.peekT > 0) {
          state.peekT -= dt;
          if (state.peekT <= 0) state.mirrorsVisible = false;
        }
        if (state.timeLeft <= 0) lose('timeOut');
      } else if (state.phase === 'resolving') {
        advanceBall(dt);
      }
    },
    predict(x, y) {
      if (state.phase !== 'predict') return { ok: false, reason: 'notPredictable' };
      if (!isBorder(x, y, state.size) || isCorner(x, y, state.size)) return { ok: false, reason: 'notGate' };
      if (state.grid[x][y].start) return { ok: false, reason: 'notGate' };
      state.predicted = { x, y };
      const correct = x === board.end.x && y === board.end.y;
      if (!correct) state.mistakes += 1;
      emit(correct ? 'correct' : 'wrong', { x, y });
      emit('predict', { x, y, correct });
      state.phase = 'resolving';
      state.ball = { i: 0, t: 0 };
      return { ok: true, correct };
    },
    peek() {
      if (state.phase !== 'predict') return { ok: false, reason: 'notPredictable' };
      state.peekUsed = true;
      state.mirrorsVisible = true;
      state.peekT = GAME.PEEK_SECONDS;
      emit('peek', {});
      return { ok: true };
    },
    drainEvents() {
      const out = events.splice(0, events.length);
      return out;
    },
    _board: board,
  };
}

export { isBorder as _isBorder, isCorner as _isCorner, isInterior as _isInterior };
