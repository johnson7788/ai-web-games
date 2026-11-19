// 全局数值配置（霓虹街机风 · 星际防线）
export const WORLD = {
  W: 1280,
  H: 720,
  BASE_Y: 636, // 防线基座顶边
};

export const STEP = 1 / 60;

// 玩法数值（纯逻辑，可被 tests / selfplay 引用）
export const TUNE = {
  // 主炮
  MAIN_DAMAGE: 14,
  MAIN_COOLDOWN: 0.18,   // 按住/连点时每发间隔
  MAIN_BURST: 1,
  MAIN_BULLET_SPEED: 820,
  // 副炮（自动防御炮台，第 2 / 3 波解锁）
  SIDE_DAMAGE: 9,
  SIDE_COOLDOWN: 0.5,
  SIDE_BULLET_SPEED: 700,
  // 能量 / 大招
  MAX_ENERGY: 100,
  KILL_ENERGY: 12,
  // 连击
  COMBO_SCORE: 10,
  // 道具
  DROP_RATE: 0.16,
  POWERUP_SPEED: 66,
  RAPID_SEC: 8,
  FREEZE_SEC: 6,
  FREEZE_FACTOR: 0.35,
  // 粒子 / 渲染档位上限（render 用）
  MAX_PARTICLES: 320,
  DPR_MAX: 2,
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'starwar-defense-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'starwar-defense-save',
};
