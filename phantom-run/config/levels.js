// PHANTOM RUN · 关卡数据（M1 拥有）
// 字段：index/scene/name/speed/newElement/platforms/walls/spikes/moons/stars/finishX/chase/difficulty。
// 坐标约定：x=世界横坐标，y=平台/物件顶边（y 向下）。主地面顶边 y=600，掉坑线 y=720。
// platform.kind：ground(实体) | rune(符文砖，踩踏虚化) | collapse(塌陷檐) | moving(竖直吊篮)。
// rune.link：联动另一块符文砖的 name（双符文互锁，一虚一实）。
// 所有关卡必须能被「跳跃间隙 + 跳跃尖刺 + 拾月光斑穿墙」的最短路径通过（见 tests/levels.test.mjs）。

const G = (x, w) => ({ x, y: 600, w, h: 120, kind: 'ground' });
const RUNE = (x, y, w, extra = {}) => ({ x, y, w, h: 14, kind: 'rune', state: 'solid', ...extra });
const COL = (x, y, w) => ({ x, y, w, h: 16, kind: 'collapse', state: 'solid' });
const MOV = (x, y, w, extra = {}) => ({ x, y, w, h: 16, kind: 'moving', amp: 120, omega: 1.7, phase: 0, ...extra });
const WALL = (x, y, w, h) => ({ x, y, w, h });
const SPIKE = (x, w = 40) => ({ x, y: 588, w, h: 12 });
const MOON = (x, y, r = 20) => ({ x, y, r });
const STAR = (x, y, r = 12) => ({ x, y, r });

// 由「地面连续段」生成实体平台（段与段之间自动留间隙）
function groundRuns(runs) {
  return runs.map(([a, b]) => G(a, b - a));
}

function makeLevel(cfg) {
  const platforms = [];
  for (const [a, b] of cfg.runs) platforms.push(G(a, b - a));
  for (const p of (cfg.extra || [])) {
    if (p.kind === 'rune') platforms.push({ h: 14, state: 'solid', ...p });
    else if (p.kind === 'collapse') platforms.push({ h: 16, state: 'solid', ...p });
    else if (p.kind === 'moving') platforms.push({ h: 16, amp: 120, omega: 1.7, phase: 0, ...p });
    else platforms.push({ h: 16, ...p });
  }
  return {
    index: cfg.index,
    scene: cfg.scene,
    name: cfg.name,
    speed: cfg.speed || 320,
    newElement: cfg.newElement,
    platforms,
    walls: (cfg.walls || []).map((w) => ({ ...w })),
    spikes: (cfg.spikes || []).map((s) => (Array.isArray(s) ? { x: s[0], w: s[1] || 40, y: 588, h: 12 } : { y: 588, h: 12, ...s })),
    moons: (cfg.moons || []).map((m) => (Array.isArray(m) ? { x: m[0], y: m[1], r: m[2] || 20 } : { r: 20, ...m })),
    stars: (cfg.stars || []).map((st) => (Array.isArray(st) ? { x: st[0], y: st[1], r: st[2] || 12 } : { r: 12, ...st })),
    finishX: cfg.finishX,
    chase: cfg.chase || null,
    difficulty: cfg.difficulty,
  };
}

