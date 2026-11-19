// BARBARIAN BASH · 关卡数据
// 坐标：cx/cy 为中心点；地面 GROUND_Y=620；物体底部落在 620（cy = 620 - h/2）。
// enemies[].core: 弱点核心（相对中心的偏移 dx/dy + 半径 r）；命中核心 = 暴击秒杀。
// barriers[].type: 'crate' 木箱 | 'tnt' 炸药桶(有 blastR) | 'glass' 玻璃。
// captive: 人质，误伤即败。stars: 弹药剩余 ≥ ammo - tripleStar → 3 星，余类推。
export const LEVELS = [
  {
    index: 1,
    name: { en: 'Neon Rookie', zh: '霓虹新手' },
    scene: 'neon-arena',
    ammo: 5, tripleStar: 1, doubleStar: 2, singleStar: 3,
    timeLimit: 60,
    enemies: [
      { cx: 880, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [],
    captive: null,
    newElement: '拖拽瞄准投掷岩石',
  },
  {
    index: 2,
    name: { en: 'Double Trouble', zh: '双敌连击' },
    scene: 'neon-arena',
    ammo: 5, tripleStar: 1, doubleStar: 2, singleStar: 3,
    timeLimit: 60,
    enemies: [
      { cx: 740, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
      { cx: 1010, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [],
    captive: null,
    newElement: '连击与弱点暴击',
  },
  {
    index: 3,
    name: { en: 'Crate Crush', zh: '破箱重击' },
    scene: 'neon-arena',
    ammo: 6, tripleStar: 2, doubleStar: 3, singleStar: 4,
    timeLimit: 60,
    enemies: [
      { cx: 940, w: 64, h: 84, hp: 2, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [
      { type: 'crate', cx: 660, w: 52, h: 52 },
      { type: 'crate', cx: 812, w: 52, h: 52 },
    ],
    captive: null,
    newElement: '可破坏木箱 + 装甲敌人(2HP)',
  },
  {
    index: 4,
    name: { en: 'Chain Reaction', zh: '连锁爆破' },
    scene: 'neon-arena',
    ammo: 6, tripleStar: 2, doubleStar: 3, singleStar: 4,
    timeLimit: 60,
    enemies: [
      { cx: 720, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
      { cx: 980, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [
      { type: 'tnt', cx: 600, w: 44, h: 64, blastR: 200 },
      { type: 'tnt', cx: 860, w: 44, h: 64, blastR: 200 },
    ],
    captive: null,
    newElement: 'TNT 炸药桶连锁爆破',
  },
  {
    index: 5,
    name: { en: 'Hostage Crisis', zh: '人质危机' },
    scene: 'neon-arena',
    ammo: 6, tripleStar: 2, doubleStar: 3, singleStar: 4,
    timeLimit: 60,
    enemies: [
      { cx: 700, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
      { cx: 1000, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [
      { type: 'glass', cx: 850, w: 56, h: 70 },
    ],
    captive: { cx: 620, w: 40, h: 72 },
    newElement: '人质保护（误伤即败）',
  },
  {
    index: 6,
    name: { en: 'Iron Warlord', zh: '钢铁军阀' },
    scene: 'neon-arena',
    ammo: 8, tripleStar: 3, doubleStar: 4, singleStar: 5,
    timeLimit: 75,
    enemies: [
      { cx: 900, w: 116, h: 132, hp: 3, boss: true, core: { dx: 0, dy: -8, r: 30 } },
      { cx: 640, w: 64, h: 84, hp: 1, core: { dx: 0, dy: -6, r: 22 } },
    ],
    barriers: [
      { type: 'tnt', cx: 780, w: 44, h: 64, blastR: 210 },
    ],
    captive: null,
    newElement: '装甲 BOSS（需弱点暴击）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
