// 关卡数据 + 霓虹符号调色板（程序化绘制，无图片素材）
// 记忆翻牌：每关 symbols 去重，每个符号出现 groupOf 次（2 = 一对 / 3 = 一组）。
// grid 单元格数必须 === symbols.length * groupOf。

export const SYMBOLS = [
  { id: 'sun',     color: '#ffd94a' },
  { id: 'moon',    color: '#8fd3ff' },
  { id: 'star',    color: '#ff9d5c' },
  { id: 'bolt',    color: '#ffe14a' },
  { id: 'diamond', color: '#7cf7e6' },
  { id: 'hex',     color: '#b08bff' },
  { id: 'ring',    color: '#ff7ac8' },
  { id: 'tri',     color: '#7dff9b' },
  { id: 'square',  color: '#ff6b6b' },
  { id: 'heart',   color: '#ff5c8a' },
  { id: 'drop',    color: '#6fd0ff' },
  { id: 'spiral',  color: '#c8ff6b' },
  { id: 'eye',     color: '#9fe8ff' },
  { id: 'crown',   color: '#ffd06b' },
  { id: 'leaf',    color: '#8affc1' },
  { id: 'wave',    color: '#7ab8ff' },
  { id: 'gear',    color: '#d9d9ff' },
  { id: 'key',     color: '#ffc46b' },
  { id: 'bell',    color: '#ffe08a' },
  { id: 'flame',   color: '#ff8a5c' },
  { id: 'snow',    color: '#c8f4ff' },
  { id: 'paw',     color: '#ffb0d9' },
  { id: 'clover',  color: '#7dffa6' },
  { id: 'arrow',   color: '#a6ff8a' },
];

const ids = SYMBOLS.map((s) => s.id);
const P = (a, b) => ids.slice(a, b);

// [col, row, groupOf, symbols]
const RAW = [
  [3, 4, 2, P(0, 6)],
  [3, 4, 2, P(6, 12)],
  [3, 4, 2, P(12, 18)],
  [4, 4, 2, P(0, 8)],
  [4, 4, 2, P(8, 16)],
  [4, 4, 2, P(16, 24)],
  [4, 5, 2, P(0, 10)],
  [4, 5, 2, P(10, 20)],
  [4, 6, 2, P(0, 12)],
  [4, 6, 2, P(12, 24)],
  [4, 3, 3, P(0, 4)],
  [4, 3, 3, P(4, 8)],
  [4, 3, 3, P(8, 12)],
  [5, 3, 3, P(0, 5)],
  [5, 3, 3, P(5, 10)],
  [5, 3, 3, P(10, 15)],
  [6, 3, 3, P(0, 6)],
  [6, 3, 3, P(6, 12)],
  [6, 4, 3, P(0, 8)],
  [6, 4, 3, P(8, 16)],
];

export const LEVELS = RAW.map(([col, row, groupOf, symbols], i) => ({
  index: i,
  grid: { col, row },
  groupOf,
  symbols,
  memorizeTime: 5,
}));

export const LEVEL_COUNT = LEVELS.length;

export const MODES = [
  { key: 'timed', timed: true },
  { key: 'practice', timed: false },
];

export function symbolById(id) {
  return SYMBOLS.find((s) => s.id === id) || { id, color: '#ffffff' };
}
