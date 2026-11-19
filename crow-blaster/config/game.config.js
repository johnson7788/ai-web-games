// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js，关卡在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  LAUNCHER_X: 640,
  LAUNCHER_Y: 620,
  SKY_TOP: 96,     // 乌鸦飞行带上沿（避开顶部 HUD 不透明条）
  SKY_BOTTOM: 470, // 乌鸦飞行带下沿
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露，其他语言整块不暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'crow-blaster-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'crow-blaster-save',
};
