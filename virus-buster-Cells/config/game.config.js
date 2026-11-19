// VIRUS BUSTER CELLS · 全局数值配置
// 玩法骨架 1:1 还原《消灭病毒》：底部飞船 + 上方降落的带血量病毒细胞，
// 拖拽移动、按住连射，击杀掉金币、血条清零过关、死亡可复活、金币升级。
// 主题换皮为「霓虹街机 · 纳米细胞防御」，全部数值/美术/音频程序化原创。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

export const SHIP = {
  Y: 636,               // 飞船固定纵向位置（底部）
  RADIUS: 26,
  MAX_SPEED: 640,       // 横向最大速度 px/s
  LIVES: 3,
  INVULN_AFTER_REVIVE: 2.2,   // 复活/受击后的无敌秒数
  DEAD_TIMER: 2.6,            // 死亡后自动复活的等待秒数
};

export const BULLET = {
  SPEED: 980,           // 向上速度 px/s
  RADIUS: 6,
  BASE_INTERVAL: 0.14,  // 基础射击间隔秒（≈7 发/s）
};

export const GERM = {
  // 按 hp 分层：半径与颜色（颜色在 render 层映射，这里只给半径档位）
  radiusFor(hp) {
    if (hp <= 3) return 17;
    if (hp <= 8) return 21;
    if (hp <= 18) return 26;
    if (hp <= 40) return 31;
    return 38; // boss
  },
  VY_MIN: 42,
  VY_MAX: 74,
  VX_MAX: 72,           // 横向漂移最大速度
  HOMING_START_Y: 360,  // 低于此高度开始轻微追船
  HOMING_ACCEL: 46,     // 追船加速度 px/s²
  COMBO_WINDOW: 3.0,    // 连击窗口秒
};

export const CRYSTAL = {
  RADIUS_MIN: 18,
  RADIUS_MAX: 30,
  VY_MIN: 92,
  VY_MAX: 150,
  VX_MAX: 64,
};

export const POWERUP = {
  DROP_CHANCE: 0.13,
  VY: 120,
  RADIUS: 16,
  DURATION: 6.0,        // 临时增益持续秒数
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'virus-buster-Cells-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'virus-buster-Cells-save',
};

// 金币价值 / 升级：base 档位（存档里存升级等级）
export const UPGRADES = {
  // 火力（每级 +1 发子弹，上限 5）
  firePower: { max: 5, baseCost: 30, costGrowth: 2.2 },
  // 射速（每级 -18% 射击间隔，上限 5）
  fireRate: { max: 5, baseCost: 24, costGrowth: 2.0 },
  // 金币价值（每级 +50% 掉金，上限 5）
  goldValue: { max: 5, baseCost: 40, costGrowth: 2.4 },
  // 护盾（每级 +1 起始护盾，上限 3）
  shield: { max: 3, baseCost: 60, costGrowth: 3.0 },
};
