// src/game/ai.js — 贪心瞄准求解器（纯逻辑，供 tools/selfplay.mjs 与测试使用）。
// 策略：射「最大同色簇的挂点」——找到当前颜色能连通成 ≥3 的空位，再反解弹道角度。
import { MAX_AIM, parityOf, neighborsOf, rowColToPos } from '../../config/gameplay.js';
import { traceShot, isEmpty } from './grid.js';

function distinctColors(grid) {
  const set = new Set();
  for (const row of grid) {
    if (!row) continue;
    for (const cell of row) if (cell && cell.c > 0) set.add(cell.c);
  }
  return [...set];
}

/** 假设在 (row,col) 放一颗 color 泡泡，它能连通出多大的同色簇（含自身）。 */
function virtualMatchSize(grid, parities, row, col, color) {
  const seen = new Set();
  const stack = [[row, col]];
  let n = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    const key = `${r},${c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isVirtual = (r === row && c === col);
    const cell = grid[r] && grid[r][c];
    if (!isVirtual && (!cell || cell.c !== color)) continue;
    n += 1;
    for (const [dr, dc] of neighborsOf(parityOf(parities, r))) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0) continue;
      const ncell = grid[nr] && grid[nr][nc];
      const isV = (nr === row && nc === col);
      if (isV || (ncell && ncell.c === color)) {
        const k2 = `${nr},${nc}`;
        if (!seen.has(k2)) stack.push([nr, nc]);
      }
    }
  }
  return n;
}

/**
 * 找到最佳挂点：给定要射的颜色（>0 具体色，<=0 视为百搭任选），
 * 枚举所有「贴着该色泡泡的空位」，取虚拟连通簇最大的那个。
 */
export function bestAttach(grid, parities, color) {
  const colors = color > 0 ? [color] : distinctColors(grid);
  let best = null;
  let bestScore = 0;
  for (const c of colors) {
    const candidates = new Set();
    for (let r = 0; r < grid.length; r += 1) {
      const row = grid[r];
      if (!row) continue;
      for (let col = 0; col < row.length; col += 1) {
        const cell = row[col];
        if (!cell || cell.c !== c) continue;
        for (const [dr, dc] of neighborsOf(parityOf(parities, r))) {
          const nr = r + dr;
          const nc = col + dc;
          if (nr < 0) continue;
          if (isEmpty(grid, parities, nr, nc)) candidates.add(`${nr},${nc}`);
        }
      }
    }
    for (const key of candidates) {
      const [rr, cc] = key.split(',').map(Number);
      const sz = virtualMatchSize(grid, parities, rr, cc, c);
      if (sz > bestScore) { bestScore = sz; best = { row: rr, col: cc, color: c, size: sz }; }
    }
  }
  return best;
}

function landingDist(landing, row, col, parities) {
  const p1 = rowColToPos(parityOf(parities, landing.row), landing.row, landing.col);
  const p2 = rowColToPos(parityOf(parities, row), row, col);
  return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

/** 反解能命中 (row,col) 的弹道角度（粗扫 + 局部细化，含左右壁反弹）。 */
export function solveAngle(grid, parities, row, col, drift = 0) {
  let bestAngle = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= 90; i += 1) {
    const a = -MAX_AIM + ((2 * MAX_AIM) * i) / 90;
    const tr = traceShot(grid, parities, a, { drift });
    if (!tr.landing) continue;
    if (tr.landing.row === row && tr.landing.col === col) return a;
    const d = landingDist(tr.landing, row, col, parities);
    if (d < bestDist) { bestDist = d; bestAngle = a; }
  }
  for (let i = 0; i <= 40; i += 1) {
    const a = Math.max(-MAX_AIM, Math.min(MAX_AIM, bestAngle - 0.04 + (0.08 * i) / 40));
    const tr = traceShot(grid, parities, a, { drift });
    if (!tr.landing) continue;
    if (tr.landing.row === row && tr.landing.col === col) return a;
    const d = landingDist(tr.landing, row, col, parities);
    if (d < bestDist) { bestDist = d; bestAngle = a; }
  }
  return bestAngle;
}

/** 组合入口：返回理想瞄准角度（无好目标时返回 null）。 */
export function bestAim(grid, parities, color, drift = 0) {
  const attach = bestAttach(grid, parities, color);
  if (!attach) return null;
  return { angle: solveAngle(grid, parities, attach.row, attach.col, drift), attach };
}
