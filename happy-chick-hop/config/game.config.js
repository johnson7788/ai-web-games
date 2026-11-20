// HAPPY CHICK HOP · 全局数值配置（builder 拥有；数值改动只改这里）
// 玩法：合成大西瓜式「孵化合并」——把同类小动物丢到一起，合并成更大的一只，
//       直到孵化出金鸡夺冠；别让鸡窝堆到顶上的红线。
export const WORLD = {
  WIDTH: 720,       // 逻辑世界宽（井口）
  HEIGHT: 1280,     // 逻辑世界高
};

export const STEP = 1 / 60;

// 布局常量（render 据此算世界→屏幕缩放；sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 64,        // 顶部 HUD 条高（px）
  WELL_ASPECT: 720 / 1280,
};

// 语言：默认英文；zh 必做；只有 locales 里真实存在的语言才会暴露
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'happy-chick-hop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'happy-chick-hop-save',
};

// 11 阶「孵化链」：同阶两只会合并成下一阶（P0 1:1 的分数表）
export const TIERS = [
  { r: 26,  score: 10,   color: '#FFF3D6', accent: '#E8C99B' }, // 0 蛋
  { r: 39,  score: 20,   color: '#FFD54F', accent: '#F5A623' }, // 1 小鸡
  { r: 54,  score: 30,   color: '#FFB74D', accent: '#F57C00' }, // 2 小鸭
  { r: 62,  score: 50,   color: '#90CAF9', accent: '#1E88E5' }, // 3 企鹅
  { r: 78,  score: 100,  color: '#F8BBD0', accent: '#E91E63' }, // 4 小兔
  { r: 92,  score: 200,  color: '#CE93D8', accent: '#7B1FA2' }, // 5 小猫
  { r: 108, score: 300,  color: '#BCAAA4', accent: '#5D4037' }, // 6 小狗
  { r: 129, score: 500,  color: '#F48FB1', accent: '#C2185B' }, // 7 小猪
  { r: 150, score: 1000, color: '#EEEEEE', accent: '#9E9E9E' }, // 8 小羊
  { r: 172, score: 2000, color: '#FFAB91', accent: '#D84315' }, // 9 小牛
  { r: 202, score: 3000, color: '#FFD700', accent: '#B8860B' }, // 10 金鸡（冠军）
];

// 游戏规则数值
export const GAME = {
  GRAVITY: 3000,        // 重力（世界单位/秒²）
  DANGER_Y: 110,        // 红线（顶部危险线，y 越小越靠上）
  HARD_LOSE_Y: 30,      // 硬溢出线（任何对象顶部越过此线即判负，接近井口最顶）
  HARD_GRACE: 0.3,      // 硬溢出宽限（秒）
  FLOOR_Y: 1230,        // 地面（对象圆心最大 y）
  SPAWN_Y: 160,         // 出生点 y
  SUBSTEPS: 4,          // 物理子步数
  LINEAR_DAMPING: 1.2,  // 线性阻尼 / 秒
  WALL_RESTITUTION: 0.3,
  FLOOR_RESTITUTION: 0.2,
  FRICTION: 0.86,       // 落地横向摩擦
  REST_SPEED: 60,       // 低于此速度视为静止
  REST_TIME: 0.35,      // 静止持续这么久才算「settled」
  DANGER_GRACE: 0.5,    // 顶部红线停留这么久判负
  MERGE_OVERLAP: 1.02,  // 同阶接触（略微重叠）即合并
  MAX_TIER: 10,
  SPAWN_TIERS: 5,       // 只从 0..4 随机出生（P0 1:1）

  // 新机制 1：岩石——每 7 次投放出一个不能合并的石头占位
  ROCK_EVERY: 7,
  ROCK_R: 34,

  // 新机制 2：锤子——每 4 次合并得 1 把（上限 3），可砸掉任意一个对象（含石头）
  HAMMER_EVERY: 4,
  HAMMER_MAX: 3,
  HAMMER_START: 1,

  // 新机制 3：连击——3 秒内连续合并，得分额外 +50%/连击（只算展示分，不计阶段进度）
  COMBO_WINDOW: 3.0,
  COMBO_BONUS: 0.5,

  // 阶段与胜利：按「孵化链」阶数推进（比分数更直观、也与冠军目标一致）。
  // 阶段只影响 HUD 与推进率；胜利 = 孵出最高阶金鸡。
  STAGE2_TIER: 3,        // 孵出 3 阶 → stage 2
  STAGE3_TIER: 5,        // 孵出 5 阶 → stage 3
  WIN_TIER: 10,          // 孵出金鸡（最高阶）= 夺冠
};
