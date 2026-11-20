// PIN & POUR · 关卡数据（12 关 3 章）
// 坐标约定：[r, c]，r=行(0..rows-1)，c=列(0..cols-1)。
// 格子 kind：empty / wall / gate / bottle / drain / comb / screen。
//   - gate：闸板（抽掉变 empty），挡住珠子下落。
//   - bottle：瓶（蜂蜜落进去=收集；气泡落进去=污染 lose）。
//   - drain：排口（气泡落进去=安全；蜂蜜落进去=浪费 lose）。
//   - comb：蜂巢块，蜂蜜可穿过并把它冲走（dissolve），气泡视为实心墙。
//   - screen：滤网，气泡可穿过，蜂蜜视为实心墙。
// 全部关卡由 solver（src/game/level.js）验证可解；par = 最小抽闸数。
const H = 'honey';
const B = 'bubble';

export const LEVELS = [
  {
    index: 1, scene: 'dawn-apiary', rows: 5, cols: 1,
    beads: [{ type: H, r: 2, c: 0 }],
    gates: [{ id: 'g1', r: 3, c: 0 }],
    walls: [], screens: [], combs: [],
    bottles: [[4, 0]], drains: [],
    par: 1, difficulty: 1,
    newElement: '单闸直落',
    tutorial: true,
  },
  {
    index: 2, scene: 'dawn-apiary', rows: 6, cols: 2,
    beads: [{ type: B, r: 1, c: 0 }, { type: H, r: 2, c: 0 }],
    gates: [{ id: 'g1', r: 3, c: 0 }, { id: 'g2', r: 2, c: 1 }],
    walls: [], screens: [[3, 1]], combs: [],
    bottles: [[5, 0]], drains: [[5, 1]],
    par: 2, difficulty: 1.8,
    newElement: '双闸顺序（气泡先引走）',
    tutorial: false,
  },
  {
    index: 3, scene: 'dawn-apiary', rows: 7, cols: 2,
    beads: [{ type: B, r: 1, c: 0 }, { type: B, r: 2, c: 0 }, { type: H, r: 3, c: 0 }],
    gates: [{ id: 'g1', r: 4, c: 0 }, { id: 'g2', r: 2, c: 1 }, { id: 'g3', r: 3, c: 1 }],
    walls: [], screens: [[4, 1]], combs: [],
    bottles: [[6, 0]], drains: [[6, 1]],
    par: 2, difficulty: 2.4,
    newElement: '气泡分流（两枚气泡）',
    tutorial: false,
  },
  {
    index: 4, scene: 'dawn-apiary', rows: 7, cols: 2,
    beads: [{ type: B, r: 1, c: 0 }, { type: H, r: 2, c: 0 }],
    gates: [{ id: 'g1', r: 3, c: 0 }, { id: 'g2', r: 2, c: 1 }],
    walls: [], screens: [[3, 1]], combs: [[4, 0]],
    bottles: [[6, 0]], drains: [[6, 1]],
    par: 2, difficulty: 2.6,
    newElement: '蜂巢桥（蜂蜜可冲走）',
    tutorial: false,
  },
  {
    index: 5, scene: 'noon-workshop', rows: 7, cols: 2,
    beads: [{ type: B, r: 1, c: 0 }, { type: B, r: 2, c: 0 }, { type: H, r: 3, c: 0 }],
    gates: [{ id: 'g1', r: 4, c: 0 }, { id: 'g2', r: 2, c: 1 }, { id: 'g3', r: 3, c: 1 }],
    walls: [], screens: [[4, 1]], combs: [[5, 0]],
    bottles: [[6, 0]], drains: [[6, 1]],
    par: 2, difficulty: 3.2,
    newElement: '时间差陷阱（气泡逐枚滴落）',
    tutorial: false,
  },
  {
    index: 6, scene: 'noon-workshop', rows: 7, cols: 3,
    beads: [{ type: H, r: 1, c: 0 }, { type: H, r: 1, c: 2 }, { type: B, r: 3, c: 1 }],
    gates: [{ id: 'g1', r: 2, c: 0 }, { id: 'g2', r: 2, c: 2 }, { id: 'g3', r: 4, c: 1 }],
    walls: [[2, 1]], screens: [], combs: [[4, 0], [4, 2]],
    bottles: [[6, 0], [6, 2]], drains: [[6, 1]],
    par: 3, difficulty: 3.6,
    newElement: '双股汇流（两瓶同时装）',
    tutorial: false,
  },
  {
    index: 7, scene: 'noon-workshop', rows: 7, cols: 3,
    beads: [{ type: H, r: 2, c: 1 }],
    gates: [{ id: 'g1', r: 3, c: 1 }, { id: 'g2', r: 4, c: 0 }],
    walls: [[3, 0], [3, 2], [4, 1], [6, 1]], screens: [], combs: [],
    bottles: [[6, 0]], drains: [[6, 2]],
    par: 2, difficulty: 4.0,
    newElement: '拦截闸（先开左路再放蜜）',
    tutorial: false,
  },
  {
    index: 8, scene: 'noon-workshop', rows: 7, cols: 3,
    beads: [{ type: H, r: 2, c: 1 }],
    gates: [{ id: 'g1', r: 3, c: 1 }],
    walls: [[3, 0], [3, 2], [4, 0], [4, 1], [6, 1]], screens: [], combs: [],
    bottles: [[6, 2]], drains: [[6, 0]],
    par: 1, difficulty: 4.2,
    newElement: '交叉排口（蜂蜜向右分流）',
    tutorial: false,
  },
  {
    index: 9, scene: 'dusk-cellar', rows: 8, cols: 1,
    beads: [{ type: H, r: 1, c: 0 }, { type: H, r: 3, c: 0 }, { type: H, r: 5, c: 0 }],
    gates: [{ id: 'g1', r: 2, c: 0 }, { id: 'g2', r: 4, c: 0 }, { id: 'g3', r: 6, c: 0 }],
    walls: [], screens: [], combs: [],
    bottles: [[7, 0]], drains: [],
    par: 3, difficulty: 4.8,
    newElement: '三闸叠塔',
    tutorial: false,
  },
  {
    index: 10, scene: 'dusk-cellar', rows: 7, cols: 3,
    beads: [{ type: B, r: 1, c: 0 }, { type: H, r: 2, c: 0 }, { type: B, r: 1, c: 2 }, { type: H, r: 2, c: 2 }],
    gates: [{ id: 'g1', r: 3, c: 0 }, { id: 'g2', r: 3, c: 2 }, { id: 'g3', r: 2, c: 1 }],
    walls: [], screens: [[3, 1]], combs: [],
    bottles: [[6, 0], [6, 2]], drains: [[6, 1]],
    par: 3, difficulty: 5.4,
    newElement: '气泡逆流（中央滤网）',
    tutorial: false,
  },
  {
    index: 11, scene: 'dusk-cellar', rows: 8, cols: 3,
    beads: [{ type: B, r: 1, c: 0 }, { type: H, r: 2, c: 0 }, { type: B, r: 1, c: 2 }, { type: H, r: 2, c: 2 }],
    gates: [{ id: 'g1', r: 3, c: 0 }, { id: 'g2', r: 3, c: 2 }, { id: 'g3', r: 2, c: 1 }],
    walls: [], screens: [[3, 1]], combs: [[4, 0], [4, 2]],
    bottles: [[7, 0], [7, 2]], drains: [[7, 1]],
    par: 3, difficulty: 6.0,
    newElement: '多室并联（双滤网+双蜂巢）',
    tutorial: false,
  },
  {
    index: 12, scene: 'dusk-cellar', rows: 8, cols: 3,
    beads: [{ type: B, r: 1, c: 0 }, { type: B, r: 2, c: 0 }, { type: H, r: 3, c: 0 }, { type: B, r: 1, c: 2 }, { type: H, r: 2, c: 2 }],
    gates: [{ id: 'g1', r: 4, c: 0 }, { id: 'g2', r: 3, c: 2 }, { id: 'g3', r: 2, c: 1 }, { id: 'g4', r: 3, c: 1 }],
    walls: [], screens: [[4, 1]], combs: [[5, 0], [5, 2]],
    bottles: [[7, 0], [7, 2]], drains: [[7, 1]],
    par: 2, difficulty: 6.8,
    newElement: '终局多室大关',
    tutorial: false,
  },
];

export const LEVEL_COUNT = LEVELS.length;
