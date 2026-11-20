// Tile Vault · 关卡生成器 + 回溯求解器（纯逻辑，零 DOM/window/Date.now）
// 职责：从 config/levels.js 的参数生成宝库堆（等距 3D 堆叠的宝物），并用回溯求解器
//       证明「无道具可解」（存在一条拾取顺序：每步拿自由块、三同凑齐消除、槽永不溢出）。
// 可解性构造：同一层内每个品类出现整组三个（whole triples per layer），自顶向下逐层必可清。
// 求解器：贪心（优先凑三同）为主，失败退回带记忆化 + 节点预算的 DFS 回溯。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- 形状：返回每层（自底向上 y=0..）的 {x,z} 单元列表。每层数量必为 3 的倍数 ----

function pyramid(grid, layers) {
  const out = [];
  for (let h = 0; h < layers; h += 1) {
    const depth = grid.z - 2 * h;
    if (depth <= 0) break;
    const cells = [];
    for (let z = h; z < grid.z - h; z += 1) {
      for (let x = 0; x < grid.x; x += 1) cells.push({ x, z });
    }
    out.push(cells);
  }
  return out;
}

function wedge(grid, layers) {
  const out = [];
  for (let h = 0; h < layers; h += 1) {
    const depth = grid.z - h;
    if (depth <= 0) break;
    const cells = [];
    for (let z = h; z < grid.z; z += 1) {
      for (let x = 0; x < grid.x; x += 1) cells.push({ x, z });
    }
    out.push(cells);
  }
  return out;
}

function block(grid, layers) {
  const out = [];
  for (let h = 0; h < layers; h += 1) {
    const cells = [];
    for (let z = 0; z < grid.z; z += 1) {
      for (let x = 0; x < grid.x; x += 1) cells.push({ x, z });
    }
    out.push(cells);
  }
  return out;
}

function well(grid, layers) {
  // 底座 = 对称金字塔；顶部 = 中央 3 宽 × 2 深的深井柱
  const extra = Math.min(3, layers - 1);
  const base = pyramid(grid, Math.max(1, layers - extra));
  const cz0 = Math.floor((grid.z - 2) / 2);
  for (let k = 0; k < extra; k += 1) {
    const cells = [];
    const x0 = Math.max(1, Math.floor((grid.x - 3) / 2));
    for (let z = cz0; z < cz0 + 2; z += 1) {
      for (let x = x0; x < x0 + 3; x += 1) cells.push({ x, z });
    }
    base.push(cells);
  }
  return base;
}

function dual(grid, layers) {
  // 两座 3 宽独立宝山并排（gap 由 6 宽网格天然分成左右两半）
  const half = Math.floor(grid.x / 2);
  const out = [];
  for (let h = 0; h < layers; h += 1) {
    const depth = grid.z - 2 * h;
    if (depth <= 0) break;
    const cells = [];
    for (let z = h; z < grid.z - h; z += 1) {
      for (let x = 0; x < half; x += 1) cells.push({ x, z });
      for (let x = half; x < half * 2; x += 1) cells.push({ x, z });
    }
    out.push(cells);
  }
  return out;
}

const SHAPES = { pyramid, wedge, block, well, dual };

// ---- 生成 ----

/** 把 triples 个三同组均匀分到 types 个品类上（每类三同组数） */
function distributeTriples(types, triples, rng) {
  const counts = new Array(types).fill(Math.floor(triples / types));
  let rem = triples % types;
  // 把余数撒到随机互异的品类，避免挤在一起
  const idx = shuffle(Array.from({ length: types }, (_, i) => i), rng);
  for (let i = 0; rem > 0; i += 1, rem -= 1) counts[idx[i % types]] += 1;
  return counts;
}

/** 生成一关：返回 { tiles: [{id,type,x,z,y}], total, types }。每个品类数量都是 3 的倍数。 */
export function generateLevel(level) {
  const rng = mulberry32(level.seed);
  const layerCells = (SHAPES[level.shape] || pyramid)(level.grid, level.layers);
  const total = layerCells.reduce((s, c) => s + c.length, 0);
  if (total % 3 !== 0) throw new Error(`L${level.index} 总块数 ${total} 不是 3 的倍数`);

  const triples = total / 3;
  const typeCounts = distributeTriples(level.types, triples, rng);
  // 三同组池：typeCounts[t] 表示品类 t 出现多少次三同组
  const pool = [];
  for (let t = 0; t < typeCounts.length; t += 1) {
    for (let k = 0; k < typeCounts[t]; k += 1) pool.push(t);
  }
  shuffle(pool, rng);

  const tiles = [];
  let id = 0;
  let poolIdx = 0;
  for (let y = 0; y < layerCells.length; y += 1) {
    const cells = shuffle(layerCells[y].slice(), rng);
    const groups = cells.length / 3;
    for (let g = 0; g < groups; g += 1) {
      const type = pool[poolIdx++];
      for (let k = 0; k < 3; k += 1) {
        const cell = cells[g * 3 + k];
        tiles.push({ id: id++, type, x: cell.x, z: cell.z, y });
      }
    }
  }

  // 假锁：视觉误导——把一部分被压住的块标记为「锁样」（玩法不变，仍是普通被压块）
  if (level.fakeLock) {
    const above = new Set();
    for (const t of tiles) if (t.y > 0) above.add(`${t.x},${t.z},${t.y}`);
    let marked = 0;
    const want = Math.floor(tiles.length * 0.3);
    for (const t of tiles) {
      if (marked >= want) break;
      if (t.y > 0 && above.has(`${t.x},${t.z},${t.y}`)) {
        t.lockVisual = true;
        marked += 1;
      }
    }
  }

  return { tiles, total, types: level.types, layerCells };
}

