// src/game/solver.js — Lights Out 线性格型的 Gauss（GF(2)）求解器 + 关卡可解性校验。
// 纯逻辑，零 DOM；供 tests/solver.test.mjs 用，也在 selfplay 的 greedy 策略里作独立解参考。
//
// 电容格是状态式（点两次才翻转），不满足线性；对含电容的关卡，用「线性化（视作 node）」
// 的按压矩阵做存在性佐证，真正的可解性由「正向重放生成解」保证（见 tests/solver.test.mjs）。

import { PRESS_PATTERNS, TYPE_PATTERN, inBounds, allLit, cloneBoard, applyLinearPress } from '../../config/gameplay.js';

/** 构造按压矩阵 M[cell][press]，press 按 (r,c) 行优先编号。电容格线性化为 orth。 */
export function buildPressMatrix(types) {
  const N = types.length;
  const cells = N * N;
  const M = Array.from({ length: cells }, () => new Array(cells).fill(0));
  for (let pr = 0; pr < N; pr += 1) {
    for (let pc = 0; pc < N; pc += 1) {
      const type = types[pr][pc];
      const pattern = type === 'capacitor' ? PRESS_PATTERNS.orth : (PRESS_PATTERNS[TYPE_PATTERN[type]] || []);
      const pressIdx = pr * N + pc;
      for (const [dr, dc] of pattern) {
        const rr = pr + dr;
        const cc = pc + dc;
        if (inBounds(N, rr, cc)) M[rr * N + cc][pressIdx] = 1;
      }
    }
  }
  return M;
}

/** GF(2) 上的 Gauss–Jordan：解 M·x = target。返回解向量（长度 = 按压数）或 null。 */
export function solveGauss(M, target) {
  const n = M.length;
  const m = n ? M[0].length : 0;
  const a = M.map((row, i) => row.slice().concat([target[i] ? 1 : 0]));
  const pivots = [];
  let row = 0;
  for (let col = 0; col < m && row < n; col += 1) {
    let pivot = -1;
    for (let r = row; r < n; r += 1) if (a[r][col] === 1) { pivot = r; break; }
    if (pivot === -1) continue;
    const tmp = a[row]; a[row] = a[pivot]; a[pivot] = tmp;
    for (let r = 0; r < n; r += 1) {
      if (r !== row && a[r][col] === 1) {
        for (let c = 0; c <= m; c += 1) a[r][c] ^= a[row][c];
      }
    }
    pivots.push(col);
    row += 1;
  }
  for (let r = 0; r < n; r += 1) {
    let has = false;
    for (let c = 0; c < m; c += 1) if (a[r][c] === 1) { has = true; break; }
    if (!has && a[r][m] === 1) return null; // 不一致：无解
  }
  const x = new Array(m).fill(0);
  for (let r = 0; r < pivots.length; r += 1) x[pivots[r]] = a[r][m];
  return x;
}

/** 目标向量：把「当前盘面」翻成「全亮」需要在哪些格上 XOR 1。 */
export function targetFor(board) {
  const out = [];
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) out.push(board[r][c] === 1 ? 0 : 1);
  }
  return out;
}

export function levelHasCapacitor(level) {
  for (let r = 0; r < level.types.length; r += 1) {
    if (level.types[r].includes('capacitor')) return true;
  }
  return false;
}

/**
 * 线性格型关卡的 Gauss 解：返回 { solvable, presses: [[r,c],...] }。
 * presses 按行优先序号还原成坐标；含电容的关卡调用方应跳过（本函数按线性化求解）。
 */
export function solveLinearLevel(level) {
  const N = level.size;
  const M = buildPressMatrix(level.types);
  const x = solveGauss(M, targetFor(level.board));
  if (!x) return { solvable: false, presses: [] };
  const presses = [];
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] === 1) presses.push([Math.floor(i / N), i % N]);
  }
  return { solvable: true, presses };
}

/** 用线性格型按压（跳过电容）把盘面翻到全亮，供测试验证 Gauss 解。 */
export function applyPressesLinear(level, presses) {
  const board = cloneBoard(level.board);
  const N = level.size;
  const state = { board, types: level.types, N };
  for (const [r, c] of presses) applyLinearPress(state, r, c);
  return board;
}

export function isAllLit(board) {
  return allLit(board);
}
