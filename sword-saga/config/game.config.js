// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（战斗数值/五行/技能/敌人），剧情在 config/story.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 40,                 // 地图瓦片尺寸（世界坐标 1280×720 → 32×18 格，但逻辑用更细的 tile）
  MAP_COLS: 24,
  MAP_ROWS: 14,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sword-saga-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sword-saga-save',
};
