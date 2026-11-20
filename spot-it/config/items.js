// config/items.js — 程序化物品库（≥40 种，Canvas 图形组合，零外部素材）。
//
// 每个物品 = 一组图形原语（shape），坐标以 item.s 为单位（s = 半尺寸，渲染时乘 s）。
// shape 类型：
//   { k:'c', x, y, r, f(ill), s(troke), w(idth) }                      圆
//   { k:'e', x, y, rx, ry, f, s, w, rot }                              椭圆
//   { k:'r', x, y, w, h, f, s, w, rot, rx }                            居中矩形（rx=圆角半径）
//   { k:'p', pts:[[x,y],...], f, s, w }                                多边形（闭合）
//   { k:'l', x1,y1,x2,y2, s(troke), w }                                线段
//   { k:'a', x, y, r, a0, a1, s(troke), w }                            圆弧（描边）
//
// 真假孪生（诱饵）：带 `a:1` 的 shape 是「唯一细节」。诱饵（variant=1）渲染时**省略**该 shape，
// 其余一模一样——玩家必须核对细节才能区分（见 src/render/items.js drawItem）。
// 单测：tests/items.test.mjs 校验 ①≥40 种 ②每个 id 唯一 ③每个物品至少 1 个 accent shape（孪生可判定）。
//
// 分类：animals 动物 / vehicles 交通工具 / time 时间 / stationery 文具 /
//       plants 植物 / kitchen 器皿 / toys 玩具 / tools 工具

const OUT = '#241d14'; // 统一深描边
const PAPER = '#f1e2bf';
const METAL = '#b7c0c8';
const WOOD = '#8a5a32';

export const CATEGORIES = {
  animals: '动物',
  vehicles: '交通工具',
  time: '时间',
  stationery: '文具',
  plants: '植物',
  kitchen: '器皿',
  toys: '玩具',
  tools: '工具',
};

