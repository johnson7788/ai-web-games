// MERGE BASKETBALL · 全局数值配置
// 纯逻辑与渲染共享的常量都在这里；sim 不依赖像素，render 用逻辑坐标缩放。

export const WORLD = {
  WIDTH: 375,          // 逻辑玩法区宽（原版 375×667）
  HEIGHT: 667,         // 逻辑玩法区高
  GROUND_H: 40,        // 地面厚度（逻辑像素）
};

export const STEP = 1 / 60; // 60Hz 固定步长

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'merge-basketball-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'merge-basketball-save',
};

// 玩法数值（sim 读取）
export const GAME = {
  GRAVITY: 1500,        // 重力基准 px/s²
  SPAWN_Y: 46,          // 落球中心起始 y
  DANGER_Y: 0,          // 危险线（顶边）
  DANGER_GRACE: 0.5,    // 球顶越线持续多少秒判负
  DROP_GAP: 0.3,        // 两次落球最小间隔（秒）
  DROP_MAX: 2,          // 同时最多在途球数
  AUTO_DROP_SEC: 4.0,   // 不操作多久自动落球（压力/兜底）
  COMBO_WINDOW: 1.5,    // 连击窗口（秒）
  MAX_SPEED: 900,       // 速度上限 px/s
  MERGE_LOCK: 0.1,      // 合成新球短时间内不可再次合成
  WIN_VALUE: 1024,      // 合到 1024 即「合成大篮球」
  ROCK_RADIUS: 22,      // 岩石球半径
};

// 落球随机值池（2/4/8 均匀）
export const DROP_VALUES = [2, 4, 8];
