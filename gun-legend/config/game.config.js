// GUN LEGEND · 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，关卡/场景/武器在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,   // 逻辑世界宽（px）
  HEIGHT: 720,   // 逻辑世界高（px）
};

export const STEP = 1 / 60; // 固定步长（秒），60Hz

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'gun-legend-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'gun-legend-save',
};
