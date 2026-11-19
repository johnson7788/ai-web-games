// MEOW MIAO · 模拟层（纯逻辑，零 DOM/window/canvas/Date.now）
// 玩法：点一块「可拿」（柱子顶端）方块进下方等待架；凑 3 块同花色（万能牌可代）即消除；
//       等待架 >7 溢出失败；时间到失败；清空所有方块获胜。
// 花色：symbol 为 0..7 的整数；-1 = 万能牌。岩石为不可用格（无方块，纯地形）。
// 随机：注入 seed 的 mulberry32，可复现。
// 生成：逆向构造保证「按 solution 顺序每次连拿 3 块同花色」必然可解（等待架最多 2 块，永不溢出）。
import { LEVELS, levelTime } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
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

const cellKey = (x, z) => `${x},${z}`;
const parseKey = (k) => k.split(',').map(Number);

// ---------- 关卡生成（逆向构造，保证可解） ----------
export function generateLevel(level, rng) {
  const { cols, rows, symbols, wilds, rocks, stackBias } = level;

  // 1. 选岩石格（不可用格）
  const allCells = [];
  for (let x = 0; x < cols; x += 1) for (let z = 0; z < rows; z += 1) allCells.push([x, z]);
  const cellOrder = shuffle(allCells, rng);
  const rockSet = new Set();
  for (let i = 0; i < Math.min(rocks, allCells.length); i += 1) rockSet.add(cellKey(cellOrder[i][0], cellOrder[i][1]));
  const usable = allCells.filter((c) => !rockSet.has(cellKey(c[0], c[1])));

  // 2. 解序：每色 3 块为一组，万能牌 3 块为一组，打乱组序
  const groups = [];
  for (let s = 0; s < symbols; s += 1) groups.push({ symbol: s });
  const wildGroups = Math.round(wilds / 3);
  for (let w = 0; w < wildGroups; w += 1) groups.push({ symbol: -1 });
  const solveGroups = shuffle(groups, rng);
  const solution = [];
  for (const g of solveGroups) for (let i = 0; i < 3; i += 1) solution.push(g.symbol);

  // 3. 逆向落子：按解序逆序把方块放到柱子顶端（最后放的=最先解）
  const height = new Map();
  const tiles = [];
  let id = 0;
  const rev = [...solution].reverse();
  for (const sym of rev) {
    const cell = pickColumn(usable, height, stackBias, rng);
    const y = height.get(cellKey(cell[0], cell[1])) || 0;
    height.set(cellKey(cell[0], cell[1]), y + 1);
    tiles.push({ id: id++, x: cell[0], z: cell[1], y, symbol: sym, onBoard: true });
  }

  return { tiles, rocks: [...rockSet].map(parseKey), solution, cols, rows };
}

function pickColumn(usable, height, stackBias, rng) {
  const used = usable.filter((c) => (height.get(cellKey(c[0], c[1])) || 0) > 0);
  const fresh = usable.filter((c) => (height.get(cellKey(c[0], c[1])) || 0) === 0);
  if (used.length && rng() < stackBias) return used[Math.floor(rng() * used.length)];
  if (fresh.length) return fresh[Math.floor(rng() * fresh.length)];
  return used[Math.floor(rng() * used.length)];
}