// ---- 求解器 ----

function buildIndex(tiles) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const posToId = new Map(tiles.map((t) => [`${t.x},${t.z},${t.y}`, t.id]));
  return { byId, posToId };
}

/** 贪心求一条合法拾取顺序：返回 tile id 数组，或 null（贪心失败）。
 *  关键：严格自顶向下逐层拾取（每层内整组三同），与「整组三同 per 层」的构造一致，
 *  因此总是能找到解。 */
export function solveOrder(tiles, cap) {
  const { byId } = buildIndex(tiles);
  const remaining = new Set(tiles.map((t) => t.id));
  const remCount = new Map();
  const layerCount = new Map();
  for (const t of tiles) {
    remCount.set(t.type, (remCount.get(t.type) || 0) + 1);
    layerCount.set(t.y, (layerCount.get(t.y) || 0) + 1);
  }

  const tray = [];
  const trayCount = new Map();
  const order = [];

  while (remaining.size > 0) {
    // 当前最高层 = 唯一候选（严格逐层清空）
    let maxY = -Infinity;
    for (const y of layerCount.keys()) if (y > maxY) maxY = y;

    const free = [];
    for (const id of remaining) {
      const t = byId.get(id);
      if (t.y === maxY) free.push(t);
    }
    if (!free.length) return null;

    let pick = null;
    for (const t of free) if (trayCount.get(t.type) === 2) { pick = t; break; }
    if (!pick) for (const t of free) if (trayCount.get(t.type) === 1) { pick = t; break; }
    if (!pick) {
      let best = -1;
      for (const t of free) {
        const c = remCount.get(t.type) || 0;
        if (c > best) { best = c; pick = t; }
      }
    }

    const already = trayCount.get(pick.type) || 0;
    if (tray.length >= cap && already < 2) return null; // 会溢出 → 无解（贪心视角）

    tray.push(pick.type);
    trayCount.set(pick.type, already + 1);
    remaining.delete(pick.id);
    remCount.set(pick.type, (remCount.get(pick.type) || 1) - 1);
    const lc = layerCount.get(pick.y) - 1;
    if (lc <= 0) layerCount.delete(pick.y); else layerCount.set(pick.y, lc);
    order.push(pick.id);

    if (trayCount.get(pick.type) >= 3) {
      let removed = 0;
      const next = [];
      for (const ty of tray) {
        if (ty === pick.type && removed < 3) removed += 1;
        else next.push(ty);
      }
      tray.length = 0;
      tray.push(...next);
      const left = trayCount.get(pick.type) - 3;
      if (left <= 0) trayCount.delete(pick.type);
      else trayCount.set(pick.type, left);
    }
  }
  return order;
}

/** 回溯 DFS（记忆化 + 节点预算）：证明是否存在合法拾取顺序。 */
function dfsSolvable(tiles, cap) {
  const { byId, posToId } = buildIndex(tiles);
  let budget = 200000;

  function key(remaining, trayCount) {
    const ids = [];
    for (const id of remaining) ids.push(id);
    ids.sort((a, b) => a - b);
    const tray = [];
    for (const [ty, c] of trayCount) if (c > 0) tray.push(`${ty}x${c}`);
    tray.sort();
    return `${ids.join(',')}|${tray.join(',')}`;
  }

  const memo = new Map();

  function search(remaining, trayCount, trayLen) {
    if (remaining.size === 0) return true;
    const k = key(remaining, trayCount);
    if (memo.has(k)) return memo.get(k);
    if (budget-- <= 0) return false;

    const free = [];
    for (const id of remaining) {
      const t = byId.get(id);
      if (!posToId.has(`${t.x},${t.z},${t.y + 1}`)) free.push(t);
    }
    if (!free.length) { memo.set(k, false); return false; }

    // 优先能凑三同的、再是扩展已有品类的、再是其他
    free.sort((a, b) => {
      const ca = trayCount.get(a.type) || 0;
      const cb = trayCount.get(b.type) || 0;
      return cb - ca;
    });

    for (const t of free) {
      const c = trayCount.get(t.type) || 0;
      if (trayLen >= cap && c < 2) continue; // 溢出，剪枝

      remaining.delete(t.id);
      posToId.delete(`${t.x},${t.z},${t.y}`);
      trayCount.set(t.type, c + 1);
      let newLen = trayLen + 1;
      let revertTriple = false;
      if (trayCount.get(t.type) >= 3) {
        trayCount.set(t.type, c - 2); // c+1-3 = c-2
        if (trayCount.get(t.type) <= 0) trayCount.delete(t.type);
        newLen = trayLen - 2;
        revertTriple = true;
      }
      const ok = search(remaining, trayCount, newLen);
      // 回滚
      remaining.add(t.id);
      posToId.set(`${t.x},${t.z},${t.y}`, t.id);
      trayCount.set(t.type, c);
      if (trayCount.get(t.type) <= 0) trayCount.delete(t.type);
      if (ok) { memo.set(k, true); return true; }
    }
    memo.set(k, false);
    return false;
  }

  const remaining = new Set(tiles.map((t) => t.id));
  return search(remaining, new Map(), 0);
}

/** 是否有解：贪心优先，失败退回回溯 DFS。 */
export function isSolvable(tiles, cap) {
  if (solveOrder(tiles, cap) !== null) return true;
  return dfsSolvable(tiles, cap);
}
