// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），鱼种在 config/fishes.js，关卡在 config/levels.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  CANNON_X: 640,   // 炮台固定底部中心
  CANNON_Y: 690,   // 炮口 y（子弹出生点）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'fish-frenzy-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'fish-frenzy-save',
};
