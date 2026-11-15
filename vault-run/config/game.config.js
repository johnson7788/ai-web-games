// config/game.config.js — 所有数值集中，逻辑层只读不写死（config-first）。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'vault-run',
  title: 'VAULT RUN',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'vault-run:lang',
  saveKey: 'vault-run:save',
  logicFps: 60,
};

// 一局 5 分钟：时间归零或冲过终点 = 结算
export const RUN = {
  clockStart: 300,
  hitPenalty: 3,        // 撞障碍扣时间
  fallPenalty: 10,      // 坠落回检查点扣时间
  pickupTime: 10,       // 时间加成拾取
  speedBase: 9,         // 起步速度 m/s
  speedMax: 15,         // 满速 m/s
  speedRamp: 60,        // 60s 内加速到满
  sprintMul: 1.45,      // 冲刺倍率
  staminaMax: 100,
  sprintDrain: 26,      // 冲刺每秒耗体力
  staminaRegen: 16,     // 体力每秒回复
  lateralSpeed: 8.5,    // A/D 横向速度 m/s
  stunSec: 1.0,         // 撞停时长
  finishZ: 2000,
};

// 动作状态机：run→vault（0.5s 手撑）→slide（0.7s 低姿态）→wallrun（侧倾最多 2 步）
export const ACTION = {
  vault:   { dur: 0.5, score: 100, arc: 1.7, label: 'vault' },
  slide:   { dur: 0.7, score: 100, lowY: 0.25, label: 'slide' },
  wallrun: { dur: 0.6, score: 150, tilt: 20, label: 'wallrun' },
  trigger: 3.0,          // 障碍前可触发上下文动作的 z 窗口
};

export const SCORE = {
  distPerM: 1,
  comboWindow: 2.5,
  multMax: 8,
  milestoneEvery: 100,
  milestoneBonus: 50,
  ratings: [['S', 6000], ['A', 4000], ['B', 2200], ['C', 0]],
};

// 5 段/关：每段解锁一个新地形/障碍类型
export const LEVELS = [
  { index: 1, startZ: 0,    halfWidth: 9,  name: 'rooftop',  intro: 'level1' },
  { index: 2, startZ: 400,  halfWidth: 8,  name: 'pipes',    intro: 'level2' },
  { index: 3, startZ: 800,  halfWidth: 3.6, name: 'alley',   intro: 'level3' },
  { index: 4, startZ: 1200, halfWidth: 5,  name: 'crane',    intro: 'level4' },
  { index: 5, startZ: 1600, halfWidth: 2.6, name: 'descent',  intro: 'level5' },
];

export const CAMERA = {
  fov: 74, fovSprint: 82, fovSlide: 66, fovVault: 70,
  eye: 1.7, eyeSlide: 0.75, eyeVault: 2.3,
  tiltWallrun: 20, // 度，蹬墙侧倾
  bobSpeed: 7, bobAmp: 0.06,
};

// 配色：黄昏屋顶（暖橙/砖红/天空紫/混凝土灰）
export const PALETTE = {
  sky: 0x7c3aed,
  sun: 0xf97316,
  brick: 0xb45309,
  concrete: 0x6b7280,
  roof: 0x8a8578,
  accent: 0xf97316,
  fog: 0x5a3a86,
};