export const LEVELS = [
  // —— 第一章 暮色魔塔（dusk-tower）——
  makeLevel({
    index: 1, scene: 'dusk-tower', speed: 320,
    name: { en: 'The First Rooftop', zh: '第一片瓦檐' },
    newElement: '常规跳（跨越间隙）',
    runs: [[0, 700], [850, 1500], [1660, 2400], [2570, 3400], [3550, 4300]],
    stars: [[1100, 572], [2000, 572], [3000, 572]],
    finishX: 4150, difficulty: 1,
  }),
  makeLevel({
    index: 2, scene: 'dusk-tower', speed: 320,
    name: { en: 'Rune Tiles', zh: '符文砖' },
    newElement: '符文砖（踩踏虚化）+ 尖刺',
    runs: [[0, 760], [940, 1840], [2020, 2940], [3120, 4060]],
    spikes: [[1150], [2650], [3550]],
    extra: [
      RUNE(1500, 500, 90, { name: 'r1' }),
      RUNE(3200, 500, 90, { name: 'r2' }),
    ],
    stars: [[700, 572], [2300, 572], [3400, 572]],
    finishX: 3910, difficulty: 1.5,
  }),
  makeLevel({
    index: 3, scene: 'dusk-tower', speed: 320,
    name: { en: 'Interlocked Runes', zh: '双符文互锁' },
    newElement: '双符文互锁（联动切换）',
    runs: [[0, 780], [960, 1880], [2060, 3000], [3180, 4100]],
    spikes: [[1300], [2400]],
    extra: [
      RUNE(1500, 500, 90, { name: 'a', link: 'b' }),
      RUNE(1650, 500, 90, { name: 'b', link: 'a', state: 'phantom' }),
    ],
    stars: [[700, 572], [2000, 572], [3300, 572]],
    finishX: 3960, difficulty: 2.2,
  }),
  makeLevel({
    index: 4, scene: 'dusk-tower', speed: 320,
    name: { en: 'Moonlight Gate', zh: '月光之门' },
    newElement: '月光斑现身 + 符文墙',
    runs: [[0, 900], [1080, 2000], [2180, 3100], [3280, 4200]],
    walls: [WALL(1500, 470, 30, 130), WALL(2700, 470, 30, 130)],
    moons: [MOON(1360, 570), MOON(2560, 570)],
    spikes: [[1650]],
    stars: [[600, 572], [2000, 572], [3600, 572]],
    finishX: 4050, difficulty: 2.8,
  }),

  // —— 第二章 月夜街市（moon-market）——
  makeLevel({
    index: 5, scene: 'moon-market', speed: 330,
    name: { en: 'High & Low Eaves', zh: '高低瓦层' },
    newElement: '高低瓦层选择',
    runs: [[0, 820], [1000, 1920], [2100, 3020], [3200, 4100]],
    extra: [
      { x: 1600, y: 480, w: 200, kind: 'ground' },   // 上层（可选，安稳但较长）
    ],
    spikes: [[2600], [3700]],
    stars: [[700, 572], [2000, 572], [3400, 572]],
    finishX: 3960, difficulty: 3.2,
  }),
  makeLevel({
    index: 6, scene: 'moon-market', speed: 335,
    name: { en: 'Ghost-Fire Pursuit', zh: '鬼火追兵' },
    newElement: '幽灵火追兵段',
    runs: [[0, 900], [1080, 2000], [2180, 3100], [3280, 4200]],
    walls: [WALL(1600, 470, 30, 130), WALL(3000, 470, 30, 130)],
    moons: [MOON(1460, 570), MOON(2860, 570)],
    spikes: [[2400], [3800]],
    stars: [[700, 572], [2200, 572], [3600, 572]],
    chase: { speed: 335 },
    finishX: 4050, difficulty: 3.5,
  }),
  makeLevel({
    index: 7, scene: 'moon-market', speed: 330,
    name: { en: 'The Moving Basket', zh: '移动吊篮' },
    newElement: '移动吊篮（竖直升降）',
    runs: [[0, 800], [980, 1900], [2080, 3000], [3180, 4100]],
    extra: [
      MOV(1500, 500, 110, { name: 'basket' }),       // 可选上层
    ],
    spikes: [[1200], [2600], [3600]],
    stars: [[700, 572], [2200, 572], [3400, 572]],
    finishX: 3960, difficulty: 4.2,
  }),
  makeLevel({
    index: 8, scene: 'moon-market', speed: 335,
    name: { en: 'Falling Eaves', zh: '塌陷檐' },
    newElement: '塌陷檐（踩后 0.8s 落）',
    runs: [[0, 820], [1000, 1920], [2100, 3020], [3200, 4100]],
    spikes: [[1300], [2500], [3700]],
    extra: [
      COL(1600, 500, 110),                            // 可选：塌陷檐
    ],
    stars: [[700, 572], [2000, 572], [3500, 572]],
    finishX: 3960, difficulty: 4.6,
  }),

  // —— 第三章 破晓城墙（dawn-wall）——
  makeLevel({
    index: 9, scene: 'dawn-wall', speed: 352,
    name: { en: 'Spike Corridor', zh: '尖刺长廊' },
    newElement: '密集尖刺 + 月光斑组合',
    runs: [[0, 760], [940, 1840], [2020, 2940], [3120, 4040]],
    spikes: [[1100], [1500], [2400], [2700], [3600]],
    walls: [WALL(3300, 470, 30, 130)],
    moons: [MOON(3160, 570)],
    stars: [[700, 572], [2000, 572], [3800, 572]],
    finishX: 3900, difficulty: 5,
  }),
  makeLevel({
    index: 10, scene: 'dawn-wall', speed: 352,
    name: { en: 'Runes Under Fire', zh: '火中符文' },
    newElement: '双符文 + 追兵叠加',
    runs: [[0, 800], [980, 1900], [2080, 3000], [3180, 4100]],
    walls: [WALL(1600, 470, 30, 130), WALL(3400, 470, 30, 130)],
    moons: [MOON(1460, 570), MOON(3260, 570)],
    spikes: [[1200], [2200], [2550]],
    extra: [
      RUNE(2000, 500, 90, { name: 'c', link: 'd' }),
      RUNE(2150, 500, 90, { name: 'd', link: 'c', state: 'phantom' }),
    ],
    stars: [[700, 572], [2200, 572], [3700, 572]],
    chase: { speed: 352 },
    finishX: 3960, difficulty: 5.4,
  }),
  makeLevel({
    index: 11, scene: 'dawn-wall', speed: 360,
    name: { en: 'The Long Breakout', zh: '长路逃亡' },
    newElement: '长距离多间隙逃亡',
    runs: [[0, 700], [880, 1580], [1760, 2460], [2640, 3340], [3520, 4220], [4400, 5100]],
    spikes: [[1150], [2000], [2900], [3800], [4600]],
    stars: [[800, 572], [2200, 572], [4000, 572]],
    finishX: 4960, difficulty: 6,
  }),
  makeLevel({
    index: 12, scene: 'dawn-wall', speed: 360,
    name: { en: 'The Final Escape', zh: '终局大逃亡' },
    newElement: '终局全机制叠加（符文+墙+尖刺+追兵）',
    runs: [[0, 760], [940, 1840], [2020, 2940], [3120, 4040], [4220, 5140]],
    walls: [WALL(1500, 470, 30, 130), WALL(3300, 470, 30, 130), WALL(4600, 470, 30, 130)],
    moons: [MOON(1360, 570), MOON(3160, 570), MOON(4460, 570)],
    spikes: [[1100], [1900], [2500], [2900], [3800], [4900]],
    extra: [
      RUNE(2200, 500, 90, { name: 'e', link: 'f' }),
      RUNE(2350, 500, 90, { name: 'f', link: 'e' }),
    ],
    stars: [[800, 572], [2400, 572], [4200, 572]],
    chase: { speed: 360 },
    finishX: 5000, difficulty: 6.5,
  }),
];

export const LEVEL_COUNT = LEVELS.length;
