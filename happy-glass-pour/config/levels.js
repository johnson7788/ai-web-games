// 关卡数据（builder 拥有）。世界坐标 1280×720，y 向下。
// 每个关卡：水源(sources)、玻璃杯(glass)、静态墙体(walls)、动态箱体(boxes)、宝石(gems)、
// 通关提示线(answer，数组里每条是一条霓虹轨道 polyline)、关卡数值。
// answer 是保证可解的轨道（也是提示线/贪心解）。
//
// 原味保留（欢乐水杯 P0）：画线引水 → 放水 → 水滴入杯计数 → 达到 winWaterNum 过关；
// 墨水有限，剩余墨水决定星级。主题换皮为霓虹街机，液体=发光能量液，底部=岩浆失水区。

const seg = (x1, y1, x2, y2, o = {}) => ({ type: 'seg', x1, y1, x2, y2, half: o.half ?? 12, lava: !!o.lava });
const circ = (x, y, r, o = {}) => ({ type: 'circ', x, y, r, lava: !!o.lava });

export const LEVELS = [
  {
    index: 1,
    name: { en: 'First Ramp', zh: '第一道轨道' },
    newElement: 'Neon ramp (draw & pour)',
    ink: 2200,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 12,
    sources: [{ x: 170, y: 120, dir: 'down' }],
    glass: { mx: 980, my: 520, w: 140 },
    walls: [],
    boxes: [],
    gems: [],
    answer: [[[150, 240], [940, 520]]],
  },
  {
    index: 2,
    name: { en: 'Drop Crate', zh: '掉落箱' },
    newElement: 'Drop crate (falls on pour)',
    ink: 2200,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 12,
    sources: [{ x: 200, y: 120, dir: 'down' }],
    glass: { mx: 1000, my: 540, w: 150 },
    walls: [],
    boxes: [{ x: 1120, y: 250, r: 28, heavy: false }],
    gems: [],
    answer: [[[180, 230], [960, 540]]],
  },
  {
    index: 3,
    name: { en: 'Neon Gems', zh: '霓虹宝石' },
    newElement: 'Neon gems (route through)',
    ink: 2200,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 12,
    sources: [{ x: 220, y: 110, dir: 'down' }],
    glass: { mx: 980, my: 540, w: 150 },
    walls: [],
    boxes: [],
    gems: [
      { x: 460, y: 316, r: 18 },
      { x: 740, y: 437, r: 18 },
    ],
    answer: [[[200, 230], [940, 540]]],
  },
  {
    index: 4,
    name: { en: 'Heavy Boulders', zh: '沉重岩石' },
    newElement: 'Heavy boulders (fall & block)',
    ink: 2400,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 13,
    sources: [{ x: 170, y: 120, dir: 'down' }],
    glass: { mx: 980, my: 520, w: 150 },
    walls: [],
    boxes: [
      { x: 1120, y: 250, r: 46, heavy: true },
      { x: 120, y: 330, r: 40, heavy: true },
    ],
    gems: [],
    answer: [[[150, 240], [940, 520]]],
  },
  {
    index: 5,
    name: { en: 'Twin Spouts', zh: '双喷口' },
    newElement: 'Twin spouts (two flows)',
    ink: 2600,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 13,
    sources: [
      { x: 280, y: 110, dir: 'down' },
      { x: 920, y: 110, dir: 'down' },
    ],
    glass: { mx: 600, my: 560, w: 160 },
    walls: [],
    boxes: [],
    gems: [],
    answer: [
      [[260, 200], [560, 560]],
      [[940, 200], [640, 560]],
    ],
  },
  {
    index: 6,
    name: { en: 'Lava Walls', zh: '岩浆墙' },
    newElement: 'Lava walls (overshoot spills)',
    ink: 2400,
    totalDrops: 36,
    winWaterNum: 24,
    dropInterval: 0.05,
    timeLimit: 13,
    sources: [{ x: 120, y: 110, dir: 'down' }],
    glass: { mx: 980, my: 540, w: 160 },
    walls: [
      seg(1160, 80, 1160, 694, { lava: true }),
    ],
    boxes: [],
    gems: [],
    answer: [[[110, 230], [940, 540]]],
  },
];

export const LEVEL_COUNT = LEVELS.length;
