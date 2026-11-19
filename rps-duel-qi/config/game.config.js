// 全局配置（数值只改这里）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'rps-duel-qi-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'rps-duel-qi-save',
};

// 玩法数值（sim 读取）
export const GAME = {
  TOTAL_ROUNDS: 30,            // 打满 30 回合 = 通关（Master the arena）
  ANGER_START: 1,              // 怒气 1..5，5 = 游戏结束
  ANGER_MAX: 5,
  QI_MAX: 5,                   // 每 5 胜攒满一气
  ROUND_TIME_BASE: 3.0,        // score<=10 时每回合倒计时
  ROUND_TIME_BY_ANGER: { 1: 2.5, 2: 2.5, 3: 2.0, 4: 1.5 }, // score>10 后随怒气提速
  SETTLE_TIME: 0.8,            // 回合结算 → 下一回合的间隔
  // boss 出手概率（P0 1:1）：paper 40% / rock 20% / scissors 40%
  BOSS_WEIGHTS: [['paper', 0.4], ['rock', 0.2], ['scissors', 0.4]],
  COMBO_STAR: 6,               // 连击 ≥6 → 至少 2 星
};
