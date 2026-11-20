// STACK SKY · 12 段推进结构 + 3 场景包
// 每段：目标层数 / 块速 / 风频 / 场景包（0 晨曦云海 · 1 雷雨层 · 2 星夜天宫）
// segmentAt(layersPlaced) 返回当前段位对象；sum(targetLayers) 之后进入无尽塔顶（沿用最后一段）

export const SCENES = [
  { id: 0, key: 'scene.dawn', pack: 'dawn' },
  { id: 1, key: 'scene.storm', pack: 'storm' },
  { id: 2, key: 'scene.night', pack: 'night' },
];

export const SEGMENTS = [
  { index: 1,  name: 'seg.1',  targetLayers: 3, speed: 300,  wind: 0, scene: 0, newElement: '慢速段：教截停与裁边（晨曦云海）' },
  { index: 2,  name: 'seg.2',  targetLayers: 4, speed: 360,  wind: 0, scene: 0, newElement: '块速提升，逼更早预判' },
  { index: 3,  name: 'seg.3',  targetLayers: 4, speed: 440,  wind: 1, scene: 0, newElement: '风切登场：每 10 层横风把移动岛吹偏' },
  { index: 4,  name: 'seg.4',  targetLayers: 4, speed: 520,  wind: 1, scene: 0, newElement: '神龛层解锁：对齐纹样恢复初始宽度' },
  { index: 5,  name: 'seg.5',  targetLayers: 4, speed: 620,  wind: 1, scene: 1, newElement: '换章：雷雨层（蓝灰电光）' },
  { index: 6,  name: 'seg.6',  targetLayers: 4, speed: 740,  wind: 2, scene: 1, newElement: '风速提升 + perfect×3 彩云缠绕' },
  { index: 7,  name: 'seg.7',  targetLayers: 4, speed: 860,  wind: 2, scene: 1, newElement: '岛宽随段位收窄，容错更小' },
  { index: 8,  name: 'seg.8',  targetLayers: 4, speed: 980,  wind: 2, scene: 1, newElement: '风频加密：每 10 层连吹两阵' },
  { index: 9,  name: 'seg.9',  targetLayers: 4, speed: 1100, wind: 3, scene: 2, newElement: '换章：星夜天宫（深紫星空）' },
  { index: 10, name: 'seg.10', targetLayers: 4, speed: 1240, wind: 3, scene: 2, newElement: '神龛层容错收紧，需更精确对齐' },
  { index: 11, name: 'seg.11', targetLayers: 4, speed: 1380, wind: 3, scene: 2, newElement: '极速段：块速逼近极限' },
  { index: 12, name: 'seg.12', targetLayers: 4, speed: 1520, wind: 3, scene: 2, newElement: '无尽塔顶：维持窄块连击冲最高分' },
];

export const SEGMENT_COUNT = SEGMENTS.length;

// layersPlaced（已叠层数）→ 段位对象（1-based；超出进入最后一段的无尽塔顶）
export function segmentAt(layersPlaced) {
  let acc = 0;
  for (const s of SEGMENTS) {
    acc += s.targetLayers;
    if (layersPlaced < acc) return s;
  }
  return SEGMENTS[SEGMENTS.length - 1];
}

export function segmentIndex(layersPlaced) {
  return segmentAt(layersPlaced).index;
}

export function scenePackAt(layersPlaced) {
  return segmentAt(layersPlaced).scene;
}
