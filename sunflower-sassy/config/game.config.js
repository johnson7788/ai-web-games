// 全局数值配置（本游戏 builder 拥有；数值改动只改这里）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sunflower-sassy-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sunflower-sassy-save',
};

// 跨模块共享的游戏规则常量（sim 里也有独立定义，这里供 main/render 读取）
export const GAME = {
  ROUND_TIME: 40,       // 单局秒数（P0 1:1）
  QUEUE_LEN: 7,         // 方向牌队列长度（P0 1:1）
  MAX_HEARTS: 3,        // 生命（新机制：失误只掉心）
  FEVER_COMBO: 20,      // 连击达到 20 触发 FEVER（新机制）
  STAR_2: 800,          // 2 星分数线（新机制）
  STAR_3: 2000,         // 3 星分数线（新机制）
};
