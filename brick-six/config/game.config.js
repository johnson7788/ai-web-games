// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js，渲染主题在 config/gameplay.js 的 SCENE_PACKS。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BOARD_X: 640,     // 棋盘中心（逻辑坐标）
  BOARD_Y: 400,
  HEX_SIZE: 40,     // 六边形外接圆半径（像素）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'brick-six-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'brick-six-save',
};
