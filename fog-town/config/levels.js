// FOG TOWN · 12 街区定义（每街区：目标 / 迷雾布局轮换 / 场景包 / 新元素）
// 场景包：0 暮巷（灰蓝）· 1 集市废墟（土金）· 2 湖畔（青白）
// doorNeeds：'none'（直通）| 'key'（钥匙）| 'lever'（机关杠杆）| 'keyAndLever'（两者）

export const SCENES = [
  { key: 'scene.0', name: 'Dusk Alley', walls: 0.16, decor: 'dusk' },
  { key: 'scene.1', name: 'Market Ruins', walls: 0.20, decor: 'market' },
  { key: 'scene.2', name: 'Lakeside', walls: 0.24, decor: 'lake' },
];

export const BLOCKS = [
  { index: 1, scene: 0, doorNeeds: 'key',  clueCount: 0, trapCount: 0, guardCount: 0, layout: 'alley',     movingFog: false, newElement: 'key-unlock' },
  { index: 2, scene: 0, doorNeeds: 'lever', clueCount: 0, trapCount: 1, guardCount: 0, layout: 'alley',     movingFog: false, newElement: 'lever-trap' },
  { index: 3, scene: 0, doorNeeds: 'key',  clueCount: 0, trapCount: 2, guardCount: 0, layout: 'corridor',  movingFog: false, newElement: 'trap-economy' },
  { index: 4, scene: 0, doorNeeds: 'key',  clueCount: 3, trapCount: 1, guardCount: 0, layout: 'corridor',  movingFog: false, newElement: 'truth-moment' },
  { index: 5, scene: 1, doorNeeds: 'keyAndLever', clueCount: 0, trapCount: 2, guardCount: 0, layout: 'dense', movingFog: false, newElement: 'key-lever-combo' },
  { index: 6, scene: 1, doorNeeds: 'key',  clueCount: 0, trapCount: 1, guardCount: 1, layout: 'dense',     movingFog: false, newElement: 'guard-vision' },
  { index: 7, scene: 1, doorNeeds: 'lever', clueCount: 0, trapCount: 2, guardCount: 2, layout: 'dense',    movingFog: false, newElement: 'double-guard' },
  { index: 8, scene: 1, doorNeeds: 'key',  clueCount: 3, trapCount: 1, guardCount: 0, layout: 'corridor',  movingFog: true,  newElement: 'moving-fog' },
  { index: 9, scene: 2, doorNeeds: 'keyAndLever', clueCount: 0, trapCount: 3, guardCount: 0, layout: 'dense', movingFog: true,  newElement: 'lakeside-combo' },
  { index: 10, scene: 2, doorNeeds: 'key', clueCount: 0, trapCount: 1, guardCount: 2, layout: 'corridor',  movingFog: true,  newElement: 'guard-fog' },
  { index: 11, scene: 2, doorNeeds: 'lever', clueCount: 3, trapCount: 3, guardCount: 0, layout: 'dense',   movingFog: false, newElement: 'lakeside-truth' },
  { index: 12, scene: 2, doorNeeds: 'keyAndLever', clueCount: 0, trapCount: 2, guardCount: 3, layout: 'dense', movingFog: true, newElement: 'finale-guards' },
];

export const BLOCK_COUNT = BLOCKS.length;

export function blockAt(index0) {
  return BLOCKS[Math.max(0, Math.min(BLOCK_COUNT - 1, index0))];
}

export function sceneAt(block) {
  return SCENES[block.scene] || SCENES[0];
}
