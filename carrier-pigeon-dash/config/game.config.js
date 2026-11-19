// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 56,          // 顶部不透明 HUD 条高度
  GROUND_Y: 640,      // 地面顶缘 y
  GROUND_H: 80,       // 地面条高度
};

export const STEP = 1 / 60;

// 玩家（信鸽）
export const PLAYER = {
  X: 260,             // 固定水平位置
  R: 18,              // 碰撞半径
  GRAVITY: 1500,      // 像素/秒^2
  FLAP_VY: -470,      // 一拍向上初速度
  MAX_FALL: 720,      // 下落速度上限
  TOP_CLAMP: 92,      // 上升最高 y（留在 HUD 条之下）
};

// 障碍（霓虹中继塔，替代原版管道）
export const TOWER = {
  W: 88,             // 塔宽
  SPACING: 300,       // 相邻塔水平间距
  TOP_MARGIN: 120,    // 塔缺口中心最低上方留白（避开 HUD）
  BOTTOM_MARGIN: 40,  // 塔缺口中心最高下方留白（避开地面）
  MAX_GAP_DELTA: 150, // 相邻缺口中心最大纵向跳变（防不可达）
};

// 难度分层：按 score 门槛选档（level = 1..5）
export const LEVELS = [
  { threshold: 0,  speed: 190, gap: 360, name: { en: 'Downtown', zh: '市中心' },    tower: '#3ee0ff' },
  { threshold: 5,  speed: 220, gap: 332, name: { en: 'Skyline', zh: '天际线' },     tower: '#43f5c4' },
  { threshold: 10, speed: 250, gap: 306, name: { en: 'Crosswinds', zh: '侧风带' },  tower: '#ffd23e' },
  { threshold: 20, speed: 280, gap: 282, name: { en: 'Storm Run', zh: '风暴航线' }, tower: '#ff7a3e' },
  { threshold: 35, speed: 305, gap: 262, name: { en: 'Neon Apex', zh: '霓虹之巅' }, tower: '#ff3d8b' },
];

// 新机制：连击里程碑（每达成 +1 分）
export const COMBO_STEPS = [3, 5, 8, 12, 16, 21];

// 新机制：邮件配送（每 5 封结算一次 +2 分）
export const MAIL_PER_DELIVERY = 5;
export const DELIVERY_BONUS = 2;

// 新机制：岩石（L4 起，每 N 座塔出现一次）
export const ROCK = {
  EVERY: 3,           // 每 3 座塔
  FROM_LEVEL: 4,      // L4 起
  R: 22,
  DRIFT_AMP: 40,      // 正弦纵向漂移幅度
  DRIFT_FREQ: 0.8,    // 漂移频率（rad/s）
};

export const TOKEN = {
  PROB: 0.55,         // 每座塔缺口里出现信封的概率
  R: 13,
};

export const NEARMISS_CLEARANCE = 24; // 判定“差一点”的垂直余量（px）

export const STAR_THRESHOLDS = [5, 15, 25]; // 1/2/3 星

// 语言：默认英文；zh 必做；只暴露 en/zh
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'carrier-pigeon-dash-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'carrier-pigeon-dash-save',
};

// 教程步数（>=3，供 tutorial-check）
export const TUTORIAL_STEPS = 3;
