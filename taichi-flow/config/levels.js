// TAICHI FLOW · 关卡定义（纯数据 + 确定性构建）
// 主题：阴阳流转。核心规则（源自参考玩法的 P0）：
//   7x7 网格，点一个格子会互换它的左右邻居，再互换它的上下邻居；被点的格子本身不变。
//   目标：让所有「阴」格（target）回到指定位置。
// 新机制：
//   - rock（锁石）：固定色块，不可点、不可换，是障碍地形。
//   - par + 星级：par 步内 = 3 星，par+2 内 = 2 星，通关 = 1 星；超 maxMoves 判负。
//   - combo（连击）：一次点击 ≥2 个新匹配即连击，叠加计分。
//
// 关卡由「目标图案」确定性打乱构造：从完成态出发打乱 par 步，因此每关必然可解
// （解法 = 逆向回放打乱序列，恰好 par 步）。打乱序列写入 level.scramble，供贪心 bot 与
// 验收 autoSolve 使用。
//
// 图案字符：'#' = 目标阴格（可动）  '.' = 阳格（可动）  'o' = 阴锁石  'x' = 阳锁石

export const SIZE = 7;

const PATTERNS = [
  {
    name: { en: 'Seed', zh: '初醒' },
    par: 5,
    rows: [
      '.......',
      '.......',
      '...#...',
      '..###..',
      '...#...',
      '.......',
      '.......',
    ],
  },
  {
    name: { en: 'Block', zh: '方寸' },
    par: 6,
    rows: [
      '.......',
      '..###..',
      '..###..',
      '..###..',
      '.......',
      '.......',
      '.......',
    ],
  },
  {
    name: { en: 'Stream', zh: '溪流' },
    par: 7,
    rows: [
      '.......',
      '.#####.',
      '.......',
      '..o.x..',
      '.......',
      '.......',
      '.......',
    ],
  },
  {
    name: { en: 'Pillar', zh: '立柱' },
    par: 8,
    rows: [
      '...x...',
      '....#..',
      '....#..',
      '....#..',
      '....#..',
      '....#..',
      '...o...',
    ],
  },
  {
    name: { en: 'Cross', zh: '十字' },
    par: 8,
    rows: [
      'x.....x',
      '...#...',
      '...#...',
      '..###..',
      '...#...',
      '...#...',
      'x.....x',
    ],
  },
  {
    name: { en: 'Slash', zh: '斜切' },
    par: 9,
    rows: [
      '#......',
      '.#.....',
      '..#....',
      '...#...',
      '....#..',
      '.....#.',
      '......#',
    ],
  },
  {
    name: { en: 'Ring', zh: '环' },
    par: 10,
    rows: [
      '.#####.',
      '#.....#',
      '#..#..#',
      '#.....#',
      '#.....#',
      '.#####.',
      '.......',
    ],
  },
  {
    name: { en: 'Mountain', zh: '山形' },
    par: 10,
    rows: [
      '...#...',
      '..###..',
      '.#####.',
      '#######',
      '.......',
      '.......',
      '.......',
    ],
  },
  {
    name: { en: 'Heart', zh: '心意' },
    par: 11,
    rows: [
      '.##.##.',
      '#######',
      '#######',
      '.#####.',
      '..###..',
      '...#...',
      '.......',
    ],
  },
  {
    name: { en: 'Taiji', zh: '太极' },
    par: 12,
    rows: [
      '###..x.',
      '###....',
      '###....',
      '###....',
      '###....',
      '###....',
      '###..o.',
    ],
  },
  {
    name: { en: 'Windows', zh: '窗' },
    par: 12,
    rows: [
      '##..##.',
      '##..##.',
      '.......',
      '##..##.',
      '##..##.',
      '.......',
      '.......',
    ],
  },
  {
    name: { en: 'Cosmos', zh: '星辰' },
    par: 13,
    rows: [
      '#..x..#',
      '.#...#.',
      '..###..',
      '#.###.#',
      '..###..',
      '.#...#.',
      '#..x..#',
    ],
  },
];

