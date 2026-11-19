// 全局数值配置（Lead 拥有；数值只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 玩法安全区（避开顶部 HUD 与底部触控条，视觉评审不判遮挡）
  MIN_X: 24,
  MAX_X: 1256,
  MIN_Y: 60,
  MAX_Y: 596,
};

export const STEP = 1 / 60;

// 布局常量（render 计算；sim 不依赖像素，只用安全区）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  CTRL_H: 112,          // 底部触控条高
  DPR_MAX: 2,
};

// 语言：默认英文；zh 必做；只暴露 locales 里真实存在的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'wildland-rally-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'wildland-rally-save',
};

// 三型敌人（对应源码 hero_config 的血量/速度骨架，换皮为霓虹赛车）
export const ENEMY = {
  1: { name: 'scout', hp: 220, speed: 185, dmg: 24, fireCd: 1.0, projSpeed: 270, radius: 16, score: 100, color: '#ff4d6d' },
  2: { name: 'striker', hp: 180, speed: 215, dmg: 20, fireCd: 0.75, projSpeed: 310, radius: 15, score: 120, color: '#ff9e3d' },
  3: { name: 'brute', hp: 300, speed: 170, dmg: 34, fireCd: 1.15, projSpeed: 240, radius: 20, score: 150, color: '#d94fff' },
};

export const PLAYER = {
  hp: 300,
  speed: 250,
  radius: 17,
  basicDmg: 60,
  basicCd: 0.5,
  basicRange: 340,
  projSpeed: 620,
  dashCd: 2.2,
  dashDist: 150,
  dashInvuln: 0.25,
  novaCd: 8,
  novaRadius: 175,
  novaDmg: 150,
  expPerKill: 24,
  expPerLevel: 100,
  dmgPerLevel: 0.1,
  maxLevel: 15,
  fireRange: 290, // 敌人开火距离（玩家射程略长：风筝才有收益）
};

export const PICKUP = {
  ttl: 10,
  dropChance: 0.34,
  interval: 6,
  maxField: 6,
  heal: 40,
  shieldTime: 3,
  speedBoost: 60,
  speedTime: 5,
  magnetTime: 6,
};

export const MATCH = {
  waves: 4,
  waveGap: 2.0,
  comboWindow: 3,
  comboMax: 5,
};

export const GAME = {
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,
};
