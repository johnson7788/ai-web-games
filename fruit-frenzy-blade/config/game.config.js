// 全局数值配置（单位：像素 / 秒 / 度）。所有玩法数值集中在这里，sim 只读不写。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

export const FRUIT = {
  radius: 46,             // 水果/炸弹/岩石的判定半径
  gravity: 980,           // 重力加速度（canvas 坐标系，向下为正）
  speedMin: 880,          // 抛出初速度下限
  speedMax: 1320,         // 抛出初速度上限
  angleMin: 70,           // 抛射角下限（相对 +x 轴）
  angleMax: 110,          // 抛射角上限
  spawnY: WORLD.HEIGHT + 60,
  rotateDuration: 3,      // 水果自转一圈秒数
  comboWindow: 1.2,       // 连击窗口（秒），超时清零
  frenzyThreshold: 5,     // 连击达到该值触发暴走
  frenzyDuration: 5,      // 暴走持续秒数
  frenzyCooldown: 3,      // 暴走结束后的冷却秒数
  normalBase: 1,          // 普通水果基础分
  goldenBase: 5,          // 金果基础分
  frenzyMult: 2,          // 暴走期间得分翻倍
};

export const LIVES = 3;

export const WAVE = {
  fruitPerWave: 10,       // 每 N 个水果推进一波
  spawnIntervalBase: 1.3, // 第 1 波生成间隔
  spawnIntervalMin: 0.55,
  bombBase: 0.10,         // 第 1 波炸弹概率
  bombStep: 0.04,         // 每波炸弹概率增量
  rockBase: 0.14,         // 第 2 波起岩石概率
  rockStep: 0.04,
  goldenBase: 0.06,       // 金果概率
  goldenStep: 0.01,
  goldenGuaranteeIndex: 7, // 第 8 个生成的水果必为金果（保证能触发 goldenSliced）
};

export const STARS = {
  one: 5,
  two: 25,
  three: 60,
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'fruit-frenzy-blade-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'fruit-frenzy-blade-save',
};