// ---- 可复现随机（与 sim 一致，纯函数）----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 格子 / 棋盘 ----
export function makeCell(color, movable) {
  return { color, movable, matched: false, flash: 0 };
}

export function makeBoard(level) {
  const cells = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    cells.push(makeCell('yang', true));
  }
  for (const i of level.target) cells[i].color = 'yin';
  for (const r of level.rocks) {
    cells[r.i] = makeCell(r.color, false);
  }
  return cells;
}

// 一次「点格」：互换左右邻居 + 上下邻居（两端/锁石不成对则不换）。
// 返回实际完成互换的对数（0/1/2）。纯函数，直接改 board。
export function applySwap(board, j) {
  const rows = SIZE;
  const cols = SIZE;
  const movable = (i) => i >= 0 && i < SIZE * SIZE && board[i].movable;
  let swaps = 0;

  // 左右邻居
  const left = (j % cols === 0) ? -1 : j - 1;
  const right = ((j + 1) % cols === 0) ? -1 : j + 1;
  if (movable(left) && movable(right)) {
    const a = board[left];
    const b = board[right];
    const tmpColor = a.color;
    a.color = b.color;
    b.color = tmpColor;
    swaps += 1;
  }

  // 上下邻居
  const top = j - cols;
  const bottom = j + cols;
  if (movable(top) && movable(bottom)) {
    const a = board[top];
    const b = board[bottom];
    const tmpColor = a.color;
    a.color = b.color;
    b.color = tmpColor;
    swaps += 1;
  }

  return swaps;
}

function parseRows(rows) {
  const target = [];
  const rocks = [];
  for (let r = 0; r < rows.length; r += 1) {
    const line = rows[r];
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c];
      const i = r * SIZE + c;
      if (ch === '#') target.push(i);
      else if (ch === 'o') rocks.push({ i, color: 'yin' });
      else if (ch === 'x') rocks.push({ i, color: 'yang' });
    }
  }
  return { target, rocks };
}

function buildScramble(board, depth, seed) {
  const rng = mulberry32(seed);
  const scramble = [];
  const used = new Set();
  let guard = depth * 200;
  while (scramble.length < depth && guard-- > 0) {
    const j = Math.floor(rng() * SIZE * SIZE);
    if (!board[j].movable || used.has(j)) continue;
    const before = board.map((c) => c.color);
    if (applySwap(board, j) === 0) continue;
    // 只记录「真正改变颜色」的换邻（避免同色换位成为视觉空步）
    let changed = false;
    for (let k = 0; k < board.length; k += 1) {
      if (board[k].color !== before[k]) { changed = true; break; }
    }
    if (!changed) {
      applySwap(board, j); // 自逆，回退空步
      continue;
    }
    scramble.push(j);
    used.add(j);
  }
  // 极端情况兜底：若可动格太少导致凑不满，退化为可用的首格序列
  if (scramble.length < depth) {
    for (let j = 0; j < SIZE * SIZE && scramble.length < depth; j += 1) {
      if (board[j].movable && !used.has(j)) {
        const before = board.map((c) => c.color);
        if (applySwap(board, j) === 0) continue;
        let changed = false;
        for (let k = 0; k < board.length; k += 1) {
          if (board[k].color !== before[k]) { changed = true; break; }
        }
        if (!changed) { applySwap(board, j); continue; }
        scramble.push(j);
        used.add(j);
      }
    }
  }
  return scramble;
}

export function buildLevels() {
  return PATTERNS.map((p, idx) => {
    const { target, rocks } = parseRows(p.rows);
    const level = {
      index: idx + 1,
      size: SIZE,
      name: p.name,
      par: p.par,
      target,
      rocks,
      targetCount: target.length,
      maxMoves: p.par * 4 + 6,
      scramble: [],
      board: null,
    };
    // 从完成态开始打乱（先建完成态棋盘）
    const solved = makeBoard(level);
    level.scramble = buildScramble(solved, p.par, 9000 + idx * 7919);
    level.board = solved; // 已是打乱后的初始态
    return level;
  });
}

export const LEVELS = buildLevels();
export const LEVEL_COUNT = LEVELS.length;
