// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘/等待架几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高（不透明，避免压住棋盘被 vision-review 判遮挡）
  SHELF_H: 74,          // 底部等待架高
  SHELF_SLOTS: 7,       // 等待架格数
  TILE_MAX: 58,         // 单块上限（px）
  TILE_MIN: 40,
};

// 语言：默认英文；zh 必做。ar/ja/ko/ru 完整翻译后才加入。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'meow-miao-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'meow-miao-save',
};

// 游戏规则数值（sim 读取）
export const GAME = {
  SHELF_CAP: 7,             // 等待架容量（原版 6，此处 7 更可玩，见交付报告）
  COMBO_WINDOW: 4,          // 连击窗口（秒）
  STAR_TIME_RATIO: 0.4,     // 剩余时间 ≥40% → +1 星
  STAR_COMBO_MIN: 3,        // 最大连击 ≥3 → +1 星
  SHUFFLE_PER_LEVEL: 1,     // 每局洗牌次数
  UNDO_PER_LEVEL: 2,        // 每局撤回次数
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
  MAX_SYMBOLS: 8,           // 最多 8 种花色（对应霓虹字形）
};
