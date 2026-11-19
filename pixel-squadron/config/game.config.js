// PIXEL SQUADRON · 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算画面几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高
  PLAYER_Y: 640,        // 玩家飞船的固定底部高度
  SAFE_X: 34,           // 左右安全边
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'pixel-squadron-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'pixel-squadron-save',
};

// 跨关公共规则数值（sim 从 levels/game.config 读取）
export const GAME = {
  COMBO_WINDOW: 2.5,        // 连击不杀敌后的衰减窗口（秒）
  COMBO_MAX: 8,             // 连击倍率上限
  PLAYER_INVULN: 1.0,       // 受击后的无敌时间（秒）
  STAR_COMBO_DEFAULT: 4,    // 连击峰值达到多少给 1 星
  STAR_HP_RATIO: 0.5,       // 剩余血量 ≥ 该比例给 1 星
  SHAKE_AMP: 4,             // 命中/爆炸小震屏幅度（px）
};
