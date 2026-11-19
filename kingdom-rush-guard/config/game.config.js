// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；其它语言完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'kingdom-rush-guard-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'kingdom-rush-guard-save',
};

// 游戏规则公共数值（各关在 levels.js 里可覆盖一部分）
export const GAME = {
  START_GOLD: 300,        // 初始金币
  BASE_HP: 20,            // 初始基地血量
  BASE_X: 92,             // 基地中心 x（左端）
  ENEMY_SPEED: 58,        // 敌人默认速度 px/s
  COMBO_DECAY: 3.0,       // 连击超过 N 秒无击杀则清零
  COMBO_OVERDRIVE_AT: 8,  // 连击达到该值 → 全塔超载 +25% 射速
  OVERDRIVE_FIRE_BONUS: 0.25,
  CORE_EVERY_KILLS: 8,    // 每 N 次击杀掉落一颗能量核心
  CORE_GOLD: 40,          // 核心金币奖励
  ORBITAL_CHARGES_NEEDED: 3, // 集满 3 颗核心可用一次轨道炮
  ORBITAL_DAMAGE: 60,     // 轨道炮对全场敌人伤害
  SLOW_DURATION: 1.6,     // 特斯拉塔减速时长
  SLOW_FACTOR: 0.45,      // 减速后速度倍率
  STAR_HP_3: 14,          // 剩余血 ≥14 → 3 星
  STAR_HP_2: 7,           // 剩余血 ≥7 → 2 星，否则 1 星
};
