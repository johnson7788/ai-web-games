// TOWER CLIMB · 全局数值配置（config-first：所有数值/文案/关卡都在这里）
// 纯数值，不 import DOM/THREE；src/game/sim.js 只读这里。

export const STEP = 1 / 60;

// ---------------------------------------------------------------- i18n / 存档
// 语言：默认英文；zh 必做；ja/ko/ar/ru 没翻完就整块不暴露（本作只做 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'tower-climb-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'tower-climb-save',
  title: 'TOWER CLIMB',
};

// ---------------------------------------------------------------- 世界 / 塔
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  KILL_Y: -14,          // 摔落判定：脚下坠落到该高度以下 = 坠落回存档层
  CHECKPOINT_FLOOR: 5,  // 踩到第 5 层后，坠落回到第 5 层
  WIND_MIN_Y: 36,       // 第 7 层起（y >= 36m）有侧风
};

export const TOWER = {
  floors: 10,
  layerH: 6,            // 层间高度 6m，总高约 60m
  radius: 5,            // 螺旋半径
  angleStep: 0.95,      // 每层转角（弧度）
  landingHalf: 2.4,     // 落脚平台半宽（方形）
  stepHalf: 1.8,        // 中间踏板半宽
};

// ---------------------------------------------------------------- 玩家物理
export const PHYS = {
  gravity: 20,
  moveSpeed: 7,
  accel: 40,
  friction: 10,
  airControl: 0.35,
  jumpVel: 12,          // 跳高约 3.6m
  coyote: 0.12,         // 120ms
  jumpBuffer: 0.15,     // 150ms
  dashSpeed: 14,
  dashUp: 5,
  eye: 1.7,             // 眼睛高度
  radius: 0.4,
  sensitivity: 0.0024,
  pitchClamp: 1.45,
};

export const CRUMBLE = { time: 0.6 };   // 塌方块：踩上 0.6s 后消失

export const WIND = {
  force: 3.4,           // 侧风推力（m/s²）
  period: 5,            // 风向切换周期
};

// ---------------------------------------------------------------- 评级（S–C）
export const RATINGS = {
  S: { maxFalls: 0, maxTime: 95 },
  A: { maxFalls: 1, maxTime: 150 },
  B: { maxFalls: 3, maxTime: 1e9 },
  C: { maxFalls: 1e9, maxTime: 1e9 },
};

// ---------------------------------------------------------------- 色板（霓虹夜塔）
export const PALETTE = {
  bg: 0x0a0a14,     // 深空黑
  purple: 0xa855f7, // 电光紫
  cyan: 0x22d3ee,   // 荧光青
  magenta: 0xec4899, // 品红
  platformTop: 0x35306b,
  platformEdge: 0x22d3ee,
  ring: 0xa855f7,
  finish: 0xec4899,
  player: 0x22d3ee,
};

// ---------------------------------------------------------------- 平台布局（螺旋上升）
// 每层一个落脚平台（landing）+ 每两层之间一个中间踏板（step）。
// step 类型按关卡段：1-2 静态（含缺口）/ 3-4 水平移动 / 5-6 塌方块 / 7-8 垂直升降 / 9 旋转。
const ANGLE_STEP = TOWER.angleStep;
// 螺旋起始角：第 1 层落在塔心 -Z 侧，玩家开场面朝 +Z 即可直接看到整座塔（目标入画）
const ANGLE_OFFSET = -Math.PI / 2;

function landingPos(floor) {
  const a = (floor - 1) * ANGLE_STEP + ANGLE_OFFSET;
  return [Math.cos(a) * TOWER.radius, (floor - 1) * TOWER.layerH, Math.sin(a) * TOWER.radius];
}

function stepType(floor) {
  if (floor <= 2) return 'static';
  if (floor <= 4) return 'moveH';
  if (floor <= 6) return 'crumble';
  if (floor <= 8) return 'moveV';
  return 'rotate';
}

function buildPlatforms() {
  const list = [];
  for (let f = 1; f <= TOWER.floors; f++) {
    const [x, y, z] = landingPos(f);
    list.push({
      id: `landing-${f}`, floor: f, kind: 'landing', type: 'static',
      base: [x, y, z], half: TOWER.landingHalf, crumble: false,
    });
  }
  for (let f = 1; f < TOWER.floors; f++) {
    const [x1, y1, z1] = landingPos(f);
    const [x2, y2, z2] = landingPos(f + 1);
    const type = stepType(f);
    const base = [(x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2];
    const a = (f - 0.5) * ANGLE_STEP + ANGLE_OFFSET;
    const tangent = [-Math.sin(a), 0, Math.cos(a)];
    list.push({
      id: `step-${f}`, floor: f, kind: 'step', type,
      base, half: TOWER.stepHalf, crumble: type === 'crumble',
      axis: tangent, amp: 1.6, period: 4.2, phase: f * 1.3,
      orbitCx: base[0], orbitCz: base[2], orbitR: 1.2, orbitSpeed: 1.4, orbitPhase: f * 0.7,
    });
  }
  return list;
}

export const PLATFORMS = buildPlatforms();

// ---------------------------------------------------------------- 事件名（fun-report uniqueEvents 用）
export const EVENTS = [
  'start', 'first_input', 'jump', 'land', 'dash', 'level_up', 'checkpoint',
  'crumble', 'fall', 'wind_gust', 'tick', 'won',
];
