// config/levels.js — 12 段推进结构：每段一个场景包 + 障碍轮换 + 新元素
// 场景包：1-4 丝路晨（沙金）/ 5-8 绿洲午（翠绿）/ 9-12 星夜（蓝紫）
// 每段 segmentLengthM 米；结束后进入下一段（12 段后无尽循环，难度封顶）。

export const SEGMENTS = [
  { index: 1,  scene: 'dawn',  lengthM: 150, types: ['low'],                       newElement: 'low' },
  { index: 2,  scene: 'dawn',  lengthM: 150, types: ['low', 'pit'],                newElement: 'pit' },
  { index: 3,  scene: 'dawn',  lengthM: 160, types: ['low', 'high'],               newElement: 'high' },
  { index: 4,  scene: 'dawn',  lengthM: 160, types: ['high', 'double'],            newElement: 'double' },
  { index: 5,  scene: 'oasis', lengthM: 170, types: ['pit', 'rock'],               newElement: 'rock' },
  { index: 6,  scene: 'oasis', lengthM: 170, types: ['low', 'pit'],                newElement: 'sand', sand: true },
  { index: 7,  scene: 'oasis', lengthM: 180, types: ['double', 'high'],            newElement: 'rhythm' },
  { index: 8,  scene: 'oasis', lengthM: 180, types: ['rock', 'pit'],               newElement: 'rock+pit' },
  { index: 9,  scene: 'night', lengthM: 190, types: ['high', 'rock'],              newElement: 'night' },
  { index: 10, scene: 'night', lengthM: 190, types: ['double', 'pit', 'low'],      newElement: 'triple' },
  { index: 11, scene: 'night', lengthM: 200, types: ['low', 'high', 'rock', 'pit'], newElement: 'mix' },
  { index: 12, scene: 'night', lengthM: 210, types: ['double', 'high', 'rock'],    newElement: 'finale' },
];

export const SCENE_COUNT = SEGMENTS.length;

// 当前距离 → 段（段从 1 开始；超出最后一段后循环回来但难度已封顶）
export function segmentAt(distanceM) {
  let acc = 0;
  for (const seg of SEGMENTS) {
    acc += seg.lengthM;
    if (distanceM < acc) return seg;
  }
  // 无尽：循环回最后一段的规则，难度封顶
  return SEGMENTS[SEGMENTS.length - 1];
}

export function segmentIndexAt(distanceM) {
  return segmentAt(distanceM).index;
}

// 场景包名（渲染用）：按段返回 dawn/oasis/night
export function sceneAt(distanceM) {
  return segmentAt(distanceM).scene;
}
