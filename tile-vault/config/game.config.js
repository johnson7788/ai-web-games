// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算宝库堆/底部槽几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,             // 顶部 HUD 条高
  MARGIN_X: 24,          // 左右安全边
  TRAY_H: 96,            // 底部槽高度
  TRAY_SLOT: 72,         // 槽位单格宽
  TILE_W: 66,            // 等距块菱形宽
  TILE_H: 33,            // 等距块菱形高（2:1 投影）
  TILE_LIFT: 32,         // 每层向上抬升
  BODY_H: 24,            // 块侧面高度
  BAG_W: 120,            // 钱袋宽
  BAG_H: 120,            // 钱袋高
};

// 语言：默认英文；zh 必做（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'tile-vault-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'tile-vault-save',
};

// 游戏规则数值（跨关公共项；每关数值在 config/levels.js）
export const GAME = {
  REVIVES_PER_LEVEL: 2,   // 每关重试次数（原作 Energy 结构的简化）
  REVIVE_TIME_BONUS: 30,  // 重试额外补时（秒）
  STAR_TIME_RATIO: 0.25,  // 剩余时间 ≥25% 初始时间 → +1 星
  STAR_REVIVE_BONUS: true,// 未用重试 → +1 星
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
