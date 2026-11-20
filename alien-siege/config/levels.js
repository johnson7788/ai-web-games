// ALIEN SIEGE · 12 波推进结构（每波一个场景包 + 敌型组合）
// 场景包：1 殖民巷（紫灰）· 2 反应场（青绿）· 3 夜空港（深蓝）
// newElement 用于设计审计（config/design.json 同步）；这里只承载生成数据。

export const WAVES = [
  { index: 1,  scene: 1, enemies: [{ type: 'crawler', count: 3 }],                                            newElement: '爬行者：快速近战，教移动+射击' },
  { index: 2,  scene: 1, enemies: [{ type: 'crawler', count: 5 }],                                            newElement: '双侧夹击：爬行者从两翼同时扑来' },
  { index: 3,  scene: 1, enemies: [{ type: 'crawler', count: 4 }, { type: 'floater', count: 1 }],             newElement: '步枪解锁：自动连射' },
  { index: 4,  scene: 1, enemies: [{ type: 'floater', count: 3 }, { type: 'crawler', count: 2 }],             newElement: '浮游者：飘移轨迹难追踪' },
  { index: 5,  scene: 2, enemies: [{ type: 'floater', count: 4 }, { type: 'crawler', count: 3 }],             newElement: '换章：反应场青绿巷道' },
  { index: 6,  scene: 2, enemies: [{ type: 'behemoth', count: 1 }, { type: 'crawler', count: 3 }],            newElement: '霰弹枪解锁 + 巨兽登场' },
  { index: 7,  scene: 2, enemies: [{ type: 'behemoth', count: 2 }, { type: 'floater', count: 2 }],            newElement: '巨兽护送：厚敌配浮游者' },
  { index: 8,  scene: 2, enemies: [{ type: 'behemoth', count: 1 }, { type: 'crawler', count: 4 }, { type: 'floater', count: 2 }], newElement: '混合冲锋：三敌型同场' },
  { index: 9,  scene: 3, enemies: [{ type: 'behemoth', count: 2 }, { type: 'floater', count: 3 }],            newElement: '镭射武器解锁 + 夜空港' },
  { index: 10, scene: 3, enemies: [{ type: 'behemoth', count: 2 }, { type: 'crawler', count: 5 }],            newElement: '双巨兽：厚敌成对压进' },
  { index: 11, scene: 3, enemies: [{ type: 'behemoth', count: 2 }, { type: 'floater', count: 4 }, { type: 'crawler', count: 4 }], newElement: '精英混编：全敌型饱和战' },
  { index: 12, scene: 3, enemies: [{ type: 'nest', count: 1 }],                                               newElement: 'Boss 母巢：持续召唤爬行者' },
];

export const WAVE_COUNT = WAVES.length;

export function waveDef(index) {
  return WAVES[Math.min(Math.max(index, 1), WAVE_COUNT) - 1];
}

// 每波总敌数（用于 HUD 剩余敌数/进度）
export function waveEnemyCount(wave) {
  const def = waveDef(wave);
  return def.enemies.reduce((s, e) => s + e.count, 0);
}
