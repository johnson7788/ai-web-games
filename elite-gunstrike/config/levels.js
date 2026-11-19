// ELITE GUNSTRIKE · 关卡 / 场景定义
// 12 关 → 3 个场景包（霓虹铸造厂 1-4 / 深红反应堆 5-8 / 紫罗兰堡垒 9-12）
// 敌型轮换：侦察机 → 炮塔机 → 重装机甲；能量核心链爆贯穿全篇；俘虏必须保护。

export const SCENES = [
  {
    index: 1,
    id: 'foundry',
    nameKey: 'scene.foundry',
    rounds: [1, 4],
    // 霓虹铸造厂：青蓝 + 品红
    palette: { bgTop: '#0a1226', bgBottom: '#060a18', neon: '#45f3ff', neon2: '#ff3ec8', grid: 'rgba(69,243,255,0.10)' },
  },
  {
    index: 2,
    id: 'reactor',
    nameKey: 'scene.reactor',
    rounds: [5, 8],
    // 深红反应堆：朱红 + 琥珀
    palette: { bgTop: '#1a0a10', bgBottom: '#0c050a', neon: '#ff5a3c', neon2: '#ffb454', grid: 'rgba(255,90,60,0.10)' },
  },
  {
    index: 3,
    id: 'citadel',
    nameKey: 'scene.citadel',
    rounds: [9, 12],
    // 紫罗兰堡垒：紫 + 金
    palette: { bgTop: '#120a22', bgBottom: '#080514', neon: '#b26bff', neon2: '#ffd24a', grid: 'rgba(178,107,255,0.10)' },
  },
];

