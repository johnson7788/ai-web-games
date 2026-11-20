// Sprout Hop · 全局数值配置（Lead 拥有；数值改动只改这里）
// 逻辑世界 1280×720，60Hz 固定步长。sim 只读 PHYS/ANCHOR/TOP0/WATER_Y/PLAY，
// render 读 WORLD/ANCHOR/TOP0/WATER_Y 做像素换算（sim 不碰像素）。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 拖拽蓄力抛物线跳的物理常数（还原自原作：重力 500、速度上限约 600、轨迹为抛物线）
export const PHYS = {
  GRAVITY: 500,      // px/s²（canvas y 向下，重力为正）
  DRAG_K: 3.0,       // 松手速度 = 拖拽向量 × K
  MAX_SPEED: 600,    // 单轴速度上限（保号钳制）
  MIN_FORWARD: 40,   // 松手最小前进速度（低于此视为无效拖拽）
  MAX_DRAG: 240,     // 拖拽向量模长上限（防止拖太远）
  PEA_R: 22,         // 豌豆半径
};

// 锚点：每跳成功后世界水平滚动，使当前平台回到此屏坐标
export const ANCHOR = { X: 260, Y: 470 };

// 平台顶面基准 y（豌豆静止中心 = TOP0 - PEA_R）
export const TOP0 = ANCHOR.Y + PHYS.PEA_R;

// 水面：豌豆中心低于此即落水判负
export const WATER_Y = 596;

// 玩法规则数值（跨关公共项）
export const PLAY = {
  MAX_RELIVES: 2,        // 每关最多复活次数
  BASE_SCORE: 2,         // 每次落台基础分
  PERFECT_BONUS: 3,      // 中心完美落点额外分
  NEAR_BONUS: 1,         // 擦边惊险落点额外分
  PERFECT_RATIO: 0.20,   // 完美区 = 距中心 ≤ 平台宽 × 该比例
  NEAR_RATIO: 0.45,      // 擦边区 = ≤ 平台宽 × 该比例（非完美）
  COLLAPSE_S: 0.6,       // 断藤落上后多久塌
  MOVE_AMP: 36,          // 移动竹筐水平摆动幅度（px）
};

// 语言：默认英文；zh 必做；其它语言未完整翻译前整块不暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sprout-hop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sprout-hop-save',
};
