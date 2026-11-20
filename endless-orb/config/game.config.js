// 全局常量配置：世界尺寸 / 固定步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js，12 环定义在 config/levels.js，升级在 config/upgrades.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CORE_X: 640, // 能量核默认圆心 x
  CORE_Y: 320, // 能量核默认圆心 y
  LAUNCH_X: 640, // 光子发射口 x
  LAUNCH_Y: 680, // 光子发射口 y
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'endless-orb-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'endless-orb-save',
};
