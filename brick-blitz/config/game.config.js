// BRICK BLITZ · 全局数值配置（Lead 拥有；数值改动只改这里）
// 1280×720 逻辑世界 + letterbox；60Hz 固定步长。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  TOP_WALL: 0,          // 球反弹上边界（Y 最小）
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块不暴露（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'brick-blitz-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'brick-blitz-save',
};

// 玩法数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  START_LIVES: 3,
  BALL_R: 9,
  BALL_SPEED: 460,          // 基准球速 px/s
  LAUNCH_ANGLE: 0.55,       // 发射角（弧度，偏离垂直向上）
  SERVE_DELAY: 0.6,         // 自动发球延迟（无输入也会推进）
  TOP_WALL: 4,

  PADDLE_W: 120,
  PADDLE_W_WIDE: 200,
  PADDLE_H: 18,
  PADDLE_Y: 648,
  PADDLE_SPEED: 1080,       // 挡板追踪目标速度 px/s
  KEY_NUDGE: 12,            // 键盘每帧移动目标量 px
  PADDLE_ANGLE_RANGE: 112,  // 挡板反弹最大偏离角（度）

  BRICK_TOP: 96,
  BRICK_H: 26,
  BRICK_GAP: 6,
  BRICK_MARGIN_X: 24,

  POWER_FALL_SPEED: 150,
  POWER_DROP_CHANCE: 0.16,
  POWER_DURATION: 12,       // wide/pierce 持续秒数
  POWER_SIZE: 22,

  KILN_HITS: 3,             // 三连击不落底
  KILN_DURATION: 2.6,       // 窑火全开持续秒数
  KILN_SPEED_MUL: 1.28,     // 窑火期间球加速

  BLAST_RADIUS: 66,         // 炸窑砖波及半径 px

  DESCEND_SPEED: 9,         // 下压阵砖墙缓降速度 px/s
  DESCEND_LINE: 560,        // 砖块压到这条线判负

  COMBO_RESET_ON_PADDLE: false,
};

// 关卡砖型 → 耐久 / 分数（render 按 kind + hp 取色）
export const BRICK_KINDS = {
  '1': { kind: 'normal', hp: 1, score: 10 },
  '2': { kind: 'hard',   hp: 2, score: 25 },
  '3': { kind: 'hard',   hp: 3, score: 40 },
  'g': { kind: 'gold',   hp: 1, score: 100 },
  'b': { kind: 'blast',  hp: 1, score: 30 },
};
