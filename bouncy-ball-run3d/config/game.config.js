// 全局数值配置 — BOUNCY BALL RUN3D（3D 螺旋塔跳球 · 霓虹街机）
// 玩法数值 1:1 还原自参考源码《欢乐球球》的 P0 事实（见 docs/batch3/bouncy-ball-run3d.md）。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 塔与球的物理/结构参数
export const TOWER = {
  N_SLOTS: 6,        // 每层圆环切成的槽位数（60° 一槽）
  SEG_ARC: 60,       // 单槽角度（度）
  NUM_DISCS: 12,     // 常驻层数（循环回收，无限塔）
  SPACING: 8,        // 相邻层中心垂直间距（原版 floor 间距 8）
  RADIUS: 3.5,       // 段块中心半径（原版 Cube 位于 z=3.5）
  SEG_W: 4,          // 段块切向宽（原版 lscale.x = 4）
  SEG_D: 4,          // 段块径向深（原版 lscale.z = 4）
  THICK: 1,          // 段块高（原版 lscale.y = 1）
  BALL_R: 0.5,
  GRAVITY: 20,       // 重力加速度（原版 gravity_y = -20，取模）
  BOUNCE_V: 10,      // 弹起速度（原版 velocity_y = 10）
  MAX_FALL: 10,      // 下落速度上限（原版封顶 velocity_y）
  DEADLOCK_LIMIT: 2, // 连续撞同一段块的容错次数（原版 _deadlockCount >= 2 判死）
  TARGET_FLOORS: 30, // 抵达第 30 层 = 通关（结算闭环）
  ROT_SPEED: 300,    // 键盘/自对弈旋转速度（度/秒）
  ROT_FACTOR: 0.75,  // 拖拽每像素旋转度数（原版 rotFactor = 0.75）
};

// 星级评级：按抵达层数
export const RATING = {
  star1: 10,
  star2: 20,
  star3: 30,
};

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bouncy-ball-run3d-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'bouncy-ball-run3d-save',
};
