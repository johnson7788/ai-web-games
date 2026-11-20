// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，场景包在 config/segments.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 560,   // 地面 y（px，逻辑世界）
  PLAYER_X: 300,   // 柯基固定屏幕 x（横向跑酷：世界左滚，角色横坐标不动）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'corgi-dash-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'corgi-dash-save',
};
