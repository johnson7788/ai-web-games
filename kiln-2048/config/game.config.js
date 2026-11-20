// KILN 2048 · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 窑腔几何（逻辑坐标）。render 由此换算，sim 只用 KILN / GAME 数值。
// 窄窑腔关卡通过 levels 里的 kilnInset 把左右墙内收。
export const KILN = {
  LEFT: 380,           // 左墙
  RIGHT: 900,          // 右墙
  FLOOR_Y: 656,        // 窑底
  FAIL_LINE_Y: 150,    // 顶部失败线（堆过判负）
  SPAWN_Y: 92,         // 投放点（持球中心 y，位于失败线上方）
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  GRAVITY: 1500,           // px/s²
  RESTITUTION: 0.16,       // 球-球 / 球-底 恢复系数（低=快速安定）
  WALL_RESTITUTION: 0.32,  // 侧墙反弹
  CONTACT_DRAG_X: 0.985,   // 接触时水平摩擦
  COLLISION_ITERS: 6,      // 每子步碰撞求解迭代
  SUBSTEPS: 2,             // 每帧子步数（防隧穿）
  SLEEP_SPEED: 24,         // 低于此速度视为静止（px/s）
  SLEEP_FRAMES: 20,        // 连续多少子步低于阈值进入睡眠
  R_BASE: 21,              // 球半径基数；r = R_BASE*(1+log2(v)/10)
  ELIMINATE_AT: 2048,      // 默认出窑阈值（关卡可覆盖）
  MAX_VALUE: 2048,         // 最大数值
  SPAWN_DELAY: 0.28,       // 投放后生成下一持球间隔（秒）
  FAIL_GRACE: 0.6,         // 静止越过失败线多久判负（秒）
  DROPS_OUT_GRACE: 1.0,    // 投放耗尽后等多久结算失败（秒）
  HAMMER_MAX: 2,
};

export const LAYOUT = {
  HUD_H: 44,
};

// 语言：默认英文；zh 必做；只暴露完整语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'kiln-2048-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'kiln-2048-save',
};
