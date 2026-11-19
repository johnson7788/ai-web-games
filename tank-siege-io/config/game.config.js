// 全局数值配置（纯逻辑 sim / 渲染 / UI 都从这里读）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

// 固定步长
export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。其它语言完整翻译后才暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'tank-siege-io-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'tank-siege-io-save',
};

// 玩法规则数值（sim 专属；渲染只读，不写）
export const GAME = {
  COLS: 13,
  ROWS: 13,
  TANK_SIZE: 0.82,          // 坦克占格比例（纯逻辑用不到，留给渲染）
  BULLET_SPEED: 9.0,        // tiles/s
  PLAYER: {
    hp: 5,
    speed: 3.6,             // tiles/s
    fireInterval: 0.4,      // 秒
    spawn: [6, 11],
    spawnShield: 2.0,       // 每波开场无敌秒数
  },
  ENEMY: {
    normal: { hp: 1, speed: 1.8, fireInterval: 1.5, score: 100 },
    speed:  { hp: 1, speed: 2.8, fireInterval: 1.3, score: 150 },
    armor:  { hp: 3, speed: 1.4, fireInterval: 1.7, score: 250 },
  },
  CORE: {
    pos: [6, 12],
    maxHp: 20,
    healPerWave: 5,
  },
  SPAWNS: [[0, 0], [6, 0], [12, 0]],
  SPAWN_INTERVAL: 3.0,      // 秒（敌人一个接一个出场）
  CONCURRENT_BASE: 2,       // 同屏敌人上限基数（L3+ 再 +1）
  COMBO_WINDOW: 3.0,        // 连击窗口（秒）
  INTERMISSION: 1.3,        // 过关后下一波间隔
  POWERUP_DROP: 0.28,       // 击杀掉道具概率
  POWERUP_TTL: 10.0,        // 道具停留秒数
  POWERUP_DURATION: 8.0,    // 增益持续时间
  MAX_LEVEL: 999,
};
