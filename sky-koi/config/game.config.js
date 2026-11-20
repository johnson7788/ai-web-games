// SKY KOI · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sky-koi-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sky-koi-save',
};

// 跨关公共项（关卡数值在 config/levels.js）
export const GAME = {
  KOI_X: 300,          // 锦鲤固定水平位置（逻辑坐标）
  KOI_R: 24,           // 锦鲤碰撞半径
  GRAVITY: 1400,       // 重力 px/s²
  FLAP_VY: -380,       // 单键上扑的瞬时竖直速度
  SKIM_BAND: 36,       // 贴近水面多近算「贴水」（底部距水面）
  SKIM_JUMP_VY: -240,  // 水花免费小跳冲量
  WATER_BASE: 600,     // 水面基线 y
  WAVE_FREQ: 0.9,      // 巨浪角频率
  CEILING: 30,         // 顶部钳制（锦鲤中心最低 y）
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
