// BRAIN MELTER · 关卡数据（纯数据，可被 node --test / selfplay 直接 import）
// 机制：
//   sequence  — 按节点上显示的数字顺序点亮（顺序点亮）
//   select    — 找出异类（形状/颜色唯一不同者）
//   sum       — 点数字凑出目标总和
//   pair      — 点开两两配对的节点
//   rotation  — 点节点把它转到统一朝向（对齐所有箭头）
// 新机制：星级（失误数结算）、连击（连续正确）、限时（部分关倒计时）、提示道具（消耗失误机会换答案）

export const PALETTE = ['#00e5ff', '#ff2d78', '#ffea00', '#7cff6b', '#b26bff', '#ff9d00'];

// 每个 item 的通用字段：id, label?, shape?, color?, value?, order?, match?, isCorrect?, rot?, target?
// shape: circle | triangle | square | diamond | hex | star | arrow
export const LEVELS = [
  {
    index: 1,
    type: 'sequence',
    timeLimit: 0,
    items: [
      { id: 'a', label: '3', order: 3 },
      { id: 'b', label: '1', order: 1 },
      { id: 'c', label: '4', order: 4 },
      { id: 'd', label: '2', order: 2 },
    ],
  },
  {
    index: 2,
    type: 'sequence',
    timeLimit: 0,
    items: [
      { id: 'a', label: '2', order: 2 },
      { id: 'b', label: '5', order: 5 },
      { id: 'c', label: '1', order: 1 },
      { id: 'd', label: '4', order: 4 },
      { id: 'e', label: '3', order: 3 },
    ],
  },
  {
    index: 3,
    type: 'select',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'circle', color: 0 },
      { id: 'b', shape: 'triangle', color: 1, isCorrect: true },
      { id: 'c', shape: 'circle', color: 0 },
      { id: 'd', shape: 'circle', color: 0 },
    ],
  },
  {
    index: 4,
    type: 'select',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'square', color: 0 },
      { id: 'b', shape: 'square', color: 0 },
      { id: 'c', shape: 'square', color: 0 },
      { id: 'd', shape: 'square', color: 5, isCorrect: true },
      { id: 'e', shape: 'square', color: 0 },
      { id: 'f', shape: 'square', color: 0 },
    ],
  },
  {
    index: 5,
    type: 'sum',
    timeLimit: 0,
    target: 10,
    solution: ['a', 'd'],
    items: [
      { id: 'a', label: '3', value: 3 },
      { id: 'b', label: '4', value: 4 },
      { id: 'c', label: '6', value: 6 },
      { id: 'd', label: '7', value: 7 },
      { id: 'e', label: '2', value: 2 },
      { id: 'f', label: '8', value: 8 },
    ],
  },
  {
    index: 6,
    type: 'sum',
    timeLimit: 0,
    target: 12,
    solution: ['a', 'b'],
    items: [
      { id: 'a', label: '5', value: 5 },
      { id: 'b', label: '7', value: 7 },
      { id: 'c', label: '3', value: 3 },
      { id: 'd', label: '9', value: 9 },
      { id: 'e', label: '4', value: 4 },
      { id: 'f', label: '8', value: 8 },
    ],
  },
  {
    index: 7,
    type: 'pair',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'circle', color: 0, match: 'm1' },
      { id: 'b', shape: 'triangle', color: 1, match: 'm2' },
      { id: 'c', shape: 'circle', color: 0, match: 'm1' },
      { id: 'd', shape: 'square', color: 2, match: 'm3' },
      { id: 'e', shape: 'triangle', color: 1, match: 'm2' },
      { id: 'f', shape: 'square', color: 2, match: 'm3' },
    ],
  },
  {
    index: 8,
    type: 'pair',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'circle', color: 0, match: 'm1' },
      { id: 'b', shape: 'triangle', color: 1, match: 'm2' },
      { id: 'c', shape: 'square', color: 2, match: 'm3' },
      { id: 'd', shape: 'diamond', color: 3, match: 'm4' },
      { id: 'e', shape: 'circle', color: 0, match: 'm1' },
      { id: 'f', shape: 'triangle', color: 1, match: 'm2' },
      { id: 'g', shape: 'square', color: 2, match: 'm3' },
      { id: 'h', shape: 'diamond', color: 3, match: 'm4' },
    ],
  },
  {
    index: 9,
    type: 'rotation',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'arrow', color: 0, rot: 0, target: 0 },
      { id: 'b', shape: 'arrow', color: 1, rot: 90, target: 0 },
      { id: 'c', shape: 'arrow', color: 2, rot: 180, target: 0 },
      { id: 'd', shape: 'arrow', color: 3, rot: 270, target: 0 },
    ],
  },
  {
    index: 10,
    type: 'rotation',
    timeLimit: 0,
    items: [
      { id: 'a', shape: 'arrow', color: 0, rot: 0, target: 0 },
      { id: 'b', shape: 'arrow', color: 1, rot: 90, target: 0 },
      { id: 'c', shape: 'arrow', color: 2, rot: 180, target: 0 },
      { id: 'd', shape: 'arrow', color: 3, rot: 270, target: 0 },
      { id: 'e', shape: 'arrow', color: 4, rot: 90, target: 0 },
      { id: 'f', shape: 'arrow', color: 5, rot: 180, target: 0 },
    ],
  },
  {
    index: 11,
    type: 'sequence',
    timeLimit: 45,
    items: [
      { id: 'a', label: '3', order: 3 },
      { id: 'b', label: '1', order: 1 },
      { id: 'c', label: '6', order: 6 },
      { id: 'd', label: '2', order: 2 },
      { id: 'e', label: '5', order: 5 },
      { id: 'f', label: '4', order: 4 },
    ],
  },
  {
    index: 12,
    type: 'select',
    timeLimit: 40,
    items: [
      { id: 'a', shape: 'hex', color: 0 },
      { id: 'b', shape: 'hex', color: 0 },
      { id: 'c', shape: 'hex', color: 0 },
      { id: 'd', shape: 'hex', color: 0 },
      { id: 'e', shape: 'hex', color: 0 },
      { id: 'f', shape: 'star', color: 4, isCorrect: true },
      { id: 'g', shape: 'hex', color: 0 },
      { id: 'h', shape: 'hex', color: 0 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
