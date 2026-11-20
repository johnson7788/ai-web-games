// REEF RAIDER · 全局数值配置（数值改动只改这里）
// 逻辑世界 1280×720 + letterbox；sim 不依赖像素，render 从 config 取几何。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量（render 用；sim 只给逻辑坐标）
export const LAYOUT = {
  HUD_H: 58,            // 顶部 HUD 不透明条高（vision-review 要求不透明，不能半透明）
  TURRET_X: 640,        // 炮台锚点（炮管根部）
  TURRET_Y: 668,
  MARGIN_X: 24,
  FISH_TOP: 100,        // 鱼群活动上界（HUD 之下）
  FISH_BOTTOM: 596,     // 鱼群活动下界（炮台之上）
};

// 语言：默认英文；zh 必做。只暴露 en/zh（未翻译语言整块不暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'reef-raider-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'reef-raider-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  BULLET_SPEED: 760,      // 灯泡弹速 px/s
  BULLET_RADIUS: 9,
  BOUNCES: 2,             // 穿屏前反弹次数
  FIRE_COOLDOWN: 0.09,    // 发射冷却 s
  POWER_MIN: 1,
  POWER_MAX: 5,
  RELIEF_GRANT: 10,       // 金币归零一次性救济
  RELIEF_TRICKLE: 1,      // 连续零币时每次救济
  RELIEF_INTERVAL: 1.4,   // 连续救济间隔 s
  COMBO_WINDOW: 4,        // 连击窗口 s
  COMBO_STEP: 0.1,        // 每连击 +10%
  COMBO_MAX_MULT: 2.0,
  SPAWN_MARGIN: 80,       // 鱼生成在屏幕外 margin
  DAMAGE_MIN: 1,
  DAMAGE_RANGE: 2,        // hurt = ceil(rand*power*RANGE + power) → [power, 3*power]
};

// 鱼种：灯鱼/蝶鱼/海龟/魔鬼鱼/幽灵灯笼鱼 + 终局王
export const FISH_TYPES = {
  lantern:   { hp: 4,  gold: 2,  radius: 22, speed: 70, color: '#FFD24E', glow: '#FFE9A0' },
  butterfly: { hp: 8,  gold: 6,  radius: 26, speed: 60, color: '#FF8AC2', glow: '#FFC0E2' },
  turtle:    { hp: 16, gold: 13, radius: 40, speed: 34, color: '#5FBF6E', glow: '#A9E8B4' },
  manta:     { hp: 24, gold: 20, radius: 48, speed: 44, color: '#6E8DFF', glow: '#B3C4FF' },
  ghost:     { hp: 40, gold: 30, radius: 34, speed: 82, color: '#B6F6FF', glow: '#E4FEFF' },
  king:      { hp: 200, gold: 300, radius: 90, speed: 26, color: '#FFE95C', glow: '#FFF3B0' },
};
