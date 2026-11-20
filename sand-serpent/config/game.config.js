// Sand Serpent · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算网格/侧栏几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  MARGIN_X: 24,         // 左右安全边
  MARGIN_Y: 16,
  SIDE_W: 150,          // 右侧信息栏宽（食物图鉴 + 目标进度）
  SIDE_GAP: 16,         // 网格与信息栏间距
  CELL_MAX: 60,         // 单格上限
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sand-serpent-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sand-serpent-save',
};

// 游戏规则数值（sim 从 levels 读取单关项；这里放跨关公共项）
export const GAME = {
  START_LENGTH: 3,        // 初始蛇长（头 + 2 节身体）
  BASE_INTERVAL: 0.16,    // 默认每步秒数（约 6.25 步/秒）
  BOOST_INTERVAL: 0.085,  // 加速带生效时的每步秒数
  BOOST_STEPS: 14,        // 踩一次加速带持续多少步
  SCORPION_STEP_EVERY: 3, // 蝎子每隔多少蛇步横逃一次
  SANDSTORM_EVERY: 11,    // 沙暴每隔多少秒触发一次（仅沙暴关）
  SANDSTORM_DURATION: 2,  // 每次沙暴持续秒数
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,           // 撞死/吃高价值食物的震屏幅度（px）
};

// 食物数值：value = 得分数；grow = 净增长节数（骆驼刺 +5 分但掉一节尾巴 → 净 +4 节）
export const FOOD = {
  beetle: { value: 1, grow: 1, label: 'beetle' },
  scorpion: { value: 3, grow: 3, label: 'scorpion' },
  thorn: { value: 5, grow: 4, label: 'thorn' },
};
