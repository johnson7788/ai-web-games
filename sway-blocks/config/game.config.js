// 全局数值配置（Lead 拥有；数值改动只改这里）
// 坐标：像素，y 向下。世界 1280×720 横屏，锚点在上方，平台在底部。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 据此绘制（sim 只依赖 GAME，不依赖像素布局）
export const LAYOUT = {
  HUD_H: 46,            // 顶部 HUD 条高
  ANCHOR_Y: 92,         // 锚点（绳顶端）默认 y
  GROUND_Y: 600,        // 平台大致落点 y（仅美术参考）
};

// 游戏规则数值（sim 读取；跨关公共项）
export const GAME = {
  GRAVITY: 2400,        // px/s²（向下）
  ANCHOR_Y: 40,         // 锚点（绳顶端）y
  AUTO_DROP_SEC: 5.0,   // 无输入自动松手兜底
  SPAWN_DELAY_SEC: 0.65,// 松手后到下一块出现
  BALANCE_SEC: 3.5,     // 最后一块落下后的平衡倒计时
  PERFECT_RAD: 0.11,    // 完美松手窗口（与竖直线的弧度偏差）
  DROP_DAMP: 0.0,       // 松手时水平速度保留比例（手感辅助：0=垂直落下，只留时机挑战）
  FALL_Y: 800,          // 低于此 y 判定坠落失败
  COMBO_SCORE: 100,     // 完美每次基础分（×连击）
  DROP_SCORE: 20,       // 普通落子基础分
  STAR2_PERFECTS: 1,    // 2 星所需完美次数
  STAR3_RATIO: 0.5,     // 3 星所需完美占比
  TUTORIAL_STEPS: 3,
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sway-blocks-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sway-blocks-save',
};
