// PLUMBER RUN · 12 关定义（每关 3 星：金币/时间/无伤）
// 关卡由「地面剖面 + 物体列表」构建成 16 行 × width 的网格。
// 图例：
//   . 空气   # 地面(不可破坏)   = 悬浮平台(不可破坏)
//   B 砖块(大/火力形态可顶碎)   ? 问号砖(顶出道具)   C 金币砖(顶出金币)
//   o 金币   E 管道怪兽(walker)   G 旗杆(过关)   P 出生点
//   S 蒸汽罐(充能)   M 扳手包(小→大)   F 蒸汽齿轮(大→火力)   ^ 尖刺(碰了掉命)
// 主题：1 晨市屋顶 / 2 下水道 / 3 夜工厂（每章 4 关）

export const ROWS = 16;
export const TILE = 45;

function buildLevel(def) {
  const width = def.width;
  const grid = Array.from({ length: ROWS }, () => Array(width).fill('.'));
  // 地面剖面（第 14、15 行为地面；'.' 表示坑）
  const ground = def.ground || '#'.repeat(width);
  for (let c = 0; c < width; c += 1) {
    const solid = ground[c] === '#';
    grid[14][c] = solid ? '#' : '.';
    grid[15][c] = solid ? '#' : '.';
  }
  for (const o of def.objects || []) {
    grid[o.r][o.c] = o.ch;
  }
  const rows = grid.map((r) => r.join(''));
  // 解析出生点 / 旗杆 / 敌人数 / 金币数
  let playerSpawn = { c: 2, r: 13 };
  let flag = null;
  let coinCount = 0;
  let enemyCount = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const ch = rows[r][c];
      if (ch === 'P') playerSpawn = { c, r };
      else if (ch === 'G') flag = { c, r };
      else if (ch === 'o') coinCount += 1;
      else if (ch === 'E') enemyCount += 1;
    }
  }
  return {
    index: def.index,
    name: def.name,
    theme: def.theme,
    width,
    height: ROWS,
    rows,
    playerSpawn,
    flag,
    coinCount,
    enemyCount,
    feature: def.feature || '',
  };
}

const L = (def) => buildLevel(def);

