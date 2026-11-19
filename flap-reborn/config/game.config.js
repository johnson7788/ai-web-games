// 全局数值配置（纯逻辑与渲染共用）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 640,      // 地面顶部 y
  CEIL: 0,            // 天花板 y
};

export const STEP = 1 / 60;

// 小鸟（霓虹光点无人机）
export const BIRD = {
  X: 300,             // 水平位置固定
  R: 16,              // 碰撞半径
  GRAVITY: 1800,      // px/s²
  FLAP_VY: -430,      // 一次拍翼向上的初速度
  MAX_FALL: 820,      // 下落速度上限
};

// 管道（霓虹光柱）
export const PIPE = {
  WIDTH: 78,
  BASE_GAP: 170,
  BASE_SPEED: 165,
  SPACING: 320,       // 相邻管道中心间距
  FIRST_X: 1200,
};

// 能量光珠（收集物）
export const ORB = {
  R: 12,
  SCORE: 2,
  OFFSET: 0.12,       // 光珠相对间隙中心的偏移比例（制造「贴边吃珠」的风险）
  CHANCE: 0.75,       // 每个管道出现光珠的概率
};

// 护盾：吃珠充电，一次碰撞可抵消
export const SHIELD = {
  MAX: 1,
  INVULN: 0.9,        // 破盾后的短暂无敌秒数
};

// 擦边判定与连击
export const NEAR = {
  MARGIN: 22,         // 距管道边缘多少 px 内算「擦边」
  BONUS: 1,           // 擦边额外加分
  MAX_COMBO: 5,
};

// 星级：结算时按分数给 1/2/3 星（0 = 无星）
export const STARS = [
  { min: 0, count: 0 },
  { min: 4, count: 1 },
  { min: 12, count: 2 },
  { min: 24, count: 3 },
];

// 难度阶梯（= 关卡 tier，供推进率与「越飞越快」的 twist 用）
export const LEVELS = [
  { score: 0, speed: 165, gap: 170, name: 'SECTOR 1' },
  { score: 8, speed: 185, gap: 162, name: 'SECTOR 2' },
  { score: 20, speed: 205, gap: 154, name: 'SECTOR 3' },
  { score: 35, speed: 225, gap: 148, name: 'SECTOR 4' },
];

// 语言：默认英文；zh 必做。未翻的语言不要加进 languages。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'flap-reborn-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'flap-reborn-save',
};
