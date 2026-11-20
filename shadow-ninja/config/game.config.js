// Shadow Ninja Cat · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 据此计算几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,             // 顶部 HUD 条高（不透明底，压任何场景都清晰）
  GROUND_LOW_Y: 560,     // 低层地面在屏幕上的 feet y（世界 y=0 对应这里）
  HIGH_H: 130,           // 高层平台相对低层的高度（世界单位，也是屏幕高度差）
  PLAYER_X: 240,         // 玩家固定屏幕 x
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'shadow-ninja-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'shadow-ninja-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  CELL_W: 96,             // 世界一格宽度（px）
  PLAYER_W: 34,           // 玩家碰撞体宽（用于前后支撑判断）
  PLAYER_H: 62,           // 玩家身高（决定跳跃时是否会撞飞镖）
  GRAVITY: 2400,          // 重力 px/s²
  JUMP_V: 830,            // 起跳速度（向上）→ 跳高 ≈142px，滞空 ≈0.69s
  DIVE_V: 1500,           // 俯冲速度（向下）
  HIGH: 130,              // 高层平台高度
  SPIKE_TOP: 26,          // 尖刺高度：y 高于它即安全
  SHURIKEN_LO: 72,        // 飞镖下沿：地面跑(y=0)头顶 62 安全，跳起即撞
  SHURIKEN_HI: 108,
  DEATH_Y: -46,           // 掉进深渊低于此 y 判死
  DOG_MUL: 1.35,          // 追击犬区间速度倍率
  GLIDE_H: 118,           // 滑索段自动滑行高度
  COUNTDOWN: 3,           // 开局倒计时秒数（含 GO）
  COYOTE_S: 0.10,         // 土狼时间
  JUMP_BUFFER_S: 0.14,    // 跳跃缓冲
  NEAR_MISS_DIST: 14,     // 差一点（nearMiss）判定余量 px
  PROP_DURATION: 4,       // 竹蜻蜓/吸金石/双倍 持续秒数
  REVIVE_CHIMES: 25,      // 复活价格（风铃）
};
