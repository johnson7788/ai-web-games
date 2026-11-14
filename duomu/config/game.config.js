/**
 * 《夺木》全部可调数值集中在这里。
 * 逻辑层 (src/game/*) 不允许写死数字，必须从这里读。
 */

/** 逻辑世界尺寸：竖版。所有坐标/测试/截图都用这套单位。 */
export const WORLD = { W: 720, H: 1280 };

/** 竖直建木与地面布局 */
export const LAYOUT = {
  trunkX: 360,
  trunkW: 334,          // 树干可见宽度
  segH: 148,            // 单节木段高度
  segGap: 0,            // 节与节之间不留缝，靠阴影分节
  sceneTop: 214,        // 树干绘制区上沿（HUD 之下）
  groundY: 1120,
  heroLeftX: 112,
  heroRightX: 608,
  heroScale: 0.66,
  heroBottomY: 1136,
  segCount: 9,
};

/**
 * 三劫：每一劫引入一条新规则，不是纯数值膨胀。
 *
 * hintMs   —— 蒙面时长，这段时间出手是「盲劈」
 * revealMs —— 微光持续时长，之后进入明牌
 * idleMs   —— 木段停留总时长，到期溜走并累积天雷
 */
export const ACTS = [
  {
    id: 'wind', nameKey: 'act.wind', bg: 'bg_wind', tint: '#8fb7c9',
    pBoth: 0, pNone: 0.46,
    hintMs: 450, revealMs: 450, idleMs: 1560, passMs: 1000,
  },
  {
    id: 'fire', nameKey: 'act.fire', bg: 'bg_fire', tint: '#e08a4a',
    // 新增「双雷」：两侧都有印，碰哪边都死，只能看它自己飘走
    pBoth: 0.2, pNone: 0.3,
    hintMs: 380, revealMs: 400, idleMs: 1380, passMs: 950,
  },
  {
    id: 'thunder', nameKey: 'act.thunder', bg: 'bg_thunder', tint: '#9a7fd0',
    pBoth: 0.24, pNone: 0.24,
    hintMs: 300, revealMs: 330, idleMs: 1180, passMs: 880,
  },
];

/** 累计夺木达到这些门槛，进入下一劫 */
export const ACT_GATES = [14, 34];

/** 双方都撑到这么久还没分胜负 → 天劫降临，节奏拉满 */
export const SUDDEN_DEATH = { atTotalLogs: 64 };

export const MATCH = {
  hp: 3,
  stunMs: 620,            // 被雷劈后的硬直
  gapMs: 300,             // 两节木段之间的落地间隔
  visibleSegs: 9,         // 屏幕上同时存在的木段
  /** 三层时间窗的得分：越早越险，越险越贵 */
  score: { blind: 3, hint: 2, sure: 1 },
  /** 同一节里第一个出手的人额外 +1：抢的是「先手」，不是「独食」 */
  firstBonus: 1,
  /** 微光线索的准确率 —— 它是值得赌的线索，不是答案 */
  hintAccuracy: 0.7,
  targetLogs: 26,         // 先夺到这么多木的一方直接取胜
};

/** 三种电脑对手：反应时间 / 抢跑倾向 / 犯错率 / 犹豫率 */
export const AI_LEVELS = [
  { id: 'novice', nameKey: 'ai.novice', reactMs: 430, aggr: 0.06, mistake: 0.14, hesitate: 0.12 },
  { id: 'veteran', nameKey: 'ai.veteran', reactMs: 300, aggr: 0.36, mistake: 0.06, hesitate: 0.08 },
  { id: 'master', nameKey: 'ai.master', reactMs: 170, aggr: 0.66, mistake: 0.02, hesitate: 0.02 },
];

/** 配色：整局只有这两套主色，玩家在任何画面都能一眼分出敌我 */
export const PALETTE = {
  ink: '#0d0a10',
  paper: '#f2e6cf',
  gold: '#e8b44a',
  red: '#e2432e',
  redDark: '#7d1a12',
  cyan: '#3fb6d8',
  cyanDark: '#123f52',
  wind: '#9fc4d4',
  fire: '#ff7a3c',
  thunder: '#b48cff',
};

/** 本地存档 key */
export const SAVE_KEY = 'duomu.save.v1';
