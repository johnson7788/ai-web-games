// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算战场/HUD 几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,             // 顶部 HUD 条高
  STAGE_W: 480,          // 战区舞台宽
  STAGE_H: 460,          // 战区舞台高
  MARGIN: 20,
};

// 语言：默认英文；zh 必做；完整翻译后才加入更多（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'idle-tycoon-forever-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'idle-tycoon-forever-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  COMBO_CASH_PER_STACK: 0.2,   // 连击每层现金加成
  COMBO_MAX: 10,               // 连击现金加成封顶层数
  IDLE_CASH_BASE: 2,           // 被动收入基础（每秒，随等级/垄断成长）
  IDLE_CASH_PER_LV: 1.5,       // 每等级被动收入
  REVIVE_HP_FULL: true,        // 复活/换对手回满血
  STAR_HP_RATIO: 0.5,          // 剩余估值 ≥50% 得 1 星
  STAR_SPEED_SEC: 40,          // 清空街区 ≤40s 得 1 星
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,                // 命中震屏幅度（px）
};