export const LEVELS = [
  // ============ 第一章 · 晨市屋顶（暖） ============
  L({
    index: 1, name: 'level.1', theme: 1, width: 110, feature: 'teach',
    ground: '#'.repeat(110),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 10, r: 12, ch: 'o' }, { c: 12, r: 12, ch: 'o' }, { c: 14, r: 11, ch: 'o' },
      { c: 20, r: 11, ch: '?' },
      { c: 26, r: 11, ch: 'B' }, { c: 27, r: 11, ch: 'B' },
      { c: 34, r: 13, ch: 'E' },
      { c: 40, r: 11, ch: 'C' },
      { c: 46, r: 12, ch: 'o' }, { c: 48, r: 11, ch: 'o' }, { c: 50, r: 12, ch: 'o' },
      { c: 56, r: 11, ch: '?' },
      { c: 62, r: 13, ch: 'E' },
      { c: 70, r: 12, ch: 'o' }, { c: 72, r: 12, ch: 'o' },
      { c: 78, r: 12, ch: 'M' },
      { c: 88, r: 12, ch: 'o' }, { c: 90, r: 11, ch: 'o' },
      { c: 100, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 2, name: 'level.2', theme: 1, width: 120, feature: 'steam',
    ground: '#'.repeat(120),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'S' },
      { c: 18, r: 12, ch: 'o' }, { c: 20, r: 12, ch: 'o' },
      { c: 26, r: 13, ch: 'E' },
      { c: 32, r: 11, ch: '?' },
      { c: 38, r: 11, ch: 'C' }, { c: 40, r: 11, ch: 'C' },
      { c: 46, r: 12, ch: 'S' },
      { c: 52, r: 13, ch: 'E' },
      { c: 58, r: 11, ch: 'B' }, { c: 59, r: 11, ch: 'B' }, { c: 60, r: 11, ch: 'B' },
      { c: 66, r: 12, ch: 'o' }, { c: 68, r: 11, ch: 'o' },
      { c: 74, r: 11, ch: '?' },
      { c: 82, r: 13, ch: 'E' },
      { c: 90, r: 12, ch: 'M' },
      { c: 98, r: 12, ch: 'o' }, { c: 100, r: 11, ch: 'o' },
      { c: 110, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 3, name: 'level.3', theme: 1, width: 130, feature: 'pit',
    ground: '#'.repeat(30) + '...' + '#'.repeat(97), // 一个 3 格坑
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 13, ch: 'E' },
      { c: 26, r: 11, ch: '?' },
      { c: 34, r: 12, ch: 'o' }, { c: 36, r: 11, ch: 'o' },
      { c: 44, r: 13, ch: 'E' },
      { c: 50, r: 11, ch: 'C' },
      { c: 56, r: 12, ch: 'S' },
      { c: 62, r: 13, ch: 'E' },
      { c: 70, r: 12, ch: 'o' }, { c: 72, r: 12, ch: 'o' },
      { c: 78, r: 11, ch: '?' },
      { c: 86, r: 11, ch: 'B' }, { c: 87, r: 11, ch: 'B' },
      { c: 96, r: 13, ch: 'E' },
      { c: 104, r: 12, ch: 'F' },
      { c: 112, r: 12, ch: 'o' }, { c: 114, r: 11, ch: 'o' },
      { c: 122, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 4, name: 'level.4', theme: 1, width: 140, feature: 'moving-platform',
    ground: '#'.repeat(24) + '...' + '#'.repeat(113),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 22, r: 13, ch: 'E' },
      { c: 30, r: 11, ch: '?' },
      { c: 36, r: 11, ch: 'C' }, { c: 38, r: 11, ch: 'C' },
      { c: 46, r: 13, ch: 'E' },
      { c: 52, r: 12, ch: 'S' },
      { c: 60, r: 12, ch: 'o' }, { c: 62, r: 11, ch: 'o' },
      { c: 68, r: 13, ch: 'E' },
      { c: 76, r: 11, ch: '?' },
      { c: 84, r: 11, ch: 'B' }, { c: 85, r: 11, ch: 'B' },
      { c: 92, r: 13, ch: 'E' },
      { c: 100, r: 12, ch: 'M' },
      { c: 108, r: 12, ch: 'o' }, { c: 110, r: 11, ch: 'o' },
      { c: 118, r: 13, ch: 'E' },
      { c: 126, r: 12, ch: 'S' },
      { c: 132, r: 13, ch: 'G' },
    ],
  }),

  // ============ 第二章 · 下水道（青绿） ============
  L({
    index: 5, name: 'level.5', theme: 2, width: 140, feature: 'pipe-gate',
    ground: '#'.repeat(20) + '...' + '#'.repeat(117),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 22, r: 13, ch: 'E' },
      { c: 28, r: 11, ch: '?' },
      { c: 34, r: 12, ch: 'S' },
      { c: 40, r: 12, ch: 'o' }, { c: 42, r: 11, ch: 'o' },
      { c: 48, r: 13, ch: 'E' },
      { c: 54, r: 11, ch: 'C' },
      { c: 60, r: 11, ch: '?' },
      { c: 66, r: 13, ch: 'E' },
      { c: 74, r: 12, ch: 'o' }, { c: 76, r: 11, ch: 'o' },
      { c: 82, r: 12, ch: 'S' },
      { c: 88, r: 13, ch: 'E' },
      { c: 94, r: 11, ch: 'B' }, { c: 95, r: 11, ch: 'B' },
      { c: 102, r: 12, ch: 'F' },
      { c: 110, r: 13, ch: 'E' },
      { c: 118, r: 12, ch: 'o' }, { c: 120, r: 11, ch: 'o' },
      { c: 132, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 6, name: 'level.6', theme: 2, width: 145, feature: 'water-current',
    ground: '#'.repeat(28) + '...' + '#'.repeat(114),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 12, ch: 'S' },
      { c: 26, r: 13, ch: 'E' },
      { c: 34, r: 11, ch: '?' },
      { c: 40, r: 11, ch: 'C' },
      { c: 46, r: 13, ch: 'E' },
      { c: 54, r: 12, ch: 'o' }, { c: 56, r: 11, ch: 'o' },
      { c: 62, r: 11, ch: '?' },
      { c: 70, r: 13, ch: 'E' },
      { c: 76, r: 12, ch: 'S' },
      { c: 82, r: 12, ch: 'o' }, { c: 84, r: 12, ch: 'o' },
      { c: 90, r: 13, ch: 'E' },
      { c: 96, r: 11, ch: 'B' }, { c: 97, r: 11, ch: 'B' },
      { c: 104, r: 12, ch: 'M' },
      { c: 112, r: 13, ch: 'E' },
      { c: 120, r: 12, ch: 'o' }, { c: 122, r: 11, ch: 'o' },
      { c: 134, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 7, name: 'level.7', theme: 2, width: 150, feature: 'dark',
    ground: '#'.repeat(22) + '..' + '#'.repeat(126),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 22, r: 13, ch: 'E' },
      { c: 28, r: 11, ch: '?' },
      { c: 36, r: 12, ch: 'S' },
      { c: 42, r: 13, ch: 'E' },
      { c: 48, r: 11, ch: 'C' },
      { c: 54, r: 12, ch: 'o' }, { c: 56, r: 11, ch: 'o' },
      { c: 62, r: 11, ch: '?' },
      { c: 68, r: 13, ch: 'E' },
      { c: 74, r: 12, ch: 'S' },
      { c: 80, r: 12, ch: 'o' }, { c: 82, r: 12, ch: 'o' },
      { c: 88, r: 13, ch: 'E' },
      { c: 94, r: 11, ch: 'B' }, { c: 95, r: 11, ch: 'B' },
      { c: 102, r: 12, ch: 'F' },
      { c: 110, r: 13, ch: 'E' },
      { c: 118, r: 12, ch: 'o' }, { c: 120, r: 11, ch: 'o' },
      { c: 128, r: 12, ch: 'S' },
      { c: 142, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 8, name: 'level.8', theme: 2, width: 155, feature: 'gauntlet',
    ground: '#'.repeat(26) + '...' + '#'.repeat(126),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 13, ch: 'E' },
      { c: 33, r: 11, ch: '?' },
      { c: 32, r: 12, ch: 'S' },
      { c: 38, r: 13, ch: 'E' },
      { c: 44, r: 11, ch: 'C' },
      { c: 50, r: 12, ch: 'o' }, { c: 52, r: 11, ch: 'o' },
      { c: 58, r: 13, ch: 'E' },
      { c: 64, r: 11, ch: '?' },
      { c: 72, r: 12, ch: 'S' },
      { c: 78, r: 13, ch: 'E' },
      { c: 84, r: 12, ch: 'o' }, { c: 86, r: 11, ch: 'o' },
      { c: 92, r: 11, ch: 'B' }, { c: 93, r: 11, ch: 'B' },
      { c: 100, r: 13, ch: 'E' },
      { c: 108, r: 12, ch: 'M' },
      { c: 116, r: 13, ch: 'E' },
      { c: 124, r: 12, ch: 'o' }, { c: 126, r: 11, ch: 'o' },
      { c: 146, r: 13, ch: 'G' },
    ],
  }),

  // ============ 第三章 · 夜工厂（靛红） ============
  L({
    index: 9, name: 'level.9', theme: 3, width: 150, feature: 'spikes',
    ground: '#'.repeat(30) + '...' + '#'.repeat(117),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 13, ch: 'E' },
      { c: 26, r: 11, ch: '?' },
      { c: 34, r: 13, ch: '^' }, { c: 35, r: 13, ch: '^' },
      { c: 42, r: 12, ch: 'S' },
      { c: 48, r: 13, ch: 'E' },
      { c: 54, r: 11, ch: 'C' },
      { c: 60, r: 12, ch: 'o' }, { c: 62, r: 11, ch: 'o' },
      { c: 68, r: 13, ch: 'E' },
      { c: 76, r: 13, ch: '^' }, { c: 77, r: 13, ch: '^' },
      { c: 84, r: 11, ch: '?' },
      { c: 92, r: 12, ch: 'S' },
      { c: 98, r: 13, ch: 'E' },
      { c: 104, r: 12, ch: 'o' }, { c: 106, r: 11, ch: 'o' },
      { c: 112, r: 13, ch: 'E' },
      { c: 120, r: 12, ch: 'F' },
      { c: 128, r: 13, ch: '^' }, { c: 129, r: 13, ch: '^' },
      { c: 142, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 10, name: 'level.10', theme: 3, width: 155, feature: 'combo',
    ground: '#'.repeat(24) + '...' + '#'.repeat(128),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 13, ch: 'E' },
      { c: 30, r: 11, ch: '?' },
      { c: 32, r: 12, ch: 'S' },
      { c: 40, r: 13, ch: 'E' },
      { c: 46, r: 11, ch: 'C' },
      { c: 52, r: 12, ch: 'o' }, { c: 54, r: 11, ch: 'o' },
      { c: 60, r: 13, ch: '^' }, { c: 61, r: 13, ch: '^' },
      { c: 68, r: 13, ch: 'E' },
      { c: 76, r: 11, ch: '?' },
      { c: 84, r: 12, ch: 'S' },
      { c: 90, r: 13, ch: 'E' },
      { c: 96, r: 12, ch: 'o' }, { c: 98, r: 11, ch: 'o' },
      { c: 104, r: 11, ch: 'B' }, { c: 105, r: 11, ch: 'B' },
      { c: 112, r: 13, ch: 'E' },
      { c: 120, r: 13, ch: '^' }, { c: 121, r: 13, ch: '^' },
      { c: 128, r: 12, ch: 'M' },
      { c: 136, r: 12, ch: 'o' }, { c: 138, r: 11, ch: 'o' },
      { c: 146, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 11, name: 'level.11', theme: 3, width: 160, feature: 'steam-gate',
    ground: '#'.repeat(20) + '...' + '#'.repeat(137),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 22, r: 13, ch: 'E' },
      { c: 28, r: 11, ch: '?' },
      { c: 34, r: 12, ch: 'S' },
      { c: 40, r: 13, ch: 'E' },
      { c: 46, r: 11, ch: 'C' },
      { c: 52, r: 12, ch: 'o' }, { c: 54, r: 11, ch: 'o' },
      { c: 60, r: 13, ch: '^' }, { c: 61, r: 13, ch: '^' },
      { c: 68, r: 13, ch: 'E' },
      { c: 74, r: 11, ch: '?' },
      { c: 82, r: 12, ch: 'S' },
      { c: 88, r: 13, ch: 'E' },
      { c: 94, r: 12, ch: 'o' }, { c: 96, r: 11, ch: 'o' },
      { c: 102, r: 11, ch: 'B' }, { c: 103, r: 11, ch: 'B' },
      { c: 110, r: 13, ch: 'E' },
      { c: 118, r: 12, ch: 'S' },
      { c: 124, r: 13, ch: '^' }, { c: 125, r: 13, ch: '^' },
      { c: 132, r: 12, ch: 'F' },
      { c: 140, r: 12, ch: 'o' }, { c: 142, r: 11, ch: 'o' },
      { c: 152, r: 13, ch: 'G' },
    ],
  }),
  L({
    index: 12, name: 'level.12', theme: 3, width: 170, feature: 'finale',
    ground: '#'.repeat(28) + '...' + '#'.repeat(139),
    objects: [
      { c: 3, r: 13, ch: 'P' },
      { c: 12, r: 12, ch: 'o' }, { c: 14, r: 12, ch: 'o' },
      { c: 20, r: 13, ch: 'E' },
      { c: 33, r: 11, ch: '?' },
      { c: 32, r: 12, ch: 'S' },
      { c: 38, r: 13, ch: 'E' },
      { c: 46, r: 13, ch: '^' }, { c: 47, r: 13, ch: '^' },
      { c: 54, r: 11, ch: 'C' },
      { c: 60, r: 12, ch: 'o' }, { c: 62, r: 11, ch: 'o' },
      { c: 68, r: 13, ch: 'E' },
      { c: 76, r: 11, ch: '?' },
      { c: 82, r: 12, ch: 'S' },
      { c: 90, r: 13, ch: 'E' },
      { c: 96, r: 12, ch: 'o' }, { c: 98, r: 11, ch: 'o' },
      { c: 104, r: 11, ch: 'B' }, { c: 105, r: 11, ch: 'B' },
      { c: 112, r: 13, ch: 'E' },
      { c: 118, r: 12, ch: 'S' },
      { c: 126, r: 13, ch: '^' }, { c: 127, r: 13, ch: '^' },
      { c: 134, r: 13, ch: 'E' },
      { c: 140, r: 12, ch: 'F' },
      { c: 148, r: 12, ch: 'o' }, { c: 150, r: 11, ch: 'o' },
      { c: 162, r: 13, ch: 'G' },
    ],
  }),
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[Math.min(LEVEL_COUNT - 1, Math.max(0, index - 1))];
}
