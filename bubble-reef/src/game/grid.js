// src/game/grid.js — 六边形网格：邻域、同色连通、悬空检测、吸附、弹道追踪（纯逻辑）
// grid   : 二维数组 grid[row][col] = { c, gold, wildcard } | null（c=0 为岩礁障碍泡）
// parities: 数组 parities[row] = 0|1（该行的列偏移 parity，见 config/gameplay.js）
import {
  BUBBLE_R, BUBBLE_DIAM, ROW_SPACING, TOP_Y, WORLD, SHOOTER, SHOT_SPEED,
  colsInRow, rowColToPos, rowIndexFromY, colFromX, neighborsOf, parityOf, rowY,
} from '../../config/gameplay.js';

/** 该格子是否为空（row<0 视为「有顶」，不可落） */
export function isEmpty(grid, parities, row, col) {
  if (row < 0) return false;
  if (col < 0 || col >= colsInRow(parityOf(parities, row))) return false;
  const r = grid[row];
  if (!r) return true;
  return !r[col];
}

/** 该格子的颜色（0 = 岩礁障碍泡，null = 空） */
export function colorAt(grid, row, col) {
  const c = grid[row] && grid[row][col];
  return c ? c.c : null;
}

/** 同色连通消除：从 (row,col) 出发，返回可消除的 {row,col}[]（≥3 才返回，否则空数组） */
export function matchCluster(grid, parities, row, col) {
  const start = grid[row] && grid[row][col];
  if (!start || start.c <= 0) return [];       // 空或岩礁不可消
  const target = start.c;
  const seen = new Set();
  const out = [];
  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const key = `${r},${c}`;
    if (seen.has(key)) continue;
    const cell = grid[r] && grid[r][c];
    if (!cell || cell.c !== target) continue;
    seen.add(key);
    out.push({ row: r, col: c });
    for (const [dr, dc] of neighborsOf(parityOf(parities, r))) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0) continue;
      const ncell = grid[nr] && grid[nr][nc];
      if (ncell && ncell.c === target && !seen.has(`${nr},${nc}`)) stack.push([nr, nc]);
    }
  }
  return out.length >= 3 ? out : [];
}

/** 悬空检测：返回所有「连接到顶行（row 0）」的格子 key 集合 */
export function attachedSet(grid, parities) {
  const attached = new Set();
  const stack = [];
  const top = grid[0] || [];
  for (let c = 0; c < top.length; c += 1) {
    if (top[c]) {
      const key = `0,${c}`;
      if (!attached.has(key)) { attached.add(key); stack.push([0, c]); }
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of neighborsOf(parityOf(parities, r))) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0) continue;
      const ncell = grid[nr] && grid[nr][nc];
      if (!ncell) continue;
      const key = `${nr},${nc}`;
      if (attached.has(key)) continue;
      attached.add(key);
      stack.push([nr, nc]);
    }
  }
  return attached;
}

/** 返回所有悬空（未连接到顶行）的 {row,col}[] */
export function floatingCells(grid, parities) {
  const attached = attachedSet(grid, parities);
  const out = [];
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] && !attached.has(`${r},${c}`)) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** 命中坐标 → 最近空格的 {row,col}（只读；不给 grid 增行） */
export function snapToCell(grid, parities, x, y) {
  const r0 = Math.max(0, rowIndexFromY(y));
  const p0 = parityOf(parities, r0);
  const c0 = Math.max(0, Math.min(colFromX(x, p0), colsInRow(p0) - 1));
  if (isEmpty(grid, parities, r0, c0)) return { row: r0, col: c0 };
  let best = null;
  let bestD = Infinity;
  for (let rr = Math.max(0, r0 - 2); rr <= r0 + 2; rr += 1) {
    const pr = parityOf(parities, rr);
    const ncols = colsInRow(pr);
    for (let cc = 0; cc < ncols; cc += 1) {
      if (!isEmpty(grid, parities, rr, cc)) continue;
      const p = rowColToPos(pr, rr, cc);
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) { bestD = d; best = { row: rr, col: cc }; }
    }
  }
  return best;
}

/**
 * 弹道追踪（预测/预览用）：从炮台出发，模拟直线飞行 + 左右壁反弹 + 洋流偏移，
 * 直到撞到泡泡或触顶，返回途经点与最终落点。
 * 与 sim 的逐帧移动共用同一套几何/碰撞规则。
 */
export function traceShot(grid, parities, angle, opts = {}) {
  const fromX = opts.fromX ?? SHOOTER.x;
  const fromY = opts.fromY ?? SHOOTER.y;
  const speed = opts.speed ?? SHOT_SPEED;
  const dt = opts.dt ?? (1 / 120);
  const drift = opts.drift ?? 0;
  let x = fromX;
  let y = fromY;
  let vx = Math.sin(angle) * speed;
  let vy = -Math.cos(angle) * speed;
  const points = [{ x, y }];
  const maxSteps = Math.ceil((fromY - TOP_Y) / (speed * dt)) + 200;

  for (let i = 0; i < maxSteps; i += 1) {
    if (drift) vx += drift * dt;   // 洋流：恒定横向加速度 → 曲线弹道
    x += vx * dt;
    y += vy * dt;

    // 左右壁反弹
    if (x < BUBBLE_R) { x = BUBBLE_R; vx = Math.abs(vx); }
    else if (x > WORLD.WIDTH - BUBBLE_R) { x = WORLD.WIDTH - BUBBLE_R; vx = -Math.abs(vx); }

    // 触顶
    if (y <= TOP_Y + BUBBLE_R) {
      points.push({ x, y });
      return { points, landing: snapToCell(grid, parities, x, y), hitTop: true };
    }

    // 撞到泡泡
    for (let r = 0; r < grid.length; r += 1) {
      const row = grid[r];
      if (!row) continue;
      const pr = parityOf(parities, r);
      for (let c = 0; c < row.length; c += 1) {
        if (!row[c]) continue;
        const p = rowColToPos(pr, r, c);
        const ddx = x - p.x;
        const ddy = y - p.y;
        if (ddx * ddx + ddy * ddy <= BUBBLE_DIAM * BUBBLE_DIAM) {
          points.push({ x, y });
          return { points, landing: snapToCell(grid, parities, x, y), hitTop: false };
        }
      }
    }
    points.push({ x, y });
  }
  return { points, landing: snapToCell(grid, parities, x, y), hitTop: false };
}

/** 网格内非空泡泡总数 */
export function countBubbles(grid) {
  let n = 0;
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) if (row[c]) n += 1;
  }
  return n;
}

/** 是否有泡泡触底（中心 y ≥ deathY） */
export function anyTouchingDeathLine(grid, deathY) {
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      if (!row[c]) continue;
      if (rowY(r) >= deathY) return true;
    }
  }
  return false;
}
