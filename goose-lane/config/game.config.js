// config/game.config.js — 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js；关卡推进在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  ROAD_LEFT: 170,        // 道路左边界（车道外是人行道/护栏）
  ROAD_RIGHT: 1110,      // 道路右边界
  PLAYER_Y: 560,         // 大鹅固定屏幕 y（世界往前滚，鹅不动）
  LANE_X: [330, 640, 950], // 三条车道中心 x
  LANE_W: 260,           // 单车道视觉宽度
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'goose-lane-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'goose-lane-save',
};
