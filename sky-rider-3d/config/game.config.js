// config/game.config.js — SKY RIDER 3D 全部数值集中，逻辑层只读不写死。
// 契约：src/game/* 纯逻辑不碰 DOM；随机用 seed。事件总线：sim 发事件，render/audio/ui 消费。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'sky-rider-3d',
  title: 'SKY RIDER 3D',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'sky-rider-3d:lang',
  saveKey: 'sky-rider-3d:save',
  laps: 3,
  logicFps: 60,
  color: { sky: 0x38bdf8, cloud: 0xf0f9ff, ring: 0xfbbf24, player: 0xef4444 },
};

// 飞机手感（俯仰=俯冲提速/爬升减速；偏航+坡度；boost 穿环回充；空格刹车）
export const PLANE = {
  baseSpeed: 42,          // m/s 巡航
  minSpeed: 16,
  maxSpeed: 70,
  accel: 26,              // 逼近目标速度的加速度
  decel: 30,              // 超速回落
  gravitySpeed: 26,       // 俯冲/爬升与速度的耦合（俯冲提速）
  brake: 34,              // 空气刹车
  yawRate: 1.7,           // rad/s
  pitchRate: 1.35,        // rad/s
  pitchMax: 0.85,         // rad
  rollMax: 0.9,           // 坡度（视觉）
  rollFactor: 0.55,       // 偏航输入→坡度
  groundY: 0,             // 峡谷地面
  crashSpeed: 30,         // 高于此速撞地算 hard crash
  groundMul: 0.62,        // 轻触地掉速
  crashMul: 0.32,         // 重摔掉速
};

export const BOOST = {
  max: 1,                 // boost 条
  drain: 0.5,             // /s
  refill: 0.34,           // 每环回充
  mul: 1.35,              // 速度倍率
};

export const RING = {
  hitMul: 0.6,            // 撞环掉速
  missPenalty: 2,         // 漏环罚时（秒）
  hitMargin: 1.8,         // 擦边判定半径倍率
  passSpeedBonus: 6,      // 穿环速度奖励
};

export const SLIPSTREAM = {
  dist: 5,                // 前机 5m 内
  mul: 1.10,              // 提速 10%
  angleCos: 0.5,          // 前机在前方（点积阈值）
  eventCd: 1.4,           // 事件节流
};

export const RACE = {
  countdown: 2.5,         // 3-2-1-GO
  distStep: 50,           // 每 50m 一次遥测里程碑
  laps: 3,
};

export const BOT = {
  count: 7,
  yawRate: 1.5,
  pitchRate: 1.1,
  skill: [0.86, 0.9, 0.94, 0.97, 1.0, 1.03, 1.06], // 每机速度系数
  err: [0.5, 0.4, 0.3, 0.24, 0.18, 0.13, 0.08],     // 航线误差（rad）
  boostChance: 0.0025,   // 每帧概率
  boostTime: 1.4,
  separate: 8,           // 避让距离
  colors: [0xfb923c, 0xfacc15, 0x4ade80, 0x22d3ee, 0x60a5fa, 0xa78bfa, 0xf472b6],
};

export const CAMERA = {
  modes: [
    { id: 'chase', dist: 14, height: 5.5, lookAhead: 26, fovBase: 62, fovSpeed: 16, fovBoost: 9 },
    { id: 'near', dist: 7, height: 3.2, lookAhead: 18, fovBase: 60, fovSpeed: 14, fovBoost: 7 },
    { id: 'cockpit', dist: 0, height: 1.0, lookAhead: 40, fovBase: 68, fovSpeed: 8, fovBoost: 6 },
  ],
  posLerp: 6.5,
  lookLerp: 7.5,
};

export const RATING = {
  // [最低名次, 评级]（名次越好评级越高）
  rank: [ [1, 'S'], [3, 'A'], [5, 'B'], [8, 'C'] ],
  crashDowngrade: 6,      // 摔机 ≥ 此数，S/A 降一级
  ringRateGood: 0.85,
};

// 5 场锦标赛赛道变体（config-first，渲染与 sim 共用）
export const TRACKS = [
  { id: 'canyon-breeze', name: 'CANYON BREEZE', variant: 'dive',   ringCount: 16, ringRadius: 12, loopR: 300, baseY: 55, elevAmp: 20, wobbleAmp: 0.08, moveAmp: 0,    moveFreq: 0,    diveDepth: 36, divePhase: 3.0, sprintRings: 0, sprintRadius: 0 },
  { id: 'drifting-clouds', name: 'DRIFTING CLOUDS', variant: 'moving', ringCount: 16, ringRadius: 12, loopR: 300, baseY: 58, elevAmp: 16, wobbleAmp: 0.06, moveAmp: 6, moveFreq: 0.55, diveDepth: 0, sprintRings: 0, sprintRadius: 0 },
  { id: 'narrow-gorge', name: 'NARROW GORGE', variant: 'canyon', ringCount: 18, ringRadius: 11, loopR: 300, baseY: 48, elevAmp: 14, wobbleAmp: 0.10, moveAmp: 0,    moveFreq: 0,    diveDepth: 0,  sprintRings: 0, sprintRadius: 0 },
  { id: 'sky-dive', name: 'SKY DIVE', variant: 'dive',   ringCount: 16, ringRadius: 12, loopR: 300, baseY: 70, elevAmp: 24, wobbleAmp: 0.08, moveAmp: 0,    moveFreq: 0,    diveDepth: 52, divePhase: 4.6, sprintRings: 0, sprintRadius: 0 },
  { id: 'golden-sprint', name: 'GOLDEN SPRINT', variant: 'sprint', ringCount: 20, ringRadius: 12, loopR: 300, baseY: 55, elevAmp: 18, wobbleAmp: 0.08, moveAmp: 0,    moveFreq: 0,    diveDepth: 0,  sprintRings: 5, sprintRadius: 9 },
];
