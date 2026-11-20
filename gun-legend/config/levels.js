// GUN LEGEND · M1 关卡/场景/武器推进定义
// 12 场 → 3 场景包（雨巷 1-4 / 天台 5-8 / 酒楼 9-12）
// 敌型轮换：刀手冲锋 → 枪手掩体 → 投弹手 → 双持精英 → Boss 大哥
// 武器解锁：左轮(1-4) → 散弹(5-8) → 双持冲锋(9-12)

export const SCENES = [
  {
    index: 1,
    id: 'alley',
    nameKey: 'scene.alley',
    rounds: [1, 4],
    // 雨巷：青蓝霓虹
    palette: { bgTop: '#0a1a2e', bgBottom: '#07101c', neon: '#54e7ff', neon2: '#b26bff', rain: true },
  },
  {
    index: 2,
    id: 'rooftop',
    nameKey: 'scene.rooftop',
    rounds: [5, 8],
    // 天台：金橙夕阳
    palette: { bgTop: '#2a1508', bgBottom: '#140a04', neon: '#ffb454', neon2: '#ff7a3c', rain: false },
  },
  {
    index: 3,
    id: 'restaurant',
    nameKey: 'scene.restaurant',
    rounds: [9, 12],
    // 酒楼：朱红灯笼
    palette: { bgTop: '#2a0a0c', bgBottom: '#120506', neon: '#ff5d5d', neon2: '#ffc94a', rain: false },
  },
];

// 每场的波次（每波 = 敌型数组）。难度渐进：先刀手教学，再引入枪手/投弹手/精英，末场 Boss。
const ROUND_DEFS = [
  { weapon: 'revolver', scene: 1, waves: [['knife', 'knife'], ['knife', 'knife', 'knife'], ['knife', 'knife']] },
  { weapon: 'revolver', scene: 1, waves: [['knife', 'knife', 'knife'], ['knife', 'gunner'], ['knife', 'knife', 'gunner']] },
  { weapon: 'revolver', scene: 1, waves: [['knife', 'gunner', 'gunner'], ['knife', 'knife', 'knife', 'gunner'], ['gunner', 'gunner', 'gunner']] },
  { weapon: 'revolver', scene: 1, waves: [['knife', 'knife', 'gunner', 'grenadier'], ['gunner', 'gunner'], ['knife', 'grenadier', 'gunner']] },
  { weapon: 'shotgun', scene: 2, waves: [['knife', 'knife', 'knife', 'knife'], ['gunner', 'gunner'], ['grenadier', 'gunner', 'gunner']] },
  { weapon: 'shotgun', scene: 2, waves: [['knife', 'knife', 'gunner', 'grenadier'], ['gunner', 'grenadier', 'gunner'], ['knife', 'knife', 'gunner']] },
  { weapon: 'shotgun', scene: 2, waves: [['elite', 'knife', 'knife'], ['gunner', 'gunner', 'grenadier'], ['elite', 'grenadier']] },
  { weapon: 'shotgun', scene: 2, waves: [['elite', 'gunner', 'gunner'], ['elite', 'grenadier', 'knife', 'knife'], ['elite', 'elite']] },
  { weapon: 'smg', scene: 3, waves: [['knife', 'knife', 'knife', 'gunner'], ['elite', 'gunner', 'gunner'], ['grenadier', 'grenadier', 'gunner']] },
  { weapon: 'smg', scene: 3, waves: [['elite', 'elite', 'knife'], ['elite', 'grenadier', 'gunner', 'gunner'], ['elite', 'knife', 'knife', 'gunner']] },
  { weapon: 'smg', scene: 3, waves: [['elite', 'elite', 'elite'], ['grenadier', 'grenadier', 'elite'], ['elite', 'gunner', 'grenadier', 'knife']] },
  { weapon: 'smg', scene: 3, waves: [['elite', 'elite', 'knife', 'gunner'], ['boss'], ['elite', 'grenadier', 'gunner']] },
];

export const ROUNDS = ROUND_DEFS.map((d, i) => ({
  index: i + 1,
  weapon: d.weapon,
  scene: d.scene,
  waves: d.waves,
}));

export const ROUND_COUNT = ROUNDS.length;

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

export function sceneForRound(round) {
  return sceneById(ROUNDS[(round - 1) % ROUND_COUNT].scene);
}
