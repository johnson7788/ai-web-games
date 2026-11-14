// SMASH KARTS · 全局数值与内容配置（唯一数值源，逻辑/渲染层不写死数字）
// 品牌方向：可爱卡通（cute cartoon）——糖纸配色、粗圆形状、拟人化卡丁车（大眼睛 + 表情）。

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

/** 全局配色：糖果卡通。ink 是所有描边/文字的深梅色。 */
export const PALETTE = {
  ink: '#3b2a4a',
  inkSoft: 'rgba(59,42,74,0.55)',
  cream: '#fff6e5',
  sky: '#bde7ff',
  white: '#ffffff',
  gold: '#ffd23f',
  mint: '#3ddc97',
  cherry: '#ff5d8f',
  blu: '#49b6ff',
  sunny: '#ffc233',
  grape: '#b06bff',
  hpGood: '#3ddc97',
  hpMid: '#ffc233',
  hpLow: '#ff5d8f',
  boost: '#ff9f1c',
  danger: '#ff4d6d',
  shadow: 'rgba(59,42,74,0.18)',
};

/**
 * 拟人化卡丁车角色表。
 * body = AI 生成的「车身 + 空白脸盘」贴图（脸由渲染层程序化绘制，便于表情切换）。
 * face = 脸盘锚点（贴图归一化坐标 0..1，精灵朝右 0°；x 向右为车头方向）。
 */
export const KARTS = {
  mint: {
    id: 'mint', name: 'Minty', color: PALETTE.mint, accent: '#12a06a',
    body: 'assets/karts/mint.webp', face: { x: 0.675, y: 0.505, r: 0.225 }, antenna: 'leaf',
    personality: 'player', blurb: { en: 'The brave little leaf kart.', zh: '一片勇敢的小叶子。' },
  },
  cherry: {
    id: 'cherry', name: 'Cherry', color: PALETTE.cherry, accent: '#d62f68',
    body: 'assets/karts/cherry.webp', face: { x: 0.675, y: 0.570, r: 0.170 }, antenna: 'flame',
    personality: 'aggressive', blurb: { en: 'All gas, all attitude.', zh: '油门到底，脾气也到底。' },
  },
  blu: {
    id: 'blu', name: 'Blu', color: PALETTE.blu, accent: '#1673c9',
    body: 'assets/karts/blu.webp', face: { x: 0.735, y: 0.505, r: 0.160 }, antenna: 'goggle',
    personality: 'sniper', blurb: { en: 'Measures twice, shoots once.', zh: '算两遍，只开一枪。' },
  },
  sunny: {
    id: 'sunny', name: 'Sunny', color: PALETTE.sunny, accent: '#d99407',
    body: 'assets/karts/sunny.webp', face: { x: 0.675, y: 0.502, r: 0.160 }, antenna: 'star',
    personality: 'brawler', blurb: { en: 'Bounces off every wall, happily.', zh: '每次都开心地撞墙弹回来。' },
  },
  grape: {
    id: 'grape', name: 'Grape', color: PALETTE.grape, accent: '#7d3ad6',
    body: 'assets/karts/grape.webp', face: { x: 0.650, y: 0.480, r: 0.165 }, antenna: 'sleep',
    personality: 'camper', blurb: { en: 'Waits. Then ruins your day.', zh: '先睡一会儿，再毁掉你的一天。' },
  },
};
export const PLAYER_KART = 'mint';
export const BOT_KARTS = ['cherry', 'blu', 'sunny', 'grape'];

