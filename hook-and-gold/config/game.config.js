// Hook & Gold · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算钩臂/海面/物件区几何（sim 只存逻辑坐标，不依赖像素）
export const LAYOUT = {
  HUD_H: 44,             // 顶部 HUD 条高
  PIVOT: { x: 640, y: 172 },  // 锚爪摆动支点（船下方）
  SURFACE_Y: 150,        // 海面（船体基线）
  FIELD: { x0: 70, x1: 1210, y0: 268, y1: 660 }, // 物件生成区
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hook-and-gold-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'hook-and-gold-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  ROTATE_RANGE_DEG: 72,    // 钟摆角度幅度（度）
  SWING_SPEED: 2.6,        // 钟摆角频率（越大越快）
  EXTEND_SPEED: 820,       // 伸出速度 px/s
  RETURN_SPEED: 760,       // 回收基速 px/s（重量 100 → 1x）
  MAX_LEN: 780,            // 最大绳长
  IDLE_LEN: 46,            // 待机锚爪垂挂长度
  MIN_LEN: 46,             // 回收到位判据
  HOOK_RADIUS: 22,         // 锚爪命中半径
  WEIGHT_NORM: 100,        // 1x 回收速度对应重量
  DYNAMITE_PER_LEVEL: 2,   // 每局「弃钩炸药」次数
  EXPLOSION_RADIUS: 135,   // 炸药桶爆炸半径
  STING_TIME: 5,           // 水母蜇伤扣秒数
  TUTORIAL_STEPS: 3,
};
