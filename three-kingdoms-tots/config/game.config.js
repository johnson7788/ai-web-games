// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 战场布局常量（render 由此计算几何；sim 不依赖像素，只认 lane / x）
export const LAYOUT = {
  HUD_H: 44,           // 顶部 HUD 条高
  HAND_H: 96,          // 底部卡牌手牌条高
  FIELD_TOP: 44,       // 战场顶（HUD 之下）
  FIELD_BOT: 624,      // 战场底（手牌条之上）
  LANE_Y: [240, 434],  // 两条兵线中心 Y
  PLAYER_SPAWN_X: 96,  // 我方出兵 X
  ENEMY_SPAWN_X: 1184, // 敌方出兵 X
  KEEP_PLAYER_X: 40,   // 我方主城 X
  KEEP_ENEMY_X: 1240,  // 敌方主城 X
  TOWER_PLAYER_X: 300, // 我方箭塔 X
  TOWER_ENEMY_X: 980,  // 敌方箭塔 X
  DPR_MAX: 2,
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'three-kingdoms-tots-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'three-kingdoms-tots-save',
};

// 战斗规则数值（sim 从 levels/game.config 读取）
export const GAME = {
  ENERGY_START: 5,
  ENERGY_MAX: 10,
  ENERGY_REGEN: 1.0,      // 每秒回能
  BATTLE_TIME: 180,       // 单局时长（秒）
  OVERTIME_HOLD: 0,       // 时间到 → 攻城方战败
  COMBO_WINDOW: 3.0,      // 连击窗口（秒）
  COMBO_ENERGY_EVERY: 3,  // 每 3 连击 +1 能量
  STAR_HP_RATIO: 0.6,     // 剩余主城血量 ≥60% → +1 星
  STAR_TIME: 90,          // ≤90 秒通关 → +1 星
  KEEP_RANGE: 300,        // 主城射程
  KEEP_ATK: 26,           // 主城攻击
  KEEP_CD: 1.6,           // 主城攻击间隔
  TOWER_ATK: 15,          // 箭塔攻击
  TOWER_CD: 1.1,          // 箭塔攻击间隔
  TOWER_RANGE: 200,       // 箭塔射程
  TOWER_HP: 300,          // 箭塔血量
  ENEMY_LEVEL_STAT: 1.28, // 敌方 L2+ 单位属性放大
  SHAKE_AMP: 5,           // 命中震屏幅度
  TUTORIAL_STEPS: 3,
};
