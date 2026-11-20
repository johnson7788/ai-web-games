// BLADE GARDEN · 全局数值配置（Lead 拥有；数值改动只改这里）
// 逻辑世界 1280×720；sim 只读 r/c 无关的连续坐标（px），不依赖像素外的其它量。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 顶栏 HUD 高度（render/ui 布局用；sim 不依赖）
export const LAYOUT = {
  HUD_H: 44,
  PLAYER_R: 20,          // 玩家渲染半径（视觉，不含判定）
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'blade-garden-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'blade-garden-save',
};

// 跨关公共规则（sim 从 levels 读取关卡参数，这里放玩家/战斗公共项）
export const GAME = {
  PLAYER_RADIUS: 16,      // 玩家碰撞半径（px）
  PLAYER: {
    SPEED: 190,           // px/s
    MAX_HP: 100,
    REGEN_DELAY: 6,       // 受伤后多少秒开始回血
    REGEN_PER_SEC: 0,     // 基础回血（升级可加）
    PICKUP_RADIUS: 30,
    MAGNET_RADIUS: 30,
  },
  MELEE: {
    STRIKE_INTERVAL: 0.9, // 基础挥剑间隔
    RANGE: 90,            // 挥剑半径
    DAMAGE: 20,
  },
  XP_PER_GEM: 1,
  XP_CURVE: [4, 6, 9, 12, 16, 20, 25, 30, 36, 42, 48, 55, 62, 70, 78, 86, 95, 104, 114, 124],
  CHOICES_PER_LEVEL: 3,   // 升级三选一
  ENEMY_CAP: 80,          // 同屏敌人硬上限
  PROJECTILE_CAP: 200,    // 同屏子弹硬上限
  SIGNATURE_INTENTS: 5,   // 满级剑意达到此数量触发「竹叶旋舞」签名
};
