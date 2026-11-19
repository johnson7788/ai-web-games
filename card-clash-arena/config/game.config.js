// 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 60,             // 顶部 HUD 条高（DOM，不透明）
  ACTION_H: 96,          // 底部动作条预留（canvas 逻辑像素）
  HAND_Y: 470,           // 手牌区上沿
  HAND_H: 145,           // 手牌高度
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'card-clash-arena-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'card-clash-arena-save',
};

// 游戏规则数值
export const GAME = {
  MAX_HEALTH: 10,
  HAND_SIZE: 5,
  DECK_SIZE: 28,
  TURN_TIME: 20,          // 每回合限时（秒），超时自动出牌
  REVEAL_TIME: 0.9,       // 属性揭晓停留（秒）
  RESOLVE_TIME: 1.25,     // 结算展示停留（秒）

  BUFF_COST: 40,          // 强化：本回合出牌属性 ×1.1
  DEBUFF_COST: 60,        // 削弱：敌方属性 ×0.85
  OVERDRIVE_COST: 80,     // 超频（新机制）：本回合出牌属性 ×2
  CANCEL_COST: 100,       // 掀桌：本回合互相 0 伤害

  BUFF_INC: 1.1,
  DEBUFF_DEC: 0.85,
  OVERDRIVE_INC: 2.0,

  WIN_REWARD_PER_DMG: 10, // 赢一回合每点伤害换金币
  LOSE_REWARD_PER_DMG: 5, // 输一回合每点伤害的安慰金币

  // 连击（新机制）：连胜累计，额外伤害
  COMBO_BONUS_1: 1,       // 连击 ≥2 额外伤害
  COMBO_BONUS_2: 2,       // 连击 ≥4 额外伤害
  COMBO_BONUS_1_AT: 2,
  COMBO_BONUS_2_AT: 4,

  // 星级（新机制）：结算 1–3 星，按剩余生命
  STARS_3_AT: 8,          // 剩余生命 ≥8 → 3 星
  STARS_2_AT: 5,          // 剩余生命 ≥5 → 2 星

  // 敌方 AI：按「当前属性最高卡」出牌的概率，其余随机
  ENEMY_BEST_P: 0.62,

  HEARTBEAT_SEC: 1.0,     // 心跳事件间隔（压 maxEventGap）
};
