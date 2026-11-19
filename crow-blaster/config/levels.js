// CROW BLASTER · 5 关定义。
// 每关：需击杀乌鸦数 + 时限 + 弹药 + 生成节奏 + 速度倍率 + 乌鸦组合（spawns 加权列表）。
// spawns 为加权列表（[kind, weight]），weight 越大越常出现。
export const LEVELS = [
  {
    index: 1, nameKey: 'level.1', time: 45, ammo: 14, crowCount: 4,
    spawnInterval: 1.1, speedMul: 1.0,
    spawns: [['scout', 10]],
    newElement: 'scout crows glide across the neon sky',
  },
  {
    index: 2, nameKey: 'level.2', time: 45, ammo: 18, crowCount: 5,
    spawnInterval: 1.0, speedMul: 1.1,
    spawns: [['scout', 7], ['tank', 3]],
    newElement: 'armored tank crows take three hits',
  },
  {
    index: 3, nameKey: 'level.3', time: 50, ammo: 22, crowCount: 6,
    spawnInterval: 0.95, speedMul: 1.2,
    spawns: [['scout', 6], ['tank', 4], ['golden', 2]],
    newElement: 'golden crows grant bonus ammo',
  },
  {
    index: 4, nameKey: 'level.4', time: 50, ammo: 24, crowCount: 7,
    spawnInterval: 0.9, speedMul: 1.3, ghostChance: 0.16,
    spawns: [['scout', 5], ['tank', 4], ['golden', 3]],
    newElement: 'ghost crows punish careless shots',
  },
  {
    index: 5, nameKey: 'level.5', time: 55, ammo: 28, crowCount: 8,
    spawnInterval: 0.85, speedMul: 1.5, ghostChance: 0.22,
    spawns: [['scout', 5], ['tank', 4], ['golden', 3]],
    newElement: 'overclocked gauntlet of every crow',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[Math.min(LEVEL_COUNT - 1, Math.max(0, index - 1))];
}
