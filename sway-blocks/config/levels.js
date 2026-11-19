// 关卡数据（原创布局，横屏 1280×720，y 向下）。
// 平台：{ x, y, w, h, angle(deg), moving:[dx,dy,periodSec]?, dot?:true, dotR?:number }
// 积木：{ shape:'box'|'circle'|'triangle'|'rock', w, h(diam), type:'normal'|'slippery'|'bouncy'|'rock',
//         anchorX, startAngle(rad，相对竖直向下，正=右), rodLength }
// 几何约定：锚点 y=40，绳长 ~220，摆动底部在上半屏；平台在下半屏，摆动不会撞到已堆好的积木。
export const LEVELS = [
  {
    name: { en: 'First Stack', zh: '初次堆叠' },
    scene: 'cyan',
    platforms: [
      { x: 640, y: 612, w: 340, h: 28 },
    ],
    blocks: [
      { shape: 'box', w: 90, h: 90, type: 'normal', anchorX: 640, startAngle: 1.25, rodLength: 220 },
      { shape: 'box', w: 90, h: 90, type: 'normal', anchorX: 640, startAngle: -1.25, rodLength: 220 },
      { shape: 'box', w: 90, h: 90, type: 'normal', anchorX: 640, startAngle: 1.2, rodLength: 220 },
    ],
  },
  {
    name: { en: 'Rolling Orbs', zh: '滚动圆球' },
    scene: 'pink',
    platforms: [
      { x: 640, y: 612, w: 560, h: 28 },
    ],
    blocks: [
      { shape: 'circle', w: 100, type: 'normal', anchorX: 460, startAngle: 1.25, rodLength: 220 },
      { shape: 'circle', w: 100, type: 'normal', anchorX: 640, startAngle: -1.25, rodLength: 220 },
      { shape: 'circle', w: 100, type: 'normal', anchorX: 820, startAngle: 1.2, rodLength: 220 },
    ],
  },
  {
    name: { en: 'Ice Blocks', zh: '滑溜冰块' },
    scene: 'blue',
    platforms: [
      { x: 640, y: 612, w: 500, h: 28 },
    ],
    blocks: [
      { shape: 'box', w: 88, h: 88, type: 'slippery', anchorX: 480, startAngle: 1.25, rodLength: 220 },
      { shape: 'box', w: 88, h: 88, type: 'slippery', anchorX: 640, startAngle: -1.25, rodLength: 220 },
      { shape: 'box', w: 88, h: 88, type: 'slippery', anchorX: 800, startAngle: 1.2, rodLength: 220 },
    ],
  },
  {
    name: { en: 'Bounce Pads', zh: '弹力方块' },
    scene: 'green',
    platforms: [
      { x: 640, y: 612, w: 460, h: 28 },
    ],
    blocks: [
      { shape: 'box', w: 88, h: 88, type: 'normal', anchorX: 520, startAngle: 1.25, rodLength: 220 },
      { shape: 'box', w: 88, h: 88, type: 'bouncy', anchorX: 640, startAngle: -1.25, rodLength: 220 },
      { shape: 'box', w: 88, h: 88, type: 'bouncy', anchorX: 760, startAngle: 1.2, rodLength: 220 },
    ],
  },
  {
    name: { en: 'Conveyor', zh: '传送平台' },
    scene: 'purple',
    platforms: [
      { x: 640, y: 612, w: 300, h: 28, moving: [120, 0, 3.2] },
    ],
    blocks: [
      { shape: 'triangle', w: 100, type: 'normal', anchorX: 640, startAngle: 1.25, rodLength: 220 },
      { shape: 'triangle', w: 100, type: 'normal', anchorX: 640, startAngle: -1.25, rodLength: 220 },
      { shape: 'box', w: 84, h: 84, type: 'normal', anchorX: 640, startAngle: 1.2, rodLength: 220 },
    ],
  },
  {
    name: { en: 'Bedrock', zh: '磐石支点' },
    scene: 'gold',
    platforms: [
      { x: 640, y: 612, w: 320, h: 28 },
      { x: 400, y: 548, w: 90, h: 26 },
      { x: 880, y: 548, w: 90, h: 26 },
    ],
    blocks: [
      { shape: 'rock', w: 130, h: 130, type: 'rock', anchorX: 640, startAngle: 1.25, rodLength: 220 },
      { shape: 'box', w: 82, h: 82, type: 'normal', anchorX: 400, startAngle: -1.25, rodLength: 200 },
      { shape: 'box', w: 82, h: 82, type: 'normal', anchorX: 880, startAngle: 1.25, rodLength: 200 },
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
