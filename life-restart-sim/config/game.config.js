// 全局配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'life-restart-sim-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'life-restart-sim-save',
};

// 游戏规则数值（sim 从这里读跨内容公共项）
export const GAME = {
  ALLOC_POINTS: 20,     // 初始可分配点数（不含天赋加成）
  SPR_BASE: 5,          // 心境固定初始值
  TALENT_PICKS: 3,      // 每局可选天赋数
  TALENT_OFFER: 10,     // 天赋候选池数量
  MAX_AGE: 100,         // 寿命上限（到达即强制终局）
  LUCK_TARGET: 3,       // 幸运连击：连续 3 次好运触发一次天命馈赠
  AUTO_INTERVAL: 0.9,   // 自动播放：每年间隔（秒）
  // 生命阶段（用于推进率/关卡计数）
  STAGES: [0, 6, 13, 18, 60],
};
