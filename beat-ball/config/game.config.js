// BEAT BALL · 全局数值配置（Lead 拥有；数值改动只改这里）
// 玩法：鼓面疾行 —— 太鼓球在巨型太鼓面上向纵深滚动，避开鼓槌落点、踩中节拍点。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法规则数值（跨关公共项；关卡专属见 config/levels.js）
export const GAME = {
  DIST_PER_SEC: 10,        // 距离即分：每秒推进换算分
  PAD_SCORE: 15,           // 踩中节拍点基础分
  COMBO_BONUS: 2,          // 每层连击额外加分（combo * COMBO_BONUS）
  JUMP_PAD_MULT: 2,        // 跳板节拍点双倍分
  PERFECT_CHAIN: [5, 10, 20], // 连击里程碑：达到后发 perfect 事件 + PERFECT_BONUS
  PERFECT_BONUS: 25,
  JUMP_DURATION: 0.5,      // 跳跃滞空秒数
  WARN_BEATS_DEFAULT: 2,   // 鼓槌预警提前拍数（无脑默认）
  FIRST_HAZARD_BEAT: 4,    // 开局前几拍无鼓槌，先教节拍
  STAR_HIT_RATIO: 0.8,     // 踩拍命中率 ≥ 此值 +1 星
};

// 语言：默认英文；zh 必做；当前只暴露 en/zh（完整翻译才暴露，缺一不可）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'beat-ball-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'beat-ball-save',
};
