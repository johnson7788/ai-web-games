// KILN 2048 · 关卡数据（12 关 3 章）
// 字段：index/scene/name/goal/eliminateAt/hammer/preview/kilnInset/features/spawn/newElement。
// goal：mergeTo{target} | eliminate{target,count} | score{target,dropLimit}。
// features：distract（大值干扰球）/ frozen（冰冻球）/ dualGlaze（双色釉）/ narrow（窄窑腔）。
// spawn：base/distract/fire 三档投放权重（火越旺，大值釉球越多）。

export const SPAWN_TABLES = {
  // 窑温越高越容易出大值球；1024 极少见，2048 永不直接投放（必须靠复烧合成）。
  base: [
    [2, 26], [4, 24], [8, 18], [16, 13], [32, 9], [64, 6],
    [128, 2.6], [256, 1.0], [512, 0.34], [1024, 0.06],
  ],
  distract: [
    [2, 20], [4, 20], [8, 16], [16, 14], [32, 12], [64, 9],
    [128, 5], [256, 2.6], [512, 1.1], [1024, 0.3],
  ],
  fire: [
    [2, 14], [4, 16], [8, 16], [16, 16], [32, 15], [64, 12],
    [128, 7], [256, 2.8], [512, 1.0], [1024, 0.2],
  ],
};

export const LEVELS = [
  {
    index: 1, scene: 'morning-workshop',
    name: { en: 'Bisque Glaze', zh: '素坯成釉' },
    goal: { type: 'mergeTo', target: 128 },
    eliminateAt: 2048, hammer: 0, preview: 1, kilnInset: 0,
    features: {}, spawn: 'base',
    newElement: '投放素坯球：同值接触合二为一',
  },
  {
    index: 2, scene: 'morning-workshop',
    name: { en: 'Two-Ball Preview', zh: '双球预览' },
    goal: { type: 'mergeTo', target: 256 },
    eliminateAt: 2048, hammer: 0, preview: 2, kilnInset: 0,
    features: {}, spawn: 'base',
    newElement: '双球预览：提前看下一枚釉球',
  },
  {
    index: 3, scene: 'morning-workshop',
    name: { en: 'Low-Fire Exit', zh: '低温出窑' },
    goal: { type: 'eliminate', target: 256, count: 1 },
    eliminateAt: 256, hammer: 0, preview: 2, kilnInset: 0,
    features: {}, spawn: 'base',
    newElement: '低温出窑：≥256 即可出窑计分',
  },
  {
    index: 4, scene: 'morning-workshop',
    name: { en: 'Hot Distractors', zh: '大值干扰' },
    goal: { type: 'mergeTo', target: 512 },
    eliminateAt: 2048, hammer: 1, preview: 2, kilnInset: 0,
    features: { distract: true }, spawn: 'distract',
    newElement: '大值干扰球：高窑温釉球混入投放',
  },
  {
    index: 5, scene: 'dusk-kiln',
    name: { en: 'Frozen Glaze', zh: '冰冻釉球' },
    goal: { type: 'eliminate', target: 512, count: 2 },
    eliminateAt: 512, hammer: 1, preview: 2, kilnInset: 0,
    features: { frozen: true }, spawn: 'base',
    newElement: '冰冻球：不可合并，两次复烧后解冻',
  },
  {
    index: 6, scene: 'dusk-kiln',
    name: { en: 'Dual Glaze', zh: '双色釉' },
    goal: { type: 'mergeTo', target: 1024 },
    eliminateAt: 2048, hammer: 1, preview: 2, kilnInset: 0,
    features: { dualGlaze: true }, spawn: 'base',
    newElement: '双色釉：隔次才能合（异色相吸）',
  },
  {
    index: 7, scene: 'dusk-kiln',
    name: { en: 'Limited Firing', zh: '限投冲分' },
    goal: { type: 'score', target: 3000, dropLimit: 42 },
    eliminateAt: 2048, hammer: 1, preview: 2, kilnInset: 0,
    features: {}, spawn: 'distract',
    newElement: '限定投放数：42 次投放冲 3000 分',
  },
  {
    index: 8, scene: 'dusk-kiln',
    name: { en: 'Narrow Chamber', zh: '窄窑腔' },
    goal: { type: 'eliminate', target: 1024, count: 2 },
    eliminateAt: 1024, hammer: 1, preview: 2, kilnInset: 70,
    features: { narrow: true, frozen: true }, spawn: 'base',
    newElement: '窄窑腔：窑壁收窄，堆叠更紧张',
  },
  {
    index: 9, scene: 'night-fire',
    name: { en: 'Three-Glaze Flux', zh: '三彩合流' },
    goal: { type: 'mergeTo', target: 2048 },
    eliminateAt: 2048, hammer: 1, preview: 3, kilnInset: 0,
    features: { distract: true, dualGlaze: true }, spawn: 'fire',
    newElement: '三彩合流：大值+双色釉同场',
  },
  {
    index: 10, scene: 'night-fire',
    name: { en: 'Twin Hammers', zh: '双锤出击' },
    goal: { type: 'score', target: 5000, dropLimit: 40 },
    eliminateAt: 2048, hammer: 2, preview: 3, kilnInset: 0,
    features: { frozen: true, distract: true }, spawn: 'fire',
    newElement: '双锤：每局两次砸碎任意球',
  },
  {
    index: 11, scene: 'night-fire',
    name: { en: 'Full Kiln', zh: '全机制合炉' },
    goal: { type: 'eliminate', target: 1024, count: 3 },
    eliminateAt: 1024, hammer: 2, preview: 3, kilnInset: 0,
    features: { frozen: true, dualGlaze: true, distract: true }, spawn: 'fire',
    newElement: '全机制合炉：冰/双色/干扰三轴叠加',
  },
  {
    index: 12, scene: 'night-fire',
    name: { en: 'Night Flame Finale', zh: '夜焰终章' },
    goal: { type: 'mergeTo', target: 2048 },
    eliminateAt: 2048, hammer: 2, preview: 3, kilnInset: 70,
    features: { frozen: true, dualGlaze: true, distract: true, narrow: true }, spawn: 'fire',
    newElement: '夜焰终章：2048 天青出窑',
  },
];

export const LEVEL_COUNT = LEVELS.length;
