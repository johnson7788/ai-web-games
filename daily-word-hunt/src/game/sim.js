// 纯逻辑：主题词库 →  seeded 网格生成 + 直线选词判定 + 提示/计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { GRID, RULES } from '../../config/game.config.js';
import { THEMES } from '../../config/themes.js';

const SIZE = GRID.SIZE;
const DIRS = [
  [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1],
];

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 把词放进网格：8 方向随机尝试，允许同字母重叠。返回 placements 或 null。
function tryGenerate(words, rng) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const placements = [];
  const ordered = [...words].sort((a, b) => b.length - a.length);
  for (const word of ordered) {
    let placed = false;
    for (let attempt = 0; attempt < RULES.placeAttempts && !placed; attempt += 1) {
      const dir = DIRS[Math.floor(rng() * DIRS.length)];
      const r0 = Math.floor(rng() * SIZE);
      const c0 = Math.floor(rng() * SIZE);
      const cells = [];
      let ok = true;
      for (let k = 0; k < word.length; k += 1) {
        const r = r0 + dir[0] * k;
        const c = c0 + dir[1] * k;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) { ok = false; break; }
        if (grid[r][c] !== null && grid[r][c] !== word[k]) { ok = false; break; }
        cells.push({ r, c });
      }
      if (!ok) continue;
      cells.forEach(({ r, c }, k) => { grid[r][c] = word[k]; });
      placements.push({ word, cells });
      placed = true;
    }
    if (!placed) return null;
  }
  // 填空
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] === null) grid[r][c] = ALPHABET[Math.floor(rng() * 26)];
    }
  }
  return { grid, placements };
}

export function generateGrid(words, seed) {
  for (let retry = 0; retry < RULES.gridRetries; retry += 1) {
    const rng = makeRng((seed + retry * 7919) >>> 0);
    const result = tryGenerate(words, rng);
    if (result) return result;
  }
  // 兜底（理论上不会到）：只放能放下的词
  const rng = makeRng(seed);
  return tryGenerate(words.slice(0, 4), rng) || { grid: [], placements: [] };
}

export function createRun({ seed = 1, mode = 'daily', dailyNumber = 0 } = {}) {
  const rng = makeRng(seed);
  const themeIndex = seed % THEMES.length;
  const theme = THEMES[themeIndex];
  const words = shuffle(theme.words, rng).slice(0, RULES.wordsPerPuzzle);
  const { grid, placements } = generateGrid(words, seed);
  // 按长度升序展示
  placements.sort((a, b) => (a.word.length - b.word.length) || a.word.localeCompare(b.word));
  return {
    seed,
    mode,
    dailyNumber,
    themeIndex,
    theme,
    size: SIZE,
    grid,
    words: placements,           // [{ word, cells }]
    found: new Set(),
    foundCells: new Set(),       // "r,c"
    score: 0,
    streak: 0,
    hintsUsed: 0,
    phase: 'playing',            // playing | complete
    events: [],
    rng,
  };
}

// 由起点/终点吸附到最近 8 方向，返回直线格子序列（纯函数，供输入与测试）。
export function lineCells(start, end, size = SIZE) {
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  if (dr === 0 && dc === 0) return [{ r: start.r, c: start.c }];
  const angle = Math.atan2(dr, dc);
  let k = Math.round(angle / (Math.PI / 4));
  k = ((k % 8) + 8) % 8;
  const dir = DIRS[k];
  const denom = dir[0] * dir[0] + dir[1] * dir[1];
  let steps = Math.round((dr * dir[0] + dc * dir[1]) / denom);
  if (steps < 0) steps = 0;
  const cells = [];
  for (let s = 0; s <= steps; s += 1) {
    const r = start.r + dir[0] * s;
    const c = start.c + dir[1] * s;
    if (r < 0 || r >= size || c < 0 || c >= size) break;
    cells.push({ r, c });
  }
  return cells;
}

export function isComplete(run) {
  return run.found.size >= run.words.length;
}

// 提交一条选中的直线格子。返回 { ok, kind, word, cells }。
export function submitSelection(run, cells) {
  if (run.phase !== 'playing' || !cells || cells.length < 2) {
    return { ok: false, kind: 'invalid' };
  }
  const forward = cells.map(({ r, c }) => run.grid[r][c]).join('');
  const reverse = [...forward].reverse().join('');
  let match = null;
  for (const { word } of run.words) {
    if (word === forward || word === reverse) { match = word; break; }
  }
  if (!match) {
    run.streak = 0;
    return { ok: false, kind: 'invalid' };
  }
  if (run.found.has(match)) {
    return { ok: false, kind: 'already', word: match };
  }
  run.found.add(match);
  for (const { r, c } of cells) run.foundCells.add(`${r},${c}`);
  run.streak += 1;
  const gained = RULES.scorePerWord + 10 * (run.streak - 1);
  run.score += gained;
  run.events.push({ type: 'found', word: match, cells, gained, streak: run.streak });
  let complete = false;
  if (isComplete(run)) {
    run.phase = 'complete';
    complete = true;
    run.events.push({ type: 'clear', score: run.score, found: run.found.size });
  }
  return { ok: true, kind: 'found', word: match, cells, gained, complete };
}

// 提示：返回某个未找到词的首格（并标记闪烁），扣次数。
export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  const remaining = run.words.filter((w) => !run.found.has(w.word));
  if (remaining.length === 0) return null;
  const pick = remaining[Math.floor(run.rng() * remaining.length)];
  run.hintsUsed += 1;
  const cell = pick.cells[0];
  run.events.push({ type: 'hint', cell, word: pick.word });
  return { cell, word: pick.word };
}

export function getHud(run) {
  return {
    found: run.found.size,
    total: run.words.length,
    score: run.score,
    streak: run.streak,
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    phase: run.phase,
    themeIndex: run.themeIndex,
    mode: run.mode,
    dailyNumber: run.dailyNumber,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const THEME_COUNT = THEMES.length;