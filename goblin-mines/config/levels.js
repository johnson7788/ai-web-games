// config/levels.js — 12 条矿道里程碑（每条解锁新矿石或新特性）。
// chapter：0 萤石洞（紫）/ 1 铜镇（橙）/ 2 深渊竖井（蓝黑）——换章必换色板+构图+装饰。
export const LEVELS = [
  { index: 1, chapter: 0, digs: 2, ores: ['ruby', 'sapphire', 'fuel', 'gold'], rocks: 3, feature: 'none',
    newElement: 'ruby + sapphire + fuel + gold — learn to swap adjacent ore' },
  { index: 2, chapter: 0, digs: 2, ores: ['ruby', 'sapphire', 'amethyst', 'fuel', 'gold'], rocks: 4, feature: 'none',
    newElement: 'amethyst vein unlocks (richer, rarer)' },
  { index: 3, chapter: 0, digs: 2, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 5, feature: 'none',
    newElement: 'emerald vein + multi-HP rock walls' },
  { index: 4, chapter: 0, digs: 2, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 5, feature: 'boss',
    newElement: 'first mine beast boss (3×3 rock block)' },
  { index: 5, chapter: 1, digs: 2, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 6, feature: 'frozen',
    newElement: 'frozen veins + copper-town lanterns' },
  { index: 6, chapter: 1, digs: 2, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 6, feature: 'hotspring',
    newElement: 'hot spring — a cell that doubles nearby yield' },
  { index: 7, chapter: 1, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 7, feature: 'rich',
    newElement: 'rich vein — random column yields 3×' },
  { index: 8, chapter: 1, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 7, feature: 'boss',
    newElement: 'poor veins + second mine beast' },
  { index: 9, chapter: 2, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 8, feature: 'dark',
    newElement: 'abyss shaft — collapses come faster' },
  { index: 10, chapter: 2, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 8, feature: 'water',
    newElement: 'groundwater — thicker rock walls' },
  { index: 11, chapter: 2, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 9, feature: 'rich',
    newElement: 'deep rich vein — high risk, high yield' },
  { index: 12, chapter: 2, digs: 3, ores: ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel', 'gold'], rocks: 9, feature: 'boss',
    newElement: 'the Abyss King — final mine beast' },
];

export function levelOf(shaft) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, shaft - 1))];
}

// 岩壁血量：基础 1，'water' 特性 +1
export function rockHpFor(level) {
  return level.feature === 'water' ? 2 : 1;
}

// 塌方间隔：'dark' 特性加快 1/3
export function collapseIntervalFor(level) {
  return level.feature === 'dark' ? 12 : 18;
}
