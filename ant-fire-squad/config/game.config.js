// ANT FIRE SQUAD · 全局配置（数值 + 语言）
// 逻辑坐标恒为 1280×720；渲染端按容器缩放，DPR ≤ 2。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

// 熔炉（交付点）
export const FORGE = {
  x: 640,
  y: 646,
  r: 58,
};

// 可投放火种 / 可活动区域（避免与 HUD、熔炉重叠）
export const ARENA = {
  x0: 90,
  x1: 1190,
  y0: 110,
  y1: 566,
};

export const STEP = 1 / 60;

export const COMBO = {
  window: 2.5,      // 连续交付窗口（秒）
  max: 4,           // 连击倍率上限
};

// 火兵（烧黄蜂）
export const SOLDIER = {
  max: 3,
  rechargeSec: 4,   // 每枚充能所需秒数
  speed: 420,
  bonusHeat: 5,     // 击杀奖励热量
};

export const ANT = {
  speed: 150,       // 空手速度 px/s（搬运时按负重减速）
  carrySlow: 0.35,  // 搬运时每点负重减速比例
  radius: 13,
  stunSec: 2.2,     // 被炸弹眩晕时长
  unloadSec: 0.9,   // 在熔炉卸货耗时（交付瓶颈）
};

export const ORB = {
  cap: 16,          // 场上火种上限
  minWeight: 1,
  maxWeight: 2,
};

export const WASP = {
  radius: 15,
};

export const SPARK = {
  max: 8,           // 火花表蓄满触发一次特殊事件
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ant-fire-squad-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ant-fire-squad-save',
};
