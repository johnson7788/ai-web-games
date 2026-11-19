// 全局数值配置（WORLD/STEP/CONFIG）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 600,       // 地面线（脚底）
  SELF_X: 240,         // 玩家站立 x
  OTHER_X: 1040,       // 对手站立 x
  BODY_W: 70,          // 命中判定体宽
  BODY_TOP: 240,       // 命中判定体顶（相对头顶）
  BODY_BOT: 600,       // 命中判定体底
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；只暴露 locales 里真实完整的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'wushen-sword-dome-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'wushen-sword-dome-save',
  tutorialKey: 'wushen-sword-dome-tutorial-done',
};
