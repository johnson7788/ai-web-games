// 全局配置：所有手感 / 赛道 / 文案参数集中在这里，代码只读不写死
export const CONFIG = {
  appId: 'neon-drift',
  title: 'NEON DRIFT',
  lang: 'zh',                 // 'zh' | 'en'
  laps: 3,
  trackWidth: 16,             // 赛道半宽 = 16/2
  logicFps: 60,

  car: {
    maxSpeed: 74,             // m/s（≈266 km/h）
    accel: 19,                // m/s²
    drag: 0.22,
    brake: 46,
    steer: 1.70,              // rad/s（抓地）
    driftSteer: 2.25,         // rad/s（漂移）
    grip: 5.4,                // 回正速度（抓地）
    driftGrip: 1.15,          // 回正速度（漂移）
    driftMinSpeed: 26,
    boostMul: 1.42,
    boostTime: 2.3,
    nitroMax: 1.0,
    nitroPerSlip: 0.050,    // 每 rad·m 的充能
    offTrackDecay: 0.60,   // 出界每秒保留 60% 速度（擦墙，不是停死）
    wallBounce: 0.35,
  },

  curveForce: 1.25,          // 弯道离心放大系数（手感难度旋钮）

  camera: {
    dist: 7.4, height: 2.55, lookAhead: 9.5,
    fovBase: 56, fovSpeed: 15, fovBoost: 9,
    posLerp: 6.5, lookLerp: 7.5,
  },

  ai: {
    count: 3,
    baseSpeed: 0.82,          // 相对玩家最大速度
    rubber: 0.10,
  },
};

export const LOCALES = {
  zh: {
    start: '开始比赛', controls: '按住空格 / 漂移键过弯，松开回正',
    lap: '圈', best: '最佳', position: '名次',
    nitro: '氮气', kmh: '公里/时', raceTime: '比赛时间',
    finished: '完赛', total: '总时间', bestLap: '最快圈', restart: '再来一局',
    newRecord: '新纪录', touchHint: '左半屏转向 · 右下漂移 · 左下氮气',
    pause: '已暂停', resume: '继续',
  },
  en: {
    start: 'START RACE', controls: 'Hold SPACE / DRIFT to slide, release to grip',
    lap: 'LAP', best: 'BEST', position: 'POS',
    nitro: 'NITRO', kmh: 'KM/H', raceTime: 'RACE TIME',
    finished: 'FINISHED', total: 'TOTAL', bestLap: 'BEST LAP', restart: 'RACE AGAIN',
    newRecord: 'NEW RECORD', touchHint: 'Steer: hold left/right · Drift: bottom right',
    pause: 'PAUSED', resume: 'RESUME',
  },
};

export const T = (k) => (LOCALES[CONFIG.lang] || LOCALES.en)[k] || k;


// 参数化环线：半径按谐波起伏，天然闭合、曲率可控（比手摆控制点更均匀）
function loopPoints(R, harm, n = 20, phase = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    let r = 1;
    for (const [k, amp, ph] of harm) r += amp * Math.sin(k * a + ph);
    pts.push([Math.round(Math.cos(a) * R * r), Math.round(Math.sin(a) * R * r)]);
  }
  return pts;
}

// 三条赛道：三种风景（现代都市 / 沙漠戈壁 / 沿海公路）
export const TRACKS = [
  {
    id: 'city', name: 'NEON CITY', cn: '现代都市', kind: 'city', scale: 1.0, width: 16,
    theme: {
      kind: 'city', fog: 0x0a0d1e, fogDensity: 0.0030, sky: 'assets/sky-city.jpg',
      neon: 0x28e0ff, neon2: 0xff2d78, ground: 0x0a1024, groundRough: 1,
      hemiSky: 0x9fd0ff, hemiGround: 0x241a34, hemi: 0.85, key: 0xffd9b0, keyI: 2.8,
      rim: 0x28e0ff, rimI: 1.8, exposure: 1.28, fill: 26, bgIntensity: 1.0,
    },
    points: loopPoints(238, [[3, 0.20, 0.6], [5, 0.10, 2.1], [7, 0.05, 0.2]], 22),
  },
  {
    id: 'desert', name: 'GOBI RUN', cn: '沙漠戈壁', kind: 'desert', scale: 1.0, width: 17,
    theme: {
      kind: 'desert', fog: 0xd9a06a, fogDensity: 0.0016, sky: 'assets/sky-desert.jpg',
      neon: 0xffc46b, neon2: 0xff7a3c, ground: 0xd9b07a, groundRough: 1,
      hemiSky: 0xffd9a8, hemiGround: 0x8a5a34, hemi: 0.78, key: 0xffe0b0, keyI: 2.35,
      rim: 0xff9a5c, rimI: 0.9, exposure: 0.96, fill: 5, bgIntensity: 1.0,
    },
    points: loopPoints(232, [[2, 0.26, 1.1], [5, 0.12, 0.3], [9, 0.05, 2.6]], 24, 0.4),
  },
  {
    id: 'coast', name: 'COASTLINE', cn: '沿海公路', kind: 'coast', scale: 1.0, width: 16,
    theme: {
      kind: 'coast', fog: 0x9fd6e8, fogDensity: 0.0018, sky: 'assets/sky-coast.jpg',
      neon: 0x9fffe6, neon2: 0xffffff, ground: 0xd9c39a, groundRough: 1,
      hemiSky: 0xbfe8ff, hemiGround: 0x6a7f8a, hemi: 1.05, key: 0xfff0d0, keyI: 2.9,
      rim: 0x7fe0ff, rimI: 1.4, exposure: 1.08, fill: 12, bgIntensity: 1.0,
    },
    points: loopPoints(246, [[4, 0.18, 0.9], [7, 0.09, 1.7], [11, 0.04, 0.1]], 26, 0.9),
  },
];
