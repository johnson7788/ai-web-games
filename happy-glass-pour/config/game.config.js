// 全局数值配置（builder 拥有；数值改动只改这里）
// 世界坐标系：左上角原点，y 向下（与 canvas 一致）。宽 1280 × 高 720（横版场地）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

// 固定步长（60Hz）
export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；其余语言完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'happy-glass-pour-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'happy-glass-pour-save',
};

// 玩法数值（sim 从 config/levels.js 读关卡；这里放跨关公共项）
export const GAME = {
  GRAVITY: 2200,            // 重力加速度（px/s²，向下为正）
  DROP_R: 8,                // 水滴碰撞半径
  LINE_HALF: 10,            // 画线半厚（碰撞半宽）
  DROP_MAX_SPEED: 2400,     // 水滴速度上限（防穿透）
  RESTITUTION: 0.12,        // 水滴法向反弹系数
  TANGENT_KEEP: 1.0,        // 水滴切向保留（光滑轨道，无切向摩擦）
  BOX_RESTITUTION: 0.15,    // 动态箱体反弹
  BOX_TANGENT_KEEP: 0.9,    // 动态箱体切向保留
  BOX_FLOOR_BOUNCE: 0.05,   // 箱体落地反弹
  BOX_FLOOR_FRICTION: 0.92, // 箱体落地摩擦
  SUBSTEPS: 10,             // 每帧物理子步
  COMBO_WINDOW: 0.4,        // 连击窗口（秒）
  INK_STAR_RATIO: 0.5,      // 剩余墨水 ≥50% → +1 星
  MAX_LINES: 6,             // 最多可画线数（防滥用）
  DROP_SPEED: 300,          // 水滴初速（沿源方向）
  DROP_JITTER: 7,           // 水滴初始随机偏移（±px）
  SOURCE_OFFSET: 26,        // 出生点沿源方向偏移
  FLOOR_Y: 694,             // 场地底部（以下为岩浆/失水区）
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
