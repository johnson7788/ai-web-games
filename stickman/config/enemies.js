// 敌人表 —— 行为参数由 src/game/ai.js 读取
// behavior: chase(扑) / kite(风筝) / snipe(狙击) / tank(推土) / eraser(擦除) / boss
export const ENEMIES = {
  scribble: {
    id: 'scribble', nameKey: 'enemy.scribble',
    hp: 26, speed: 220, accel: 1500, r: 24,
    contactDmg: 8, contactCd: 0.85,
    inkDrop: 3, score: 10, tier: 1,
    behavior: 'chase',
    wobble: 1.6,          // 追击时的左右摆动幅度（弧度）
    spawnAir: true,
  },
  nib: {
    id: 'nib', nameKey: 'enemy.nib',
    hp: 46, speed: 115, accel: 900, r: 26,
    contactDmg: 6, contactCd: 1.0,
    keep: [300, 430],     // 保持距离区间
    fireCd: 1.55, telegraph: 0.38, shot: 'nib',
    inkDrop: 4, score: 20, tier: 1,
    behavior: 'kite',
  },
  compass: {
    id: 'compass', nameKey: 'enemy.compass',
    hp: 64, speed: 78, accel: 620, r: 30,
    contactDmg: 8, contactCd: 1.0,
    keep: [470, 650],
    fireCd: 2.9, charge: 1.05, beamTime: 0.2, shot: 'compass',
    inkDrop: 5, score: 30, tier: 2,
    behavior: 'snipe',
  },
  smudge: {
    id: 'smudge', nameKey: 'enemy.smudge',
    hp: 160, speed: 82, accel: 700, r: 40,
    contactDmg: 13, contactCd: 0.7,
    inkDrop: 8, score: 40, tier: 2,
    behavior: 'tank',
    split: { type: 'scribble', count: 2, hp: 16 },
    knockResist: 0.4,
  },
  eraser: {
    id: 'eraser', nameKey: 'enemy.eraser',
    hp: 48, speed: 155, accel: 800, r: 28,
    contactDmg: 10, contactCd: 0.6,
    inkDrop: 7, score: 45, tier: 2,
    behavior: 'eraser',
    wipeCd: 4.2, wipeTime: 0.55, wipeDrain: 5, bulletProof: 0.35, // 子弹伤害只有 35%
    floating: true,
  },
  blank: {
    id: 'blank', nameKey: 'enemy.blank',
    hp: 2000, r: 130,
    contactDmg: 26, contactCd: 0.9,
    inkDrop: 80, score: 500, tier: 4,
    behavior: 'boss',
    phases: [
      { at: 1.0, nameKey: 'boss.phase1' },
      { at: 0.66, nameKey: 'boss.phase2' },
      { at: 0.33, nameKey: 'boss.phase3' },
    ],
    knockResist: 0.95,
  },
};

// 每幕的数值倍率（按幕序号 1..5）
export const ACT_SCALE = [
  { hp: 1.00, dmg: 0.85, speed: 1.00 },   // 第一幕教学：伤害略低
  { hp: 1.15, dmg: 1.10, speed: 1.04 },
  { hp: 1.34, dmg: 1.20, speed: 1.08 },
  { hp: 1.55, dmg: 1.32, speed: 1.12 },
  { hp: 1.00, dmg: 1.35, speed: 1.00 },
];

export default ENEMIES;
