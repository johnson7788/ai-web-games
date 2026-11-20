// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js（纯逻辑），渲染主题在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HALL_FLOOR_Y: 600,   // 大厅地面线（机台摆放基准）
  CABINET_Y: 470,      // 三台机台顶部
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'arcade-treasure-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'arcade-treasure-save',
};
