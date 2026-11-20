// SKY STRIKE ALPHA · 全局数值配置（Lead 拥有；数值改动只改这里）
// 玩法：霓虹街机横版飞行。按住上升 / 松开俯冲，穿越能量闸门与陨石阵，
//       收集能量核心，把「跃迁充能」耗尽即过关；撞墙/撞石/坠地即死。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 52,          // 顶部 HUD 不透明条高（可玩区天花板在此之下）
};

export const STEP = 1 / 60;

// 跨关公共数值
export const GAME = {
  PLAYER_X: 210,       // 玩家固定横坐标（只控制高度）
  PLAYER_R: 15,        // 玩家碰撞半径
  THRUST: 2500,        // 按住时的向上加速度 px/s²
  GRAVITY: 1900,       // 松开时的向下加速度 px/s²
  VMAX_UP: -340,       // 最大上冲速度
  VMAX_DOWN: 480,      // 最大下坠速度
  CEIL_Y: WORLD.HUD_H + 20,  // 顶部软上限（可短暂触顶但不死）
  READY_TIMEOUT: 2.0,       // 开局悬停：首输入立即起飞，否则 2s 自动进入飞行
  WARP_MAX: 100,       // 跃迁充能最大值
  WARP_DRAIN: 5,       // 每秒消耗的充能（≈20s/关）
  CORE_SCORE: 10,      // 每颗核心基础分
  COMBO_MAX: 8,        // 连击封顶
  NEAR_MISS_MARGIN: 16,// 贴边掠过判定（px，触发 nearMiss 奖励事件）
  SHIELD_HITS: 1,      // 护盾拾取后抵挡次数
  STAR_CORE_RATIO: 0.6,// 收核≥此比例 → +1 星
  DPR_MAX: 2,          // 渲染 DPR 上限
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删掉（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'sky-strike-alpha-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'sky-strike-alpha-save',
};
