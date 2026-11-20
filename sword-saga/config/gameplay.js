// config/gameplay.js — 战斗数值 / 五行 / 技能 / 道具 / 敌人 / 章节（全部数值集中于此）
// 纯逻辑可测：不碰 DOM/window；随机用注入的 rng。

// 五行相生相克环：ELEMENTS[i] 克 ELEMENTS[(i+1)%5]
// 金克木 · 木克土 · 土克水 · 水克火 · 火克金
export const ELEMENTS = ['metal', 'wood', 'earth', 'water', 'fire'];

export function counterOf(el) {
  const i = ELEMENTS.indexOf(el);
  return ELEMENTS[(i + 1) % ELEMENTS.length];
}

export function isCounter(attackerEl, defenderEl) {
  return counterOf(attackerEl) === defenderEl;
}

export function elementMult(attackerEl, defenderEl) {
  if (isCounter(attackerEl, defenderEl)) return ELEMENT.COUNTER;
  if (attackerEl === defenderEl) return ELEMENT.SAME;
  return 1.0;
}

export const ELEMENT = {
  COUNTER: 1.5,   // 克制：1.5 倍伤害 + 全屏墨晕（signature）
  SAME: 0.75,     // 同属性减伤
  NEUTRAL: 1.0,
};

// ATB 速度条：每 1/60 tick 累加 speed*ATB_RATE，满 ATB_THRESHOLD 出手。
export const ATB = { RATE: 0.02, THRESHOLD: 100 };

// 角色（双主角）：hero 剑客（金）+ fox 灵狐（火）
export const HEROES = {
  hero: {
    id: 'hero',
    nameKey: 'hero.name',
    element: 'metal',
    hp: 260,
    mp: 60,
    atk: 40,
    magic: 30,
    def: 20,
    speed: 72,
    skills: ['cloudBreaker', 'stoneRoot'],   // 金 + 土
  },
  fox: {
    id: 'fox',
    nameKey: 'fox.name',
    element: 'fire',
    hp: 200,
    mp: 50,
    atk: 32,
    magic: 38,
    def: 14,
    speed: 94,
    skills: ['rimeLance', 'verdantBind'],    // 水 + 木
  },
};

// 技能：普攻用角色自带 element；技能带各自 element（覆盖全五行）
export const SKILLS = {
  cloudBreaker: { id: 'cloudBreaker', nameKey: 'skill.metal', element: 'metal', mp: 10, power: 55 },
  stoneRoot:    { id: 'stoneRoot',    nameKey: 'skill.earth', element: 'earth', mp: 12, power: 62 },
  rimeLance:    { id: 'rimeLance',    nameKey: 'skill.water', element: 'water', mp: 10, power: 55 },
  verdantBind:  { id: 'verdantBind',  nameKey: 'skill.wood',  element: 'wood',  mp: 12, power: 62 },
};

// 道具（战斗内消耗）
export const ITEMS = {
  herb:   { id: 'herb',   nameKey: 'item.herb',   healHp: 70, healMp: 0 },
  elixir: { id: 'elixir', nameKey: 'item.elixir', healHp: 0,  healMp: 30 },
};

// 每场战斗后回血比例（避免慢性失血把 greedy bot 拖死）
export const POST_BATTLE = {
  healHpRatio: 0.4,
  healMpRatio: 0.3,
  growthMaxHp: 6,   // 每战后双主角 +6 上限（成长钩子，封顶）
  growthCap: 120,
};

// 敌人模板
export const ENEMIES = {
  bambooWraith: { id: 'bambooWraith', nameKey: 'enemy.bambooWraith', element: 'wood',  hp: 90,  atk: 16, magic: 8,  def: 6,  speed: 40 },
  snowWhelp:    { id: 'snowWhelp',    nameKey: 'enemy.snowWhelp',    element: 'water', hp: 84,  atk: 15, magic: 10, def: 6,  speed: 44 },
  ashMite:      { id: 'ashMite',      nameKey: 'enemy.ashMite',      element: 'fire',  hp: 104, atk: 20, magic: 12, def: 7,  speed: 48 },
  stoneWard:    { id: 'stoneWard',    nameKey: 'enemy.stoneWard',    element: 'earth', hp: 120, atk: 18, magic: 8,  def: 14, speed: 36 },
  metalImp:     { id: 'metalImp',     nameKey: 'enemy.metalImp',     element: 'metal', hp: 130, atk: 24, magic: 10, def: 12, speed: 52 },
  // Boss 每 4 章（第 4 / 8 / 12 章）
  bambooKing:   { id: 'bambooKing',   nameKey: 'enemy.bambooKing',   element: 'wood',  hp: 420, atk: 26, magic: 14, def: 12, speed: 52, boss: true },
  snowMother:   { id: 'snowMother',   nameKey: 'enemy.snowMother',   element: 'water', hp: 520, atk: 28, magic: 18, def: 14, speed: 54, boss: true },
  towerDemon:   { id: 'towerDemon',   nameKey: 'enemy.towerDemon',   element: 'metal', hp: 680, atk: 32, magic: 22, def: 18, speed: 60, boss: true },
};

// 章节：12 章短篇。scene = 1 青竹林 / 2 雪山道 / 3 锁妖塔（每 4 章换场景）
// battles：本章敌人构成（数组，元素为 ENEMIES id）。boss 章 battles 只含 1 个 boss。
export const CHAPTERS = [
  { chapter: 1, scene: 1, battles: [['bambooWraith']] },
  { chapter: 2, scene: 1, battles: [['bambooWraith', 'bambooWraith']] },
  { chapter: 3, scene: 1, battles: [['ashMite', 'ashMite']] },
  { chapter: 4, scene: 1, battles: [['bambooKing']], boss: true },
  { chapter: 5, scene: 2, battles: [['snowWhelp', 'snowWhelp']] },
  { chapter: 6, scene: 2, battles: [['snowWhelp', 'stoneWard']] },
  { chapter: 7, scene: 2, battles: [['stoneWard', 'metalImp']] },
  { chapter: 8, scene: 2, battles: [['snowMother']], boss: true },
  { chapter: 9, scene: 3, battles: [['metalImp', 'metalImp']] },
  { chapter: 10, scene: 3, battles: [['ashMite', 'stoneWard', 'metalImp']] },
  { chapter: 11, scene: 3, battles: [['metalImp', 'stoneWard', 'ashMite']] },
  { chapter: 12, scene: 3, battles: [['towerDemon']], boss: true },
];

export const TOTAL_CHAPTERS = CHAPTERS.length;

export function chapterDef(chapter) {
  return CHAPTERS[Math.max(0, Math.min(TOTAL_CHAPTERS - 1, chapter - 1))];
}

// 每章剧情节点：地图上依次出现「对话 NPC」与「战斗门」。
export const MAP = {
  cols: 24,
  rows: 14,
  // 出生点与目标点（逻辑格坐标）
  spawn: { x: 2, y: 7 },
  npc: { x: 10, y: 7 },    // 对话节点（触发展开剧情）
  door: { x: 20, y: 7 },   // 战斗门（触发战斗）
};
