// 纯逻辑：same-game 星爆消消（10×10，5 色星 + 岩石障碍）
// P0 骨架与原版 1:1：点击选同色连通团(≥2) → 引爆 n²×5 → 下落 → 左靠 → 无相邻同色即死局结算。
// 新机制：岩石（相邻引爆碎裂 +50）、连击（4s 窗口 +5/级）、完美清空 +1000、三星评级、3 关小战役。
import { GAME, targetFor } from '../../config/game.config.js';

const GRID = GAME.GRID;
const STAR_TYPES = GAME.STAR_TYPES;
const ROCK = GAME.ROCK_TYPE;

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

export function rocksForLevel(level) {
  return Math.min((level - 1) * GAME.ROCKS_PER_LEVEL, GAME.ROCK_CAP);
}

function inGrid(x, y) {
  return x >= 0 && x < GRID && y >= 0 && y < GRID;
}

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0));
}

function isStar(v) {
  return v >= 1 && v <= STAR_TYPES;
}

export function hasMove(grid) {
  for (let x = 0; x < GRID; x += 1) {
    for (let y = 0; y < GRID; y += 1) {
      const t = grid[x][y];
      if (!isStar(t)) continue;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (inGrid(nx, ny) && grid[nx][ny] === t) return true;
      }
    }
  }
  return false;
}

export function findGroup(grid, x, y) {
  const t = grid[x][y];
  if (!isStar(t)) return [];
  const seen = new Set([`${x},${y}`]);
  const stack = [[x, y]];
  const out = [];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    out.push([cx, cy]);
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      const k = `${nx},${ny}`;
      if (inGrid(nx, ny) && grid[nx][ny] === t && !seen.has(k)) {
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
  }
  return out;
}

export function allGroups(grid) {
  const seen = new Set();
  const groups = [];
  for (let x = 0; x < GRID; x += 1) {
    for (let y = 0; y < GRID; y += 1) {
      if (!isStar(grid[x][y])) continue;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      const g = findGroup(grid, x, y);
      for (const [gx, gy] of g) seen.add(`${gx},${gy}`);
      if (g.length >= 2) groups.push(g);
    }
  }
  return groups;
}

export function countStars(grid) {
  let c = 0;
  for (let x = 0; x < GRID; x += 1) {
    for (let y = 0; y < GRID; y += 1) {
      if (isStar(grid[x][y])) c += 1;
    }
  }
  return c;
}

function buildGrid(rng, rocks) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const grid = emptyGrid();
    for (let x = 0; x < GRID; x += 1) {
      for (let y = 0; y < GRID; y += 1) {
        grid[x][y] = 1 + Math.floor(rng() * STAR_TYPES);
      }
    }
    const cells = [];
    for (let x = 0; x < GRID; x += 1) for (let y = 0; y < GRID; y += 1) cells.push([x, y]);
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (let i = 0; i < Math.min(rocks, cells.length); i += 1) {
      grid[cells[i][0]][cells[i][1]] = ROCK;
    }
    if (hasMove(grid)) return grid;
  }
  // 理论上到不了这里；兜底返回一张无岩石必可动棋盘
  const grid = emptyGrid();
  for (let x = 0; x < GRID; x += 1) for (let y = 0; y < GRID; y += 1) grid[x][y] = 1 + Math.floor(rng() * STAR_TYPES);
  return grid;
}

function fallDown(grid) {
  for (let x = 0; x < GRID; x += 1) {
    let fall = 0;
    for (let y = 0; y < GRID; y += 1) {
      if (grid[x][y] === 0) fall += 1;
      else if (fall > 0) {
        grid[x][y - fall] = grid[x][y];
        grid[x][y] = 0;
      }
    }
  }
}

function fallLeft(grid) {
  let shift = 0;
  for (let x = 0; x < GRID; x += 1) {
    if (grid[x][0] === 0) {
      shift += 1;
    } else if (shift > 0) {
      for (let y = 0; y < GRID; y += 1) {
        grid[x - shift][y] = grid[x][y];
        grid[x][y] = 0;
      }
    }
  }
}

export function createSim(level = 1, seed = 1) {
  const sim = {
    seed,
    phase: 'playing',     // playing | won | lost
    level,
    score: 0,
    target: targetFor(level),
    grid: null,
    selected: null,       // [[x,y],...] 已选中的同色连通团
    moves: 0,
    combo: 0,
    lastClearAt: -Infinity,
    time: 0,
    starsEarned: 0,
    remainingStars: 0,
    events: [],
    rng: mulberry32(seed),
  };
  sim.grid = buildGrid(sim.rng, rocksForLevel(level));
  sim.remainingStars = countStars(sim.grid);
  return sim;
}

