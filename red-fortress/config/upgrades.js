// 关间三选一改装。effects 由 sim 累加进 run.mods，不做硬编码逻辑。
// max = 可叠加次数（最多 2 级）
export const UPGRADES = [
  {
    id: 'pierce',
    icon: 'pierce',
    nameKey: 'up_pierce',
    descKey: 'up_pierce_desc',
    max: 2,
    effects: { pierce: 1 },
  },
  {
    id: 'spread',
    icon: 'spread',
    nameKey: 'up_spread',
    descKey: 'up_spread_desc',
    max: 2,
    effects: { extraBullets: 2 },
  },
  {
    id: 'demo',
    icon: 'demo',
    nameKey: 'up_demo',
    descKey: 'up_demo_desc',
    max: 2,
    effects: { grenadeRadius: 0.35, grenadeDmg: 2 },
  },
  {
    id: 'turbo',
    icon: 'turbo',
    nameKey: 'up_turbo',
    descKey: 'up_turbo_desc',
    max: 2,
    effects: { speedMul: 0.15 },
  },
  {
    id: 'armor',
    icon: 'armor',
    nameKey: 'up_armor',
    descKey: 'up_armor_desc',
    max: 2,
    effects: { maxHp: 2, heal: 2 },
  },
  {
    id: 'reload',
    icon: 'reload',
    nameKey: 'up_reload',
    descKey: 'up_reload_desc',
    max: 2,
    effects: { mgCdMul: -0.15, grenadeCdMul: -0.2 },
  },
  {
    id: 'repair',
    icon: 'repair',
    nameKey: 'up_repair',
    descKey: 'up_repair_desc',
    max: 2,
    effects: { maxGrenades: 1, fullHealOnStage: 1 },
  },
  {
    id: 'magnet',
    icon: 'magnet',
    nameKey: 'up_magnet',
    descKey: 'up_magnet_desc',
    max: 2,
    effects: { pickupMul: 0.8, autoCollect: 1 },
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
