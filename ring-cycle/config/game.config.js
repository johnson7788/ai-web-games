// config/game.config.js — 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（M1），渲染主题在 src/render/theme.js（M2）
export const WORLD = {
  WIDTH: 1280,       // 逻辑世界宽（px）
  HEIGHT: 720,       // 逻辑世界高（px）
  BALL_Y: 600,       // 糖球固定屏幕 y（世界向下滚动，环从上方下落）
  PX_PER_METER: 10,  // depth（米）= 累计滚动像素 / 10
};

export const STEP = 1 / 60; // 固定步长（秒）

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ring-cycle-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ring-cycle-save',
};
