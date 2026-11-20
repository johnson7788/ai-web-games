// config/levels.js — SKY DROP DODGE · 12 波推进结构（每波新元素 / 掉落轮换 / 风带 / 场景）
// scene: 1 晴午天台（亮蓝） / 2 雷雨（灰紫电光） / 3 晚霞（金橙）
export const SCENES = [
  { index: 1, key: 'scene.1', name: 'noon',   palette: 'noon' },
  { index: 2, key: 'scene.2', name: 'thunder', palette: 'thunder' },
  { index: 3, key: 'scene.3', name: 'dusk',    palette: 'dusk' },
];

export const WAVES = [
  { index: 1, name: 'wave.1',  scene: 1, durationSec: 12, interval: 1.5, warn: 1.2, speed: [240, 280], kinds: ['pot'], aim: 0.30, burst: 1, tracking: 0, wind: 0 },
  { index: 2, name: 'wave.2',  scene: 1, durationSec: 12, interval: 0.75, warn: 0.9, speed: [280, 320], kinds: ['bottle', 'cup', 'can'], aim: 0.35, burst: 1, tracking: 0, wind: 0 },
  { index: 3, name: 'wave.3',  scene: 1, durationSec: 12, interval: 1.1, warn: 1.0, speed: [300, 340], kinds: ['pot', 'cup', 'bottle'], aim: 0.40, burst: 1, tracking: 0, wind: 1 },
  { index: 4, name: 'wave.4',  scene: 2, durationSec: 13, interval: 1.6, warn: 1.4, speed: [330, 380], kinds: ['fridge', 'sofa', 'tv'], aim: 0.50, burst: 1, tracking: 0, wind: 1 },
  { index: 5, name: 'wave.5',  scene: 2, durationSec: 13, interval: 0.9, warn: 0.8, speed: [200, 240], kinds: ['drone'], aim: 0.0, burst: 1, tracking: 1, wind: 0 },
  { index: 6, name: 'wave.6',  scene: 2, durationSec: 12, interval: 0.7, warn: 0.25, speed: [340, 380], kinds: ['bottle', 'pot', 'cup'], aim: 0.50, burst: 1, tracking: 0, wind: 1 },
  { index: 7, name: 'wave.7',  scene: 2, durationSec: 12, interval: 0.55, warn: 0.6, speed: [380, 420], kinds: ['bottle', 'cup', 'can', 'pot'], aim: 0.40, burst: 2, tracking: 0, wind: 1 },
  { index: 8, name: 'wave.8',  scene: 2, durationSec: 13, interval: 0.6, warn: 0.8, speed: [360, 400], kinds: ['pot', 'cup', 'drone'], aim: 0.40, burst: 1, tracking: 0.3, wind: 2 },
  { index: 9, name: 'wave.9',  scene: 3, durationSec: 13, interval: 1.2, warn: 1.3, speed: [350, 400], kinds: ['fridge', 'sofa', 'tv', 'bottle'], aim: 0.50, burst: 1, tracking: 0, wind: 1 },
  { index: 10, name: 'wave.10', scene: 3, durationSec: 12, interval: 0.45, warn: 0.5, speed: [410, 450], kinds: ['bottle', 'cup', 'can'], aim: 0.45, burst: 2, tracking: 0, wind: 1 },
  { index: 11, name: 'wave.11', scene: 3, durationSec: 13, interval: 1.0, warn: 0.9, speed: [300, 340], kinds: ['drone', 'fridge', 'sofa'], aim: 0.40, burst: 1, tracking: 0.4, wind: 1 },
  { index: 12, name: 'wave.12', scene: 3, durationSec: 14, interval: 0.5, warn: 0.6, speed: [420, 470], kinds: ['pot', 'bottle', 'cup', 'drone', 'fridge'], aim: 0.50, burst: 2, tracking: 0.3, wind: 1 },
];

export const WAVE_COUNT = WAVES.length;

export function waveAt(index) {
  return WAVES[Math.min(WAVES.length - 1, Math.max(0, index - 1))];
}

export function totalDurationSec() {
  return WAVES.reduce((s, w) => s + w.durationSec, 0);
}