/** 手感参数：加速度/漂移/加速条。所有阈值都可被 config 单测断言。 */
export const TUNING = {
  kart: {
    radius: 20,
    accel: 420,          // px/s²
    maxSpeed: 300,       // px/s
    reverseMax: 130,
    turnRate: 3.0,       // rad/s
    driftTurnRate: 4.5,  // 漂移时转向更快（代价见 driftGrip）
    friction: 1.7,
    driftFriction: 1.05, // 漂移保留速度
    driftGrip: 0.55,     // 漂移时速度方向与车头的夹角保留比例（走外线）
    wallBounce: 0.35,
    obstacleBounce: 0.45,
  },
  boost: {
    perSec: 0.55,        // 漂移充能速度（满 = 1）
    driftMinSpeed: 120,  // 低于该速度漂移不充能
    driftMinSteer: 0.25,
    minToFire: 0.35,     // 低于该值松手不结算加速
    speedMul: 1.7,
    minDur: 0.45,        // 秒
    maxDur: 1.15,
    ramDamage: 26,       // 「撞人」升级才生效
    ramKnock: 300,
  },
  combat: {
    hitFlashSec: 0.14,
    respawnInvulnSec: 1.5,
    hazardTickSec: 0.5,  // 岩浆掉血频率
  },
  ai: {
    thinkSec: 0.18,
    aimErrorRad: 0.16,
    damageMul: 0.55,     // AI 打玩家/彼此的伤害系数（玩家打 AI 不乘）
    fireRateMul: 0.7,    // AI 开火间隔放大（<1 = 更慢）
    aimTolRad: 0.2,      // AI 允许开火的瞄准容差
  },
};

/** 武器表。ammo=Infinity 表示默认武器。 */
export const WEAPONS = {
  gun: {
    id: 'gun', name: { en: 'Pop Gun', zh: '泡泡枪' },
    damage: 9, speed: 660, fireRate: 0.2, ammo: Infinity, count: 1, spread: 0.03,
    splash: 0, color: PALETTE.sunny, recoil: 26, icon: 'gun',
  },
  rapid: {
    id: 'rapid', name: { en: 'Rapid', zh: '速射' },
    damage: 7, speed: 720, fireRate: 0.075, ammo: 48, count: 1, spread: 0.07,
    splash: 0, color: PALETTE.blu, recoil: 14, icon: 'rapid',
  },
  shotgun: {
    id: 'shotgun', name: { en: 'Popcorn', zh: '爆米花' },
    damage: 9, speed: 600, fireRate: 0.72, ammo: 14, count: 5, spread: 0.3,
    splash: 0, color: PALETTE.cherry, recoil: 90, icon: 'shotgun',
  },
  rocket: {
    id: 'rocket', name: { en: 'Rocket', zh: '火箭' },
    damage: 32, speed: 430, fireRate: 0.85, ammo: 6, count: 1, spread: 0,
    splash: 74, color: PALETTE.danger, recoil: 120, icon: 'rocket',
  },
};
export const CRATE_WEAPONS = ['rapid', 'shotgun', 'rocket'];

/**
 * 三个竞技场：每个都有新元素（见 config/design.json levels）。
 * obstacles: { shape:'circle'|'rect', art:'mushroom'|'gumdrop'|'rock'|'bale', bounce }
 * hazards:   { type:'lava'|'belt' }
 */
