// MR HAT ESCAPE · 全局数值与运行配置
// 纯静态零构建：canvas 逻辑分辨率 1280×720，DPR ≤2 由 renderer 处理。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 48,
};

// 60Hz 固定步长
export const STEP = 1 / 60;

export const PLAYER = {
  W: 30,
  H: 44,
  SPEED: 4.8,       // px/frame ≈ 288 px/s
  JUMP_VY: -12.5,   // 初速，配合 GRAVITY=0.58 → 跳高 ≈135px、滞空 ≈43 帧
  GRAVITY: 0.58,
  MAX_FALL: 16,
};

export const COMBO = {
  WINDOW: 2.0,      // 连击窗口（秒）
  SCORE_PER_STAR: 100,
  COMBO_BONUS: 25,  // 每个连击递增分
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mr-hat-escape-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mr-hat-escape',
};
