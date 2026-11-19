// BLADE BARRAGE · 全局配置（数值唯一来源）
// sim 只读 GAME 数值；render 读 WORLD/LAYOUT；main 读 CONFIG/STEP。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（与 en key 完全一致）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'blade-barrage-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'blade-barrage-save', // 仅 Sdk 降级 localStorage 时使用
};

// 玩法数值（改编自「万剑归一」：飞刃向上贯穿移动核心；尖刺即死亡）
export const GAME = {
  LIVES: 3,

  // 飞刃（blade）
  BLADE_X: 640,
  BLADE_HALF_W: 12,
  BLADE_HALF_H: 34,
  BLADE_START_Y: 520,
  BLADE_SPEED: 1300, // 发射后向上恒定速度
  FALL_SPEED: 50,    // 未发射时缓慢下沉（时间压力）
  BURST_RADIUS: 150, // 空中爆发（burst）命中半径

  // 尖刺（trap）
  TOP_SPIKE_Y: 52,
  BOTTOM_SPIKE_Y: 676,

  // 核心（enemy，越打越小越快）
  CORE_RADIUS0: 48,
  CORE_RADIUS_MIN: 26,
  CORE_RADIUS_STEP: 4,
  CORE_Y_MIN: 150,
  CORE_Y_MAX: 280,
  CORE_X_MIN: 220,
  CORE_X_MAX: 1060,
  CORE_SPEED0: 420,
  CORE_SPEED_STEP: 55,

  // 岩石（hazard，wave≥3 出现）
  ROCK_RADIUS: 19,
  ROCK_Y_MIN: 340,
  ROCK_Y_MAX: 460,
  ROCK_SPEED: 210,

  // 能量宝石（wave≥2 出现，集满 3 颗进入 Surge）
  GEM_RADIUS: 12,
  GEM_Y_MIN: 330,
  GEM_Y_MAX: 500,
  GEM_SPEED: 160,
  SURGE_GEMS: 3,
  SURGE_DURATION: 6,
  SURGE_SPEED_SCALE: 0.7, // Surge 期间核心变慢（子弹时间）

  // 波次 / 得分
  HITS_PER_WAVE: 4,       // 每 4 次命中进一波
  BASE_HIT: 100,          // 命中基础分（乘 combo / 完美 / surge）
  GEM_SCORE: 150,
  PERFECT_RATIO: 0.4,     // 命中偏移 ≤ 半径×0.4 判定 PERFECT
  STAR_1: 400,
  STAR_2: 1200,
  STAR_3: 2500,

  // 渲染 / 品质
  MAX_PARTICLES: 260,
};

export const LAYOUT = {
  HUD_H: 52, // 顶部 HUD 不透明条（vision-review 要求不遮挡）
};
