// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，段位与场景包在 config/levels.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 660,       // 塔基（最底层岛）的底边 y（世界坐标，y 向下）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'stack-sky-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'stack-sky-save',
};