export const ITEMS = [
  // ------------------------------ animals ------------------------------
  { id: 'cat', en: 'Cat', zh: '猫', cat: 'animals', s: 26, shapes: [
    { k: 'c', x: 0, y: 0.12, r: 0.78, f: '#7b8ea3', s: OUT, w: 0.07 },
    { k: 'p', pts: [[-0.7, -0.5], [-0.55, -1.05], [-0.18, -0.55]], f: '#7b8ea3', s: OUT, w: 0.06, a: 1 },
    { k: 'p', pts: [[0.7, -0.5], [0.55, -1.05], [0.18, -0.55]], f: '#7b8ea3', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.32, y: 0.02, r: 0.09, f: '#3a2f22' },
    { k: 'c', x: 0.32, y: 0.02, r: 0.09, f: '#3a2f22' },
    { k: 'l', x1: -0.12, y1: 0.34, x2: 0.12, y2: 0.34, s: '#3a2f22', w: 0.05 },
  ] },
  { id: 'fish', en: 'Fish', zh: '鱼', cat: 'animals', s: 26, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.95, ry: 0.55, f: '#e8904a', s: OUT, w: 0.07 },
    { k: 'p', pts: [[0.9, 0], [1.35, -0.5], [1.35, 0.5]], f: '#e8904a', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.55, y: -0.12, r: 0.1, f: '#241d14' },
  ] },
  { id: 'bird', en: 'Bird', zh: '鸟', cat: 'animals', s: 26, shapes: [
    { k: 'e', x: 0, y: 0.1, rx: 0.7, ry: 0.62, f: '#e6c94a', s: OUT, w: 0.07 },
    { k: 'p', pts: [[0.28, -0.18], [0.72, -0.5], [0.4, 0.08]], f: '#e8a23c', s: OUT, w: 0.05, a: 1 },
    { k: 'c', x: -0.32, y: -0.02, r: 0.1, f: '#241d14' },
    { k: 'l', x1: -0.42, y1: 0.52, x2: -0.2, y2: 0.72, s: '#e8a23c', w: 0.07 },
  ] },
  { id: 'rabbit', en: 'Rabbit', zh: '兔子', cat: 'animals', s: 26, shapes: [
    { k: 'e', x: 0, y: 0.18, rx: 0.62, ry: 0.68, f: '#e8e0d2', s: OUT, w: 0.07 },
    { k: 'e', x: -0.3, y: -0.95, rx: 0.16, ry: 0.42, f: '#e8e0d2', s: OUT, w: 0.06, a: 1 },
    { k: 'e', x: 0.3, y: -0.95, rx: 0.16, ry: 0.42, f: '#e8e0d2', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.2, y: 0.02, r: 0.09, f: '#241d14' },
    { k: 'c', x: 0.2, y: 0.02, r: 0.09, f: '#241d14' },
  ] },
  { id: 'bear', en: 'Bear', zh: '熊', cat: 'animals', s: 28, shapes: [
    { k: 'c', x: 0, y: 0.02, r: 0.8, f: '#9a6b3f', s: OUT, w: 0.07 },
    { k: 'c', x: -0.5, y: -0.62, r: 0.22, f: '#9a6b3f', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: 0.5, y: -0.62, r: 0.22, f: '#9a6b3f', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.28, y: -0.1, r: 0.09, f: '#241d14' },
    { k: 'c', x: 0.28, y: -0.1, r: 0.09, f: '#241d14' },
    { k: 'c', x: 0, y: 0.32, r: 0.14, f: '#c9a06a' },
  ] },
  { id: 'turtle', en: 'Turtle', zh: '乌龟', cat: 'animals', s: 27, shapes: [
    { k: 'e', x: 0, y: 0.05, rx: 0.85, ry: 0.6, f: '#5a9a52', s: OUT, w: 0.07 },
    { k: 'c', x: 0.78, y: 0.05, r: 0.22, f: '#7ab068', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.32, y: 0.0, r: 0.1, f: '#241d14' },
    { k: 'p', pts: [[-0.5, 0.55], [-0.35, 0.75], [-0.15, 0.6]], f: '#7ab068', s: OUT, w: 0.05 },
  ] },
  { id: 'crab', en: 'Crab', zh: '螃蟹', cat: 'animals', s: 27, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.8, ry: 0.55, f: '#d8483f', s: OUT, w: 0.07 },
    { k: 'l', x1: -0.75, y1: -0.25, x2: -1.2, y2: -0.5, s: '#d8483f', w: 0.09, a: 1 },
    { k: 'l', x1: 0.75, y1: -0.25, x2: 1.2, y2: -0.5, s: '#d8483f', w: 0.09, a: 1 },
    { k: 'c', x: -0.32, y: -0.12, r: 0.1, f: '#241d14' },
    { k: 'c', x: 0.32, y: -0.12, r: 0.1, f: '#241d14' },
  ] },
  { id: 'owl', en: 'Owl', zh: '猫头鹰', cat: 'animals', s: 26, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.7, ry: 0.8, f: '#8a6a45', s: OUT, w: 0.07 },
    { k: 'p', pts: [[-0.3, -0.6], [-0.12, -1.0], [0.0, -0.66]], f: '#8a6a45', s: OUT, w: 0.05, a: 1 },
    { k: 'p', pts: [[0.3, -0.6], [0.12, -1.0], [0.0, -0.66]], f: '#8a6a45', s: OUT, w: 0.05, a: 1 },
    { k: 'c', x: -0.22, y: -0.08, r: 0.18, f: '#f1e2bf' },
    { k: 'c', x: 0.22, y: -0.08, r: 0.18, f: '#f1e2bf' },
    { k: 'c', x: -0.22, y: -0.08, r: 0.07, f: '#241d14' },
    { k: 'c', x: 0.22, y: -0.08, r: 0.07, f: '#241d14' },
  ] },

  // ------------------------------ vehicles ------------------------------
  { id: 'car', en: 'Toy Car', zh: '小车', cat: 'vehicles', s: 28, shapes: [
    { k: 'r', x: 0, y: -0.1, w: 1.7, h: 0.6, f: '#d8483f', s: OUT, w: 0.07, rx: 0.12 },
    { k: 'r', x: 0, y: -0.62, w: 0.9, h: 0.5, f: '#d8483f', s: OUT, w: 0.07, rx: 0.1, a: 1 },
    { k: 'c', x: -0.55, y: 0.3, r: 0.2, f: '#241d14' },
    { k: 'c', x: 0.55, y: 0.3, r: 0.2, f: '#241d14' },
  ] },
  { id: 'plane', en: 'Plane', zh: '飞机', cat: 'vehicles', s: 28, shapes: [
    { k: 'e', x: 0, y: 0, rx: 1.0, ry: 0.32, f: '#4a7bbf', s: OUT, w: 0.07 },
    { k: 'p', pts: [[-0.1, -0.3], [0.4, -1.0], [0.55, -0.18]], f: '#4a7bbf', s: OUT, w: 0.05, a: 1 },
    { k: 'p', pts: [[0.85, 0.05], [1.3, 0.3], [0.85, 0.35]], f: '#d8483f', s: OUT, w: 0.05 },
  ] },
  { id: 'bike', en: 'Bicycle', zh: '自行车', cat: 'vehicles', s: 28, shapes: [
    { k: 'a', x: -0.5, y: 0.3, r: 0.34, a0: 0, a1: 6.3, s: OUT, w: 0.07 },
    { k: 'a', x: 0.5, y: 0.3, r: 0.34, a0: 0, a1: 6.3, s: OUT, w: 0.07 },
    { k: 'l', x1: -0.5, y1: 0.3, x2: 0.0, y2: -0.4, s: OUT, w: 0.06, a: 1 },
    { k: 'l', x1: 0.0, y1: -0.4, x2: 0.5, y2: 0.3, s: OUT, w: 0.06 },
  ] },
  { id: 'bus', en: 'Bus', zh: '巴士', cat: 'vehicles', s: 28, shapes: [
    { k: 'r', x: 0, y: -0.1, w: 1.8, h: 0.7, f: '#e8c94a', s: OUT, w: 0.07, rx: 0.1 },
    { k: 'r', x: -0.4, y: -0.05, w: 0.3, h: 0.3, f: '#8fc3e8', s: OUT, w: 0.05, a: 1 },
    { k: 'r', x: 0.05, y: -0.05, w: 0.3, h: 0.3, f: '#8fc3e8', s: OUT, w: 0.05 },
    { k: 'c', x: -0.6, y: 0.35, r: 0.2, f: '#241d14' },
    { k: 'c', x: 0.6, y: 0.35, r: 0.2, f: '#241d14' },
  ] },
  { id: 'rocket', en: 'Rocket', zh: '火箭', cat: 'vehicles', s: 27, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.4, ry: 0.95, f: '#e8e0d2', s: OUT, w: 0.07 },
    { k: 'p', pts: [[-0.38, 0.1], [0, -1.35], [0.38, 0.1]], f: '#d8483f', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: 0, y: 0, r: 0.2, f: '#4a7bbf', s: OUT, w: 0.05 },
    { k: 'p', pts: [[-0.4, 0.75], [0, 1.25], [0.4, 0.75]], f: '#e8a23c', s: OUT, w: 0.06 },
  ] },
  { id: 'boat', en: 'Boat', zh: '小船', cat: 'vehicles', s: 28, shapes: [
    { k: 'p', pts: [[-0.9, 0.15], [0.9, 0.15], [0.55, 0.6], [-0.55, 0.6]], f: '#8a5a32', s: OUT, w: 0.07 },
    { k: 'l', x1: 0, y1: -0.1, x2: 0, y2: -0.85, s: OUT, w: 0.06, a: 1 },
    { k: 'p', pts: [[0.02, -0.85], [0.7, -0.15], [0.02, -0.15]], f: '#e8e0d2', s: OUT, w: 0.05 },
  ] },

  // ------------------------------ time ------------------------------
  { id: 'wallclock', en: 'Wall Clock', zh: '挂钟', cat: 'time', s: 27, shapes: [
    { k: 'c', x: 0, y: 0, r: 0.95, f: PAPER, s: OUT, w: 0.08 },
    { k: 'l', x1: 0, y1: 0, x2: 0.3, y2: -0.4, s: OUT, w: 0.07, a: 1 },
    { k: 'l', x1: 0, y1: 0, x2: -0.35, y2: 0.15, s: OUT, w: 0.05, a: 1 },
    { k: 'c', x: 0, y: 0, r: 0.08, f: '#d8483f' },
  ] },
  { id: 'alarmclock', en: 'Alarm Clock', zh: '闹钟', cat: 'time', s: 26, shapes: [
    { k: 'r', x: 0, y: 0, w: 1.4, h: 1.1, f: '#d8483f', s: OUT, w: 0.07, rx: 0.16 },
    { k: 'c', x: 0, y: 0.02, r: 0.4, f: PAPER, s: OUT, w: 0.06 },
    { k: 'a', x: -0.55, y: -0.5, r: 0.26, a0: Math.PI, a1: Math.PI * 2, s: OUT, w: 0.07, a: 1 },
    { k: 'l', x1: 0, y1: 0.02, x2: 0.18, y2: -0.12, s: OUT, w: 0.05 },
  ] },
  { id: 'pocketwatch', en: 'Pocket Watch', zh: '怀表', cat: 'time', s: 25, shapes: [
    { k: 'c', x: 0, y: 0, r: 0.85, f: '#e8c94a', s: OUT, w: 0.08 },
    { k: 'c', x: 0, y: 0, r: 0.62, f: PAPER, s: OUT, w: 0.05 },
    { k: 'l', x1: 0, y1: 0, x2: 0.25, y2: -0.3, s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: 0, y: 0.85, r: 0.12, f: '#e8c94a', s: OUT, w: 0.05 },
  ] },
  { id: 'hourglass', en: 'Hourglass', zh: '沙漏', cat: 'time', s: 26, shapes: [
    { k: 'r', x: 0, y: -0.85, w: 0.9, h: 0.22, f: WOOD, s: OUT, w: 0.06 },
    { k: 'r', x: 0, y: 0.85, w: 0.9, h: 0.22, f: WOOD, s: OUT, w: 0.06 },
    { k: 'p', pts: [[-0.4, -0.75], [0.4, -0.75], [0.12, 0], [0.4, 0.75], [-0.4, 0.75], [-0.12, 0]], f: '#e8c94a', s: OUT, w: 0.06, a: 1 },
  ] },

  // ------------------------------ stationery ------------------------------
  { id: 'pencil', en: 'Pencil', zh: '铅笔', cat: 'stationery', s: 28, shapes: [
    { k: 'r', x: 0, y: 0, w: 1.7, h: 0.3, f: '#e8c94a', s: OUT, w: 0.06, rx: 0.06 },
    { k: 'p', pts: [[0.85, -0.15], [1.15, 0], [0.85, 0.15]], f: '#d9b98a', s: OUT, w: 0.05, a: 1 },
    { k: 'r', x: -0.95, y: 0, w: 0.16, h: 0.32, f: '#e87fa0', s: OUT, w: 0.05 },
  ] },
  { id: 'scissors', en: 'Scissors', zh: '剪刀', cat: 'stationery', s: 27, shapes: [
    { k: 'l', x1: 0.3, y1: -0.1, x2: -0.55, y2: -0.75, s: METAL, w: 0.09 },
    { k: 'l', x1: 0.3, y1: -0.1, x2: -0.55, y2: 0.75, s: METAL, w: 0.09 },
    { k: 'c', x: 0.42, y: -0.3, r: 0.22, f: '#d8483f', s: OUT, w: 0.05, a: 1 },
    { k: 'c', x: 0.42, y: 0.3, r: 0.22, f: '#d8483f', s: OUT, w: 0.05 },
  ] },
  { id: 'ruler', en: 'Ruler', zh: '直尺', cat: 'stationery', s: 28, shapes: [
    { k: 'r', x: 0, y: 0, w: 1.8, h: 0.5, f: '#e8c94a', s: OUT, w: 0.07, rx: 0.06 },
    { k: 'l', x1: -0.3, y1: -0.18, x2: -0.3, y2: 0.05, s: OUT, w: 0.04 },
    { k: 'l', x1: 0.0, y1: -0.18, x2: 0.0, y2: 0.05, s: OUT, w: 0.04 },
    { k: 'l', x1: 0.3, y1: -0.18, x2: 0.3, y2: 0.05, s: OUT, w: 0.04, a: 1 },
    { k: 'l', x1: 0.6, y1: -0.18, x2: 0.6, y2: 0.05, s: OUT, w: 0.04 },
  ] },
  { id: 'book', en: 'Book', zh: '书', cat: 'stationery', s: 28, shapes: [
    { k: 'r', x: -0.05, y: 0, w: 1.4, h: 0.95, f: '#4a7bbf', s: OUT, w: 0.07, rx: 0.06 },
    { k: 'l', x1: 0.65, y1: -0.45, x2: 0.65, y2: 0.45, s: PAPER, w: 0.07, a: 1 },
  ] },
  { id: 'glasses', en: 'Glasses', zh: '眼镜', cat: 'stationery', s: 27, shapes: [
    { k: 'a', x: -0.5, y: 0, r: 0.4, a0: 0, a1: 6.3, s: OUT, w: 0.07 },
    { k: 'a', x: 0.5, y: 0, r: 0.4, a0: 0, a1: 6.3, s: OUT, w: 0.07 },
    { k: 'l', x1: -0.1, y1: 0, x2: 0.1, y2: 0, s: OUT, w: 0.07, a: 1 },
    { k: 'l', x1: -0.9, y1: 0, x2: -1.15, y2: 0, s: OUT, w: 0.06 },
    { k: 'l', x1: 0.9, y1: 0, x2: 1.15, y2: 0, s: OUT, w: 0.06 },
  ] },
  { id: 'fountainpen', en: 'Fountain Pen', zh: '钢笔', cat: 'stationery', s: 28, shapes: [
    { k: 'r', x: 0, y: 0, w: 0.34, h: 1.6, f: '#2a4a6a', s: OUT, w: 0.06, rx: 0.08 },
    { k: 'p', pts: [[-0.15, -0.8], [0, -1.2], [0.15, -0.8]], f: METAL, s: OUT, w: 0.05, a: 1 },
    { k: 'r', x: 0, y: 0.62, w: 0.4, h: 0.3, f: METAL, s: OUT, w: 0.05 },
  ] },
  { id: 'notebook', en: 'Notebook', zh: '笔记本', cat: 'stationery', s: 27, shapes: [
    { k: 'r', x: 0, y: 0, w: 1.1, h: 1.4, f: '#e8e0d2', s: OUT, w: 0.07, rx: 0.08 },
    { k: 'p', pts: [[-0.55, -0.7], [0.55, -0.7], [0.55, -0.1], [-0.55, -0.1]], f: '#5aa05a', s: OUT, w: 0.05, a: 1 },
    { k: 'l', x1: -0.3, y1: 0.3, x2: 0.3, y2: 0.3, s: '#9aa4ad', w: 0.04 },
    { k: 'l', x1: -0.3, y1: 0.5, x2: 0.3, y2: 0.5, s: '#9aa4ad', w: 0.04 },
  ] },

  // ------------------------------ plants ------------------------------
  { id: 'cactus', en: 'Cactus', zh: '仙人掌', cat: 'plants', s: 26, shapes: [
    { k: 'r', x: 0, y: 0, w: 0.5, h: 1.5, f: '#5aa05a', s: OUT, w: 0.07, rx: 0.22 },
    { k: 'r', x: -0.55, y: -0.25, w: 0.34, h: 0.7, f: '#5aa05a', s: OUT, w: 0.06, rx: 0.16, a: 1 },
    { k: 'r', x: 0.55, y: 0.1, w: 0.34, h: 0.7, f: '#5aa05a', s: OUT, w: 0.06, rx: 0.16 },
    { k: 'r', x: 0, y: 0.85, w: 0.9, h: 0.3, f: '#c98a5a', s: OUT, w: 0.06, rx: 0.1 },
  ] },
  { id: 'flower', en: 'Flower', zh: '花', cat: 'plants', s: 26, shapes: [
    { k: 'l', x1: 0, y1: 0.1, x2: 0, y2: 0.95, s: '#5aa05a', w: 0.08 },
    { k: 'c', x: 0, y: -0.25, r: 0.34, f: '#e87fa0', s: OUT, w: 0.05, a: 1 },
    { k: 'c', x: 0, y: -0.3, r: 0.12, f: '#e8c94a' },
  ] },
  { id: 'leaf', en: 'Leaf', zh: '叶子', cat: 'plants', s: 26, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.9, ry: 0.5, f: '#5aa05a', s: OUT, w: 0.07, rot: -0.5 },
    { k: 'l', x1: -0.75, y1: -0.35, x2: 0.75, y2: 0.4, s: '#3a7a3a', w: 0.05, a: 1 },
  ] },
  { id: 'tree', en: 'Tree', zh: '树', cat: 'plants', s: 27, shapes: [
    { k: 'r', x: 0, y: 0.55, w: 0.34, h: 0.7, f: '#8a5a32', s: OUT, w: 0.06 },
    { k: 'c', x: 0, y: -0.3, r: 0.62, f: '#5aa05a', s: OUT, w: 0.07, a: 1 },
    { k: 'c', x: -0.35, y: -0.1, r: 0.4, f: '#6ab06a', s: OUT, w: 0.06 },
  ] },
  { id: 'mushroom', en: 'Mushroom', zh: '蘑菇', cat: 'plants', s: 25, shapes: [
    { k: 'r', x: 0, y: 0.15, w: 0.42, h: 0.7, f: '#e8e0d2', s: OUT, w: 0.06 },
    { k: 'a', x: 0, y: -0.05, r: 0.55, a0: Math.PI, a1: Math.PI * 2, s: OUT, w: 0.02 },
    { k: 'p', pts: [[-0.55, -0.05], [0, -0.85], [0.55, -0.05]], f: '#d8483f', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.2, y: -0.42, r: 0.09, f: PAPER },
  ] },
  { id: 'mug', en: 'Mug', zh: '马克杯', cat: 'kitchen', s: 25, shapes: [
    { k: 'r', x: 0, y: 0, w: 0.95, h: 1.1, f: '#4a7bbf', s: OUT, w: 0.07, rx: 0.1 },
    { k: 'a', x: 0.5, y: -0.1, r: 0.28, a0: -Math.PI / 2, a1: Math.PI / 2, s: OUT, w: 0.07, a: 1 },
  ] },
  { id: 'teapot', en: 'Teapot', zh: '茶壶', cat: 'kitchen', s: 27, shapes: [
    { k: 'e', x: 0, y: 0.05, rx: 0.85, ry: 0.6, f: '#7b8ea3', s: OUT, w: 0.07 },
    { k: 'a', x: -0.7, y: 0.3, r: 0.3, a0: Math.PI / 2, a1: Math.PI * 1.6, s: OUT, w: 0.06, a: 1 },
    { k: 'a', x: 0.85, y: -0.1, r: 0.26, a0: 0, a1: Math.PI * 1.5, s: OUT, w: 0.06 },
    { k: 'c', x: 0, y: -0.72, r: 0.16, f: '#7b8ea3', s: OUT, w: 0.05 },
  ] },
  { id: 'spoon', en: 'Spoon', zh: '勺子', cat: 'kitchen', s: 27, shapes: [
    { k: 'e', x: 0.3, y: 0.1, rx: 0.32, ry: 0.5, f: METAL, s: OUT, w: 0.06 },
    { k: 'l', x1: 0.2, y1: 0.5, x2: -0.7, y2: -0.4, s: METAL, w: 0.08, a: 1 },
  ] },
  { id: 'bowl', en: 'Bowl', zh: '碗', cat: 'kitchen', s: 26, shapes: [
    { k: 'a', x: 0, y: -0.1, r: 0.8, a0: 0, a1: Math.PI, s: OUT, w: 0.06 },
    { k: 'r', x: 0, y: -0.12, w: 1.58, h: 0.12, f: '#5aa05a', s: OUT, w: 0.05, a: 1 },
    { k: 'r', x: 0, y: 0.28, w: 0.5, h: 0.12, f: '#8a5a32', s: OUT, w: 0.05 },
  ] },
  { id: 'bottle', en: 'Bottle', zh: '瓶子', cat: 'kitchen', s: 26, shapes: [
    { k: 'r', x: 0, y: 0.1, w: 0.6, h: 1.2, f: '#5a9a9a', s: OUT, w: 0.07, rx: 0.1 },
    { k: 'r', x: 0, y: -0.7, w: 0.24, h: 0.4, f: '#5a9a9a', s: OUT, w: 0.06, a: 1 },
    { k: 'r', x: 0, y: 0.4, w: 0.5, h: 0.3, f: PAPER, s: OUT, w: 0.05 },
  ] },
  { id: 'candle', en: 'Candle', zh: '蜡烛', cat: 'kitchen', s: 25, shapes: [
    { k: 'r', x: 0, y: 0.1, w: 0.5, h: 1.1, f: PAPER, s: OUT, w: 0.07, rx: 0.1 },
    { k: 'l', x1: 0, y1: -0.45, x2: 0, y2: -0.85, s: OUT, w: 0.05 },
    { k: 'e', x: 0, y: -0.95, rx: 0.16, ry: 0.3, f: '#e8a23c', s: OUT, w: 0.05, a: 1 },
  ] },

  // ------------------------------ toys ------------------------------
  { id: 'teddy', en: 'Teddy', zh: '泰迪熊', cat: 'toys', s: 27, shapes: [
    { k: 'c', x: 0, y: 0.1, r: 0.7, f: '#c98a5a', s: OUT, w: 0.07 },
    { k: 'c', x: -0.42, y: -0.55, r: 0.2, f: '#c98a5a', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: 0.42, y: -0.55, r: 0.2, f: '#c98a5a', s: OUT, w: 0.06, a: 1 },
    { k: 'c', x: -0.24, y: 0.0, r: 0.09, f: '#241d14' },
    { k: 'c', x: 0.24, y: 0.0, r: 0.09, f: '#241d14' },
  ] },
  { id: 'robot', en: 'Robot', zh: '机器人', cat: 'toys', s: 27, shapes: [
    { k: 'r', x: 0, y: 0, w: 1.0, h: 1.1, f: METAL, s: OUT, w: 0.07, rx: 0.12 },
    { k: 'c', x: 0, y: -0.35, r: 0.22, f: '#4a7bbf', s: OUT, w: 0.05, a: 1 },
    { k: 'r', x: -0.35, y: 0.7, w: 0.24, h: 0.4, f: METAL, s: OUT, w: 0.05 },
    { k: 'r', x: 0.35, y: 0.7, w: 0.24, h: 0.4, f: METAL, s: OUT, w: 0.05 },
  ] },
  { id: 'balloon', en: 'Balloon', zh: '气球', cat: 'toys', s: 26, shapes: [
    { k: 'e', x: 0, y: -0.1, rx: 0.6, ry: 0.75, f: '#e87fa0', s: OUT, w: 0.07 },
    { k: 'l', x1: 0, y1: 0.65, x2: 0, y2: 1.1, s: OUT, w: 0.05, a: 1 },
    { k: 'p', pts: [[-0.15, 0.55], [0.15, 0.55], [0, 0.75]], f: '#e87fa0', s: OUT, w: 0.05 },
  ] },
  { id: 'top', en: 'Spinning Top', zh: '陀螺', cat: 'toys', s: 25, shapes: [
    { k: 'p', pts: [[-0.5, -0.5], [0.5, -0.5], [0, 0.75]], f: '#d8483f', s: OUT, w: 0.07 },
    { k: 'l', x1: 0, y1: -0.5, x2: 0, y2: -1.0, s: OUT, w: 0.06, a: 1 },
  ] },
  { id: 'kite', en: 'Kite', zh: '风筝', cat: 'toys', s: 27, shapes: [
    { k: 'p', pts: [[0, -0.95], [0.8, 0.15], [0, 0.85], [-0.8, 0.15]], f: '#e8c94a', s: OUT, w: 0.07 },
    { k: 'l', x1: 0, y1: -0.95, x2: 0, y2: 1.2, s: OUT, w: 0.05, a: 1 },
  ] },

  // ------------------------------ tools ------------------------------
  { id: 'key', en: 'Key', zh: '钥匙', cat: 'tools', s: 26, shapes: [
    { k: 'c', x: -0.3, y: 0, r: 0.3, f: '#e8c94a', s: OUT, w: 0.07 },
    { k: 'l', x1: 0, y1: 0, x2: 0.85, y2: 0, s: '#e8c94a', w: 0.12, a: 1 },
    { k: 'l', x1: 0.6, y1: 0, x2: 0.7, y2: 0.25, s: '#e8c94a', w: 0.1 },
  ] },
  { id: 'hammer', en: 'Hammer', zh: '锤子', cat: 'tools', s: 28, shapes: [
    { k: 'r', x: 0.2, y: 0, w: 0.4, h: 1.3, f: '#c98a5a', s: OUT, w: 0.07, rx: 0.08 },
    { k: 'r', x: -0.45, y: -0.55, w: 0.8, h: 0.5, f: METAL, s: OUT, w: 0.06, a: 1 },
  ] },
  { id: 'lantern', en: 'Lantern', zh: '灯笼', cat: 'tools', s: 26, shapes: [
    { k: 'e', x: 0, y: 0, rx: 0.7, ry: 0.85, f: '#d8483f', s: OUT, w: 0.07 },
    { k: 'l', x1: -0.5, y1: 0, x2: 0.5, y2: 0, s: '#e8c94a', w: 0.06, a: 1 },
    { k: 'r', x: 0, y: 0.85, w: 0.5, h: 0.16, f: '#e8c94a', s: OUT, w: 0.05 },
  ] },
];

// 快速索引（渲染/关卡生成/测试用）
export const ITEMS_BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

export function itemById(id) {
  return ITEMS_BY_ID.get(id) || null;
}

/** 物品的本地化名字（en 默认，zh 中文；供清单 HUD 使用）。 */
export function itemLabel(id, lang = 'en') {
  const it = itemById(id);
  if (!it) return id;
  return lang === 'zh' ? it.zh : it.en;
}
