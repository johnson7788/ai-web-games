// CAT VS DOG WAR · 全局数值配置（Lead 拥有；数值改动只改这里）
// 主题：猫咪 vs 狗狗的草坪打地鼠——点掉从洞里钻出来的小动物，躲开石头。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局：canvas 逻辑坐标 1280x720；HUD 是 DOM 顶栏，占位 HUD_H，玩法区在其下方。
export const LAYOUT = {
  HUD_H: 64,           // 顶部 HUD 条高（DOM，不透明）
  HOLE_R: 58,          // 洞口半径
  // 5 个洞口中心（左上下 / 中 / 右上下，保留原版星形布局）
  holes: [
    { x: 270, y: 240 },
    { x: 270, y: 490 },
    { x: 640, y: 372 },
    { x: 1010, y: 490 },
    { x: 1010, y: 240 },
  ],
  CRITTER_R: 52,       // 小动物身体半径
  ROCK_R: 40,          // 石头半径
};

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cat-vs-dog-war-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'cat-vs-dog-war-save',
};

// 玩法规则数值（sim 从这里读；跨关公共项）
export const GAME = {
  STAGE_COUNT: 3,            // 三波（20s x 3 = 60s 总分攻防）
  STAGE_TIME: 20,            // 每波秒数
  STAGE_TARGETS: [400, 1200, 2200], // 每波结束时的累计分数门槛（不达标判负）
  HEARTS: 3,                 // 生命：动物逃脱 / 点到石头 各扣 1 心
  RESPAWN: 0.5,              // 击杀/消失后洞口重新出怪的间隔
  INITIAL_STAGGER: 0.35,     // 开局 5 个洞错峰出怪
  COMBO_WINDOW: 2.5,         // 连续击杀判定窗口（秒）
  COMBO_MAX: 5,              // 连击倍率上限
  ROCK_WEIGHT: 0.08,         // 每次出怪为石头的概率
  STARS_3: 5000,             // 3 星分数门槛
  STARS_2: 3200,             // 2 星分数门槛
};

// 小动物类型：taps=点击几下打死；score=基础分；lifetime=钻出后停留秒数（超时逃脱扣心）
// weight 归一化（合计 = 1.0）。名字/颜色为原创换皮（猫咪/小狗/猎犬/金毛）。
export const MONSTER_TYPES = {
  cat:   { taps: 1, score: 100, lifetime: 2.8, weight: 0.60, color: '#fff3df' },
  pup:   { taps: 1, score: 200, lifetime: 2.4, weight: 0.25, color: '#7fd8ff' },
  hound: { taps: 4, score: 400, lifetime: 3.6, weight: 0.10, color: '#ff6bd1' },
  gold:  { taps: 2, score: 500, lifetime: 3.0, weight: 0.05, color: '#ffc14d' },
};

export const ROCK = {
  type: 'rock',
  score: -50,                // 点到石头扣分（不扣到负）
  lifetime: 2.0,
  color: '#9aa3ad',
};
