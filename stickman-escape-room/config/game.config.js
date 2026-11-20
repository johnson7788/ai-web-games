// STICKMAN ESCAPE ROOM · 全局数值配置（Lead 拥有；数值改动只改这里）
// 主题：霓虹街机。玩法：在天花板压下来之前，站进唯一的安全缺口逃出密室。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高
  MARGIN_X: 28,         // 左右安全边
  MARGIN_Y: 16,
  COL_GAP: 6,           // 柱子间隙
  PLAYER_H: 64,         // 火柴人身高
  CEILING_THICK: 40,    // 天花板厚度
  SPIKE_H: 22,          // 天花板尖刺长度
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'stickman-escape-room-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'stickman-escape-room-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  COLUMNS: 9,             // 柱子数（0..8）
  PLAYER_START: 4,        // 玩家初始列
  MAX_LEVEL: 8,           // 逃出第 8 关即通关
  BOOST_PER_LEVEL: 1,     // 每关冲刺次数
  SCORE_GEM: 10,
  SCORE_SHIELD: 5,
  SCORE_SLOW: 5,
  SCORE_SURVIVE: 50,      // 存活基础分（× combo）
  COMBO_STAR_AT: 3,       // 连击 ≥3 额外 +1 星
  SETTLE_STAR: true,      // 天花板落下前已就位 +1 星
  SHIELD_MAX: 3,          // 护盾持有上限
  SLOW_MAX: 2,            // 减速持有上限
  TUTORIAL_STEPS: 4,
};