// 关卡布局。坐标单位 px，炮塔在 (640,648)，活动区 x∈[60,1220] y∈[70,560]。
// enemies: {type, x, y}；obstacles: {type, x, y, w, h}；captives: {x, y}
// par3/par2/par1 = 三星/两星/一星的 shotsUsed 门槛。
const LEVEL_DEFS = [
  { // 1 教学：两个侦察机
    scene: 'foundry', ammo: 4, par3: 2, par2: 3, par1: 4, meltdown: 24,
    enemies: [{ type: 'scout', x: 430, y: 220 }, { type: 'scout', x: 850, y: 300 }],
    obstacles: [], captives: [],
  },
  { // 2 引入玻璃掩体
    scene: 'foundry', ammo: 5, par3: 3, par2: 4, par1: 5, meltdown: 24,
    enemies: [{ type: 'scout', x: 350, y: 180 }, { type: 'scout', x: 640, y: 140 }, { type: 'scout', x: 930, y: 260 }],
    obstacles: [{ type: 'glass', x: 640, y: 320, w: 96, h: 14 }], captives: [],
  },
  { // 3 引入炮塔机（会还击）
    scene: 'foundry', ammo: 5, par3: 3, par2: 4, par1: 5, meltdown: 26,
    enemies: [{ type: 'scout', x: 420, y: 200 }, { type: 'scout', x: 860, y: 180 }, { type: 'turret', x: 640, y: 300 }],
    obstacles: [], captives: [],
  },
  { // 4 引入俘虏（不能打中）
    scene: 'foundry', ammo: 5, par3: 3, par2: 4, par1: 5, meltdown: 26,
    enemies: [{ type: 'scout', x: 360, y: 220 }, { type: 'scout', x: 920, y: 240 }, { type: 'turret', x: 640, y: 160 }],
    obstacles: [], captives: [{ x: 300, y: 430 }],
  },
  { // 5 换章 + 能量核心链爆
    scene: 'reactor', ammo: 6, par3: 3, par2: 4, par1: 5, meltdown: 28,
    enemies: [{ type: 'turret', x: 400, y: 180 }, { type: 'turret', x: 880, y: 180 }, { type: 'turret', x: 640, y: 320 }],
    obstacles: [{ type: 'core', x: 640, y: 110, w: 34, h: 34 }], captives: [],
  },
  { // 6 重装机甲 + 掩体箱
    scene: 'reactor', ammo: 6, par3: 4, par2: 5, par1: 6, meltdown: 28,
    enemies: [{ type: 'scout', x: 380, y: 220 }, { type: 'scout', x: 900, y: 220 }, { type: 'heavy', x: 640, y: 160 }],
    obstacles: [{ type: 'box', x: 500, y: 360, w: 90, h: 90 }, { type: 'box', x: 780, y: 360, w: 90, h: 90 }], captives: [],
  },
  { // 7 双核心链爆 + 重甲
    scene: 'reactor', ammo: 7, par3: 4, par2: 5, par1: 6, meltdown: 30,
    enemies: [{ type: 'heavy', x: 640, y: 140 }, { type: 'turret', x: 400, y: 300 }, { type: 'turret', x: 880, y: 300 }],
    obstacles: [{ type: 'core', x: 400, y: 120, w: 34, h: 34 }, { type: 'core', x: 880, y: 120, w: 34, h: 34 }], captives: [],
  },
  { // 8 双重重甲 + 俘虏 + 砖墙
    scene: 'reactor', ammo: 8, par3: 5, par2: 6, par1: 7, meltdown: 30,
    enemies: [{ type: 'heavy', x: 420, y: 180 }, { type: 'heavy', x: 860, y: 180 }, { type: 'turret', x: 640, y: 320 }],
    obstacles: [{ type: 'brick', x: 300, y: 300, w: 80, h: 80 }, { type: 'brick', x: 980, y: 300, w: 80, h: 80 }], captives: [{ x: 980, y: 430 }],
  },
  { // 9 换章 + 密集火力
    scene: 'citadel', ammo: 8, par3: 5, par2: 6, par1: 7, meltdown: 32,
    enemies: [{ type: 'turret', x: 360, y: 200 }, { type: 'turret', x: 920, y: 200 }, { type: 'heavy', x: 640, y: 140 }, { type: 'turret', x: 640, y: 340 }],
    obstacles: [{ type: 'glass', x: 200, y: 300, w: 90, h: 14 }], captives: [],
  },
  { // 10 双核心 + 俘虏 + 重甲
    scene: 'citadel', ammo: 9, par3: 6, par2: 7, par1: 8, meltdown: 32,
    enemies: [{ type: 'heavy', x: 400, y: 160 }, { type: 'heavy', x: 880, y: 160 }, { type: 'turret', x: 500, y: 340 }, { type: 'turret', x: 780, y: 340 }],
    obstacles: [{ type: 'core', x: 400, y: 300, w: 34, h: 34 }, { type: 'core', x: 880, y: 300, w: 34, h: 34 }], captives: [{ x: 640, y: 300 }],
  },
  { // 11 三重重甲
    scene: 'citadel', ammo: 10, par3: 6, par2: 7, par1: 8, meltdown: 34,
    enemies: [{ type: 'heavy', x: 360, y: 180 }, { type: 'heavy', x: 640, y: 120 }, { type: 'heavy', x: 920, y: 180 }, { type: 'turret', x: 480, y: 340 }, { type: 'turret', x: 800, y: 340 }],
    obstacles: [{ type: 'box', x: 640, y: 360, w: 90, h: 90 }], captives: [],
  },
  { // 12 Boss：全机制收束
    scene: 'citadel', ammo: 12, par3: 7, par2: 8, par1: 9, meltdown: 40,
    enemies: [{ type: 'heavy', x: 320, y: 200 }, { type: 'heavy', x: 960, y: 200 }, { type: 'heavy', x: 640, y: 140 }, { type: 'heavy', x: 640, y: 380 }, { type: 'turret', x: 480, y: 260 }, { type: 'turret', x: 800, y: 260 }],
    obstacles: [{ type: 'core', x: 200, y: 140, w: 34, h: 34 }, { type: 'core', x: 1080, y: 140, w: 34, h: 34 }], captives: [{ x: 200, y: 340 }],
  },
];

export const LEVELS = LEVEL_DEFS.map((d, i) => ({ index: i + 1, ...d }));
export const LEVEL_COUNT = LEVELS.length;

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

export function sceneForLevel(level) {
  return sceneById(LEVELS[Math.min(LEVEL_COUNT, Math.max(1, level)) - 1].scene);
}