export const ARENAS = [
  {
    id: 'meadow',
    name: { en: 'Sunny Meadow', zh: '阳光草地' },
    tagline: { en: 'Warm-up: learn the drift.', zh: '热身：学会漂移。' },
    bg: 'assets/bg/arena-meadow.webp',
    tint: '#9fe6a0',
    obstacles: [
      { shape: 'circle', x: 300, y: 180, r: 38, art: 'mushroom', bounce: true },
      { shape: 'circle', x: 980, y: 180, r: 38, art: 'mushroom', bounce: true },
      { shape: 'circle', x: 300, y: 540, r: 38, art: 'mushroom', bounce: true },
      { shape: 'circle', x: 980, y: 540, r: 38, art: 'mushroom', bounce: true },
      { shape: 'rect', x: 560, y: 132, w: 160, h: 52, art: 'bale', bounce: true },
      { shape: 'rect', x: 560, y: 536, w: 160, h: 52, art: 'bale', bounce: true },
    ],
    hazards: [],
    crateSpots: [
      { x: 640, y: 360 }, { x: 180, y: 360 }, { x: 1100, y: 360 },
      { x: 640, y: 250 }, { x: 640, y: 470 },
    ],
    spawns: [
      { x: 175, y: 190 }, { x: 1105, y: 190 }, { x: 140, y: 600 },
      { x: 1140, y: 600 }, { x: 360, y: 380 }, { x: 920, y: 380 },
    ],
    music: 'meadow',
  },
  {
    id: 'candy',
    name: { en: 'Bubblegum Factory', zh: '泡泡糖工厂' },
    tagline: { en: 'The belts move you. Plan your line.', zh: '传送带会推你走，先想好路线。' },
    bg: 'assets/bg/arena-candy.webp',
    tint: '#ffc2e2',
    obstacles: [
      { shape: 'circle', x: 250, y: 200, r: 42, art: 'gumdrop', bounce: true },
      { shape: 'circle', x: 1030, y: 200, r: 42, art: 'gumdrop', bounce: true },
      { shape: 'circle', x: 250, y: 520, r: 42, art: 'gumdrop', bounce: true },
      { shape: 'circle', x: 1030, y: 520, r: 42, art: 'gumdrop', bounce: true },
      { shape: 'rect', x: 600, y: 110, w: 80, h: 80, art: 'rock', bounce: false },
      { shape: 'rect', x: 600, y: 530, w: 80, h: 80, art: 'rock', bounce: false },
    ],
    hazards: [
      { type: 'belt', x: 120, y: 250, w: 1040, h: 84, dx: 1, dy: 0, speed: 130 },
      { type: 'belt', x: 120, y: 386, w: 1040, h: 84, dx: -1, dy: 0, speed: 130 },
    ],
    crateSpots: [
      { x: 640, y: 196 }, { x: 640, y: 524 }, { x: 440, y: 360 },
      { x: 840, y: 360 }, { x: 640, y: 360 },
    ],
    spawns: [
      { x: 175, y: 190 }, { x: 1105, y: 190 }, { x: 140, y: 600 },
      { x: 1140, y: 600 }, { x: 300, y: 380 }, { x: 980, y: 380 },
    ],
    music: 'candy',
  },
  {
    id: 'lava',
    name: { en: 'Lava Lamp Lair', zh: '岩浆灯窟' },
    tagline: { en: 'Mind the pools. Beat the champion.', zh: '小心岩浆，还要打赢冠军车。' },
    bg: 'assets/bg/arena-lava.webp',
    tint: '#c9a7ff',
    obstacles: [
      { shape: 'circle', x: 640, y: 130, r: 40, art: 'rock', bounce: false },
      { shape: 'circle', x: 640, y: 590, r: 40, art: 'rock', bounce: false },
      { shape: 'circle', x: 220, y: 360, r: 44, art: 'rock', bounce: false },
      { shape: 'circle', x: 1060, y: 360, r: 44, art: 'rock', bounce: false },
    ],
    hazards: [
      { type: 'lava', x: 420, y: 250, r: 50 },
      { type: 'lava', x: 860, y: 250, r: 50 },
      { type: 'lava', x: 420, y: 470, r: 50 },
      { type: 'lava', x: 860, y: 470, r: 50 },
    ],
    crateSpots: [
      { x: 640, y: 360 }, { x: 160, y: 160 }, { x: 1120, y: 160 },
      { x: 160, y: 560 }, { x: 1120, y: 560 },
    ],
    spawns: [
      { x: 175, y: 190 }, { x: 1105, y: 190 }, { x: 140, y: 600 },
      { x: 1140, y: 600 }, { x: 400, y: 380 }, { x: 880, y: 380 },
    ],
    music: 'lava',
    champion: { kart: 'cherry', hp: 170, label: { en: 'Cherry Prime', zh: '樱桃女王' } },
  },
];

export const RULES = {
  rounds: 3,
  killTarget: 10,
  roundSeconds: 100,
  respawnSec: 2.0,
  crateRespawnSec: 6.0,
  maxCrates: 4,
  projectileLife: 1.5,
  countdownSec: 2.4,
  botCount: 4,
  hp: 100,
  boostStart: 0.4,
};

