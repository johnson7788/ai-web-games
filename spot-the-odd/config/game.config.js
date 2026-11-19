// 全局数值配置 —— SPOT THE ODD（霓虹找异类）
// 玩法骨架 1:1 还原「找你妹」：任务条给类别与数量，点选同类物品收集，计时 5 回合，
// 与 AI 对手竞速。换皮成霓虹街机，新增 3 个机制：ODD 异类奖励 / 连击倍率 / 三星评级。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 5 大类别（每类 5 个程序化图标，共 25 个）
export const CATEGORIES = [
  { id: 'critter', color: '#ff2d78' },
  { id: 'rover',   color: '#00e5ff' },
  { id: 'chrono',  color: '#ffd400' },
  { id: 'tool',    color: '#7cff5e' },
  { id: 'flora',   color: '#c06bff' },
];

export const CATEGORY_ORDER = ['critter', 'rover', 'chrono', 'tool', 'flora'];

// 每个类别 5 个绘制形（draw 0..4）；id 仅用于调试/测试
export const ITEMS = CATEGORIES.flatMap((c) =>
  [0, 1, 2, 3, 4].map((draw) => ({ id: `${c.id}-${draw}`, cat: c.id, draw })),
);

export const ROUNDS = 5;
export const ROUND_TIME = 60;          // 每回合秒数
export const NEED = [3, 3, 4, 4, 5];   // 每回合需要收集的数量
export const HINT_COUNT = 3;           // 每局提示次数
export const ODD_TIME_BONUS = 3;       // 点中 ODD 异类 + 秒
export const ODD_SCORE_BONUS = 25;     // ODD 异类基础分
export const CORRECT_SCORE = 10;       // 单次正确分（× 连击）
export const WRONG_SCORE_COST = 2;     // 点错扣分（不扣时间，但重置连击）
export const COMBO_MAX = 5;            // 连击上限
export const AI_COMPLETE_MIN = 38;     // AI 对手完成一回合的最短秒数
export const AI_COMPLETE_MAX = 52;     // AI 对手完成一回合的最长秒数

// 网格布局（画布内）
export const GRID = {
  cols: 5,
  rows: 5,
  left: 40,
  top: 100,
  cellW: 240,
  cellH: 118,
  gap: 6,
};

// 语言：默认英文；zh 必做（一线语言，完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'spot-the-odd-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'spot-the-odd-save',
};
