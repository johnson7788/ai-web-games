// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键（Lead 所有）
// 玩法数值在 config/gameplay.js（M1），渲染主题在 src/render/theme.js（M2）
export const WORLD = {
  WIDTH: 1280, // 逻辑世界宽（px）
  HEIGHT: 720, // 逻辑世界高（px）
  CANNON_X: 640, // 炮台底座 x
  CANNON_Y: 646, // 炮台底座 y
  WALL_L: 96, // 左崖壁 x（<此值 = 弹射）
  WALL_R: 1184, // 右崖壁 x（>此值 = 弹射）
  FORTRESS_Y: 610, // 要塞线：目标越过此线即撞击要塞
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cannon-echo-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'cannon-echo-save',
};
