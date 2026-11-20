// 全局数值配置（只改这里；sim/render/ui 都从这里读）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局：顶部不透明 HUD 条 + 下方纯游戏视口
export const LAYOUT = {
  HUD_H: 48,          // 顶部 HUD 条高（DOM 不透明，遮挡区不放玩法）
  TILE: 48,           // 单格像素
  VIEW_W: 1280,       // 视口宽
  VIEW_H: 720 - 48,   // 视口高（= 14 行 × 48）
};

// 物理（platform hop 手感：快跑 + 短促弹跳）
export const PHYS = {
  SPEED: 380,         // 水平移动速度 px/s
  GRAVITY: 2600,      // 重力 px/s²
  JUMP_V: 900,        // 起跳初速 px/s（向上）
  MAX_FALL: 1500,     // 下落速度上限
  COYOTE: 0.09,       // 离地后仍可起跳的宽限秒
  JUMP_BUFFER: 0.12,  // 落地前按跳的缓冲秒
  STOMP_BOUNCE: 540,  // 踩敌弹跳初速
  INVULN: 1.0,        // 护盾吸收后的无敌秒
};

export const SCORE = {
  COIN_BASE: 10,      // 单金币基础分
  STAR: 100,          // 星星分
  STOMP: 50,          // 踩敌分
  COMBO_MAX: 5,       // 连击上限
  COMBO_WINDOW: 2.0,  // 连击窗口秒
  MAGNET_SEC: 6.0,    // 磁铁持续秒
  MAGNET_RADIUS: 130, // 磁铁吸附半径
};

// 语言：默认英文；zh 必做。只暴露真实翻译完整的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mario-bird-hop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mario-bird-hop-save',
};
