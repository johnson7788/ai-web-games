// BALL ORBIT · 12 波定义（推进结构）
// 每波：场景包 / 初始行数 / 列数 / 硬度分布 / 特性概率 / 行星数 / 弹射加倍带 / 空穴率
// 波次推进：每 DESCENTS_PER_WAVE 次下坠 +1（见 gameplay.WAVES）
// hole = 单元格留空概率（让流星能穿缝弹上顶墙，ballz 类核心手感）
export const WAVES = [
  { index: 1,  scene: 'dust', rows: 4, cols: 9, value: [1, 3],  addBall: 0.06, shield: 0.00, moving: 0.00, planets: 0, bounceBand: false, hole: 0.28 },
  { index: 2,  scene: 'dust', rows: 4, cols: 9, value: [1, 4],  addBall: 0.08, shield: 0.00, moving: 0.00, planets: 1, bounceBand: false, hole: 0.26 },
  { index: 3,  scene: 'dust', rows: 5, cols: 9, value: [2, 5],  addBall: 0.08, shield: 0.00, moving: 0.00, planets: 2, bounceBand: false, hole: 0.26 },
  { index: 4,  scene: 'dust', rows: 5, cols: 9, value: [2, 6],  addBall: 0.08, shield: 0.08, moving: 0.00, planets: 2, bounceBand: false, hole: 0.24 },
  { index: 5,  scene: 'gas',  rows: 5, cols: 9, value: [3, 7],  addBall: 0.08, shield: 0.10, moving: 0.10, planets: 2, bounceBand: false, hole: 0.24 },
  { index: 6,  scene: 'gas',  rows: 5, cols: 9, value: [3, 8],  addBall: 0.08, shield: 0.12, moving: 0.12, planets: 2, bounceBand: true,  hole: 0.22 },
  { index: 7,  scene: 'gas',  rows: 6, cols: 9, value: [4, 9],  addBall: 0.08, shield: 0.14, moving: 0.14, planets: 3, bounceBand: true,  hole: 0.22 },
  { index: 8,  scene: 'gas',  rows: 6, cols: 9, value: [4, 10], addBall: 0.08, shield: 0.16, moving: 0.16, planets: 3, bounceBand: true,  hole: 0.20 },
  { index: 9,  scene: 'deep', rows: 6, cols: 9, value: [5, 12], addBall: 0.08, shield: 0.18, moving: 0.18, planets: 4, bounceBand: true,  hole: 0.20 },
  { index: 10, scene: 'deep', rows: 6, cols: 9, value: [5, 13], addBall: 0.08, shield: 0.20, moving: 0.20, planets: 4, bounceBand: true,  hole: 0.18 },
  { index: 11, scene: 'deep', rows: 7, cols: 9, value: [6, 15], addBall: 0.08, shield: 0.22, moving: 0.22, planets: 5, bounceBand: true,  hole: 0.18 },
  { index: 12, scene: 'deep', rows: 7, cols: 9, value: [7, 18], addBall: 0.08, shield: 0.25, moving: 0.25, planets: 5, bounceBand: true,  hole: 0.16 },
];

export const WAVE_COUNT = WAVES.length;

// wave 下标（1-based）→ 波对象；越界 clamp 到最后一波
export function waveAt(index) {
  const i = Math.max(1, Math.min(WAVE_COUNT, index));
  return WAVES[i - 1];
}

// 波次 → 场景包 id
export function sceneForWave(index) {
  return waveAt(index).scene;
}
