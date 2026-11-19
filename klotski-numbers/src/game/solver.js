// KLOTSKI NUMBERS · 求解器（纯逻辑，供自对弈/验收测试使用，不进运行期玩法路径）
// solveBoard：IDA*（曼哈顿 + 线性冲突），可靠解 3×3 / 4×4；更大盘返回 null。
// bestMoveIndex：贪心最佳单步（枚举空位同行/列，取启发式最低者），供 5×5+ 兜底。
// applySlide / heuristic：与 sim.move 完全一致的滑动语义，便于离屏复现。

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function heuristic(arr, n) {
  const L = n * n;
  const rowOf = (i) => (i / n) | 0;
  const colOf = (i) => i % n;
  let s = 0;
  for (let i = 0; i < L; i += 1) {
    const v = arr[i];
    if (v === 0) continue;
    const g = v - 1;
    s += Math.abs(rowOf(i) - rowOf(g)) + Math.abs(colOf(i) - colOf(g));
  }
  // 线性冲突：同行/同列内目标同排却逆序的块，每对 +2（比曼哈顿更紧的合法下界）
  for (let r = 0; r < n; r += 1) {
    const tiles = [];
    for (let c = 0; c < n; c += 1) {
      const v = arr[r * n + c];
      if (v !== 0 && rowOf(v - 1) === r) tiles.push(v);
    }
    for (let a = 0; a < tiles.length; a += 1) {
      for (let b = a + 1; b < tiles.length; b += 1) {
        if (colOf(tiles[a] - 1) > colOf(tiles[b] - 1)) s += 2;
      }
    }
  }
  for (let c = 0; c < n; c += 1) {
    const tiles = [];
    for (let r = 0; r < n; r += 1) {
      const v = arr[r * n + c];
      if (v !== 0 && colOf(v - 1) === c) tiles.push(v);
    }
    for (let a = 0; a < tiles.length; a += 1) {
      for (let b = a + 1; b < tiles.length; b += 1) {
        if (rowOf(tiles[a] - 1) > rowOf(tiles[b] - 1)) s += 2;
      }
    }
  }
  return s;
}

export function applySlide(cells, n, blank, t) {
  const step = (Math.floor(t / n) === Math.floor(blank / n)) ? 1 : n;
  if (t < blank) {
    for (let cur = blank; cur > t; cur -= step) cells[cur] = cells[cur - step];
  } else {
    for (let cur = blank; cur < t; cur += step) cells[cur] = cells[cur + step];
  }
  cells[t] = 0;
  return t;
}

export function bestMoveIndex(cells, n) {
  const L = n * n;
  const blank = cells.indexOf(0);
  let best = -1;
  let bestH = Infinity;
  for (let t = 0; t < L; t += 1) {
    if (t === blank) continue;
    if (Math.floor(t / n) !== Math.floor(blank / n) && (t % n) !== (blank % n)) continue;
    const copy = cells.slice();
    applySlide(copy, n, blank, t);
    const h = heuristic(copy, n);
    if (h < bestH) { bestH = h; best = t; }
  }
  return best;
}

export function solveBoard(cells, n, opts = {}) {
  if (n > 4) return null; // IDA* 仅可靠覆盖 3×3/4×4
  const L = n * n;
  const maxNodes = opts.maxNodes ?? 3000000;
  const arr = cells.slice();
  const blank = arr.indexOf(0);
  const path = [];
  let nodes = 0;
  const FOUND = -1;

  function dfs(g, blankPos, prevBlank, bound) {
    nodes += 1;
    if (nodes > maxNodes) return Infinity;
    const hh = heuristic(arr, n);
    const f = g + hh;
    if (f > bound) return f;
    if (hh === 0) return FOUND;
    let min = Infinity;
    const r0 = (blankPos / n) | 0;
    const c0 = blankPos % n;
    for (const [dr, dc] of DIRS) {
      const nr = r0 + dr;
      const nc = c0 + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const ni = nr * n + nc;
      if (ni === prevBlank) continue;
      arr[blankPos] = arr[ni];
      arr[ni] = 0;
      path.push(ni);
      const res = dfs(g + 1, ni, blankPos, bound);
      if (res === FOUND) return FOUND;
      if (res < min) min = res;
      path.pop();
      arr[ni] = arr[blankPos];
      arr[blankPos] = 0;
    }
    return min;
  }

  let bound = heuristic(arr, n);
  for (;;) {
    const res = dfs(0, blank, -1, bound);
    if (res === FOUND) return path.slice();
    if (res === Infinity) return null;
    bound = res;
  }
}
