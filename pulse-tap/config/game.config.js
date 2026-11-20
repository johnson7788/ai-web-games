// PULSE TAP · 全局数值配置（Lead 拥有；数值改动只改这里）
// 世界：1280×720 逻辑世界 + letterbox；60Hz 固定步长。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 四轨节奏：DFJK 四键映射 0..3；触屏四轨点击。
export const TRACK_COUNT = 4;
export const LANE_KEYS = ['D', 'F', 'J', 'K'];
export const LANE_CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];

// 判定窗口（毫秒）。写进 config 并单测；groove 模式下窗口微放宽。
export const JUDGE = {
  PERFECT_MS: 60,
  GREAT_MS: 120,
  GROOVE_PERFECT_MS: 75,
  GROOVE_GREAT_MS: 140,
};

// 体力/血量：Miss 扣血，归零失败。
export const HP = {
  START: 100,
  MAX: 100,
  MISS_DAMAGE: 20,
  HOLD_BREAK_DAMAGE: 10,
  FAKE_DAMAGE: 12,
};

// 计分与连击。
export const SCORE = {
  PERFECT: 100,
  GREAT: 50,
  HOLD_BONUS: 40,
  SLIDE_CHAIN: 20,
  STAR_ACCURACY: 0.9, // accuracy ≥ 0.9 → +1 星
};

// 律动模式（signature）：连续 Perfect 达到 8 次进入。
export const GROOVE = {
  STREAK: 8,
};

// 开局倒计时（音符开始前的准备拍）。
export const GAME = {
  LEAD_IN: 2.0,
  COMBO_EVENT_STEP: 10, // 每 10 连击发一次 combo 事件
  BPM_EVENT_DIVISOR: 2, // 每半拍发一次 beat 事件（保证事件密度）
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'pulse-tap-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'pulse-tap-save',
};
