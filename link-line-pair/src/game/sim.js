// LINK LINE PAIR · 纯逻辑 sim（无 DOM，Node 可测）
// 玩法：把霓虹星点按路径顺序连成星座（连相邻两点=1 段），连完所有段获胜。
// 新机制：连击得分 / 星级评定 / 岩石陷阱 / 撤销 / 提示。
import { LEVELS } from '../../config/levels.js';
import { PLAY, parAndLimit } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const nodes = level.nodes.map((n) => ({ c: n[0], r: n[1] }));
  const segCount = nodes.length - 1;
  const key = (c, r) => `${c},${r}`;

  // 去重星点（dots）
  const dots = [];
  const dotIdByKey = new Map();
  for (const n of nodes) {
    const k = key(n.c, n.r);
    if (!dotIdByKey.has(k)) {
      dotIdByKey.set(k, dots.length);
      dots.push({ id: dots.length, c: n.c, r: n.r, key: k });
    }
  }

  // 段（每相邻两点一段）
  const segments = [];
  for (let i = 0; i < segCount; i += 1) {
    segments.push({
      a: dotIdByKey.get(key(nodes[i].c, nodes[i].r)),
      b: dotIdByKey.get(key(nodes[i + 1].c, nodes[i + 1].r)),
    });
  }

  const { par, limit } = parAndLimit(segCount);

  const state = {
    levelIndex: idx,
    level,
    nodes,
    dots,
    segments,
    segCount,
    rocks: level.rocks.map((r) => ({ c: r[0], r: r[1] })),
    connected: new Array(segCount).fill(false),
    connSeq: [],
    doneCount: 0,
    sel: null,
    combo: 0,
    maxCombo: 0,
    lastConnectAt: -1e9,
    missCount: 0,
    lives: PLAY.MAX_LIVES,
    undoLeft: PLAY.UNDO_PER_LEVEL,
    hintLeft: PLAY.HINT_PER_LEVEL,
    elapsed: 0,
    par,
    timeLimit: limit,
    score: 0,
    stars: 0,
    phase: 'playing',
    loseReason: null,
    hintUntil: -1,
    hintTrail: null,
  };

  const events = [];
  const push = (type, extra = {}) => events.push({ type, ...extra });

  push('levelStart', { levelIndex: idx, segCount, dotCount: dots.length, rockCount: state.rocks.length });

  function segBetween(dotA, dotB) {
    for (let i = 0; i < segCount; i += 1) {
      const s = segments[i];
      if (state.connected[i]) continue;
      if ((s.a === dotA && s.b === dotB) || (s.a === dotB && s.b === dotA)) return i;
    }
    return -1;
  }

  function win() {
    state.phase = 'won';
    state.stars = 3;
    if (state.missCount >= 1) state.stars -= 1;
    if (state.elapsed > state.par) state.stars -= 1;
    state.stars = Math.max(1, state.stars);
    push('win', { stars: state.stars, score: state.score, missCount: state.missCount, elapsed: state.elapsed });
    if (state.stars === 3) push('perfect', { stars: 3, score: state.score });
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.loseReason = reason;
    state.stars = 0;
    push('lose', { reason, score: state.score });
  }

  function miss(kind, extra = {}) {
    state.missCount += 1;
    state.lives -= 1;
    state.combo = 0;
    push(kind, { ...extra, lives: state.lives, missCount: state.missCount });
    if (state.lives <= 0) lose('lives');
  }

  function connect(i) {
    state.connected[i] = true;
    state.connSeq.push(i);
    state.doneCount += 1;
    state.combo = (state.elapsed - state.lastConnectAt <= PLAY.COMBO_WINDOW) ? state.combo + 1 : 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.lastConnectAt = state.elapsed;
    state.score += PLAY.SCORE_PER_SEG * state.combo;
    push('connect', { segment: i, combo: state.combo, done: state.doneCount, total: state.segCount });
    if (state.combo >= 2) push('combo', { combo: state.combo });
    if (state.doneCount === state.segCount) win();
  }

  function buildHintTrail() {
    const active = new Set();
    for (let i = 0; i < segCount; i += 1) if (!state.connected[i]) active.add(i);
    const trail = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const inSeg = (i > 0 && active.has(i - 1)) || (i < segCount && active.has(i));
      if (inSeg) trail.push(nodes[i]);
    }
    return trail;
  }

  const run = {
    state,
    get level() { return level; },

    getHud() {
      return {
        level: state.levelIndex + 1,
        name: level.name,
        timeLeft: Math.max(0, state.timeLimit - state.elapsed),
        par: state.par,
        combo: state.combo,
        maxCombo: state.maxCombo,
        score: state.score,
        lives: state.lives,
        undoLeft: state.undoLeft,
        hintLeft: state.hintLeft,
        done: state.doneCount,
        total: state.segCount,
        dots: state.dots.length,
        rocks: state.rocks.length,
        phase: state.phase,
      };
    },

    step(dt) {
      if (state.phase !== 'playing') return;
      state.elapsed += dt;
      if (state.combo > 0 && state.elapsed - state.lastConnectAt > PLAY.COMBO_WINDOW) {
        state.combo = 0;
        push('comboBreak', {});
      }
      if (state.elapsed >= state.timeLimit) lose('timeOut');
    },

    tapDot(dotId) {
      if (state.phase !== 'playing') return { ok: false };
      const id = dotId | 0;
      if (id < 0 || id >= state.dots.length) return { ok: false };
      if (state.sel == null) {
        state.sel = id;
        push('select', { dot: id });
        return { ok: true, selected: true };
      }
      if (state.sel === id) {
        state.sel = null;
        push('select', { dot: id, deselect: true });
        return { ok: true, selected: false };
      }
      const i = segBetween(state.sel, id);
      if (i >= 0) {
        connect(i);
        state.sel = id;
        return { ok: true, connected: true, segment: i };
      }
      miss('miss');
      return { ok: false, miss: true };
    },

    tapRock(rockIdx) {
      if (state.phase !== 'playing') return { ok: false };
      const i = rockIdx | 0;
      if (i < 0 || i >= state.rocks.length) return { ok: false };
      miss('rock', { rock: i });
      return { ok: false, miss: true };
    },

    undo() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.undoLeft <= 0 || state.connSeq.length === 0) return { ok: false };
      const i = state.connSeq.pop();
      state.connected[i] = false;
      state.doneCount -= 1;
      state.undoLeft -= 1;
      state.combo = 0;
      if (state.connSeq.length > 0) {
        state.sel = segments[state.connSeq[state.connSeq.length - 1]].b;
      } else {
        state.sel = null;
      }
      push('undo', { segment: i, undoLeft: state.undoLeft });
      return { ok: true, segment: i };
    },

    hint() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.hintLeft <= 0) return { ok: false };
      state.hintLeft -= 1;
      state.hintTrail = buildHintTrail();
      state.hintUntil = state.elapsed + PLAY.HINT_DURATION;
      push('hint', { hintLeft: state.hintLeft });
      return { ok: true };
    },

    drainEvents() {
      return events.splice(0, events.length);
    },
  };

  return run;
}
