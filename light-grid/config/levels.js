// config/levels.js — 关卡库（36 关，3 场景包 × 12 关；5×5 → 6×6 → 7×7）。
//
// 每关的「可解性」由构造保证：从全亮状态施加一组线性按压（par 个不同格，只按 node/diode/relay，
// 不直接按 capacitor/insulator）得到初始盘面，这组按压本身就是一个可行解。运行时玩家不必复刻
// 该组按压，只要把全部节点点亮即过关。单测会用 src/game/solver.js 的 Gauss 求解器 + 正向重放
// 双重验证每关可解（见 tests/solver.test.mjs）。

import { applyLinearPress, allLit } from './gameplay.js';

export const CHAPTERS = [
  { id: 'motherboard', nameKey: 'chapter.motherboard', palette: 'motherboard', size: 5 },
  { id: 'gpu', nameKey: 'chapter.gpu', palette: 'gpu', size: 6 },
  { id: 'neon', nameKey: 'chapter.neon', palette: 'neon', size: 7 },
];

// 关卡定义：specials = [格型, r, c]（其余为 node）；par = 目标最优步数（= 生成解的长度）。
const LEVEL_DEFS = [
  // ---- 主板（绿黑）5×5 ----
  { index: 1, size: 5, chapter: 'motherboard', specials: [], par: 4, seed: 101 },
  { index: 2, size: 5, chapter: 'motherboard', specials: [], par: 5, seed: 102 },
  { index: 3, size: 5, chapter: 'motherboard', specials: [], par: 6, seed: 103 },
  { index: 4, size: 5, chapter: 'motherboard', specials: [['diode', 0, 1], ['diode', 2, 1], ['diode', 4, 1]], par: 5, seed: 104 },
  { index: 5, size: 5, chapter: 'motherboard', specials: [['diode', 0, 0], ['diode', 2, 2], ['diode', 4, 4]], par: 6, seed: 105 },
  { index: 6, size: 5, chapter: 'motherboard', specials: [['diode', 0, 1], ['diode', 2, 3], ['capacitor', 2, 2]], par: 7, seed: 106 },
  { index: 7, size: 5, chapter: 'motherboard', specials: [['capacitor', 1, 1], ['capacitor', 3, 3]], par: 5, seed: 107 },
  { index: 8, size: 5, chapter: 'motherboard', specials: [['capacitor', 2, 2], ['diode', 0, 2], ['diode', 4, 2]], par: 6, seed: 108 },
  { index: 9, size: 5, chapter: 'motherboard', specials: [['capacitor', 1, 1], ['relay', 2, 2]], par: 7, seed: 109 },
  { index: 10, size: 5, chapter: 'motherboard', specials: [['relay', 2, 2]], par: 5, seed: 110 },
  { index: 11, size: 5, chapter: 'motherboard', specials: [['relay', 0, 0], ['relay', 4, 4]], par: 6, seed: 111 },
  { index: 12, size: 5, chapter: 'motherboard', specials: [['relay', 2, 2], ['diode', 0, 1], ['capacitor', 4, 3]], par: 8, seed: 112 },

  // ---- 显卡（蓝银）6×6 ----
  { index: 13, size: 6, chapter: 'gpu', specials: [], par: 6, seed: 113 },
  { index: 14, size: 6, chapter: 'gpu', specials: [], par: 7, seed: 114 },
  { index: 15, size: 6, chapter: 'gpu', specials: [['diode', 0, 2], ['diode', 2, 2], ['diode', 4, 2]], par: 8, seed: 115 },
  { index: 16, size: 6, chapter: 'gpu', specials: [['diode', 0, 1], ['diode', 5, 4], ['insulator', 3, 3]], par: 8, seed: 116 },
  { index: 17, size: 6, chapter: 'gpu', specials: [['capacitor', 2, 2], ['capacitor', 3, 3], ['diode', 0, 5], ['diode', 5, 0]], par: 8, seed: 117 },
  { index: 18, size: 6, chapter: 'gpu', specials: [['capacitor', 1, 1], ['capacitor', 4, 4], ['relay', 2, 2], ['relay', 3, 3]], par: 8, seed: 118 },
  { index: 19, size: 6, chapter: 'gpu', specials: [['relay', 1, 1], ['relay', 4, 4], ['insulator', 2, 2], ['insulator', 3, 3]], par: 9, seed: 119 },
  { index: 20, size: 6, chapter: 'gpu', specials: [['insulator', 1, 1], ['insulator', 1, 4], ['insulator', 4, 1], ['insulator', 4, 4]], par: 9, seed: 120 },
  { index: 21, size: 6, chapter: 'gpu', specials: [['diode', 0, 2], ['diode', 5, 3], ['relay', 2, 2], ['relay', 3, 3]], par: 9, seed: 121 },
  { index: 22, size: 6, chapter: 'gpu', specials: [['capacitor', 1, 1], ['diode', 0, 5], ['relay', 5, 0]], par: 10, seed: 122 },
  { index: 23, size: 6, chapter: 'gpu', specials: [['diode', 0, 0], ['relay', 5, 5], ['insulator', 2, 3], ['insulator', 3, 2]], par: 10, seed: 123 },
  { index: 24, size: 6, chapter: 'gpu', specials: [['diode', 0, 0], ['relay', 5, 5], ['capacitor', 2, 2]], par: 11, seed: 124 },

  // ---- 霓虹管（粉紫）7×7 ----
  { index: 25, size: 7, chapter: 'neon', specials: [], par: 7, seed: 125 },
  { index: 26, size: 7, chapter: 'neon', specials: [], par: 8, seed: 126 },
  { index: 27, size: 7, chapter: 'neon', specials: [['diode', 0, 1], ['diode', 2, 1], ['diode', 4, 1], ['diode', 6, 1]], par: 9, seed: 127 },
  { index: 28, size: 7, chapter: 'neon', specials: [['diode', 0, 2], ['diode', 6, 4], ['insulator', 3, 3], ['insulator', 3, 4]], par: 9, seed: 128 },
  { index: 29, size: 7, chapter: 'neon', specials: [['capacitor', 1, 1], ['capacitor', 5, 5], ['relay', 2, 2], ['relay', 4, 4]], par: 10, seed: 129 },
  { index: 30, size: 7, chapter: 'neon', specials: [['capacitor', 2, 2], ['capacitor', 4, 4], ['diode', 0, 6], ['diode', 6, 0]], par: 10, seed: 130 },
  { index: 31, size: 7, chapter: 'neon', specials: [['relay', 1, 1], ['relay', 5, 5], ['diode', 0, 0], ['insulator', 3, 3]], par: 11, seed: 131 },
  { index: 32, size: 7, chapter: 'neon', specials: [['insulator', 1, 2], ['insulator', 1, 4], ['insulator', 5, 2], ['insulator', 5, 4]], par: 11, seed: 132 },
  { index: 33, size: 7, chapter: 'neon', specials: [['capacitor', 1, 1], ['diode', 0, 6], ['relay', 6, 0]], par: 12, seed: 133 },
  { index: 34, size: 7, chapter: 'neon', specials: [['diode', 0, 0], ['relay', 6, 6], ['capacitor', 3, 3]], par: 12, seed: 134 },
  { index: 35, size: 7, chapter: 'neon', specials: [['diode', 0, 0], ['relay', 6, 6], ['capacitor', 1, 1], ['insulator', 3, 4]], par: 13, seed: 135 },
  { index: 36, size: 7, chapter: 'neon', specials: [['diode', 0, 0], ['diode', 6, 6], ['relay', 0, 6], ['relay', 6, 0], ['capacitor', 3, 3], ['insulator', 3, 2], ['insulator', 3, 4]], par: 14, seed: 136 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTypes(size, specials) {
  const types = Array.from({ length: size }, () => Array(size).fill('node'));
  for (const [type, r, c] of specials) {
    if (r >= 0 && c >= 0 && r < size && c < size) types[r][c] = type;
  }
  return types;
}

function allOnes(N) {
  return Array.from({ length: N }, () => Array(N).fill(1));
}

function pressableCells(types, N) {
  const cells = [];
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (types[r][c] !== 'insulator' && types[r][c] !== 'capacitor') cells.push([r, c]);
    }
  }
  return cells;
}

function scramble(types, N, par, seed) {
  const pool = pressableCells(types, N);
  const target = Math.min(par, pool.length);
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const rng = mulberry32((seed + attempt) >>> 0);
    const board = allOnes(N);
    const solution = [];
    const cells = pool.slice();
    // 局部 Fisher–Yates：洗出前 target 个不同格作为解。
    for (let i = 0; i < target; i += 1) {
      const j = i + Math.floor(rng() * (cells.length - i));
      const tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
      const [r, c] = cells[i];
      applyLinearPress({ board, types, N }, r, c);
      solution.push([r, c]);
    }
    if (!allLit(board)) return { board, solution };
  }
  throw new Error(`light-grid: 无法生成非平凡关卡 (seed=${seed}, par=${par})`);
}

export function buildLevels() {
  return LEVEL_DEFS.map((def) => {
    const types = makeTypes(def.size, def.specials);
    const { board, solution } = scramble(types, def.size, def.par, def.seed);
    const par = solution.length;
    return {
      index: def.index,
      size: def.size,
      chapter: def.chapter,
      board,
      types,
      solution,
      par,
      maxSteps: par + 5,
    };
  });
}

export const LEVELS = buildLevels();
