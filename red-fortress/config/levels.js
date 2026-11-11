// 4 关关卡数据。地形由 seed + theme 确定性生成，据点/停机坪/波次是显式数据。
// y=0 在顶部（关底/Boss），玩家从底部出发向上推进。

export const STAGES = [
  {
    id: 'jungle',
    nameKey: 'stage_jungle',
    descKey: 'stage_jungle_desc',
    radioKey: 'radio_jungle',
    theme: 'jungle',
    rows: 76,
    seed: 4107,
    scale: { count: 1, fire: 1, hp: 1 },
    enemyMix: { rifle: 7, mine: 2, turret: 1 },
    camps: [{ row: 62, pows: 3 }, { row: 44, pows: 3 }, { row: 26, pows: 3 }, { row: 10, pows: 3 }],
    helipads: [{ row: 54 }, { row: 36 }, { row: 20 }, { row: 6 }],
    wave: { every: 6, from: 70, to: 8, size: [3, 4] },
    boss: null,
  },
  {
    id: 'river',
    nameKey: 'stage_river',
    descKey: 'stage_river_desc',
    radioKey: 'radio_river',
    theme: 'river',
    rows: 84,
    seed: 5219,
    scale: { count: 1.15, fire: 1.08, hp: 1 },
    enemyMix: { rifle: 6, rocket: 2, tank: 1, turret: 2, mine: 1 },
    camps: [{ row: 70, pows: 3 }, { row: 52, pows: 3 }, { row: 34, pows: 3 }, { row: 18, pows: 3 }],
    helipads: [{ row: 62 }, { row: 44 }, { row: 26 }, { row: 12 }],
    wave: { every: 6, from: 78, to: 10, size: [3, 5] },
    boss: null,
  },
  {
    id: 'desert',
    nameKey: 'stage_desert',
    descKey: 'stage_desert_desc',
    radioKey: 'radio_desert',
    theme: 'desert',
    rows: 92,
    seed: 6331,
    scale: { count: 1.22, fire: 1.08, hp: 1.1 },
    enemyMix: { rifle: 5, rocket: 2, tank: 2, turret: 2, mortar: 2, mine: 1 },
    camps: [{ row: 78, pows: 3 }, { row: 60, pows: 3 }, { row: 42, pows: 3 }, { row: 26, pows: 3 }],
    helipads: [{ row: 70 }, { row: 52 }, { row: 34 }, { row: 20 }],
    wave: { every: 6, from: 86, to: 20, size: [4, 5] },
    boss: { type: 'tankboss', row: 8 },
  },
  {
    id: 'fortress',
    nameKey: 'stage_fortress',
    descKey: 'stage_fortress_desc',
    radioKey: 'radio_fortress',
    theme: 'fortress',
    rows: 100,
    seed: 7457,
    scale: { count: 1.25, fire: 1.12, hp: 1.18 },
    enemyMix: { rifle: 5, rocket: 2, tank: 2, turret: 2, mortar: 2, mine: 1 },
    camps: [{ row: 86, pows: 3 }, { row: 68, pows: 3 }, { row: 50, pows: 3 }, { row: 34, pows: 3 }],
    helipads: [{ row: 78 }, { row: 60 }, { row: 42 }, { row: 30 }],
    wave: { every: 6, from: 92, to: 18, size: [3, 5] },
    boss: { type: 'boss', row: 4 },
  },
];

export const STAGE_COUNT = STAGES.length;

export function stageAt(index) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, index | 0))];
}

// 标题屏/选关展示用
export const STAGE_ORDER = STAGES.map((s) => s.id);
