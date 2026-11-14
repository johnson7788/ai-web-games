// config/game.config.js — 所有数值集中，逻辑层只读不写死
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'drift-limits',
  title: 'DRIFT LIMITS',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'drift-limits:lang',
  saveKey: 'drift-limits:save',
  laps: 3,
  logicFps: 60,
};

// 车辆手感：沿用 neon-drift 实测校准值
export const CAR = {
  maxSpeed: 74, accel: 19, brake: 46,
  steer: 1.70, driftSteer: 2.25, grip: 5.4, driftGrip: 1.15,
  driftMinSpeed: 26, boostMul: 1.42, boostTime: 2.3,
  nitroMax: 1, nitroPerSlip: 0.02, curveForce: 1.25, driftScrub: 0.08,
  angleMax: 0.55,
};

export const POLICE = {
  baseRatio: 0.72, heatAdd: 0.05,
  rubberFar: 60, rubberFarAdd: 8, rubberNear: 10, rubberNearSub: 10,
  crashGap: 15, bustGap: 3, bustHold: 1.2,
  gapPerfect: 55, gapNormal: 45, gapJump: 13, secondCopOffset: 12,
  heat3Mul: 1.10,
};

export const SCORE = {
  driftRate: 6, nearMiss: 150, lapBonus: 500,
  multMax: 10, chainWindow: 2.5, noDriftReset: 6,
  nearMissNitro: 0.15,
  ratings: [ ['S', 15000], ['A', 10000], ['B', 6000], ['C', 0] ],
};

export const TRAFFIC = {
  lanes: [-5, 0, 5], speedMin: 22, speedMax: 30,
  spawnEvery: [3.5, 2.8, 2.2], spawnAheadMin: 120, spawnAheadMax: 180,
  despawnBehind: 60, max: 14,
  hitDs: 4.2, hitDt: 2.0, nearDtMin: 2.0, nearDtMax: 3.4,
  crashSpeedMul: 0.55, crashCooldown: 0.6,
};

export const BLOCKS = { fractions: [0.25, 0.55, 0.8], hitDs: 3.0, hitDt: 2.2 };

export const LAUNCH = { reds: 3, greenAt: 3.0, perfectWindow: 0.35, perfectBoost: 1.6, perfectNitro: 0.5, perfectGap: 10 };

export const CAMERA = { dist: 7.4, height: 2.55, lookAhead: 9.5, fovBase: 56, fovSpeed: 15, fovBoost: 9, posLerp: 6.5, lookLerp: 7.5 };

// perk：4 规则 + 4 数值；best score 里程碑解锁；每局装 2
export const PERKS = [
  { id: 'chain-lock', kind: 'rule', unlock: 3000 },
  { id: 'nearmiss-master', kind: 'rule', unlock: 6000 },
  { id: 'cop-shaker', kind: 'rule', unlock: 10000 },
  { id: 'ghost-bump', kind: 'rule', unlock: 15000 },
  { id: 'engine-tune', kind: 'stat', unlock: 20000 },
  { id: 'turbo-kit', kind: 'stat', unlock: 30000 },
  { id: 'grip-tires', kind: 'stat', unlock: 45000 },
  { id: 'light-chassis', kind: 'stat', unlock: 60000 },
];

// 夜城环线：谐波参数化闭合样条（neon-drift 底座同款生成器）
function loopPoints(R, harm, n = 22, phase = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    let r = 1;
    for (const [k, amp, ph] of harm) r += amp * Math.sin(k * a + ph);
    pts.push([Math.round(Math.cos(a) * R * r), Math.round(Math.sin(a) * R * r)]);
  }
  return pts;
}

export const TRACK_DEF = {
  id: 'night-city', name: 'NEON CITY', width: 16, scale: 1.0,
  points: loopPoints(238, [[3, 0.20, 0.6], [5, 0.10, 2.1], [7, 0.05, 0.2]], 22),
  theme: {
    fog: 0x070a18, fogDensity: 0.0032, sky: 'assets/sky-night.jpg',
    neon: 0x28e0ff, neon2: 0xff2d78, ground: 0x0a1024,
    hemiSky: 0x8fb8ff, hemiGround: 0x1a1430, hemi: 0.75,
    key: 0xbfd4ff, keyI: 2.2, rim: 0x28e0ff, rimI: 1.6,
    exposure: 1.22, fill: 24, bgIntensity: 0.9,
  },
};

export const CARS = [
  { id: 'vector', name: 'VECTOR', tint: 0x28e0ff },
  { id: 'vortex', name: 'VORTEX', tint: 0xff9a3c },
  { id: 'arrow', name: 'ARROW', tint: 0x8aff5a },
];