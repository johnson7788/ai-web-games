// MERGE 2048 · 贪心 AI（经典 2048 角落策略的加权评估版）
// 供 tools/selfplay.mjs 复用；纯逻辑，无 DOM。
import { slideGrid } from './sim.js';

const DIRS = ['up', 'down', 'left', 'right'];

function logv(t) {
  return t ? Math.log2(t.value) : 0;
}

// 四个角落方向的单调性，取最好（鼓励大数蹲角）
function monotonicity(grid, rows, cols) {
  let best = 0;
  for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let m = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = logv(grid[r][c]);
        if (c + 1 < cols) {
          const next = logv(grid[r][c + 1]);
          if (dc > 0 && next < x) m -= x - next;
          if (dc < 0 && next > x) m -= next - x;
        }
        if (r + 1 < rows) {
          const next = logv(grid[r + 1][c]);
          if (dr > 0 && next < x) m -= x - next;
          if (dr < 0 && next > x) m -= next - x;
        }
      }
    }
    if (m > best) best = m;
  }
  return best;
}

function smoothness(grid, rows, cols) {
  let s = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = logv(grid[r][c]);
      if (c + 1 < cols) s -= Math.abs(x - logv(grid[r][c + 1]));
      if (r + 1 < rows) s -= Math.abs(x - logv(grid[r + 1][c]));
    }
  }
  return s;
}

function cornerMax(grid, rows, cols) {
  let best = 0;
  const corners = [[0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1]];
  for (const [r, c] of corners) best = Math.max(best, logv(grid[r][c]));
  return best;
}

export function evaluate(grid, rows, cols) {
  let empty = 0;
  let maxVal = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const t = grid[r][c];
      if (!t) { empty += 1; continue; }
      if (t.value > maxVal) maxVal = t.value;
    }
  }
  const mono = monotonicity(grid, rows, cols);
  const corner = cornerMax(grid, rows, cols);
  const smooth = smoothness(grid, rows, cols);
  return empty * 14 + mono * 4 + corner * 8 + smooth * 0.3 + maxVal * 0.02;
}

/** 返回最优方向；无合法移动返回 null。 */
export function bestMove(grid, opts) {
  let best = null;
  let bestScore = -Infinity;
  for (const d of DIRS) {
    const res = slideGrid(grid, d, opts);
    if (!res.moved) continue;
    let score = evaluate(res.grid, opts.rows, opts.cols);
    if (res.merges.length) score += 140; // 明确偏好产生合并的步（推进）
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}
