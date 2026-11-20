// LAUNCH LEGENDS · 全局数值配置（Lead 拥有；数值改动只改这里）
// 烟花弹向上攀升：自动弹跳 + 左右横移，撞碎云絮得分/充能，炽热态烧穿钢棚，高度即分数。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算火箭弹跳带 / 云层间距（sim 不依赖像素，只依赖 r,c 与归一化进度）
export const LAYOUT = {
  HUD_H: 52,          // 顶部 HUD 条高
  FLOOR_Y: 560,       // 弹跳下界（火箭落地弹起处）
  CEIL_Y: 150,        // 弹跳上界（火箭顶点 = 撞层判定线）
  LAYER_SPACING: 72,  // 云层在屏幕上的垂直间距
  BAR_H: 30,          // 每层障碍条厚度
  LAUNCH_PAD_Y: 620,  // 发射台顶部
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'launch-legends-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'launch-legends-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  MOVE_SPEED: 520,        // 横移速度 px/s
  BASE_BOUNCE: 0.85,      // 基础弹跳周期（秒/层）
  MIN_BOUNCE: 0.5,        // 加速后的弹跳周期下限
  BOUNCE_STEP: 0.965,     // 每撞碎一片云絮，弹跳周期 × 此系数（更快爬升）
  FUSE_MAX: 100,          // 引信蓄能上限（满了自动进入炽热态）
  FUSE_PER_CLOUD: 34,     // 每片云絮充能（3 片满）
  INCANDESCENT: 3.5,      // 炽热态持续秒数
  FIREWORK_EVERY: 5,      // 每爬升 5m 绽放一圈迷你烟花（签名记忆点）
  WALL_ZONE: 64,          // 侧壁反弹判定区（贴墙边缘 px）
  RAIN_SLOW: 1.45,        // 阵雨带内弹跳周期倍率（下压减速）
  CLOUD_SHIFT_AMP: 90,    // 移动云台水平摆动幅度 px
  CLOUD_SHIFT_RATE: 2.2,  // 移动云台摆动角速度
  STAR_CLOUD_RATIO: 0.5,  // 云絮星：本关撞碎云絮数 ≥ ceil(targetHeight×此值) 才 +1 星
};
