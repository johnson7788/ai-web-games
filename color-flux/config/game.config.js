// COLOR FLUX · 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），场景主题在 src/render/theme.js（M2）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BALL_X: 640,      // 萤固定屏幕 x（垂直上跳，同 Color Switch）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'color-flux-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'color-flux-save',
};
