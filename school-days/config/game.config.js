// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做；其他语言完整才暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'school-days-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'school-days-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  START_COINS: 2000,       // 沿用原作 PlayerDataManager 初始金币 2000
  START_ENERGY: 100,       // 原作体力概念，满值
  ENERGY_MAX: 100,
  ENERGY_MAX_UP: 20,       // 第 8 周连轴周：体力上限 +20
  WEEKLY_ENERGY_REGEN: 40, // 每周末结算后自然恢复的体力
  SLOTS_PER_WEEK: 5,       // 每周可排的课时数
  LOW_ENERGY_THRESHOLD: 10,
  LOW_ENERGY_MOOD_PENALTY: 10, // 结算时体力过低 → 心情惩罚
  GOAL_COIN_REWARD: 100,   // 每周目标达标奖励金币

  START_ATTRS: { grades: 30, fitness: 30, mood: 60, reputation: 20 },
  ATTR_MAX: 100,
  ATTR_MIN: 0,

  // 最终大考目标（第 12 周）
  FINAL_TARGETS: { grades: 70, fitness: 60, mood: 45, reputation: 55 },
  // 核心两门：及格线（放榜 win 的最低条件）
  CORE_EXAM: ['grades', 'fitness'],

  // 第 11 周模拟考：四门达标线（提前暴露短板）
  MOCK_TARGETS: { grades: 60, fitness: 50, mood: 45, reputation: 45 },

  SLOT_DURATION: 0.55,     // 结算时每节课动画时长（sim 秒）
  EVENT_TICK_DURATION: 0.9, // 事件进入的节奏
};

// 四门科目。attr = 主属性；base = 每课时基础成长；moodDelta = 心情变化；
// energyCost / coinCost = 消耗；talentBonus = 每名对应天赋生额外成长（第 4 周起 ×2）。
export const SUBJECTS = {
  study: { id: 'study', attr: 'grades', base: 3, moodDelta: -1, energyCost: 20, coinCost: 0, talentBonus: 1 },
  martial: { id: 'martial', attr: 'fitness', base: 3, moodDelta: -1, energyCost: 25, coinCost: 0, talentBonus: 1 },
  trip: { id: 'trip', attr: 'reputation', base: 4, moodDelta: 2, energyCost: 15, coinCost: 40, talentBonus: 1 },
  rest: { id: 'rest', attr: null, base: 0, moodDelta: 5, energyCost: 0, coinCost: 0, energyRegen: 25, talentBonus: 0 },
};

export const SUBJECT_ORDER = ['study', 'martial', 'trip', 'rest'];

// 学生（小熊猫村童）：4-6 名，各有天赋倾向
export const STUDENTS = [
  { id: 'zhu', name: 'A-Zhu', talent: 'study' },
  { id: 'mo', name: 'A-Mo', talent: 'study' },
  { id: 'feng', name: 'A-Feng', talent: 'martial' },
  { id: 'yan', name: 'A-Yan', talent: 'martial' },
  { id: 'you', name: 'A-You', talent: 'trip' },
];
