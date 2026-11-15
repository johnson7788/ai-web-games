// config/game.config.js — SPACE WAVE 3D 全部数值/关卡/色板集中于此；逻辑层只读不写死。
// 单位：米（隧道纵向 dist / 船体垂直 y）、秒、60Hz 固定步长。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'pipy-space-wave-3d',
  title: 'SPACE WAVE 3D',
  defaultLang: 'en',
  languages: ['en', 'zh'], // ja/ko/ar/ru 不做，整块不暴露
  rtlLangs: [],
  langNames: { en: 'English', zh: '中文' },
  langStorageKey: 'space-wave-3d:lang',
  saveKey: 'space-wave-3d:save',
};

// 隧道 / 玩家垂直运动
export const TUNNEL = {
  range: 7,          // 船体可移动的垂直半程（y ∈ [-range, range]）
  radius: 7.6,       // 隧道视觉半径（渲染用）
  ringSpacing: 9,    // 隧道环间距（米）
  ringCount: 40,     // 滚动的隧道环数量
  lookAhead: 160,    // 向前生成障碍的距离
  despawnBehind: 14, // 越过船后多少米销毁
  gateEvery: 34,     // 障碍（门）基准间距
  gateJitter: 8,     // 门距抖动
};

export const SHIP = {
  gravity: 46,       // 松手下坠加速度
  thrust: 70,        // 按住上升加速度
  vmax: 14,          // 垂直速度上限
  y0: 0,             // 起始高度
};

export const SPEED = {
  min: 17,           // 起始前进速度
  max: 40,           // 极速
  rampDist: 2200,    // 达到极速的里程
  boostMul: 1.3,     // 加速段（第 4 段）倍率
};

export const SCORE = {
  distPerMeter: 1,   // 距离 = 基础分
  perfect: 50,       // 完美穿越基础分（×倍率）
  perfectTol: 0.3,   // 完美判定：距缝隙中心 ±0.3m
  nearTol: 0.9,      // 近失判定：距中心 ±0.9m
  nearBonus: 15,     // 近失奖励
  orbScore: 25,      // 能量球直接加分
  multMax: 8,        // 连穿倍率上限（签名：×8）
  segmentLen: 500,   // 每段长度
  shieldMax: 1,      // 护盾上限
  invulnSec: 0.9,    // 护盾被击破后的无敌时间
  slowmoSec: 0.2,    // 极限窄缝完美穿越的凝滞时长
  slowmoScale: 0.35, // 凝滞时的时间缩放
  ratings: [['S', 4000], ['A', 2500], ['B', 1200], ['C', 0]],
};

// 5 段模板：每段一个「新元素」；level 越界时循环取模。
// kind: ring(静态宽缝) / moving(移动柱) / narrow(窄缝) / spin(旋转环+加速) / extreme(极限窄缝连穿)
export const SEGMENTS = [
  {
    id: 'wide', kind: 'ring', gapH: 3.6, amp: 0, freq: 0,
    colors: { accent: 0x06b6d4, accent2: 0x22d3ee, pipe: 0x0a2a40, bg: 0x050510 },
  },
  {
    id: 'moving', kind: 'moving', gapH: 3.2, amp: 2.2, freq: 1.7,
    colors: { accent: 0xd946ef, accent2: 0xf0abfc, pipe: 0x2a0a35, bg: 0x050510 },
  },
  {
    id: 'narrow', kind: 'narrow', gapH: 2.0, amp: 0, freq: 0, orb: true,
    colors: { accent: 0xf59e0b, accent2: 0xfcd34d, pipe: 0x2a2008, bg: 0x050510 },
  },
  {
    id: 'spin', kind: 'spin', gapH: 2.4, amp: 2.8, freq: 2.8, boost: true,
    colors: { accent: 0x06b6d4, accent2: 0xd946ef, pipe: 0x0a2a3a, bg: 0x050510 },
  },
  {
    id: 'extreme', kind: 'extreme', gapH: 1.3, amp: 0, freq: 0, streak: true,
    colors: { accent: 0xf59e0b, accent2: 0xffffff, pipe: 0x2a1508, bg: 0x050510 },
  },
];

export function segmentAt(level) {
  return SEGMENTS[(Math.max(1, level) - 1) % SEGMENTS.length];
}
