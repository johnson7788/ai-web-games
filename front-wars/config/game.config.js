// 全局数值配置 —— FRONT WARS（俯视角 4v4 阵营射击，单机 + bot）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const ARENA = { x0: 40, y0: 96, x1: 1240, y1: 680 };

// 对称战场：左右出生区、三条推进路线、中央过载点
export const WALLS = [
  { x: 520, y: 280, w: 170, h: 36 },
  { x: 520, y: 500, w: 170, h: 36 },
  { x: 760, y: 280, w: 170, h: 36 },
  { x: 760, y: 500, w: 170, h: 36 },
];

export const SPAWNS = {
  0: [
    { x: 100, y: 170 }, { x: 100, y: 320 }, { x: 100, y: 460 }, { x: 100, y: 610 },
  ],
  1: [
    { x: 1180, y: 170 }, { x: 1180, y: 320 }, { x: 1180, y: 460 }, { x: 1180, y: 610 },
  ],
};

export const LOADOUTS = {
  rifleman: {
    id: 'rifleman',
    name: { en: 'RIFLEMAN', zh: '步枪兵' },
    tag: { en: 'Balanced', zh: '均衡' },
    desc: { en: 'Reliable rifle. Good at every range.', zh: '可靠步枪，远近都能打。' },
    icon: '🎯',
    color: '#7dd3fc',
    hp: 100,
    speed: 210,
    radius: 16,
    fireCd: 0.18,
    damage: 25,
    bulletSpeed: 620,
    spread: 0.03,
  },
  scout: {
    id: 'scout',
    name: { en: 'SCOUT', zh: '侦察兵' },
    tag: { en: 'Fast', zh: '高速' },
    desc: { en: 'Fast and quick-firing, but fragile.', zh: '移动快、射速高，但更脆。' },
    icon: '⚡',
    color: '#a7f3d0',
    hp: 80,
    speed: 255,
    radius: 14,
    fireCd: 0.10,
    damage: 17,
    bulletSpeed: 700,
    spread: 0.055,
  },
  heavy: {
    id: 'heavy',
    name: { en: 'HEAVY', zh: '重装兵' },
    tag: { en: 'Tank', zh: '坦克' },
    desc: { en: 'Slow, loud, and very hard to put down.', zh: '慢、响，但非常难打。' },
    icon: '🛡️',
    color: '#fbbf24',
    hp: 145,
    speed: 170,
    radius: 18,
    fireCd: 0.32,
    damage: 42,
    bulletSpeed: 540,
    spread: 0.025,
  },
};

export const PERKS = [
  { id: 'rapid', kind: 'rule', icon: '🔥', name: { en: 'Rapid Fire', zh: '急速射击' }, desc: { en: 'Fire 25% faster.', zh: '射速 +25%。' } },
  { id: 'armor', kind: 'stat', icon: '🛡️', name: { en: 'Plate Armor', zh: '防弹插板' }, desc: { en: '+25 max HP.', zh: '最大生命 +25。' } },
  { id: 'speed', kind: 'stat', icon: '👟', name: { en: 'Light Boots', zh: '轻量战靴' }, desc: { en: '+12% move speed.', zh: '移动速度 +12%。' } },
  { id: 'pierce', kind: 'rule', icon: '➡️', name: { en: 'AP Rounds', zh: '穿甲弹' }, desc: { en: 'Bullets pierce one extra enemy.', zh: '子弹可多穿透一个敌人。' } },
  { id: 'medic', kind: 'rule', icon: '➕', name: { en: 'Field Medic', zh: '战地医疗' }, desc: { en: 'Heal 30 HP on every kill.', zh: '每次击杀回复 30 生命。' } },
  { id: 'leader', kind: 'stat', icon: '📣', name: { en: 'Squad Leader', zh: '小队指挥' }, desc: { en: 'Allied bots deal +20% damage.', zh: '友方 bot 伤害 +20%。' } },
  { id: 'respawn', kind: 'stat', icon: '⏱️', name: { en: 'Quick Respawn', zh: '快速归队' }, desc: { en: 'Respawn 40% faster.', zh: '重生时间 -40%。' } },
  { id: 'overcharge', kind: 'rule', icon: '⚡', name: { en: 'Overcharge', zh: '过载核心' }, desc: { en: 'Kills reset your dash cooldown.', zh: '击杀重置冲刺冷却。' } },
];

export const RULES = {
  perTeam: 4,
  killTarget: 15,
  roundTime: 120,
  roundsToWin: 2,
  respawn: 2.0,
  botRange: 500,
  botAccuracy: 0.12,
  tutorialTarget: 5,
  tutorialDash: 2.6,
  dashDuration: 0.16,
  dashCooldown: 2.6,
  dashSpeed: 3.0,
  overdriveEvery: 18,
  overdriveDuration: 8,
};

export const ROUNDS = [
  {
    index: 1,
    name: { en: 'DEPOT', zh: '仓库' },
    enemy: ['rifleman', 'rifleman', 'rifleman', 'rifleman'],
    enemyTint: '#fb7185',
    weather: 'dust',
  },
  {
    index: 2,
    name: { en: 'CROSSING', zh: '交叉口' },
    enemy: ['scout', 'scout', 'heavy', 'rifleman'],
    enemyTint: '#fb923c',
    weather: 'dusk',
  },
  {
    index: 3,
    name: { en: 'FOUNDRY', zh: '铸造厂' },
    enemy: ['scout', 'heavy', 'heavy', 'rifleman'],
    enemyTint: '#f43f5e',
    weather: 'embers',
  },
];

export const COLORS = {
  bg: '#0b1114',
  floor: '#1b272a',
  floorAlt: '#223135',
  grid: 'rgba(255,255,255,0.035)',
  wall: '#4b5b5e',
  wallTop: '#6b7f82',
  wallEdge: '#8fa4a7',
  blue: '#38bdf8',
  blueDark: '#0c4a6e',
  red: '#fb7185',
  redDark: '#881337',
  bullet: '#fde68a',
  hud: 'rgba(6,15,20,0.78)',
  sand: '#8a6a43',
  hazard: '#fbbf24',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'front-wars-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'front-wars-save',
};
