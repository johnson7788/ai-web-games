// CANNON ECHO · 12 波推进定义 + 3 场景包（晨谷 / 雪隘 / 熔峡）
// 波次目标型轮换：慢速浮空箱 / 俯冲集群 / 掩体后补给箱（护盾）/ 装甲箱（需回声连击）/ Boss 巨箱

// 场景：wave 1-4 晨谷，5-8 雪隘，9-12 熔峡
export const SCENES = [
  { index: 0, name: 'scene.0', minWave: 1, maxWave: 4, decor: 'morning' },
  { index: 1, name: 'scene.1', minWave: 5, maxWave: 8, decor: 'snow' },
  { index: 2, name: 'scene.2', minWave: 9, maxWave: 12, decor: 'lava' },
];

export function sceneAt(wave) {
  for (const s of SCENES) if (wave >= s.minWave && wave <= s.maxWave) return s;
  return SCENES[SCENES.length - 1];
}

// 每波生成清单：{ type, lane, count }，lane 可省略（随机列）
export const WAVES = [
  { index: 1, newElement: 'wave.1', targets: [
    { type: 'crate', lane: 3 }, { type: 'crate', lane: 2 }, { type: 'crate', lane: 4 }, { type: 'crate', lane: 5 },
  ] },
  { index: 2, newElement: 'wave.2', targets: [
    { type: 'diver', lane: 1 }, { type: 'diver', lane: 2 }, { type: 'diver', lane: 3 },
    { type: 'crate', lane: 5 }, { type: 'diver', lane: 6 }, { type: 'diver', lane: 7 },
  ] },
  { index: 3, newElement: 'wave.3', targets: [
    { type: 'shielded', lane: 2 }, { type: 'crate', lane: 3 }, { type: 'shielded', lane: 5 }, { type: 'crate', lane: 6 },
  ] },
  { index: 4, newElement: 'wave.4', targets: [
    { type: 'armored', lane: 4 }, { type: 'crate', lane: 2 }, { type: 'crate', lane: 6 },
  ] },
  { index: 5, newElement: 'wave.5', targets: [
    { type: 'shielded', lane: 2 }, { type: 'armored', lane: 5 }, { type: 'diver', lane: 3 }, { type: 'diver', lane: 4 },
  ] },
  { index: 6, newElement: 'wave.6', targets: [
    { type: 'diver', lane: 1 }, { type: 'diver', lane: 2 }, { type: 'shielded', lane: 4 }, { type: 'diver', lane: 6 }, { type: 'diver', lane: 7 },
  ] },
  { index: 7, newElement: 'wave.7', targets: [
    { type: 'armored', lane: 3 }, { type: 'armored', lane: 5 }, { type: 'crate', lane: 4 },
  ] },
  { index: 8, newElement: 'wave.8', targets: [
    { type: 'diver', lane: 2 }, { type: 'shielded', lane: 3 }, { type: 'diver', lane: 4 }, { type: 'diver', lane: 5 }, { type: 'shielded', lane: 6 },
  ] },
  { index: 9, newElement: 'wave.9', targets: [
    { type: 'crate', lane: 2 }, { type: 'shielded', lane: 3 }, { type: 'armored', lane: 4 }, { type: 'shielded', lane: 5 }, { type: 'crate', lane: 6 },
  ] },
  { index: 10, newElement: 'wave.10', targets: [
    { type: 'armored', lane: 2 }, { type: 'armored', lane: 4 }, { type: 'shielded', lane: 6 },
  ] },
  { index: 11, newElement: 'wave.11', targets: [
    { type: 'diver', lane: 1 }, { type: 'armored', lane: 3 }, { type: 'shielded', lane: 4 }, { type: 'armored', lane: 5 }, { type: 'diver', lane: 7 },
  ] },
  { index: 12, newElement: 'wave.12', targets: [
    { type: 'boss', lane: 4 },
  ] },
];

export const WAVE_COUNT = WAVES.length;

export function waveAt(n) {
  return WAVES[clamp(n - 1, 0, WAVE_COUNT - 1)];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
