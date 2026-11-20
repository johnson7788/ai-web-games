// NEO TETRA · 12 矿层 + 3 场景包。
// 每层：目标行数（本层内消行数）+ 特性轮换。特性：
//   vein     加速矿脉（重力按等级加成）
//   nextCount 双 next（2 预览）
//   dark     暗井（只有 ghost 亮）
//   narrow   窄井（左右各封 1 列墙，有效宽 8）
//   heavy    重块（石头块不可消只可绕）
//   gift     gift 块（随机道具）
// 场景包 scene：copper（暖橙）/ ice（青蓝）/ core（红黑），换章必换色板 + 构图 + 装饰 + 专属 BGM 层。

export const SCENE_PACKS = [
  { id: 'copper', name: 'scene.copper', layers: [1, 2, 3, 4, 5, 6] },
  { id: 'ice', name: 'scene.ice', layers: [7, 8, 9] },
  { id: 'core', name: 'scene.core', layers: [10, 11, 12] },
];

export const LAYERS = [
  { index: 1,  name: 'layer.1',  scene: 'copper', baseHue: 30,  target: 5,  features: {} },
  { index: 2,  name: 'layer.2',  scene: 'copper', baseHue: 20,  target: 5,  features: { vein: 1 } },
  { index: 3,  name: 'layer.3',  scene: 'copper', baseHue: 42,  target: 6,  features: { nextCount: 2 } },
  { index: 4,  name: 'layer.4',  scene: 'copper', baseHue: 16,  target: 6,  features: { narrow: true } },
  { index: 5,  name: 'layer.5',  scene: 'copper', baseHue: 50,  target: 7,  features: { gift: true } },
  { index: 6,  name: 'layer.6',  scene: 'copper', baseHue: 10,  target: 7,  features: { dark: true } },
  { index: 7,  name: 'layer.7',  scene: 'ice',    baseHue: 190, target: 8,  features: { heavy: true } },
  { index: 8,  name: 'layer.8',  scene: 'ice',    baseHue: 214, target: 8,  features: { narrow: true, nextCount: 2 } },
  { index: 9,  name: 'layer.9',  scene: 'ice',    baseHue: 202, target: 9,  features: { dark: true, gift: true } },
  { index: 10, name: 'layer.10', scene: 'core',   baseHue: 355, target: 9,  features: { vein: 2 } },
  { index: 11, name: 'layer.11', scene: 'core',   baseHue: 340, target: 10, features: { heavy: true, narrow: true } },
  { index: 12, name: 'layer.12', scene: 'core',   baseHue: 14,  target: 12, features: { dark: true, vein: 1, gift: true } },
];

export const LAYER_COUNT = LAYERS.length;

export function layerAt(index) {
  const n = Math.max(1, Math.min(LAYER_COUNT, Math.round(index) || 1));
  return LAYERS[n - 1];
}

export function sceneOf(layerIndex) {
  return layerAt(layerIndex).scene;
}

export function scenePack(sceneId) {
  return SCENE_PACKS.find((s) => s.id === sceneId) || SCENE_PACKS[0];
}
