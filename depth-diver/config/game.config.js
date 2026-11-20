// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算 HUD/可玩区几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,             // 顶部 HUD 条高（不透明，保证截图可读）
  PLAY_X0: 150,          // 可玩区左边界
  PLAY_X1: 1130,         // 可玩区右边界
  PLAY_Y0: 70,           // 可玩区上边界
  PLAY_Y1: 620,          // 可玩区下边界
  PLAYER_W: 76,
  PLAYER_H: 46,
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'depth-diver-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'depth-diver-save',
};

// 游戏规则数值（跨关公共项；sim 从 levels/game.config 读取）
export const GAME = {
  DEPTH_SCALE: 10,        // 10px 滚动 = 1m 深度
  PLAYER_R: 28,           // 碰撞半径
  STEER_SPEED: 300,       // 水平微调速度 px/s
  SINK_SPEED: 130,        // 松开下沉速度 px/s
  RISE_SPEED: 330,        // 按住上浮速度 px/s
  VENT_FORCE: 300,        // 热泉上喷推力 px/s
  NEAR_MISS_DIST: 74,     // 与致命物擦肩距离阈值（发 nearMiss）
  OXYGEN_BASE_DRAIN: 1.0, // 基础耗氧 1/s
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,           // 撞击/采集震屏幅度
  LANE_X: [240, 420, 600, 780, 960], // 5 条危险/样本航迹
  LANE_DANGER: 120,       // 单航迹危险柱半宽
  SAMPLE_STAR: true,      // 采满样本计星
  TIME_STAR_RATIO: 0.3,   // 剩余氧气 ≥30% → +1 星
};

// 跨局成长模块（升级）：由总星数解锁，sim/render 读取 state.modules 生效。
export const MODULES = [
  { id: 'sonar',      stars: 3,  kind: 'rule', desc: '声呐标出样本方位' },
  { id: 'headlight',  stars: 6,  kind: 'rule', desc: '头灯照射半径 +40%' },
  { id: 'magnet',     stars: 9,  kind: 'rule', desc: '样本磁吸（靠近自动吸附）' },
  { id: 'shield',     stars: 12, kind: 'rule', desc: '每局 1 次护盾（免一次撞击）' },
  { id: 'stabilizer', stars: 15, kind: 'rule', desc: '洋流漂移减半' },
  { id: 'boost',      stars: 18, kind: 'rule', desc: '主动俯冲加速（下潜更快省氧）' },
  { id: 'slowField',  stars: 21, kind: 'rule', desc: '擦肩时短暂慢放' },
  { id: 'tank',       stars: 24, kind: 'stat', desc: '氧气上限 +25%' },
  { id: 'battery',    stars: 27, kind: 'stat', desc: '头灯基础半径 +20%' },
  { id: 'hull',       stars: 30, kind: 'stat', desc: '碰撞半径 -6%' },
];
