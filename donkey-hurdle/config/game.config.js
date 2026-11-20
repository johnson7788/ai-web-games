// config/game.config.js — 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 560,     // 地面线（驴脚掌所在 y）
  PLAYER_X: 240,     // 驴固定在屏幕上的 x（自动奔跑，世界向左滚动）
  HORIZON_Y: 360,    // 地平线（天空/远景分界）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'donkey-hurdle-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'donkey-hurdle-save',
};
