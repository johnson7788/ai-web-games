// FROG HOP LEAF · 全局数值配置（数值改动只改这里）
// 世界：横向 1280 固定；纵向随关卡高度；相机只向上滚动（像 Doodle Jump），
// 掉到相机底边以下（跌进池塘）判负。物理用简单位置/速度积分，固定 60Hz 步长。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,          // 视口高度（canvas 逻辑像素）
  MARGIN: 30,           // 荷叶可放置的左右安全边
};

export const STEP = 1 / 60;

// 物理：单位为 px / s（位置直接积分，不经过 RigidBody）
export const PHYS = {
  GRAVITY: 2000,        // 下落加速度 px/s²
  WALK: 105,            // 落地时水平移动速度（恒定）
  RISE_DRIFT: 46,       // 上升段水平漂移速度（慢，忠实原作）
  JUMP_V: 760,          // 普通跳跃初速度（向上为负）
  SPRING_V: 920,        // 弹簧叶弹跳初速度（≈1.5× 普通跳，落点可控）
  GOLDEN_V: 860,        // 金叶弹跳初速度（当前金叶只加分、不弹，保留备用）
  MAX_FALL: 1500,       // 下落速度上限
};

// 荷叶几何
export const LEAF = {
  H: 26,                // 荷叶厚度（视觉高度，碰撞用顶面）
  FROG_W: 42,           // 青蛙碰撞宽
  FROG_H: 42,           // 青蛙碰撞高
  OVERLAP_MIN: 92,      // 相邻荷叶 x 方向最小重叠（保证可攀爬）
};

// 得分 / 连击
export const SCORE = {
  FIREFLY_BASE: 10,     // 萤火虫基础分 × combo
  GOLDEN_BONUS: 25,     // 金叶落地加分
  WIN_BONUS: 50,        // 过关基础奖励
  COMBO_MAX: 9,         // 连击显示上限
};

// 相机：只向上滚动，青蛙爬到视口 55% 高度时开始跟随
export const CAMERA = {
  FOLLOW_FRAC: 0.55,
  LERP: 0.12,
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'frog-hop-leaf-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'frog-hop-leaf-save',
};

// 跨关公共规则
export const GAME = {
  TUTORIAL_STEPS: 3,        // 首次交互引导步数
  PARTICLE_MAX: 240,        // 粒子上限（分档）
  PARTICLE_MAX_LOW: 90,     // 低配/移动端粒子上限
  DPR_MAX: 2,               // 最大设备像素比
};
