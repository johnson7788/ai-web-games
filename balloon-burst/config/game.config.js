// 全局数值配置（Lead 拥有；数值改动只改这里）
// 契约：1280×720 逻辑世界 + letterbox，60Hz 固定步长；sim 不依赖像素。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算灯笼网格几何（sim 只给 r,c）
export const LAYOUT = {
  HUD_H: 46,            // 顶部 HUD 条高
  MARGIN_X: 26,         // 左右安全边
  MARGIN_Y: 18,
  CELL_MAX: 108,        // 单格上限
  GLOW_R: 60,           // 升空灯笼光晕半径
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 未翻译不暴露。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'balloon-burst-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'balloon-burst-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  MANUAL_MIN: 2,          // 手动点击最小同色群
  CASCADE_MIN: 3,         // 连锁自动消的最小群
  SHIFT_INTERVAL: 5,      // 变色灯笼换色间隔（秒）
  BIG_CLEAR_MIN: 6,       // 单次消除达到该数量 → 大场面（孔明灯升空）
  STAR_TIME_RATIO: 0.35,  // 剩余时间 ≥35% → +1 星
  STAR_BIG_RATIO: 1,      // 达成 big clear → +1 星
  TIME_LANTERN_BONUS: 5,  // 时间灯笼补秒
  BASE_PER_LANTERN: 10,   // 单灯基准分（组分数 = n² × base）
};

// 灯笼颜色（顺序即难度推进，sim 按 level.colors 取前 N 个）
export const LANTERN_COLORS = ['coral', 'amber', 'gold', 'jade', 'sky', 'violet'];
