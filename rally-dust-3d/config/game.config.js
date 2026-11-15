// config/game.config.js — RALLY DUST 3D 全部数值集中（逻辑层只读不写死）
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  title: 'RALLY DUST 3D',
  appId: 'pipy-rally-dust-3d',
  defaultLang: 'en',
  languages: ['en', 'zh'],          // ja/ko/ar/ru 不做 → 整块不暴露
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: [],
  langStorageKey: 'rally-dust-3d:lang',
  saveKey: 'rally-dust-3d:save',
  stages: 5,
  logicFps: 60,
};

// 车辆手感：力驱动 + 侧向摩擦模型（(s,t) 赛道空间，参考 drift-limits 校准）
export const CAR = {
  maxSpeed: 52,             // m/s（≈187 km/h，受车损衰减）
  accel: 17,
  brake: 30,
  steer: 1.7,               // 常规转向角速率
  driftSteer: 2.4,          // 手刹转向角速率（更灵）
  steerSmooth: 8,
  gripAsphalt: 5.2,         // 侧向抓地（角度衰减速率 /s）
  gripGravel: 3.4,
  gripMud: 1.5,             // 泥地抓地低 → 漂移窗口大
  driftGrip: 1.1,           // 手刹时抓地
  driftMinSpeed: 16,
  curveForce: 1.1,          // 弯道把车往外/内拉
  angleMax: 0.72,
  driftScrub: 0.05,         // 漂移掉速（得分与速度对立）
  offTrackScrub: 1.6,       // 出界减速
  driftAngleMin: 0.13,      // 判定漂移的侧滑角阈值
  gearSpeeds: [0, 18, 28, 38, 52], // 档位速度区间上限（1-4 档自动离合）
  downshiftBrake: 0.96,     // 手动降档瞬间的速度倍率（发动机制动）
};

// 路面类型（渲染贴图槽位 + 抓地）
export const SURFACES = {
  gravel:  { grip: 'gripGravel',  color: 0xd6a35c, name: 'GRAVEL' },
  mud:     { grip: 'gripMud',     color: 0x6b4423, name: 'MUD' },
  asphalt: { grip: 'gripAsphalt', color: 0x4a4f57, name: 'TARMAC' },
};

// 车损表：撞树/撞石/出界/颠簸
export const DAMAGE = {
  max: 100,                     // 100% = 退赛
  tree: { dmg: 16, speedMul: 0.45, bias: 0.35, biasTime: 1.2 },
  rock: { dmg: 11, speedMul: 0.60, bias: 0.24, biasTime: 0.9 },
  offTrackDps: 5,               // 出界每秒伤害
  bumpDps: 4,                   // 颠簸近路：高速压过每秒伤害
  bumpSpeedMin: 22,             // 低于此速度压颠簸路段不伤
  maxSpeedMulPerDmg: 0.004,     // 每点伤害衰减最大速度（满伤 ≈ 0.6x）
  minMaxSpeedMul: 0.6,
};

// 路书（副驾 pace notes）
export const PACE = {
  lookaheadSec: 3,              // 提前 3 秒报弯
  minLookahead: 42,             // 最小报弯距离(m)
  cornerKappa: 0.004,           // 判定为弯的曲率阈值
  perfectTol: 4,                // 完美过弯速度容差(m/s)
  gearForKappa: [               // 曲率 → 建议档位
    [0.020, 1], [0.012, 2], [0.007, 3], [0, 4],
  ],
};

// 计分与评级
export const SCORE = {
  driftRate: 5,                 // 漂移分 = speed*|angle|*dt*driftRate
  pacePerfect: 120,             // 按路书档位完美过弯
  distPer100: 20,               // 每推进 100m
  stageClear: 400,              // 每完成一个赛段
  timeRate: 30,                 // 比目标时间每快 1s 的加分
  ratings: [['S', 9000], ['A', 6000], ['B', 3000], ['C', 0]],
};

export const CAMERA = {
  chase: { dist: 8.5, height: 3.6, lookAhead: 10, posLerp: 6.5, lookLerp: 8, fov: 58, fovSpeed: 12 },
  hood:  { dist: 0.0, height: 1.15, lookAhead: 26, posLerp: 30, lookLerp: 30, fov: 66, fovSpeed: 6 },
  shake: 0.10,                  // 颠簸相机抖动幅度（reduced-motion 关）
};

// 赛段定义：点对点拉力（seed 生成路径 + 路面类型 + 障碍）
// surfaces: {from,to,type} 按弧长比例；trees/rocks 障碍数量；bumpy 颠簸近路比例段
export const STAGES = [
  { id: 's1', name: 'GRAVEL RUN',   len: 1400, width: 15, seed: 101, turns: 6,  turnMax: 0.45, surfaces: [{ from: 0, to: 1, type: 'gravel' }], trees: 0,  rocks: 0,  bumpy: [] },
  { id: 's2', name: 'MUD HAIRPIN',  len: 1600, width: 15, seed: 202, turns: 9,  turnMax: 0.95, surfaces: [{ from: 0, to: 0.35, type: 'gravel' }, { from: 0.35, to: 0.82, type: 'mud' }, { from: 0.82, to: 1, type: 'gravel' }], trees: 2, rocks: 0, bumpy: [] },
  { id: 's3', name: 'FOREST NARROW',len: 1500, width: 11, seed: 303, turns: 10, turnMax: 0.85, surfaces: [{ from: 0, to: 1, type: 'gravel' }], trees: 30, rocks: 0, bumpy: [] },
  { id: 's4', name: 'BUMPY CUT',    len: 1700, width: 14, seed: 404, turns: 8,  turnMax: 0.75, surfaces: [{ from: 0, to: 1, type: 'asphalt' }], trees: 0, rocks: 12, bumpy: [{ from: 0.30, to: 0.48 }, { from: 0.70, to: 0.86 }] },
  { id: 's5', name: 'FINAL MIX',    len: 1800, width: 14, seed: 505, turns: 10, turnMax: 0.9,  surfaces: [{ from: 0, to: 0.30, type: 'asphalt' }, { from: 0.30, to: 0.62, type: 'mud' }, { from: 0.62, to: 1, type: 'gravel' }], trees: 4, rocks: 8, bumpy: [] },
];

// 每赛段目标时间（评级时间加分基准；配置可 ±20%）
export const STAGE_TARGETS = [45, 60, 58, 66, 70];