function push(sim, type, payload = {}) {
  sim.events.push({ type, ...payload });
}

function ratingOf(score, target) {
  if (score >= target * GAME.RATING_3) return 3;
  if (score >= target * GAME.RATING_2) return 2;
  return 1; // 到达死局即结算，最低 1 星（无硬失败，三星是 mastery 目标）
}

function winLevel(sim) {
  const stars = ratingOf(sim.score, sim.target);
  sim.starsEarned = stars;
  push(sim, 'levelClear', { level: sim.level, score: sim.score, stars });
  if (sim.level >= GAME.MAX_LEVEL) {
    sim.phase = 'won';
    push(sim, 'win', { score: sim.score, stars });
  } else {
    sim.level += 1;
    sim.target = targetFor(sim.level);
    sim.grid = buildGrid(sim.rng, rocksForLevel(sim.level));
    sim.remainingStars = countStars(sim.grid);
    sim.selected = null;
    sim.combo = 0;
    sim.lastClearAt = -Infinity;
    push(sim, 'levelUp', { level: sim.level, target: sim.target });
  }
}

export function select(sim, x, y) {
  if (sim.phase !== 'playing') return { ok: false };
  const t = sim.grid[x][y];
  if (!isStar(t)) {
    if (sim.selected) {
      sim.selected = null;
      push(sim, 'deselect');
    }
    return { ok: false, reason: 'empty-or-rock' };
  }
  const group = findGroup(sim.grid, x, y);
  if (group.length >= 2) {
    sim.selected = group;
    push(sim, 'select', { size: group.length, score: group.length * group.length * GAME.BASE_SCORE });
    return { ok: true, size: group.length };
  }
  if (sim.selected) {
    sim.selected = null;
    push(sim, 'deselect');
  }
  push(sim, 'invalid', { reason: 'single' });
  return { ok: false, reason: 'single' };
}

export function pop(sim) {
  if (sim.phase !== 'playing' || !sim.selected || sim.selected.length < 2) return { ok: false };
  const cells = sim.selected;
  sim.selected = null;

  // 连击（4 秒窗口）
  const withinWindow = (sim.time - sim.lastClearAt) <= GAME.COMBO_WINDOW;
  sim.combo = withinWindow ? Math.min(sim.combo + 1, 9) : 1;
  sim.lastClearAt = sim.time;

  const size = cells.length;
  const base = size * size * GAME.BASE_SCORE;
  const comboBonus = Math.max(0, sim.combo - 1) * GAME.COMBO_STEP;
  let gain = base + comboBonus;

  // 相邻岩石碎裂
  const adjRocks = new Set();
  for (const [cx, cy] of cells) {
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (inGrid(nx, ny) && sim.grid[nx][ny] === ROCK) adjRocks.add(`${nx},${ny}`);
    }
  }

  for (const [cx, cy] of cells) sim.grid[cx][cy] = 0;
  let rocksBroken = 0;
  for (const k of adjRocks) {
    const [rx, ry] = k.split(',').map(Number);
    sim.grid[rx][ry] = 0;
    rocksBroken += 1;
  }
  if (rocksBroken > 0) {
    gain += rocksBroken * GAME.ROCK_BONUS;
  }

  sim.score += gain;
  sim.moves += 1;
  push(sim, 'pop', { size, gain, combo: sim.combo });
  if (rocksBroken > 0) push(sim, 'rockBreak', { count: rocksBroken });
  if (sim.combo >= 2) push(sim, 'combo', { combo: sim.combo });

  fallDown(sim.grid);
  fallLeft(sim.grid);
  push(sim, 'fall');

  sim.remainingStars = countStars(sim.grid);

  if (sim.remainingStars === 0) {
    sim.score += GAME.PERFECT_BONUS;
    push(sim, 'perfect', { bonus: GAME.PERFECT_BONUS });
    winLevel(sim);
  } else if (!hasMove(sim.grid)) {
    const bonus = Math.max(0, GAME.END_BONUS_A - sim.remainingStars * sim.remainingStars * GAME.END_BONUS_B);
    sim.score += bonus;
    push(sim, 'deadlock', { remaining: sim.remainingStars, bonus });
    winLevel(sim); // 到达死局即结算并推进（无硬失败）
  }

  return { ok: true, size, gain };
}

export function tick(sim, dt) {
  sim.time += dt;
}

export function drainEvents(sim) {
  const e = sim.events;
  sim.events = [];
  return e;
}

export function getHud(sim) {
  return {
    score: sim.score,
    target: sim.target,
    level: sim.level,
    combo: sim.combo,
    moves: sim.moves,
    stars: sim.starsEarned,
  };
}
