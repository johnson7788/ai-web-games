// MONSTER MELTER · 纯逻辑 sim（无 DOM，Node/浏览器通用）
// 玩法骨架：六边形棋盘上拖放发光宝石，填满整条线即"熔炼"攻击怪兽；
// 三方向线（横 / 60° / 120°）消除 → 伤害 = 2×色号×连击，分数 = Σ(n+1)²×连击。
// 新机制：连击（连续消除叠乘）、星级（按步数）、岩石障碍（挡线、炸弹可清）、炸弹道具。
import { BOARD, GEM_DAMAGE, COMBO_MAX } from '../../config/game.config.js';

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

const { SPACING, SIN60, SNAP, COUNTS, BOMB_RADIUS } = BOARD;

export function axialToWorld(q, r) {
  return { x: SPACING * q + SPACING * 0.5 * r, y: SPACING * SIN60 * r };
}

// 25 种形状（轴向坐标 [q, r]，世界 = q*(110,0) + r*(55, 95.26)）。
// 0 号是单格；其余为 4 格 polyhex。根格统一是 [0,0]。
export const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, -1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [1, -1]],
  [[0, 0], [0, 1], [0, 2], [-1, 1]],
  [[0, 0], [0, 1], [0, 2], [-1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [-1, 1], [-2, 2], [-1, 2]],
  [[0, 0], [-1, 1], [-2, 2], [-2, 1]],
  [[0, 0], [-1, 1], [-2, 2], [0, 1]],
  [[0, 0], [-1, 1], [-2, 2], [-1, 0]],
  [[0, 0], [-1, 1], [-2, 2], [-3, 3]],
  [[0, 0], [0, 1], [1, 1], [2, 0]],
  [[0, 0], [1, -1], [2, -1], [2, 0]],
  [[0, 0], [-1, 1], [0, 2], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [-2, 2]],
  [[0, 0], [-1, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [-1, 0]],
  [[0, 0], [-1, 1], [0, 2], [0, 1]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [-1, 1], [-1, 0], [-2, 1]],
];

function buildCells() {
  const cells = [];
  let idx = 0;
  for (let r = 0; r < COUNTS.length; r += 1) {
    const count = COUNTS[r];
    const y = (r - 4) * SPACING * SIN60;
    const xStart = count % 2 === 0
      ? (-count / 2) * SPACING + SPACING / 2
      : (-(count - 1) / 2) * SPACING;
    for (let c = 0; c < count; c += 1) {
      cells.push({ index: idx++, x: xStart + c * SPACING, y });
    }
  }
  return cells;
}

export const CELLS = buildCells();
export const CELL_COUNT = CELLS.length; // 61

// 27 条消除线：横向 / 60° 对角 / 120° 对角，各 9 条。按几何投影分组。
function buildLines() {
  const dirs = [
    { px: 0, py: 1 },
    { px: -SIN60, py: 0.5 },
    { px: SIN60, py: 0.5 },
  ];
  const lines = [];
  for (const d of dirs) {
    const buckets = new Map();
    for (const cell of CELLS) {
      const key = Math.round((d.px * cell.x + d.py * cell.y) / (SPACING * SIN60));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(cell.index);
    }
    for (const line of buckets.values()) {
      line.sort((a, b) => a - b);
      lines.push(line);
    }
  }
  return lines;
}

export const LINES = buildLines();

function shapeWorldOffsets(shapeIndex) {
  return SHAPES[shapeIndex].map(([q, r]) => axialToWorld(q, r));
}

// 把形状的每个子格吸附到最近棋盘格；任一个落空/重复即失败。
function resolveTargets(anchorIndex, shapeIndex) {
  const anchor = CELLS[anchorIndex];
  const offsets = shapeWorldOffsets(shapeIndex);
  const used = new Set();
  const targets = [];
  for (const off of offsets) {
    const tx = anchor.x + off.x;
    const ty = anchor.y + off.y;
    let best = -1;
    let bestDist = Infinity;
    for (const cell of CELLS) {
      const d = Math.hypot(cell.x - tx, cell.y - ty);
      if (d < bestDist) { bestDist = d; best = cell.index; }
    }
    if (bestDist > SNAP || used.has(best)) return null;
    used.add(best);
    targets.push(best);
  }
  return targets;
}

function levelHp(levelIndex) {
  const lv = levelIndex + 1;
  let hp = 70 + levelIndex * 5;
  if (lv % 5 === 0) hp += 60;
  return hp;
}

function makeLevel(levelIndex, seed) {
  const rng = mulberry32(seed);
  const lv = levelIndex + 1;
  const monType = levelIndex % 4;
  const rocks = [];
  if (levelIndex >= 2) {
    const count = Math.min(4, 1 + Math.floor(levelIndex / 3));
    while (rocks.length < count) {
      const i = Math.floor(rng() * CELL_COUNT);
      if (!rocks.includes(i)) rocks.push(i);
    }
  }
  const hp = levelHp(levelIndex);
  const parMoves = Math.max(3, Math.ceil(hp / 18) + 2);
  return { lv, monType, hp, rocks, parMoves };
}

function randomPiece(rng) {
  // 单格概率 ~1/7（救命件），其余随机 4 格形状
  const shape = rng() < 1 / 7 ? 0 : 1 + Math.floor(rng() * (SHAPES.length - 1));
  const color = 1 + Math.floor(rng() * 4);
  return { shape, color };
}

export function createRun(levelIndex, opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);
  const level = makeLevel(levelIndex, seed);
  const board = CELLS.map((cell) => ({
    index: cell.index,
    x: cell.x,
    y: cell.y,
    kind: level.rocks.includes(cell.index) ? 'rock' : 'empty',
    color: 0,
  }));

  const state = {
    level: level.lv,
    monType: level.monType,
    monsterHp: level.hp,
    monsterMaxHp: level.hp,
    board,
    trays: [randomPiece(rng), randomPiece(rng), randomPiece(rng)],
    bombs: opts.bombs == null ? 1 : opts.bombs,
    score: opts.score || 0,
    combo: 0,
    moves: 0,
    stars: 0,
    phase: 'playing', // playing | won | lost
    simTime: 0,
    talkTimer: 2.5 + rng() * 2,
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function findPlacement(trayIndex) {
    const tray = state.trays[trayIndex];
    if (!tray) return null;
    for (let a = 0; a < CELL_COUNT; a += 1) {
      if (canPlace(trayIndex, a)) return a;
    }
    return null;
  }

  function canPlace(trayIndex, anchorIndex) {
    if (state.phase !== 'playing') return false;
    const tray = state.trays[trayIndex];
    if (!tray) return false;
    const targets = resolveTargets(anchorIndex, tray.shape);
    if (!targets) return false;
    for (const t of targets) {
      if (state.board[t].kind !== 'empty') return false;
    }
    return true;
  }

  function computeStars() {
    const par = level.parMoves;
    if (state.moves <= par) return 3;
    if (state.moves <= Math.ceil(par * 1.7)) return 2;
    return 1;
  }

  function winLevel() {
    state.phase = 'won';
    state.stars = computeStars();
    emit('star', { stars: state.stars });
    emit('win', { stars: state.stars, level: state.level, score: state.score, moves: state.moves });
  }

  function loseLevel() {
    state.phase = 'lost';
    emit('lose', { reason: 'deadEnd', level: state.level, score: state.score, moves: state.moves });
  }

  function checkLose() {
    if (state.phase !== 'playing') return;
    for (let i = 0; i < 3; i += 1) {
      if (findPlacement(i) !== null) return;
    }
    loseLevel();
  }

  function resolveClears() {
    const cleared = [];
    for (const line of LINES) {
      let full = true;
      for (const i of line) if (state.board[i].kind !== 'gem') { full = false; break; }
      if (full) for (const i of line) cleared.push({ index: i, color: state.board[i].color });
    }
    if (!cleared.length) {
      state.combo = 0;
      return 0;
    }
    state.combo = Math.min(state.combo + 1, COMBO_MAX);
    const mult = state.combo;
    let damage = 0;
    let score = 0;
    cleared.forEach((c, seq) => {
      damage += GEM_DAMAGE[c.color - 1] * mult;
      score += (seq + 1) * (seq + 1) * mult;
      state.board[c.index].kind = 'empty';
      state.board[c.index].color = 0;
    });
    state.score += score;
    state.monsterHp -= damage;
    emit('clear', { cells: cleared.length, combo: mult, indices: cleared.map((c) => c.index) });
    emit('combo', { combo: mult });
    emit('hit', { damage, hp: Math.max(0, state.monsterHp) });
    if (state.monsterHp <= 0) { state.monsterHp = 0; winLevel(); }
    return cleared.length;
  }

  function bombTargets(cellIndex) {
    const center = CELLS[cellIndex];
    const r = BOMB_RADIUS * SPACING;
    const out = [];
    for (const cell of CELLS) {
      if (Math.hypot(cell.x - center.x, cell.y - center.y) <= r) out.push(cell.index);
    }
    return out;
  }

  const run = {
    state,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.simTime += dt;
      state.talkTimer -= dt;
      if (state.talkTimer <= 0) {
        state.talkTimer = 3.5 + rng() * 2;
        emit('talk', { line: Math.floor(rng() * 5) });
      }
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    canPlace,
    findPlacement,
    resolveTargets,

    place(trayIndex, anchorIndex) {
      if (!canPlace(trayIndex, anchorIndex)) return { ok: false };
      const tray = state.trays[trayIndex];
      const targets = resolveTargets(anchorIndex, tray.shape);
      for (const t of targets) {
        state.board[t].kind = 'gem';
        state.board[t].color = tray.color;
      }
      state.moves += 1;
      state.score += targets.length + 1;
      emit('place', { trayIndex, cells: targets.length });
      state.trays[trayIndex] = randomPiece(rng);
      resolveClears();
      checkLose();
      return { ok: true, cleared: targets.length };
    },

    useBomb(cellIndex) {
      if (state.phase !== 'playing' || state.bombs <= 0) return { ok: false };
      if (cellIndex < 0 || cellIndex >= CELL_COUNT) return { ok: false };
      state.bombs -= 1;
      const mult = Math.max(1, state.combo);
      const targets = bombTargets(cellIndex);
      let damage = 0;
      let score = 0;
      let gems = 0;
      let rocks = 0;
      targets.forEach((i, seq) => {
        const c = state.board[i];
        if (c.kind === 'gem') {
          damage += GEM_DAMAGE[c.color - 1] * mult;
          score += (seq + 1) * (seq + 1) * mult;
          gems += 1;
        } else if (c.kind === 'rock') {
          rocks += 1;
        }
        c.kind = 'empty';
        c.color = 0;
      });
      state.score += score;
      state.monsterHp -= damage;
      emit('bomb', { cells: targets.length, gems, rocks });
      if (rocks > 0) emit('rock', { count: rocks });
      if (damage > 0) emit('hit', { damage, hp: Math.max(0, state.monsterHp) });
      if (state.monsterHp <= 0) { state.monsterHp = 0; winLevel(); }
      else checkLose();
      return { ok: true, targets: targets.length };
    },

    getHud() {
      return {
        level: state.level,
        score: state.score,
        best: state.score,
        monsterHp: Math.max(0, state.monsterHp),
        monsterMaxHp: state.monsterMaxHp,
        bombs: state.bombs,
        combo: state.combo,
        moves: state.moves,
        monType: state.monType,
      };
    },

    checkLose,
  };

  return run;
}
