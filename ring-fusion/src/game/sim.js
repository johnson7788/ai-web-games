// Ring Fusion · 纯逻辑（无 DOM / 无渲染）
// 玩法骨架（P0 1:1 参考「环与环」）：
//   3×3 共 9 个「环点」，每点有 3 个槽：大(0)/中(1)/小(2)。
//   槽值：-1 空、-2 岩石、>=0 环颜色。
//   底部 3 个「手牌」，每张牌持有 1~3 个环（槽位子集）。拖动手牌到环点放置。
//   放置后按：单点三环同色 / 横竖斜线三环点各含同色 → 消除；连击倍率计分。
// 原创机制：
//   岩石槽位（被消行震碎）、连击充能爆发（一键清点）、星级结算（评级钩子）。
import { BURST_NEED, TIME_START, TIME_PER_CLEAR, COLORS } from '../../config/game.config.js';

export const EMPTY = -1;
export const STONE = -2;
export const SLOTS = 3;
export const POINTS = 9;
export const HAND = 3;

export const LEVELS = [
  { baseColors: 3, target: 12, rocks: 0, rockSpawn: 0 },
  { baseColors: 4, target: 16, rocks: 1, rockSpawn: 0.05 },
  { baseColors: 5, target: 20, rocks: 2, rockSpawn: 0.10 },
  { baseColors: 6, target: 24, rocks: 3, rockSpawn: 0.15 },
  { baseColors: 7, target: 28, rocks: 4, rockSpawn: 0.20 },
];

// 稳定随机（自对弈可复现）
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

function rint(rng, n) {
  return Math.floor(rng() * n);
}

function slotCount(tile) {
  let n = 0;
  for (let s = 0; s < SLOTS; s += 1) if (tile[s] !== EMPTY) n += 1;
  return n;
}

function emptySlots(tile) {
  const out = [];
  for (let s = 0; s < SLOTS; s += 1) if (tile[s] === EMPTY) out.push(s);
  return out;
}

function pointHasIcon(pt, icon) {
  return pt[0] === icon || pt[1] === icon || pt[2] === icon;
}

// 一条线（横/竖/两条对角线）包含的环点下标；不落在该对角线返回空
export function lineFor(dir, p) {
  if (dir === 'h') { const r = Math.floor(p / 3) * 3; return [r, r + 1, r + 2]; }
  if (dir === 'v') { const c = p % 3; return [c, c + 3, c + 6]; }
  if (dir === 'd1') return (p === 0 || p === 4 || p === 8) ? [0, 4, 8] : [];
  if (dir === 'd2') return (p === 2 || p === 4 || p === 6) ? [2, 4, 6] : [];
  return [];
}

const DIRS = ['h', 'v', 'd1', 'd2'];

// 计算一次放置后的消除集合（纯函数，不修改入参）
export function computeRemovals(points, p, colors) {
  const removals = [];
  const pt = points[p];
  if (pt[0] !== EMPTY && pt[0] !== STONE && pt[0] === pt[1] && pt[1] === pt[2]) {
    removals.push({ dir: 'single', icon: pt[0], line: [p] });
  }
  for (const dir of DIRS) {
    const line = lineFor(dir, p);
    if (line.length !== 3) continue;
    for (let icon = 0; icon < colors; icon += 1) {
      let cnt = 0;
      for (const pi of line) if (pointHasIcon(points[pi], icon)) cnt += 1;
      if (cnt === 3) removals.push({ dir, icon, line });
    }
  }
  return removals;
}

// 应用消除：同色环移除 + 受影响环点内的岩石震碎（原地修改 points）
export function applyRemovals(points, removals) {
  const affected = new Set();
  let removed = 0;
  for (const r of removals) {
    for (const pi of r.line) {
      affected.add(pi);
      const pt = points[pi];
      for (let s = 0; s < SLOTS; s += 1) {
        if (pt[s] === r.icon) { pt[s] = EMPTY; removed += 1; }
      }
    }
  }
  let shattered = 0;
  for (const pi of affected) {
    const pt = points[pi];
    for (let s = 0; s < SLOTS; s += 1) {
      if (pt[s] === STONE) { pt[s] = EMPTY; shattered += 1; }
    }
  }
  return { removed, shattered, affected };
}

export function canPlace(tile, pt) {
  for (let s = 0; s < SLOTS; s += 1) {
    if (tile[s] !== EMPTY && pt[s] !== EMPTY) return false;
  }
  return true;
}

