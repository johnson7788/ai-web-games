// MONKEY DASH RUN · 全局数值配置（零依赖零外链，纯程序化）
// 玩法：霓虹丛林竖版跑酷。猴子固定底部，世界向下滚动，左右切道躲障碍/吃收集。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 两条车道（左/右），猴子可瞬切。车道 x 与玩家判定 y 是全部核心几何。
export const LANES_X = [380, 900];
export const PLAYER_Y = 560;
export const PLAYER_R = 26;

// 世界向下滚动速度（px/s）。基础速度 + 每档加速。
export const BASE_SPEED = 340;
export const SPEED_PER_TIER = 55;
export const MAX_TIER = 5;

// 升档分数阈值（达到即 tier 2/3/4/5，速度提升）。
export const TIER_SCORES = [100, 300, 600, 1000];

// 生成节奏：基础间隔，随档位收紧（保证事件密度 ≤3s）。
export const SPAWN_BASE = 0.85;
export const SPAWN_MIN = 0.5;

// 冲刺：收集 3 个火花触发，冲刺时长、速度倍率、分数倍率。
export const RUSH_SPARKS = 3;
export const RUSH_SECONDS = 3;
export const RUSH_SPEED_MULT = 1.6;
export const RUSH_SCORE_MULT = 2;

// 护盾（无敌）时长。
export const SHIELD_SECONDS = 3;

// 连击：收集间隔内连续收集叠加倍率（封顶 8）。
export const COMBO_MAX = 8;
export const COMBO_WINDOW = 3.0;

// 各实体碰撞半径。
export const ENTITY_R = {
  cactus: 34,
  wasp: 30,
  rock: 42,
  banana: 24,
  shield: 26,
  spark: 26,
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'monkey-dash-run-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'monkey-dash-run-save',
};
