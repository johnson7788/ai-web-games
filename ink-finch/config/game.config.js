// INK FINCH · 全局数值配置（Lead 拥有；数值改动只改这里）
// 水墨世界：墨色雀穿过竹海，上扑溅墨点，穿竹节记分。黑白灰 + 一抹朱砂红。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 660,        // 地面线（竹根/地面带）
  CEILING_Y: 0,         // 天花板（撞顶即死）
};

export const STEP = 1 / 60;

// 小鸟物理（flappy 核心：单键上扑 + 重力下坠）
export const BIRD = {
  X: 260,               // 常驻水平位置（逆风关会被风吹偏）
  R: 14,                // 碰撞半径
  W: 40,                // 渲染宽
  H: 30,                // 渲染高
  GRAVITY: 1100,        // 重力（px/s²）
  FLAP_VY: -335,        // 上扑冲量（负 = 向上）
  MAX_FALL: 640,        // 最大下落速度
  READY_GRACE: 1.2,     // 就绪阶段自动起飞的宽限（秒）
  MIN_X: 60,            // 逆风关左墙（吹出即死）
  MAX_X: 520,           // 逆风关右墙（夹紧）
};

// 竹节（管道）几何与卷轴
export const GATE = {
  STALK_W: 84,          // 竹节横向宽
  SCROLL: 160,          // 卷轴速度 px/s
  SPACING: 288,         // 相邻竹节间距
  NEAR_MISS: 24,        // 近贴边判定（px，须大于鸟碰撞半径才有意义）
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ink-finch-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ink-finch-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  TUTORIAL_STEPS: 4,     // 首次交互引导步数
  SHAKE_AMP: 4,          // 死亡小震屏幅度（px）
  INK_PER_FLAP: 3,       // 每次上扑溅出的墨点数
};
