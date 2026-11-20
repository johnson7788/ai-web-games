// COLOR FLUX · 12 段推进定义
// 每段：形状轮换 + 转速渐升 + 滚动加速 + 场景包（极夜/日辉/霓虹雨）+ 特殊规则
// 段索引 1..12；超过 12 仍按第 12 段无尽续跑。

export const SEGMENTS = [
  { index: 1,  shape: 'ring',     omega: 88,  scroll: 120, scene: 0, special: null },
  { index: 2,  shape: 'arc2',     omega: 92,  scroll: 128, scene: 0, special: null },
  { index: 3,  shape: 'cross',    omega: 96,  scroll: 136, scene: 0, special: null },
  { index: 4,  shape: 'windmill', omega: 100, scroll: 144, scene: 0, special: 'rhythm' },
  { index: 5,  shape: 'nested',   omega: 104, scroll: 152, scene: 1, special: null },
  { index: 6,  shape: 'ring',     omega: 108, scroll: 160, scene: 1, special: 'rhythm' },
  { index: 7,  shape: 'arc2',     omega: 112, scroll: 168, scene: 1, special: null },
  { index: 8,  shape: 'cross',    omega: 116, scroll: 176, scene: 1, special: 'dual' },
  { index: 9,  shape: 'windmill', omega: 120, scroll: 184, scene: 2, special: 'rhythm' },
  { index: 10, shape: 'nested',   omega: 124, scroll: 192, scene: 2, special: null },
  { index: 11, shape: 'ring',     omega: 128, scroll: 200, scene: 2, special: 'dual' },
  { index: 12, shape: 'nested',   omega: 132, scroll: 208, scene: 2, special: 'rhythm' },
];

export const SEGMENT_COUNT = SEGMENTS.length;

// 场景包：0=极夜(蓝紫) 1=日辉(金橙) 2=霓虹雨(青粉)
export const SCENES = [
  { index: 0, key: 'scene.polar', name: 'polar' },
  { index: 1, key: 'scene.day',   name: 'day' },
  { index: 2, key: 'scene.neon',  name: 'neon' },
];

export function segmentAt(segmentIndex) {
  const i = Math.max(1, Math.min(SEGMENT_COUNT, Math.floor(segmentIndex) || 1));
  return SEGMENTS[i - 1];
}

export function sceneOf(segmentIndex) {
  return segmentAt(segmentIndex).scene;
}
