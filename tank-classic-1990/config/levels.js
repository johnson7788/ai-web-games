// 关卡定义：12 关，每关恰好引入一个新元素（fun-audit 强制不重复）。
// 地形 flags 累积：brick 永远有；steel/grass/rock/water 逐关解锁。
// 敌人：grunt(1HP 慢) scout(快) gunner(速射) tank(2HP)。
export const LEVELS = [
  { index: 1, name: { en: 'First Contact', zh: '初次交锋' }, terrain: {}, enemies: [{ type: 'grunt', count: 6 }], newElement: 'brick maze + grunt enemies' },
  { index: 2, name: { en: 'Steel', zh: '钢铁防线' }, terrain: { steel: true }, enemies: [{ type: 'grunt', count: 8 }], newElement: 'steel walls (indestructible)' },
  { index: 3, name: { en: 'Tall Grass', zh: '草丛伏击' }, terrain: { steel: true, grass: true }, enemies: [{ type: 'grunt', count: 8 }], newElement: 'grass cover (hides tanks)' },
  { index: 4, name: { en: 'Bedrock', zh: '岩层' }, terrain: { steel: true, grass: true, rock: true }, enemies: [{ type: 'grunt', count: 8 }, { type: 'scout', count: 2 }], newElement: 'rock walls (2-hit)' },
  { index: 5, name: { en: 'Aqueduct', zh: '水道' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'grunt', count: 8 }, { type: 'scout', count: 3 }], newElement: 'water lanes (blocks tanks, bullets pass)' },
  { index: 6, name: { en: 'Scouts', zh: '侦察兵' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'scout', count: 8 }, { type: 'grunt', count: 3 }], newElement: 'scout enemies (fast)' },
  { index: 7, name: { en: 'Gunners', zh: '速射炮手' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'gunner', count: 7 }, { type: 'grunt', count: 4 }], newElement: 'gunner enemies (rapid fire)' },
  { index: 8, name: { en: 'Armored', zh: '装甲师' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'tank', count: 7 }, { type: 'grunt', count: 3 }], newElement: 'tank enemies (2 HP)' },
  { index: 9, name: { en: 'Deep Freeze', zh: '深度冻结' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'grunt', count: 8 }, { type: 'tank', count: 3 }], newElement: 'freeze power-up' },
  { index: 10, name: { en: 'Rapid', zh: '连发弹夹' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'gunner', count: 6 }, { type: 'scout', count: 5 }], newElement: 'rapid power-up' },
  { index: 11, name: { en: 'Shield', zh: '能量护盾' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'tank', count: 6 }, { type: 'gunner', count: 5 }], newElement: 'shield power-up' },
  { index: 12, name: { en: 'Last Stand', zh: '最后防线' }, terrain: { steel: true, grass: true, rock: true, water: true }, enemies: [{ type: 'grunt', count: 6 }, { type: 'scout', count: 5 }, { type: 'gunner', count: 5 }, { type: 'tank', count: 4 }], newElement: 'boss wave: all types + all terrain' },
];

export const LEVEL_COUNT = LEVELS.length;

export function totalEnemies(level) {
  return level.enemies.reduce((s, e) => s + e.count, 0);
}
