// FROG HOP LEAF · 关卡定义（三个池塘层级，逐层引入新要素）
// 每关：生成一条从池底到「莲花门」的荷叶梯。sim 只读这些数值；level.js 负责用 seed 生成。
export const LEVELS = [
  {
    index: 1,
    scene: 'shallows',            // 浅滩：清凉蓝绿
    name: { en: 'Pond Shallows', zh: '浅滩莲池' },
    steps: 18,                    // 地面之上的荷叶数（决定高度）
    gapMin: 92,
    gapMax: 118,
    leafWMin: 210,
    leafWMax: 330,
    ladybugs: 2,                  // 瓢虫（蜗牛改）
    pebbles: 0,                   // 滚石
    thorns: 0,                    // 尖刺
    cattails: 0,                  // 香蒲（喷气泡）
    springLeaves: 0,              // 弹簧叶（新机制）
    goldenLeaves: 0,              // 金叶（新机制）
    fireflies: 12,                // 萤火虫（苹果改，喂连击）
    fireflyGoal: 6,               // 2 星所需萤火虫数
    comboGoal: 4,                 // 3 星所需最大连击
  },
  {
    index: 2,
    scene: 'reeds',               // 芦苇荡：暖黄绿
    name: { en: 'Reed Maze', zh: '芦苇迷宫' },
    steps: 20,
    gapMin: 96,
    gapMax: 122,
    leafWMin: 205,
    leafWMax: 320,
    ladybugs: 2,
    pebbles: 2,
    thorns: 0,
    cattails: 0,
    springLeaves: 2,              // 引入弹簧叶
    goldenLeaves: 0,
    fireflies: 14,
    fireflyGoal: 8,
    comboGoal: 5,
  },
  {
    index: 3,
    scene: 'canopy',              // 树冠：暮色紫金
    name: { en: 'Sky Canopy', zh: '树冠天际' },
    steps: 22,
    gapMin: 98,
    gapMax: 124,
    leafWMin: 200,
    leafWMax: 315,
    ladybugs: 2,
    pebbles: 2,
    thorns: 0,
    cattails: 2,                  // 引入香蒲气泡
    springLeaves: 2,
    goldenLeaves: 2,              // 引入金叶
    fireflies: 16,
    fireflyGoal: 9,
    comboGoal: 6,
  },
];

export const LEVEL_COUNT = LEVELS.length;

// 主题色板（render 读取）：场景 → 天空渐变 / 水面 / 荷叶 / 高光
export const SCENES = {
  shallows: {
    skyTop: '#bfe8ff',
    skyBottom: '#eefcf0',
    water: '#3aa7d6',
    waterDeep: '#2279a6',
    leaf: '#3fae63',
    leafDark: '#2c8a4c',
    accent: '#ffd23f',
  },
  reeds: {
    skyTop: '#cfe6a8',
    skyBottom: '#fbf3cf',
    water: '#4aa8c2',
    waterDeep: '#2b7fa0',
    leaf: '#5cae4e',
    leafDark: '#3f8a3a',
    accent: '#ffca3a',
  },
  canopy: {
    skyTop: '#c7b9e8',
    skyBottom: '#ffe0c2',
    water: '#3f6fb0',
    waterDeep: '#2a4f88',
    leaf: '#57b06a',
    leafDark: '#3a8a4c',
    accent: '#ffb03a',
  },
};
