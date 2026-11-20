// ENDLESS ORB · 12 环推进结构定义。
// 每环：scene（0 蓝星核 / 1 红巨核 / 2 黑洞核）、form（single/swing/variable/twin）、
//        target（本环目标钉数）、omega（核自转角速度，rad/s，可正负表方向）、formParams。
// formParams 语义：swing → { swingAmp, swingFreq }；variable → { varAmp, varFreq }；twin 可带 varAmp/varFreq。

export const SCENES = [
  { id: 'blue', key: 'scene.blue', label: 'BLUE CORE' },
  { id: 'red', key: 'scene.red', label: 'RED GIANT' },
  { id: 'black', key: 'scene.black', label: 'BLACK HOLE' },
];

export const RINGS = [
  // 1–4 蓝星核：教基础时机 → 反向 → 摇摆 → 变速
  { index: 1, scene: 0, form: 'single', target: 8, omega: 0.80, formParams: {} },
  { index: 2, scene: 0, form: 'single', target: 10, omega: -1.05, formParams: {} },
  { index: 3, scene: 0, form: 'swing', target: 12, omega: 0.95, formParams: { swingAmp: 62, swingFreq: 1.3 } },
  { index: 4, scene: 0, form: 'variable', target: 14, omega: 1.05, formParams: { varAmp: 0.55, varFreq: 2.1 } },

  // 5–8 红巨核：极性反转引入 → 双核互绕 → 摇摆+极性 → 极速+极性
  { index: 5, scene: 1, form: 'single', target: 16, omega: 1.30, formParams: {} },
  { index: 6, scene: 1, form: 'twin', target: 18, omega: 1.05, formParams: {} },
  { index: 7, scene: 1, form: 'swing', target: 20, omega: 1.35, formParams: { swingAmp: 72, swingFreq: 1.5 } },
  { index: 8, scene: 1, form: 'variable', target: 22, omega: 1.50, formParams: { varAmp: 0.65, varFreq: 2.6 } },

  // 9–12 黑洞核：高速单核 → 双核+变速 → 摇摆+极性 → 终局全开
  { index: 9, scene: 2, form: 'single', target: 24, omega: 1.60, formParams: {} },
  { index: 10, scene: 2, form: 'twin', target: 26, omega: 1.30, formParams: { varAmp: 0.5, varFreq: 2.4 } },
  { index: 11, scene: 2, form: 'swing', target: 28, omega: 1.70, formParams: { swingAmp: 80, swingFreq: 1.7 } },
  { index: 12, scene: 2, form: 'twin', target: 30, omega: 1.75, formParams: { varAmp: 0.6, varFreq: 2.8 } },
];

export const RING_COUNT = RINGS.length;

export function ringAt(index) {
  return RINGS[Math.max(0, Math.min(RINGS.length - 1, index - 1))];
}

export function sceneAt(ringIndex) {
  return SCENES[ringAt(ringIndex).scene] || SCENES[0];
}
