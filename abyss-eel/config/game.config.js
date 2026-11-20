// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），渲染主题在 src/render/theme.js（M2）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HEAD_Y: 540,      // 鳗头固定屏幕 y
  ORB_GAP: 34,      // 珠链间距（渲染/轨迹采样）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'abyss-eel-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'abyss-eel-save',
};
