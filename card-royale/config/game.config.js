// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算牌桌几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,             // 顶部 HUD 条高
  MARGIN_X: 24,
  MARGIN_Y: 12,
  CARD_W: 84,            // 单张牌宽
  CARD_H: 118,           // 单张牌高
  CARD_OFFSET: 40,       // 同一列纵向露头高度
  STOCK_W: 84,
  STOCK_H: 118,
  WASTE_OFFSET: 26,      // 弃牌堆层叠错位
  FOOTER_H: 150,         // 底部库存/弃牌区高度
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'card-royale-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'card-royale-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  ROYAL_STREAK_MIN: 5,      // 连续出牌 ≥5 触发皇家连胜
  ROYAL_BONUS: 50,          // 皇家连胜一次性奖励分
  BASE_SCORE: 10,           // 每张牌基础分
  COMBO_COLOR_BONUS: 5,     // 同色连出每次额外分
  TREASURE_MULT: 2,         // 藏宝牌分数倍率
  THAW_COST: 1,             // 解冻一次消耗的动作（无牌面代价，只多一次点击）
  REDEAL_KEEP_TOP: 1,       // 重翻时保留底牌，其余洗回库存
  TUTORIAL_STEPS: 4,        // 首次交互引导步数
};
