// 关卡数据（纯数据，sim 解析成可查询网格）。
// 坐标约定：row 0 = 顶部，row 13 = 底部地面行；col 从左到右。
// 字符：'#' 实心  'B' 可顶破的箱子  '^' 尖刺  'R' 落岩  'o' 金币  '*' 星星
//       'm' 磁铁  's' 护盾  'F' 终点旗  'P' 出生点  '.' 空
import { LAYOUT } from './game.config.js';

const ROWS = 14;

function build(def) {
  const cols = def.cols;
  const grid = [];
  for (let r = 0; r < ROWS; r += 1) grid.push(new Array(cols).fill('.'));

  const solid = new Set();
  const spikes = new Set();
  const rocks = new Set();
  const boxes = [];
  const coins = [];
  const stars = [];
  const powerups = [];
  const monsters = [];
  let playerStart = null;
  let flag = null;

  const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < cols;
  const put = (r, c, ch) => { if (inBounds(r, c)) grid[r][c] = ch; };

  // 地面：def.ground 字符串，'#' 实心，'.' 坑
  for (let c = 0; c < cols; c += 1) {
    const ch = def.ground[c] || '.';
    if (ch === '#') { put(ROWS - 1, c, '#'); solid.add(`${ROWS - 1},${c}`); }
  }

  // 悬浮平台
  for (const [r, c, len] of def.platforms || []) {
    for (let i = 0; i < len; i += 1) {
      if (inBounds(r, c + i)) { put(r, c + i, '#'); solid.add(`${r},${c + i}`); }
    }
  }

  // 箱子（可顶破，含 1–3 枚金币，seed 由坐标派生，保证确定性）
  for (const [r, c] of def.boxes || []) {
    put(r, c, 'B');
    boxes.push({ r, c, coins: 1 + ((c * 7 + r * 13) % 3), id: `box-${r}-${c}` });
  }

  // 尖刺 / 落岩（致命，不可站）
  for (const [r, c] of def.spikes || []) { put(r, c, '^'); spikes.add(`${r},${c}`); }
  for (const [r, c] of def.rocks || []) { put(r, c, 'R'); rocks.add(`${r},${c}`); }

  // 金币 / 星星 / 道具
  for (const [r, c] of def.coins || []) { put(r, c, 'o'); coins.push({ r, c, id: `coin-${r}-${c}` }); }
  for (const [r, c] of def.stars || []) { put(r, c, '*'); stars.push({ r, c, id: `star-${r}-${c}` }); }
  for (const p of def.powerups || []) {
    put(p.r, p.c, p.kind === 'magnet' ? 'm' : 's');
    powerups.push({ r: p.r, c: p.c, kind: p.kind, id: `${p.kind}-${p.r}-${p.c}` });
  }

  // 怪物：从 c 向右巡逻 range 格再折返
  for (const m of def.monsters || []) {
    put(m.r, m.c, 'M');
    monsters.push({ c: m.c, r: m.r, range: m.range, id: `mon-${m.r}-${m.c}` });
  }

  // 终点旗与出生点
  if (def.flagR != null && def.flagCol != null) {
    put(def.flagR, def.flagCol, 'F');
    flag = { c: def.flagCol, r: def.flagR };
  }
  if (def.startR != null && def.startCol != null) {
    put(def.startR, def.startCol, 'P');
    playerStart = { c: def.startCol, r: def.startR };
  }

  return {
    name: def.name,
    cols,
    rows: ROWS,
    grid,
    solid,
    spikes,
    rocks,
    boxes,
    coins,
    stars,
    powerups,
    monsters,
    flag,
    playerStart,
    // 地面行顶部 y（sim 用）
    groundY: (ROWS - 1) * LAYOUT.TILE,
  };
}

// 三关：每关一个新元素（L1 金币箱 / L2 尖刺踩敌 / L3 落岩道具）
export const LEVELS = [
  build({
    name: { en: 'Neon Meadow', zh: '霓虹草原' },
    cols: 70,
    ground: '#'.repeat(22) + '..' + '#'.repeat(17) + '...' + '#'.repeat(13) + '..' + '#'.repeat(11),
    platforms: [[9, 24, 3], [9, 46, 3]],
    boxes: [[9, 8], [9, 30], [9, 53]],
    spikes: [],
    rocks: [],
    coins: [
      [12, 5], [12, 7], [12, 10], [12, 13], [12, 16], [12, 19],
      [12, 25], [12, 28], [12, 31], [12, 34], [12, 37],
      [12, 45], [12, 49], [12, 52], [12, 55], [12, 60], [12, 63],
      [9, 15], [9, 17], [9, 40], [9, 57],
      [8, 24], [8, 25], [8, 26], [8, 46], [8, 47], [8, 48],
    ],
    stars: [[9, 33], [9, 50]],
    monsters: [{ c: 0, r: 12, range: 3 }, { c: 35, r: 12, range: 4 }],
    powerups: [{ r: 12, c: 14, kind: 'shield' }],
    flagR: 9,
    flagCol: 66,
    startR: 12,
    startCol: 2,
  }),

  build({
    name: { en: 'Spike Corridor', zh: '尖刺走廊' },
    cols: 70,
    ground: '#'.repeat(16) + '..' + '#'.repeat(20) + '...' + '#'.repeat(29),
    platforms: [],
    boxes: [[9, 14], [9, 45]],
    spikes: [[12, 8], [12, 9], [12, 31], [12, 32], [12, 50], [12, 51]],
    rocks: [],
    coins: [
      [12, 5], [12, 7], [12, 10], [12, 12], [12, 14], [12, 18],
      [12, 20], [12, 22], [12, 24], [12, 26], [12, 28], [12, 30],
      [12, 33], [12, 35], [12, 37], [12, 41], [12, 43], [12, 45],
      [12, 47], [12, 49], [12, 53], [12, 55], [12, 57], [12, 59],
      [12, 61], [12, 63], [12, 65],
      [9, 11], [9, 24], [9, 42], [9, 58],
    ],
    stars: [[9, 20], [9, 55]],
    monsters: [{ c: 22, r: 12, range: 2 }],
    powerups: [],
    flagR: 9,
    flagCol: 66,
    startR: 12,
    startCol: 2,
  }),

  build({
    name: { en: 'Rockfall Run', zh: '落岩跑道' },
    cols: 70,
    ground: '#'.repeat(22) + '..' + '#'.repeat(22) + '...' + '#'.repeat(21),
    platforms: [],
    boxes: [[9, 11], [9, 40]],
    spikes: [[12, 15], [12, 16]],
    rocks: [[11, 8], [12, 8], [11, 36], [12, 36], [11, 60], [12, 60]],
    coins: [
      [12, 5], [12, 7], [12, 9], [12, 11], [12, 13], [12, 18], [12, 20],
      [12, 24], [12, 26], [12, 28], [12, 30], [12, 32], [12, 34],
      [12, 38], [12, 41], [12, 43], [12, 49], [12, 51], [12, 53],
      [12, 55], [12, 57], [12, 62], [12, 64],
      [9, 25], [9, 44], [9, 58],
    ],
    stars: [[9, 33], [9, 52]],
    monsters: [{ c: 28, r: 12, range: 3 }, { c: 53, r: 12, range: 3 }],
    powerups: [{ r: 12, c: 13, kind: 'shield' }, { r: 12, c: 43, kind: 'magnet' }],
    flagR: 9,
    flagCol: 66,
    startR: 12,
    startCol: 2,
  }),
];

export const LEVEL_COUNT = LEVELS.length;
