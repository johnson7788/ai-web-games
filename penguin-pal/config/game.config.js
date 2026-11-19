// 全局数值配置（Lead 拥有；数值改动只改这里）

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量（render/ui 由此计算几何；sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,          // 顶部 HUD 条高
  ACTION_H: 96,       // 底部动作条高
  GROUND_Y: 560,      // 地面线（企鹅脚底）
  PENGUIN_CX: 640,    // 企鹅中心 x
};

// 语言：默认英文；zh 必做。?lang= > localStorage > defaultLang。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'penguin-pal-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'penguin-pal-save',
};

// 宠物规则数值（sim 读取；自对弈/单测也走这套）
export const GAME = {
  GOAL_LEVEL: 3,               // 升到 3 级 = 达成目标（结算）
  XP_NEED: [0, 20, 34, 48],    // 从 level L 升到 L+1 所需 XP（index=当前等级）
  STAT_MIN: 0,
  STAT_MAX: 100,

  // 每秒自然衰减（数值越大越急）
  DECAY: {
    hunger: 1.0,               // 饥饿随时间上升（越高越糟）
    clean: 0.5,                // 清洁随时间下降
    energy: -0.6,              // 体力自然回复（负 = 回复）
    mood: 0.3,                 // 心情随时间缓慢下降
    moodHunger: 0.7,           // 饥饿 > 阈值 时心情额外下降/秒
    moodDirty: 0.7,            // 清洁 < 阈值 时心情额外下降/秒
  },

  // 需求阈值（决定企鹅的“心愿”）
  WISH: {
    hunger: 62,                // 饥饿 > 62 → 想吃
    clean: 38,                 // 清洁 < 38 → 想洗
    energy: 32,                // 体力 < 32 → 想睡
    mood: 45,                  // 心情 < 45 → 想玩
  },

  // 动作效果（正负增量；金为 0 表示免费）
  ACTIONS: {
    feed: { hunger: -35, mood: 4, energy: -2, gold: 0, xp: 0 },
    wash: { clean: 35, energy: -4, gold: 0, xp: 0 },
    rest: { energy: 45, hunger: 8, mood: 2, gold: 0, xp: 0 },
    play: { mood: 22, energy: -14, hunger: 6, gold: 0, xp: 0 },
    train: { mood: 4, energy: -14, hunger: 6, gold: 0, xp: 3 },
    work: { gold: 15, xp: 1, mood: -6, energy: -10, hunger: 6 },
  },

  // 心愿满足奖励（连击）
  COMBO: {
    bonusXp: 1,
    bonusGold: 5,
  },

  // 商店道具
  SHOP: {
    fish: { gold: 5, hunger: -40, mood: 0, xp: 0 },
    icecream: { gold: 12, mood: 35, hunger: 0, xp: 0 },
    toy: { gold: 18, mood: 20, xp: 2, hunger: 0 },
  },

  // 结算星级：四项健康度达标计数
  STAR_GOOD: { hunger: 50, energy: 50, mood: 50, clean: 50 },

  AMBIENT_SEC: 2.0,            // 环境事件间隔（眨眼/轻摇，填充死时间）
};
