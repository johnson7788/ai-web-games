// BLADE GARDEN · 剑意升级表（Lead 拥有）。sim 按 id 应用效果，UI 按 name/desc/icon 显示。
// kind: 'rule'（改规则/新机制）| 'stat'（改数值）。rule 占比必须 ≥35%（见 design.json）。
export const UPGRADES = [
  { id: 'bladePower', kind: 'stat', icon: '🗡', maxLevel: 5, name: { en: 'Blade Power', zh: '剑劲' }, desc: { en: 'Melee damage +25%.', zh: '挥砍伤害 +25%。' } },
  { id: 'bladeSpeed', kind: 'stat', icon: '⚡', maxLevel: 5, name: { en: 'Blade Speed', zh: '剑速' }, desc: { en: 'Strike faster: interval −15%.', zh: '挥砍更快：间隔 −15%。' } },
  { id: 'bladeRange', kind: 'stat', icon: '🌀', maxLevel: 5, name: { en: 'Blade Reach', zh: '剑锋' }, desc: { en: 'Melee range +18.', zh: '挥砍范围 +18。' } },
  { id: 'windStep', kind: 'stat', icon: '🍃', maxLevel: 5, name: { en: 'Wind Step', zh: '疾风步' }, desc: { en: 'Move speed +12%.', zh: '移动速度 +12%。' } },
  { id: 'regrowth', kind: 'stat', icon: '🌿', maxLevel: 5, name: { en: 'Regrowth', zh: '回春' }, desc: { en: 'Regenerate +0.25 HP/s after a quiet moment.', zh: '脱战后每秒回复 +0.25 生命。' } },
  { id: 'bambooShield', kind: 'stat', icon: '🛡', maxLevel: 5, name: { en: 'Bamboo Shield', zh: '竹盾' }, desc: { en: 'Max HP +25, and heal 25 now.', zh: '生命上限 +25，并立刻回复 25。' } },
  { id: 'magnet', kind: 'stat', icon: '🧲', maxLevel: 4, name: { en: 'Qi Magnet', zh: '磁吸' }, desc: { en: 'Pick up Qi motes from farther away.', zh: '从更远处吸收修为光点。' } },
  { id: 'leafDart', kind: 'rule', icon: '🎋', maxLevel: 4, name: { en: 'Bamboo Leaf Dart', zh: '竹叶镖' }, desc: { en: 'Unleash a dart at the nearest beast.', zh: '自动向最近的野物射出竹叶镖。' } },
  { id: 'whirlSlash', kind: 'rule', icon: '💫', maxLevel: 4, name: { en: 'Whirl Slash', zh: '回旋斩' }, desc: { en: 'A spinning slash cuts all beasts around you.', zh: '回旋剑光斩伤身边所有野物。' } },
  { id: 'thunderBamboo', kind: 'rule', icon: '⛈', maxLevel: 4, name: { en: 'Thunder Bamboo', zh: '雷竹' }, desc: { en: 'Lightning strikes three beasts on the field.', zh: '雷霆劈向场上三只野物。' } },
  { id: 'rootTangle', kind: 'rule', icon: '🪢', maxLevel: 3, name: { en: 'Root Tangle', zh: '根须缠绕' }, desc: { en: 'Roots slow beasts that draw near.', zh: '根须缠住靠近的野物，使其减速。' } },
  { id: 'thousandBamboo', kind: 'rule', icon: '🌾', maxLevel: 3, name: { en: 'Thousand Bamboo', zh: '千竹' }, desc: { en: 'Leaf Dart fires two more darts per volley.', zh: '竹叶镖每轮多射两枚。' } },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
