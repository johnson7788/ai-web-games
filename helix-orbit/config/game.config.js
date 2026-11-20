// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），层形轮换在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  TOWER_X: 640,     // 塔中心屏幕 x
  BALL_Y: 468,      // 球固定屏幕 y（塔层随深度上移）
  RING_RX: 424,     // 层椭圆半长轴（px）
  RING_RY: 122,     // 层椭圆半短轴（px）
  LAYER_GAP: 60,    // 相邻层屏幕间距（px）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'helix-orbit-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'helix-orbit-save',
};
