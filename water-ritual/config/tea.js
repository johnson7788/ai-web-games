// config/tea.js — WATER RITUAL 玩法数值（config-first，逻辑层不写死数字）。
// 机制：按住倒水，水位从 0 升向目标线 line，水温从 startTemp 线性下降；
//       松手（超过 featherMs 未再按）即结算。评分 = 水位误差 + 水温误差。
//       每 5 单一波客流高峰；连客日连续 perfect 触发「满堂彩」。
export const TEA = {
  // —— 倒水物理 ——
  pourRate: 0.52,        // 水位每秒上升（0..1）；满杯约 1.9s
  startTemp: 97,         // 开始倒水时水温（°C）
  coolRate: 9.0,         // 水温每秒下降（°C）
  minTemp: 20,           // 水温下限（装饰用）
  maxLevel: 1.0,         // 水位上限；到顶 = 溢出
  minPourLevel: 0.06,    // 松手时水位低于此值视为「没倒水」，不计结算（防误触）
  featherMs: 140,        // 松手宽限：该时间内再按住视为「续倒」，不结算（时机手感）

  // —— 评分容差 ——
  perfectLevelTol: 0.05, // 水位误差在此内 + 水温在窗口内 → perfect
  goodLevelTol: 0.13,
  perfectTempTol: 2.2,   // 相对窗口的额外容差
  goodTempTol: 6.0,
  levelWeight: 0.5,
  tempWeight: 0.5,
  perfectAccuracy: 90,   // 一口回甘（金圈涟漪）阈值
  goodAccuracy: 70,

  // —— 耐心 / 心 ——
  heartsMax: 3,
  patienceBase: 20,      // 基础耐心秒（每单）
  spawnDelay: 0.25,      // 两单之间的上客间隔（秒）
  rushSpawnDelay: 0.12,  // 高峰内上客间隔（秒）

  // —— 节奏 / 连击 ——
  rushEvery: 5,          // 每 5 单一波客流高峰
  fullHouseStreak: 3,    // 高峰内连续 perfect 3 单 → 满堂彩
  comboWindowSec: 4.0,   // 连击窗口（连续成功单）

  // —— 经营推进 ——
  daysTotal: 12,         // 12 天经营
  dayTargetBase: 4,      // 每天目标单数（第 1 天）
  dayTargetGrowth: 0.5,  // 每天目标单数递增
  sceneByDay: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], // 1 晨茶 2 午市 3 夜谈

  // —— 客型（绿茶 / 红茶 / 花茶 = 不同水温线）——
  teas: {
    green: { id: 'green', key: 'tea.green', color: '#9adf9a', targetTemp: 84, windowHalf: 4.0, reward: 12 },
    black: { id: 'black', key: 'tea.black', color: '#c98a4b', targetTemp: 90, windowHalf: 3.0, reward: 15 },
    flower: { id: 'flower', key: 'tea.flower', color: '#e6a8c8', targetTemp: 76, windowHalf: 3.5, reward: 14 },
  },

  // —— 客型难度档（贵客高风险高回报 / 老茶客容错高但分低 / 急客时间短 / 挑剔客区间窄）——
  guests: {
    regular:  { id: 'regular',  key: 'guest.regular',  windowMul: 1.3, patienceMul: 1.3, rewardMul: 1.0, levelRange: [0.42, 0.82] },
    noble:    { id: 'noble',    key: 'guest.noble',    windowMul: 0.55, patienceMul: 1.0, rewardMul: 2.2, levelRange: [0.55, 0.95] },
    oldFriend: { id: 'oldFriend', key: 'guest.oldFriend', windowMul: 1.6, patienceMul: 1.6, rewardMul: 0.75, levelRange: [0.38, 0.72] },
    hurried:  { id: 'hurried',  key: 'guest.hurried',  windowMul: 1.0, patienceMul: 0.55, rewardMul: 1.5, levelRange: [0.4, 0.7] },
    picky:    { id: 'picky',    key: 'guest.picky',    windowMul: 0.7, patienceMul: 1.2, rewardMul: 1.6, levelRange: [0.5, 0.9] },
  },

  // —— 12 天每轮客型轮换（索引取模，保证每天不同客型组合）——
  guestRotation: [
    'regular', 'oldFriend', 'hurried', 'regular', 'picky',
    'noble', 'regular', 'hurried', 'picky', 'regular',
    'oldFriend', 'noble', 'hurried', 'picky', 'regular',
  ],

  // —— 升级（kind: rule 改规则 | stat 数值；rule 占比 ≥35%）——
  upgrades: [
    { id: 'thermometer', kind: 'rule', descKey: 'up.thermometer', cost: 30, apply: { showWindow: true } },
    { id: 'slowPour',    kind: 'rule', descKey: 'up.slowPour',    cost: 30, apply: { pourRateMul: 0.8 } },
    { id: 'iceReserve',  kind: 'rule', descKey: 'up.iceReserve',  cost: 40, apply: { coolRateMul: 0.72 } },
    { id: 'secondChance', kind: 'rule', descKey: 'up.secondChance', cost: 50, apply: { forgivePerDay: 1 } },
    { id: 'goldenRipple', kind: 'rule', descKey: 'up.goldenRipple', cost: 60, apply: { perfectBonus: 2 } },
    { id: 'rushMaster',  kind: 'rule', descKey: 'up.rushMaster',  cost: 50, apply: { rushBonus: 2 } },
    { id: 'regularFriend', kind: 'rule', descKey: 'up.regularFriend', cost: 35, apply: { regularPatienceMul: 1.35 } },
    { id: 'cozyPot',     kind: 'rule', descKey: 'up.cozyPot',     cost: 45, apply: { featherMsAdd: 90 } },
    { id: 'heartUp',     kind: 'stat', descKey: 'up.heartUp',     cost: 55, apply: { heartsAdd: 1 } },
    { id: 'coinUp',      kind: 'stat', descKey: 'up.coinUp',      cost: 40, apply: { coinMul: 1.3 } },
  ],
};

export const SCENES = {
  1: { id: 1, key: 'scene.morning', palette: { bg: '#f7ead6', accent: '#e8b44a', ink: '#5a4632' } },
  2: { id: 2, key: 'scene.noon', palette: { bg: '#dcecdc', accent: '#3f9d6e', ink: '#1f3a2a' } },
  3: { id: 3, key: 'scene.night', palette: { bg: '#141a38', accent: '#6f7ff0', ink: '#e6e8ff' } },
};