function clonePoints(points) {
  return points.map((p) => p.slice());
}

export function createRun(opts = {}) {
  const mode = opts.mode || 'classic';
  const levelIndex = opts.levelIndex ?? 0;
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);

  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)] || LEVELS[0];

  const state = {
    phase: 'playing',       // playing | won | lost
    mode,
    levelIndex,
    seed,
    rng,
    simTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    cleared: 0,             // 已消环数（经典模式目标进度）
    target: mode === 'classic' ? level.target : Infinity,
    colors: level.baseColors,
    points: Array.from({ length: POINTS }, () => [EMPTY, EMPTY, EMPTY]),
    hand: Array.from({ length: HAND }, () => [EMPTY, EMPTY, EMPTY]),
    burstMeter: 0,
    burstReady: false,
    timeLeft: mode === 'time' ? TIME_START : 0,
    level,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload, t: state.simTime });

  function colorsNow() {
    return Math.min(COLORS.length, state.level.baseColors + Math.floor(state.score / 20));
  }

  function rocksForLevel() {
    return state.level.rocks || 0;
  }

  function placeInitialRocks() {
    const n = rocksForLevel();
    if (n <= 0) return;
    const slots = [];
    for (let p = 0; p < POINTS; p += 1) for (let s = 0; s < SLOTS; s += 1) slots.push([p, s]);
    // Fisher-Yates shuffle
    for (let i = slots.length - 1; i > 0; i -= 1) {
      const j = rint(rng, i + 1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    for (let k = 0; k < Math.min(n, slots.length); k += 1) {
      const [p, s] = slots[k];
      state.points[p][s] = STONE;
    }
  }

  function buildHand() {
    // 收集每个环点的空缺槽位（岩石视为占用）
    const lacks = [];
    for (let p = 0; p < POINTS; p += 1) {
      const es = emptySlots(state.points[p]);
      if (!es.length) continue;
      // 与参考一致：缺 1 个取 1，缺多个随机取 1~2 个
      let subset;
      if (es.length === 1) subset = [es[0]];
      else {
        const count = rng() > 0.5 ? 2 : 1;
        const copy = es.slice();
        subset = [];
        while (subset.length < count && copy.length) {
          subset.push(copy.splice(rint(rng, copy.length), 1)[0]);
        }
      }
      lacks.push(subset);
    }
    if (!lacks.length) return false;

    let tiles;
    if (lacks.length <= 3) {
      tiles = lacks.map((t) => t.slice());
      while (tiles.length < 3) tiles.push([rint(rng, SLOTS)]);
    } else {
      tiles = [];
      const copy = lacks.slice();
      while (tiles.length < 3 && copy.length) {
        tiles.push(copy.splice(rint(rng, copy.length), 1)[0].slice());
      }
    }

    state.hand = Array.from({ length: HAND }, () => [EMPTY, EMPTY, EMPTY]);
    const colors = colorsNow();
    for (let h = 0; h < tiles.length; h += 1) {
      for (const s of tiles[h]) {
        if (state.level.rockSpawn > 0 && rng() < state.level.rockSpawn) state.hand[h][s] = STONE;
        else state.hand[h][s] = rint(rng, colors);
      }
    }
    return true;
  }

  function handAvailable() {
    return state.hand.some((t) => slotCount(t) > 0);
  }

  function checkLose() {
    if (state.phase !== 'playing') return;
    const hasEmpty = state.points.some((p) => p.includes(EMPTY));
    if (!hasEmpty) { lose('full'); return; }
    const tiles = state.hand.filter((t) => slotCount(t) > 0);
    if (tiles.length) {
      for (const t of tiles) {
        for (let p = 0; p < POINTS; p += 1) {
          if (canPlace(t, state.points[p])) return; // 还能放，不死
        }
      }
      lose('blocked');
    }
  }

  function checkWin() {
    if (state.phase !== 'playing') return;
    if (state.mode === 'classic' && state.cleared >= state.target) {
      state.phase = 'won';
      emit('win', { score: state.score, combo: state.maxCombo, level: state.levelIndex + 1 });
    }
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    emit('lose', { reason, score: state.score, cleared: state.cleared });
  }

  function maybeRefill() {
    if (!handAvailable() && state.phase === 'playing') {
      if (buildHand()) emit('refill', { count: HAND });
      else lose('full');
    }
  }

  function chargeBurst(removed) {
    state.burstMeter = Math.min(BURST_NEED, state.burstMeter + removed);
    if (state.burstMeter >= BURST_NEED) state.burstReady = true;
  }

  // 预览一次放置的消除结果（不改状态）
  function preview(h, p) {
    const tile = state.hand[h];
    const pt = state.points[p];
    if (!tile || slotCount(tile) === 0) return { ok: false, reason: 'empty' };
    if (!canPlace(tile, pt)) return { ok: false, reason: 'occupied' };
    const points = clonePoints(state.points);
    for (let s = 0; s < SLOTS; s += 1) if (tile[s] !== EMPTY) points[p][s] = tile[s];
    const removals = computeRemovals(points, p, colorsNow());
    const { removed, shattered } = applyRemovals(points, removals);
    return { ok: true, removed, shattered, lines: removals.length };
  }

  function place(h, p) {
    if (state.phase !== 'playing') return { ok: false, reason: 'over' };
    const tile = state.hand[h];
    if (!tile || slotCount(tile) === 0) return { ok: false, reason: 'empty' };
    const pt = state.points[p];
    if (!canPlace(tile, pt)) { emit('placeFail', { h, p }); return { ok: false, reason: 'occupied' }; }

    for (let s = 0; s < SLOTS; s += 1) if (tile[s] !== EMPTY) pt[s] = tile[s];
    state.hand[h] = [EMPTY, EMPTY, EMPTY];
    emit('place', { h, p });

    const removals = computeRemovals(state.points, p, colorsNow());
    const { removed, shattered, affected } = applyRemovals(state.points, removals);

    let clearedThisMove = removed;
    if (removed > 0) {
      state.combo += 1;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;
      state.score += removed * state.combo;
      state.cleared += removed;
      chargeBurst(removed);
      emit('clear', { count: removed, combo: state.combo, lines: removals.length });
      if (state.combo >= 2) emit('combo', { combo: state.combo });
    } else {
      state.combo = 0;
    }
    if (shattered > 0) {
      state.score += shattered * 2;
      state.cleared += shattered; // 岩石震碎也算「推进」（但不算 fusion 环数，这里并入目标便于收敛）
      emit('stone', { count: shattered });
    }
    if (state.mode === 'time' && removed > 0) {
      state.timeLeft += TIME_PER_CLEAR * removed;
    }

    state.colors = colorsNow();
    checkWin();
    checkLose();
    maybeRefill();

    return {
      ok: true,
      removed,
      shattered,
      clearedThisMove,
      combo: state.combo,
      score: state.score,
      affected: Array.from(affected),
      colorIndex: removals.length ? removals[0].icon : null,
    };
  }

  function burst(p) {
    if (state.phase !== 'playing') return { ok: false, reason: 'over' };
    if (!state.burstReady) return { ok: false, reason: 'nocharge' };
    const pt = state.points[p];
    let icons = 0;
    let stones = 0;
    for (let s = 0; s < SLOTS; s += 1) {
      if (pt[s] !== EMPTY && pt[s] !== STONE) icons += 1;
      if (pt[s] === STONE) stones += 1;
      pt[s] = EMPTY;
    }
    if (icons + stones === 0) return { ok: false, reason: 'empty' };
    state.burstReady = false;
    state.burstMeter = 0;
    state.cleared += icons + stones;
    state.score += icons * 2 + stones * 2;
    emit('burst', { icons, stones });
    checkWin();
    checkLose();
    maybeRefill();
    return { ok: true, icons, stones, affected: [p] };
  }

  function validMoves() {
    const out = [];
    for (let h = 0; h < HAND; h += 1) {
      if (slotCount(state.hand[h]) === 0) continue;
      for (let p = 0; p < POINTS; p += 1) {
        if (canPlace(state.hand[h], state.points[p])) out.push({ h, p });
      }
    }
    return out;
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.simTime += dt;
    if (state.mode === 'time') {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) { state.timeLeft = 0; lose('time'); }
    }
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  // 初始化
  placeInitialRocks();
  buildHand();
  emit('level', { level: levelIndex + 1, mode, colors: state.colors, target: state.target });

  return {
    state,
    step,
    drainEvents,
    place,
    burst,
    preview,
    validMoves,
    buildHand,
    canPlace,
  };
}
