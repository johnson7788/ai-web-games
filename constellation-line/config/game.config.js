// config/game.config.js — 全局常量：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；关卡在 config/levels.js；渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 玩法画布安全区（避开顶部 HUD / 底部边缘）
  PLAY_X: 80,
  PLAY_Y: 96,
  PLAY_W: 1120,
  PLAY_H: 600,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'constellation-line-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'constellation-line-save',
};
