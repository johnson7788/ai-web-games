// 全局数值配置（Lead 拥有；数值改动只改这里）
// P0 玩法数值 1:1 复刻参考源码（assets/scripts/DataCollection.js speedChange）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法规则数值（sim 从这里读；render/main 读像素常量）
export const GAME = {
  LANE_COUNT: 4,
  LANE_X: [400, 560, 720, 880], // 四条车道中心 x（相对 1280 画布）
  LANE_W: 150,
  PLAYER_Y: 620,
  PLAYER_BAND: 46,          // 碰撞带半高（像素）
  SPAWN_Y: -110,            // 实体出生 y（屏幕上方外）
  END_Y: 780,               // 实体回收 y（屏幕下方外）

  // P0 速度曲线（gameTime 秒）：
  //   <10s: interval 1500ms, fall 5s
  //   >=10s: interval = 1050 - floor(t/10)*50 (min 50), fall = 5 - floor(t/10)*0.3 (min 0.5)
  BARRIER_INTERVAL_0: 1500,
  FALL_TIME_0: 5,
  SPEED_MIN_INTERVAL: 50,
  SPEED_MIN_FALL: 0.5,

  GOODS_AFTER_SEC: 10,      // 10s 后才开始出包裹
  GOODS_PROB: 0.4,          // 每次路障生成时出包裹的概率
  DOUBLE_GOODS_PROB: 0.1,   // 双包裹概率
  SHIELD_AFTER_SEC: 15,     // 15s 后才开始出护盾
  SHIELD_PROB: 0.12,        // 每次路障生成时出护盾的概率
  SHIELD_MAX: 2,            // 护盾层数上限

  COMBO_STEP: 10,           // 连击每 +10 提升一档乘数
  COMBO_MAX_MULT: 3,        // 乘数上限 ×3
  LEVEL_SCORE_STEP: 20,     // 每 20 分升一级
  STARS: [10, 40, 75],      // 1★ / 2★ / 3★ 分数门槛
  MAX_BARRIER_STREAK: 3,    // 单车道最多连续 3 个路障
};

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'travel-master-pack-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'travel-master-pack-save',
};
