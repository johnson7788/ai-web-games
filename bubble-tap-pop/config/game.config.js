// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bubble-tap-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'bubble-tap-pop-save',
};

// 游戏规则数值（sim 从 game.config 读取；render/main 只读展示层）
export const GAME = {
  COLORS: ['blue', 'red', 'green', 'orange', 'purple'],
  LIVES: 3,                 // 初始生命
  MAX_LIVES: 3,
  ROUND_TTL: 3.0,           // 每轮基础时限（秒）
  MIN_ROUND_TTL: 2.2,       // 等级提升后时限下限
  TTL_DECAY_PER_LEVEL: 0.15, // 每升一级时限缩短
  BUBBLES_PER_ROUND: 5,     // 每轮一个颜色一个泡泡
  ROCK_UNLOCK_SCORE: 8,     // 分数达到后进入 L2，岩石陷阱开始出现
  COMBO_STEPS: [5, 10, 15, 20], // 连击里程碑（触发 comboUp）
  STAR_THRESHOLDS: [5, 15, 30], // 结算星级：1/2/3 星分数线
  LEVEL_EVERY: 8,           // level = 1 + floor(score / LEVEL_EVERY)
  MAX_GAIN: 5,              // 单次正确点击最高得分
  MAX_PARTICLES: 220,       // 粒子上限分档
  DPR_MAX: 2,               // devicePixelRatio 上限
};
