// UNBLOCK CARS · 关卡生成 + 求解器（纯逻辑，零 DOM）
// 玩法：Rush-Hour 滑动拼图。6×6 网格，横向主车（hero）滑到右侧出口即通关。
// 车辆：H（横向，长度 2/3）/ V（纵向，长度 2/3），只能在各自车道上滑动，不能穿车/穿岩石。
// 关卡由 seed 确定性生成，用快速 BFS 求解器验证可解、记录最短步数（par）。
// 版权：只提取玩法规则，全部关卡数据为原创程序化生成，非参考源码数据。

export const COLS = 6;
export const ROWS = 6;
export const LEVEL_COUNT = 24;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellsOf(car) {
  const cells = [];
  for (let i = 0; i < car.len; i += 1) {
    if (car.o === 'H') cells.push([car.row, car.col + i]);
    else cells.push([car.row + i, car.col]);
  }
  return cells;
}

export function isSolved(cars) {
  const hero = cars.find((c) => c.hero);
  return hero.col + hero.len === COLS;
}

// ---------------- BFS 求解器（数组化编码，最快路径） ----------------

function slide(def, p, occ) {
  let lo = p;
  let hi = p;
  if (def.o === 'H') {
    while (lo - 1 >= 0 && !occ.has(`${def.fix},${lo - 1}`)) lo -= 1;
    while (hi + def.len < COLS && !occ.has(`${def.fix},${hi + def.len}`)) hi += 1;
  } else {
    while (lo - 1 >= 0 && !occ.has(`${lo - 1},${def.fix}`)) lo -= 1;
    while (hi + def.len < ROWS && !occ.has(`${hi + def.len},${def.fix}`)) hi += 1;
  }
  return [lo, hi];
}

function buildOcc(defs, pos, rockSet, excludeIdx) {
  const occ = new Set(rockSet);
  for (let i = 0; i < defs.length; i += 1) {
    if (i === excludeIdx) continue;
    const d = defs[i];
    for (let k = 0; k < d.len; k += 1) {
      if (d.o === 'H') occ.add(`${d.fix},${pos[i] + k}`);
      else occ.add(`${pos[i] + k},${d.fix}`);
    }
  }
  return occ;
}

export function solveCars(cars, rocks) {
  const defs = cars.slice().sort((a, b) => a.id - b.id).map((c) => ({
    id: c.id,
    o: c.o,
    len: c.len,
    fix: c.o === 'H' ? c.row : c.col,
    hero: !!c.hero,
  }));
  const heroIdx = defs.findIndex((d) => d.hero);
  const heroLen = defs[heroIdx].len;
  const start = cars.slice().sort((a, b) => a.id - b.id).map((c) => (c.o === 'H' ? c.col : c.row));
  const rockSet = new Set(rocks.map(([r, c]) => `${r},${c}`));

  const encode = (pos) => pos.join(',');
  const isGoal = (pos) => pos[heroIdx] + heroLen === COLS;

  const visited = new Set([encode(start)]);
  const queue = [{ pos: start, path: [] }];
  let expanded = 0;

  for (let head = 0; head < queue.length; head += 1) {
    const { pos, path } = queue[head];
    if (isGoal(pos)) return path;
    if (++expanded > 60000) break;

    for (let i = 0; i < defs.length; i += 1) {
      const d = defs[i];
      const occ = buildOcc(defs, pos, rockSet, i);
      const [lo, hi] = slide(d, pos[i], occ);
      for (let to = lo; to <= hi; to += 1) {
        if (to === pos[i]) continue;
        const npos = pos.slice();
        npos[i] = to;
        const key = encode(npos);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ pos: npos, path: [...path, { carId: d.id, to }] });
      }
    }
  }
  return null; // 不可解或超上限
}

// ---------------- 关卡生成 ----------------

function newElementFor(levelIndex) {
  const table = [
    '基础滑动：把主车滑到右侧出口',
    '纵向车辆加入（交叉堵塞）',
    '岩石障碍（不可移动）',
    '双岩石夹道',
    '连击计分 ×2 解锁',
    '限步上限收紧',
    '更多车辆（密集车流）',
    '三格长车加入',
    '提示道具 + 撤回连招',
    '横向车流',
    '岩石 + 长车组合',
    '高难限步',
    '四岩石围堵',
    '连击倍率上限 +1',
    '多车叠加规划',
    '长直走廊',
    '岩石矩阵',
    '限步极限',
    '复杂交叉',
    '岩石 + 长车 + 限步',
    '大师级车流',
    '极限围堵',
    '终极限步',
    '霓虹终点挑战',
  ];
  return table[Math.min(levelIndex, table.length - 1)];
}

