// MOSAIC SLIDE · 滑块拼图可解性（纯逻辑，零 DOM）
// 标准「逆序奇偶」判定：把棋盘当作 {0..N-1} 的全排列（0 = 缺口），
// 不变量 = 全排列逆序数奇偶 XOR 缺口距其家(左上角)的曼哈顿距离奇偶。
// 每一步（滑一块进缺口）都同时翻转两者，故该不变量恒定；可解当且仅当为偶。
// shuffle 本身用「缺口随机游走 + 记录路径」生成（天然可解），本文件另供单测复验。

import { GAME } from '../../config/game.config.js';

export function indexToRC(i, cols) {
  return { r: Math.floor(i / cols), c: i % cols };
}

export function rcToIndex(r, c, cols) {
  return r * cols + c;
}

// board：长度 rows*cols 的数组，board[cell] = 该格碎片 id（0 = 缺口）。
// 返回 { solvable, inversions, blankDist }。
export function solvability(board, rows, cols, blankHome = GAME.BLANK_HOME) {
  let inversions = 0;
  for (let i = 0; i < board.length; i += 1) {
    for (let j = i + 1; j < board.length; j += 1) {
      if (board[i] > board[j]) inversions += 1;
    }
  }
  const blankIdx = board.indexOf(0);
  const br = Math.floor(blankIdx / cols);
  const bc = blankIdx % cols;
  const hr = Math.floor(blankHome / cols);
  const hc = blankHome % cols;
  const blankDist = Math.abs(br - hr) + Math.abs(bc - hc);
  const solvable = (inversions + blankDist) % 2 === 0;
  return { solvable, inversions, blankDist };
}

export function isSolvable(board, rows, cols, blankHome) {
  return solvability(board, rows, cols, blankHome).solvable;
}

// 缺口 cell 的四邻（不越界）
export function neighbors(cell, rows, cols) {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  const out = [];
  if (r > 0) out.push((r - 1) * cols + c);
  if (r < rows - 1) out.push((r + 1) * cols + c);
  if (c > 0) out.push(r * cols + c - 1);
  if (c < cols - 1) out.push(r * cols + c + 1);
  return out;
}

// 给定缺口随机游走记录 blankSeq（长度 depth+1，blankSeq[0] = 家），
// 返回「回到完成态」所需点击的格子序列（每项是 cell index）。
export function solveScramble(blankSeq, depth) {
  return blankSeq.slice(0, depth).reverse();
}
