// NOTE RIDER · 全局数值配置（Lead 拥有；数值改动只改这里）
// 逻辑世界 1280×720 + letterbox；60Hz 固定步长。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算五线谱 / 判定线 / 玩家位置（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 46,             // 顶部 HUD 条高
  HIT_X: 300,            // 判定线 x（note 到达此线时 startTime == beatClock）
  PLAYER_X: 232,         // 玩家（弦骑士）x
  LANE_Y: [330, 420],    // 上/下两条弦的 y（对应五线谱第 2/4 线）
  STAFF_LINES: [285, 330, 375, 420, 465], // 五线谱 5 条线
  PX_PER_BEAT: 220,      // 每拍横向宽度（px）
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'note-rider-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'note-rider-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取）
export const GAME = {
  MAX_HP: 100,           // 玩家血量
  HIT_WINDOWS: { perfect: 0.06, great: 0.12, good: 0.18 }, // 判定窗（秒）
  GRADES: {
    perfect: { score: 30, dmg: 2 },
    great:   { score: 20, dmg: 1 },
    good:    { score: 10, dmg: 1 },
  },
  CHORD_STREAK: 8,       // 连续 Perfect 达到该值触发「和弦斩」
  ENERGY_MAX: 6,         // 技能能量上限
  SWITCH_COOLDOWN: 0.12, // 换轨硬直（秒）
};

// 技能（还原原作 SkillConfig 的 4 个：加无敌/双重攻击/加血/持续加血 → 护盾/爆发/吸血/治疗）
export const SKILLS = {
  shield:    { cost: 3, cooldown: 8,  duration: 5,  desc: 'shield' },    // 10001 加无敌
  burst:     { cost: 3, cooldown: 8,  duration: 6,  hits: 3, desc: 'burst' }, // 10003 双重攻击
  lifesteal: { cost: 3, cooldown: 10, duration: 8,  desc: 'lifesteal' }, // 10006 持续加血
  heal:      { cost: 4, cooldown: 12, amount: 20, desc: 'heal' },        // 10005 加血
};
