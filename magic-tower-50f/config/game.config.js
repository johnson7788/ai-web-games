// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算地图几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,             // 顶部 HUD 条高（不透明，视觉评审不判遮挡）
  MARGIN_X: 22,          // 左右安全边
  MARGIN_Y: 16,
  MAP_PAD: 10,
  CELL_MAX: 64,          // 单格上限
  HERO_W: 40,
};

// 语言：默认英文；zh 必做；其他语言未完整翻译前不暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'magic-tower-50f-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'magic-tower-50f-save',
};

// 跨关公共规则数值（sim 从 data/floorgen 读取；这里放全局项）
export const GAME = {
  FLOORS: 50,
  MAX_LEVEL: 50,
  START: { level: 1, hp: 200, maxHp: 200, attack: 15, defence: 10, exp: 0, nextExp: 9 },
  BASE_CRIT: 0.1,            // 玩家基础暴击率（原作 CRIT 0.1）
  DODGE: 0.05,               // 玩家闪避（原作 MISS 0.05）
  COMBO_MAX: 10,             // 连击上限
  COMBO_ATK: 0.03,           // 每层连击 +3% 攻击
  COMBO_CRIT: 0.05,          // 每层连击 +5% 暴击率
  POTION_SMALL_RATIO: 0.25,  // 小血瓶回 25% 最大生命
  POTION_LARGE_RATIO: 0.5,   // 大血瓶回 50% 最大生命
  GEM_ATK: 10,               // 红宝石 +10 攻击（原作）
  GEM_DEF: 3,                // 蓝宝石 +3 防御（原作）
  STONES_NEEDED: 6,          // 6 颗灵石升一级武器/盾
  SWORD_BASE: [10, 22, 38, 58, 84, 116],  // 剑 6 阶基础攻击
  SHIELD_BASE: [6, 13, 22, 34, 50, 70],   // 盾 6 阶基础防御
  ENHANCE_ATT: 3,            // 商店强化剑每次 +攻击
  ENHANCE_DEF: 2,            // 商店强化盾每次 +防御
  ENHANCE_MAX: 5,            // 每件装备强化上限
  TUTORIAL_STEPS: 3,
  STAR_HP_RATIO: 0.6,        // 满血 ≥60% 加 1 星
  STAR_KILL_RATIO: 0.5,      // 击杀 ≥50% 加 1 星
};
