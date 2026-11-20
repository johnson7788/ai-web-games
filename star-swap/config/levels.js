// config/levels.js — 12 关推进结构：目标分 + 特性轮换（每关一个 newElement）
// scene 索引 0/1/2 → 河内(紫蓝) / 猎户(青白) / 南门(金橙)，换章必换色板。
// feature 轮换：dark（暗物质阵）/ seeded（初始特殊星）/ six（六色）/ gravity（重力反转一回合）/ lens（引力透镜）
export const LEVELS = [
  { index: 1, scene: 0, colors: 5, target: 600,  moves: 20, feature: null },
  { index: 2, scene: 0, colors: 5, target: 900,  moves: 20, feature: null },
  { index: 3, scene: 0, colors: 5, target: 1200, moves: 22, feature: 'dark',  darkCount: 6 },
  { index: 4, scene: 0, colors: 6, target: 2600, moves: 24, feature: 'six' },
  { index: 5, scene: 1, colors: 5, target: 1800, moves: 22, feature: 'seeded', seeded: [{ r: 2, c: 3, s: 'row' }, { r: 5, c: 4, s: 'col' }] },
  { index: 6, scene: 1, colors: 5, target: 2200, moves: 24, feature: 'lens',  lens: 3 },
  { index: 7, scene: 1, colors: 5, target: 2400, moves: 24, feature: 'gravity' },
  { index: 8, scene: 1, colors: 6, target: 3600, moves: 26, feature: 'dark+six', darkCount: 8 },
  { index: 9, scene: 2, colors: 6, target: 3400, moves: 26, feature: 'lens+six', lens: 3 },
  { index: 10, scene: 2, colors: 5, target: 3200, moves: 26, feature: 'gravity+dark', darkCount: 8 },
  { index: 11, scene: 2, colors: 6, target: 4600, moves: 28, feature: 'six+seeded', seeded: [{ r: 1, c: 1, s: 'nova' }] },
  { index: 12, scene: 2, colors: 6, target: 5200, moves: 30, feature: 'all', darkCount: 8, seeded: [{ r: 3, c: 3, s: 'nova' }], lens: 3 },
];

export function levelAt(i) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, i - 1));
  return LEVELS[idx];
}

export const LEVEL_COUNT = LEVELS.length;

export const SCENES = [
  { id: 0, key: 'scene.river', name: '河内 / Milky River' },
  { id: 1, key: 'scene.orion', name: '猎户 / Orion' },
  { id: 2, key: 'scene.south', name: '南门 / South Gate' },
];

export function sceneOf(levelIndex) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex - 1))].scene;
}