const cache = new Map();

export function getLevel(levelIndex) {
  const i = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  if (cache.has(i)) return cache.get(i);

  let found = null;

  for (let attempt = 0; attempt < 60 && !found; attempt += 1) {
    const rng = mulberry32((i + 1) * 7919 + attempt * 131);
    const heroRow = i === 0 ? 2 : Math.floor(rng() * ROWS);
    const heroCol = Math.floor(rng() * (COLS - 3)); // 0..2，主车至少 2 步才能到出口
    const hero = { id: 0, o: 'H', len: 2, row: heroRow, col: heroCol, hero: true };

    const cars = [hero];
    const rocks = [];
    const occupied = new Set();
    for (const [r, c] of cellsOf(hero)) occupied.add(`${r},${c}`);

    const nBlockers = Math.min(3 + Math.floor(i / 2), 8);
    let ok = true;

    for (let b = 0; b < nBlockers; b += 1) {
      const placed = placeRandomCar(rng, occupied, cars.length);
      if (!placed) { ok = false; break; }
      cars.push(placed);
    }
    if (!ok) continue;

    // 岩石：从第 3 关开始出现，随关卡增多；确定性扫描保证数量，且避开主车行
    if (i >= 2) {
      const nRocks = Math.min(1 + Math.floor((i - 2) / 4), 4);
      let placedRocks = 0;
      for (let idx = 0; idx < ROWS * COLS && placedRocks < nRocks; idx += 1) {
        const r = (idx * 7 + 3) % ROWS;
        const c = (idx * 5 + 2) % COLS;
        if (r === heroRow) continue;
        const k = `${r},${c}`;
        if (occupied.has(k)) continue;
        rocks.push([r, c]);
        occupied.add(k);
        placedRocks += 1;
      }
    }

    const solution = solveCars(cars, rocks);
    if (!solution || solution.length < 3) continue;

    const minMoves = solution.length;
    found = {
      index: i + 1,
      rows: ROWS,
      cols: COLS,
      heroRow,
      cars,
      rocks,
      par: minMoves,
      maxMoves: Math.max(minMoves * 3 + 12, 24),
      difficulty: Math.round((1 + i * 0.5) * 10) / 10,
      newElement: newElementFor(i),
      hasRocks: rocks.length > 0,
      solution,
    };
  }

  const level = found || {
    index: i + 1,
    rows: ROWS,
    cols: COLS,
    heroRow: 2,
    cars: [{ id: 0, o: 'H', len: 2, row: 2, col: 1, hero: true }],
    rocks: [],
    par: 3,
    maxMoves: 24,
    difficulty: 1,
    newElement: newElementFor(i),
    hasRocks: false,
    solution: [{ carId: 0, to: 2 }, { carId: 0, to: 3 }, { carId: 0, to: 4 }],
  };

  cache.set(i, level);
  return level;
}

function placeRandomCar(rng, occupied, id) {
  const o = rng() < 0.55 ? 'H' : 'V';
  const len = rng() < 0.68 ? 2 : 3;
  for (let t = 0; t < 120; t += 1) {
    if (o === 'H') {
      const row = Math.floor(rng() * ROWS);
      const col = Math.floor(rng() * (COLS - len + 1));
      if (freeRun(occupied, o, row, col, len)) {
        mark(occupied, o, row, col, len);
        return { id, o, len, row, col, hero: false };
      }
    } else {
      const row = Math.floor(rng() * (ROWS - len + 1));
      const col = Math.floor(rng() * COLS);
      if (freeRun(occupied, o, row, col, len)) {
        mark(occupied, o, row, col, len);
        return { id, o, len, row, col, hero: false };
      }
    }
  }
  return null;
}

function freeRun(occ, o, row, col, len) {
  for (let i = 0; i < len; i += 1) {
    const k = o === 'H' ? `${row},${col + i}` : `${row + i},${col}`;
    if (occ.has(k)) return false;
  }
  return true;
}

function mark(occ, o, row, col, len) {
  for (let i = 0; i < len; i += 1) {
    const k = o === 'H' ? `${row},${col + i}` : `${row + i},${col}`;
    occ.add(k);
  }
}