/**
 * 局间三选一升级。kind:'rule' 改变规则（产生 build），'stat' 只调数值。
 * 每局结束（含失败）都开一次，最多 2 次（3 局）。
 */
export const UPGRADES = [
  { id: 'rocket-bounce', kind: 'rule', icon: 'bounce', name: { en: 'Bouncy Rockets', zh: '弹跳火箭' }, desc: { en: 'Rockets ricochet off walls once.', zh: '火箭撞墙后弹一次。' } },
  { id: 'triple-shot', kind: 'rule', icon: 'triple', name: { en: 'Triple Pop', zh: '三连爆米花' }, desc: { en: 'Shotgun fires 3 extra pellets, each weaker.', zh: '霰弹多 3 颗弹丸，单颗威力下降。' } },
  { id: 'drift-fire-trail', kind: 'rule', icon: 'trail', name: { en: 'Spark Trail', zh: '火花尾迹' }, desc: { en: 'Drifting leaves a burning trail that hurts karts.', zh: '漂移留下火焰尾迹，烧到对手。' } },
  { id: 'turbo-refund', kind: 'rule', icon: 'turbo', name: { en: 'Turbo Heart', zh: '涡轮之心' }, desc: { en: 'Every smash refunds a full boost.', zh: '每次击杀直接补满加速条。' } },
  { id: 'ram-boost', kind: 'rule', icon: 'ram', name: { en: 'Bumper Ram', zh: '保险杠撞击' }, desc: { en: 'Boosting into a kart deals heavy damage.', zh: '加速撞人会打出大量伤害。' } },
  { id: 'ghost-respawn', kind: 'rule', icon: 'ghost', name: { en: 'Ghost Start', zh: '幽灵起步' }, desc: { en: 'Respawn with 3s invulnerability and a free boost.', zh: '重生后无敌 3 秒并附赠一次加速。' } },
  { id: 'magnet-crate', kind: 'rule', icon: 'magnet', name: { en: 'Crate Magnet', zh: '箱子磁铁' }, desc: { en: 'Crates drift toward you from further away.', zh: '远处的箱子会自动向你滑过来。' } },
  { id: 'lucky-crate', kind: 'rule', icon: 'lucky', name: { en: 'Lucky Lid', zh: '幸运箱盖' }, desc: { en: 'Crates give a full refill plus a shield.', zh: '箱子额外补满弹药并给一层护盾。' } },
  { id: 'armor-plate', kind: 'stat', icon: 'armor', name: { en: 'Armor Plate', zh: '装甲板' }, desc: { en: '+30 max HP.', zh: '最大生命 +30。' } },
  { id: 'quick-reload', kind: 'stat', icon: 'reload', name: { en: 'Quick Hands', zh: '快手装填' }, desc: { en: '-18% fire delay.', zh: '射击间隔 -18%。' } },
  { id: 'turbo-engine', kind: 'stat', icon: 'engine', name: { en: 'Turbo Engine', zh: '涡轮引擎' }, desc: { en: '+10% top speed and faster drift charge.', zh: '极速 +10%，漂移充能更快。' } },
];
export const UPGRADE_PICKS = 3;

/** 表情枚举：渲染层按状态选择（拟人化 = 角色的主要表达出口）。 */
export const EXPRESSIONS = ['idle', 'happy', 'angry', 'hit', 'ko', 'boost', 'win', 'sleepy', 'surprise'];

/** 结算评级门槛（按玩家得分：击杀×10 + 存活 + 胜局×40）。 */
export const RANKS = [
  { id: 'S', min: 260, color: PALETTE.gold },
  { id: 'A', min: 190, color: PALETTE.mint },
  { id: 'B', min: 120, color: PALETTE.blu },
  { id: 'C', min: 0, color: PALETTE.grape },
];

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'smash-karts-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'smash-karts-save',
  keyart: 'assets/keyart/keyart-keyart-smash.webp',
};
