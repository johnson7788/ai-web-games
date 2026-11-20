// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言。
// 玩法数值在 config/gameplay.js，字母/关卡数据在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,      // 逻辑世界宽（px）
  HEIGHT: 720,      // 逻辑世界高（px）
};

export const STEP = 1 / 60; // 固定步长（秒）

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'abc-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'abc-pop-save',
};