// ---------- createRun ----------
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const gen = generateLevel(level, rng);

  const byId = new Map();
  for (const t of gen.tiles) byId.set(t.id, t);

  const state = {
    level: level.index,
    levelIndex,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    cols: gen.cols,
    rows: gen.rows,
    tiles: gen.tiles,
    rocks: gen.rocks,
    shelf: [],
    timeLeft: levelTime(levelIndex),
    initialTime: levelTime(levelIndex),
    score: 0,
    combo: 1,
    maxCombo: 1,
    comboExpiresAt: 0,
    shuffleLeft: GAME.SHUFFLE_PER_LEVEL,
    undoLeft: GAME.UNDO_PER_LEVEL,
    stars: 0,
    result: null,
    totalTiles: gen.tiles.length,
  };

  const run = {
    state,
    _solution: gen.solution,
    _rng: rng,
    _byId: byId,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(state.initialTime),
    _lastMatchAt: -1e9,
    _lastPicked: null,

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._lose('timeout');
      }
    },

    // 某方块是否可拿（onBoard 且是所在柱子顶端）
    isFree(tile) {
      if (!tile || !tile.onBoard) return false;
      for (const t of this.state.tiles) {
        if (t !== tile && t.onBoard && t.x === tile.x && t.z === tile.z && t.y > tile.y) return false;
      }
      return true;
    },

    freeTiles() {
      return this.state.tiles.filter((t) => t.onBoard && this.isFree(t));
    },

    // 取一块进等待架
    pick(id) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      const t = this._byId.get(id);
      if (!t || !t.onBoard) return { ok: false, reason: 'notFound' };
      if (!this.isFree(t)) return { ok: false, reason: 'locked' };
      t.onBoard = false;
      s.shelf.push(t);
      this._lastPicked = { id: t.id, x: t.x, z: t.z, y: t.y, symbol: t.symbol };
      this._emit({ type: 'pick', symbol: t.symbol, id: t.id });
      this._resolveMatches();
      if (s.shelf.length > GAME.SHELF_CAP) {
        this._lose('overflow');
        return { ok: true, ended: 'lost' };
      }
      if (s.tiles.every((tt) => !tt.onBoard)) {
        this._win();
        return { ok: true, ended: 'won' };
      }
      return { ok: true };
    },

    useShuffle() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.shuffleLeft <= 0) return { ok: false, reason: 'none' };
      const board = s.tiles.filter((t) => t.onBoard);
      if (board.length < 2) return { ok: false, reason: 'empty' };
      const syms = shuffle(board.map((t) => t.symbol), this._rng);
      board.forEach((t, i) => { t.symbol = syms[i]; });
      s.shuffleLeft -= 1;
      this._emit({ type: 'shuffle' });
      return { ok: true };
    },

    useUndo() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      if (s.undoLeft <= 0) return { ok: false, reason: 'none' };
      if (s.shelf.length === 0) return { ok: false, reason: 'empty' };
      const t = s.shelf.pop();
      t.onBoard = true;
      s.undoLeft -= 1;
      this._lastPicked = null;
      this._emit({ type: 'undo', symbol: t.symbol, id: t.id });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      const activeCombo = this._clock <= s.comboExpiresAt ? s.combo : 1;
      const remaining = new Map();
      for (const t of s.tiles) if (t.onBoard) remaining.set(t.symbol, (remaining.get(t.symbol) || 0) + 1);
      return {
        level: s.level,
        timeLeft: s.timeLeft,
        phase: s.phase,
        score: s.score,
        combo: activeCombo,
        shuffleLeft: s.shuffleLeft,
        undoLeft: s.undoLeft,
        shelfLen: s.shelf.length,
        remainingTiles: s.tiles.filter((t) => t.onBoard).length,
        remaining: Object.fromEntries(remaining),
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _findMatch() {
      const s = this.state;
      const counts = new Map();
      let wilds = 0;
      const wildTiles = [];
      const bySym = new Map();
      for (const t of s.shelf) {
        if (t.symbol === -1) { wilds += 1; wildTiles.push(t); }
        else {
          counts.set(t.symbol, (counts.get(t.symbol) || 0) + 1);
          if (!bySym.has(t.symbol)) bySym.set(t.symbol, []);
          bySym.get(t.symbol).push(t);
        }
      }
      if (wilds >= 3) return { tiles: wildTiles.slice(0, 3), symbol: -1, wildCount: 3 };
      let best = null;
      for (const [sym, c] of counts) {
        if (!best || c > counts.get(best.symbol)) best = { symbol: sym, count: c };
      }
      if (!best) return null;
      if (best.count >= 3) return { tiles: bySym.get(best.symbol).slice(0, 3), symbol: best.symbol, wildCount: 0 };
      if (best.count >= 2 && wilds >= 1) {
        return { tiles: bySym.get(best.symbol).slice(0, 2).concat(wildTiles[0]), symbol: best.symbol, wildCount: 1 };
      }
      if (best.count >= 1 && wilds >= 2) {
        return { tiles: bySym.get(best.symbol).slice(0, 1).concat(wildTiles.slice(0, 2)), symbol: best.symbol, wildCount: 2 };
      }
      return null;
    },

    _resolveMatches() {
      const s = this.state;
      let guard = 0;
      for (;;) {
        if (++guard > 60) break;
        const m = this._findMatch();
        if (!m) break;
        const ids = new Set(m.tiles.map((t) => t.id));
        s.shelf = s.shelf.filter((t) => !ids.has(t.id));
        if (this._clock - this._lastMatchAt <= GAME.COMBO_WINDOW) s.combo += 1;
        else s.combo = 1;
        this._lastMatchAt = this._clock;
        s.comboExpiresAt = this._clock + GAME.COMBO_WINDOW;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        if (s.combo >= 2) this._emit({ type: 'combo', level: s.combo });
        this._emit({ type: 'match', symbol: m.symbol, wildCount: m.wildCount, combo: s.combo });
        if (m.wildCount > 0) this._emit({ type: 'wild', count: m.wildCount });
        s.score += 100 * s.combo;
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.shelf = []; // 收集完毕即清空（余牌豁免，避免软锁）
      const stars = Math.max(1, Math.min(3,
        1 + (s.timeLeft >= s.initialTime * GAME.STAR_TIME_RATIO ? 1 : 0) + (s.maxCombo >= GAME.STAR_COMBO_MIN ? 1 : 0)));
      s.stars = stars;
      s.result = { won: true, stars, timeLeft: s.timeLeft, score: s.score, maxCombo: s.maxCombo };
      this._emit({ type: 'win', stars, score: s.score, timeLeft: s.timeLeft });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, timeLeft: s.timeLeft, score: s.score, reason };
      this._emit({ type: 'lose', reason });
    },
  };

  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
