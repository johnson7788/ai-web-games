// 9 关布局（世界坐标 1280×720，发射台 (640,640)）。
// block 类型：
//   brick  —— 普通可破坏方块（霓虹粉紫）
//   rubber —— 橡皮细条（霓虹绿），破坏后掉落加分光球
//   bumper —— 圆形挡板（霓虹橙），不可破坏，把球弹开
// 每关逐个引入新元素（新机制见 config/design.json levels）。
export const LEVELS = [
  {
    index: 1,
    name: 'levelName1',
    blocks: [
      { type: 'brick', x: 400, y: 300, w: 120, h: 70 },
      { type: 'brick', x: 880, y: 300, w: 120, h: 70 },
      { type: 'bumper', x: 640, y: 150, r: 40 },
    ],
  },
  {
    index: 2,
    name: 'levelName2',
    blocks: [
      { type: 'brick', x: 420, y: 360, w: 110, h: 64 },
      { type: 'brick', x: 860, y: 360, w: 110, h: 64 },
      { type: 'brick', x: 640, y: 200, w: 110, h: 64 },
      { type: 'bumper', x: 640, y: 470, r: 38 },
    ],
  },
  {
    index: 3,
    name: 'levelName3',
    blocks: [
      { type: 'rubber', x: 500, y: 300, w: 24, h: 170 },
      { type: 'rubber', x: 780, y: 300, w: 24, h: 170 },
      { type: 'brick', x: 640, y: 130, w: 120, h: 60 },
      { type: 'bumper', x: 640, y: 520, r: 36 },
    ],
  },
  {
    index: 4,
    name: 'levelName4',
    blocks: [
      { type: 'brick', x: 320, y: 220, w: 110, h: 60 },
      { type: 'brick', x: 640, y: 220, w: 110, h: 60 },
      { type: 'brick', x: 960, y: 220, w: 110, h: 60 },
      { type: 'brick', x: 480, y: 420, w: 110, h: 60 },
      { type: 'brick', x: 800, y: 420, w: 110, h: 60 },
      { type: 'bumper', x: 640, y: 120, r: 36 },
    ],
  },
  {
    index: 5,
    name: 'levelName5',
    blocks: [
      { type: 'brick', x: 300, y: 300, w: 100, h: 60 },
      { type: 'brick', x: 980, y: 300, w: 100, h: 60 },
      { type: 'brick', x: 640, y: 430, w: 100, h: 60 },
      { type: 'bumper', x: 500, y: 160, r: 42 },
      { type: 'bumper', x: 780, y: 160, r: 42 },
    ],
  },
  {
    index: 6,
    name: 'levelName6',
    blocks: [
      { type: 'brick', x: 400, y: 200, w: 100, h: 56 },
      { type: 'brick', x: 640, y: 200, w: 100, h: 56 },
      { type: 'brick', x: 880, y: 200, w: 100, h: 56 },
      { type: 'brick', x: 400, y: 360, w: 100, h: 56 },
      { type: 'brick', x: 880, y: 360, w: 100, h: 56 },
      { type: 'bumper', x: 640, y: 430, r: 36 },
      { type: 'bumper', x: 220, y: 200, r: 30 },
    ],
  },
  {
    index: 7,
    name: 'levelName7',
    blocks: [
      { type: 'brick', x: 320, y: 180, w: 90, h: 54 },
      { type: 'brick', x: 640, y: 180, w: 90, h: 54 },
      { type: 'brick', x: 960, y: 180, w: 90, h: 54 },
      { type: 'brick', x: 480, y: 340, w: 90, h: 54 },
      { type: 'brick', x: 800, y: 340, w: 90, h: 54 },
      { type: 'rubber', x: 640, y: 300, w: 22, h: 150 },
      { type: 'bumper', x: 320, y: 470, r: 34 },
      { type: 'bumper', x: 960, y: 470, r: 34 },
    ],
  },
  {
    index: 8,
    name: 'levelName8',
    blocks: [
      { type: 'brick', x: 280, y: 160, w: 84, h: 50 },
      { type: 'brick', x: 560, y: 160, w: 84, h: 50 },
      { type: 'brick', x: 840, y: 160, w: 84, h: 50 },
      { type: 'brick', x: 1080, y: 160, w: 84, h: 50 },
      { type: 'brick', x: 420, y: 320, w: 84, h: 50 },
      { type: 'brick', x: 860, y: 320, w: 84, h: 50 },
      { type: 'rubber', x: 640, y: 220, w: 20, h: 130 },
      { type: 'bumper', x: 200, y: 320, r: 32 },
      { type: 'bumper', x: 1080, y: 320, r: 32 },
    ],
  },
  {
    index: 9,
    name: 'levelName9',
    blocks: [
      { type: 'brick', x: 360, y: 140, w: 80, h: 50 },
      { type: 'brick', x: 640, y: 140, w: 80, h: 50 },
      { type: 'brick', x: 920, y: 140, w: 80, h: 50 },
      { type: 'brick', x: 220, y: 320, w: 80, h: 50 },
      { type: 'brick', x: 500, y: 320, w: 80, h: 50 },
      { type: 'brick', x: 780, y: 320, w: 80, h: 50 },
      { type: 'brick', x: 1060, y: 320, w: 80, h: 50 },
      { type: 'rubber', x: 360, y: 480, w: 18, h: 120 },
      { type: 'rubber', x: 920, y: 480, w: 18, h: 120 },
      { type: 'bumper', x: 640, y: 420, r: 40 },
      { type: 'bumper', x: 140, y: 200, r: 28 },
      { type: 'bumper', x: 1140, y: 200, r: 28 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
