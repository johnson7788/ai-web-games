// 关卡数据（Lead 拥有；数值改动只改这里）。
// 3 关：霓虹防线主题（原创换皮）。3 条路径 / 18 个建造点 / 7 波敌人。
// 敌人 token：d = drone(轻量) / b = brute(重甲) / s = speeder(疾速)。

const X_SPOTS = [250, 400, 550, 700, 850, 1000];
const LANE_YS = [205, 360, 515];

// 每条路径（右→左）：敌人从右端出生，走向左侧基地。
const PATH_BLUEPRINTS = [
  [[1230, 205], [1050, 185], [880, 225], [700, 185], [520, 225], [340, 190], [160, 210], [92, 210]],
  [[1230, 360], [1060, 340], [890, 380], [720, 340], [540, 380], [360, 345], [170, 360], [92, 360]],
  [[1230, 515], [1050, 495], [880, 535], [700, 495], [520, 535], [340, 500], [160, 515], [92, 515]],
];

// 敌人数值
export const ENEMY_DEFS = {
  d: { name: 'drone', hp: 30, speed: 58, reward: 12, playerHurt: 1, radius: 11, color: '#ff4d6d' },
  b: { name: 'brute', hp: 95, speed: 44, reward: 30, playerHurt: 2, radius: 15, color: '#b983ff' },
  s: { name: 'speeder', hp: 22, speed: 96, reward: 15, playerHurt: 1, radius: 9, color: '#2de2e6' },
};

// 塔数值（4 类 × 4 级）：range=射程 build=造价(该级累计) attack=单次伤害 fire=射击间隔
export const TOWER_DEFS = {
  laser:  { name: 'laser',  label: 'Laser',  cost: 80,  range: [100, 120, 140, 160], attack: [15, 22, 32, 45], fire: [1.0, 0.9, 0.82, 0.72] },
  tesla:  { name: 'tesla',  label: 'Tesla',  cost: 100, range: [105, 125, 145, 165], attack: [12, 18, 26, 36], fire: [1.1, 1.0, 0.9, 0.8], slow: true },
  rail:   { name: 'rail',   label: 'Rail',   cost: 130, range: [95, 115, 135, 155], attack: [26, 40, 58, 80], fire: [1.3, 1.2, 1.1, 1.0], aoe: 34 },
  drone:  { name: 'drone',  label: 'Drone',  cost: 90,  range: [80, 90, 100, 110], attack: [8, 12, 18, 26], fire: [0.42, 0.38, 0.34, 0.3] },
};
export const TOWER_ORDER = ['laser', 'tesla', 'rail', 'drone'];

// 紧凑波次构造：W(间隔, 每只间隔, 'ddd', 'bb', ...)
const W = (delay, genEvery, ...parts) => {
  const spawn = [];
  for (const p of parts) {
    if (typeof p === 'string') { for (const ch of p) spawn.push(ch); }
    else if (p && typeof p.n === 'number') { for (let i = 0; i < p.n; i += 1) spawn.push(p.t); }
  }
  return { delay, genEvery, spawn };
};

const LEVEL_1_WAVES = [
  W(0.6, 0.5, 'ddd'),
  W(2.8, 0.5, 'dddddd'),
  W(2.8, 0.45, 'ddddddddd'),
  W(2.8, 0.5, 'dddd', 'b'),
  W(2.8, 0.6, 'bbb'),
  W(2.8, 0.42, 'dddddddddd', 'bbbb'),
  W(2.8, 0.4, 'dddddddddddddddd'),
];

const LEVEL_2_WAVES = [
  W(0.6, 0.5, 'ddds'),
  W(2.8, 0.45, 'dddddd', 'ss'),
  W(2.8, 0.42, 'ddddddddd', 'sss'),
  W(2.8, 0.5, 'dddd', 'b', 's'),
  W(2.8, 0.55, 'bbb', 's'),
  W(2.8, 0.4, 'dddddddddd', 'bbbb', 'ss'),
  W(2.8, 0.4, 'dddddddddddd', 'bbbb', 'ssss'),
];

const LEVEL_3_WAVES = [
  W(0.6, 0.5, 'dddb'),
  W(2.8, 0.45, 'dddddd', 'bb'),
  W(2.8, 0.42, 'ddddddddd', 'sss'),
  W(2.8, 0.5, 'bbbb', 'd'),
  W(2.8, 0.55, 'bbbbbb'),
  W(2.8, 0.4, 'dddddddddddd', 'bbbbbb', 'sss'),
  W(2.8, 0.38, 'dddddddddddddddd', 'bbbbbb', 'ssssss'),
];

function buildSpots(blockedSet) {
  const spots = [];
  let id = 0;
  for (let lane = 0; lane < 3; lane += 1) {
    for (let col = 0; col < 6; col += 1) {
      spots.push({
        id,
        lane,
        x: X_SPOTS[col],
        y: LANE_YS[lane],
        blocked: blockedSet.has(id),
      });
      id += 1;
    }
  }
  return spots;
}

export const LEVELS = [
  {
    name: { en: 'Perimeter', zh: '外围防线' },
    scene: 'neon-violet',
    paths: PATH_BLUEPRINTS,
    buildSpots: buildSpots(new Set()),
    waves: LEVEL_1_WAVES,
    newElement: '四类基础塔（激光/特斯拉/轨道炮/无人机）',
  },
  {
    name: { en: 'Breakthrough', zh: '突破走廊' },
    scene: 'neon-cyan',
    paths: PATH_BLUEPRINTS,
    buildSpots: buildSpots(new Set([2, 7, 13, 16])),
    waves: LEVEL_2_WAVES,
    newElement: '疾速敌人 + 部分建造点被岩石封锁',
  },
  {
    name: { en: 'Citadel', zh: '要塞核心' },
    scene: 'neon-gold',
    paths: PATH_BLUEPRINTS,
    buildSpots: buildSpots(new Set([4, 9, 11])),
    waves: LEVEL_3_WAVES,
    newElement: '重甲精英成群 + 核心掉落加速',
  },
];

export const LEVEL_COUNT = LEVELS.length;
