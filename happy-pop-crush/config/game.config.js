// 全局数值配置（Lead 拥有；数值改动只改这里）
// HAPPY POP CRUSH — 霓虹街机 match-3（原创换皮，玩法骨架 1:1 于开心消消乐）

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 棋盘 + 得分公共项（sim 读取；跨关一致的规则数值）
export const GAME = {
  ROWS: 8,
  COLS: 8,
  BASE_COLORS: 6,          // 最大颜色种类（关卡可用更少）
  POINTS_PER_GEM: 40,      // 每消除 1 颗基础分（连锁只加固定连击奖励，不乘爆）
  COMBO_BONUS: 40,         // 每多一层连锁的固定奖励（combo-1 层）
  SPECIAL_BONUS: 120,      // 特殊宝石引爆额外分
  ROCK_BONUS: 80,          // 敲碎/炸碎岩石额外分
  STAR_2_RATIO: 1.5,       // 分数达目标 ×1.5 → 2 星
  STAR_3_RATIO: 2.0,       // 分数达目标 ×2.0 → 3 星
};

// 渲染布局常量（render 由此计算棋盘几何；sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,               // 顶部 HUD 条高（DOM）
  MARGIN_X: 24,
  MARGIN_Y: 12,
  CELL_MAX: 82,            // 单格上限
};

// 霓虹街机宝石色板（render 用；sim 只用 0..5 整数）
export const GEM_COLORS = [
  '#2DE2E6', // 0 青
  '#FF2E63', // 1 品红
  '#FFD166', // 2 黄
  '#4ADE80', // 3 绿
  '#FF8A3D', // 4 橙
  '#A78BFA', // 5 紫
];

// 语言：默认英文；zh 必做；?lang= 可覆盖
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'happy-pop-crush-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'happy-pop-crush-save',
};
