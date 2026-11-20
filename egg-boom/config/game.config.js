// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，关卡定义在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  EGG_X: 220,       // 弹簧蛋固定屏幕 x
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'egg-boom-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'egg-boom-save',
};
