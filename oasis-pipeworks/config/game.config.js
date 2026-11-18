// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算网格/等待区几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  MARGIN_X: 24,         // 左右安全边
  MARGIN_Y: 16,
  QUEUE_W: 116,         // 等待区宽（≈1 格 + 边）
  QUEUE_GAP: 18,        // 网格与等待区间距
  CELL_MAX: 112,        // 单格上限
  FOX_W: 96,
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'oasis-pipeworks-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'oasis-pipeworks-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  DIG_PER_LEVEL: 1,          // 每局铲除次数
  DIG_MAX: 2,                // 铲除上限（含广告补充）
  DIG_AD_REFILL: 1,          // 看一次广告补几次
  FLOW_TIME_FALLBACK: 6,     // 关卡未给 blockTime 时的默认（秒/格）
  BLOOM_STAR: true,          // 花朵计星
  TIME_STAR_RATIO: 0.3,      // 剩余时间 ≥30% 初始时间 → +1 星
  TUTORIAL_STEPS: 3,         // 首次交互引导步数
  SHAKE_AMP: 4,              // 放管/铲除小震屏幅度（px）
};
