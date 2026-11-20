// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  MARGIN: 24,       // 战场边界（桌面边缘）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'battle-royale-mini-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'battle-royale-mini-save',
};
