// OCEAN DASH · 12 赛段定义 + 3 场景包
// 场景包：珊瑚浅滩（亮青，1-4）/ 深沟（深蓝，5-8）/ 红树林（绿金，9-12）
// 每段竞速 vs 3 AI；newElement 必须是该段新增的机制（fun-audit 检查不重复）。

export const SCENES = [
  {
    id: 'coral',
    name: 'scene.coral',
    waterTop: '#0e5f74',
    waterBottom: '#04222e',
    skyTop: '#8fd8e8',
    skyBottom: '#d9f4ff',
    surface: '#bff4ff',
    accent: '#2ee6c8',
    glow: '#7df9e0',
    decor: 'coral',
  },
  {
    id: 'trench',
    name: 'scene.trench',
    waterTop: '#06283f',
    waterBottom: '#01060d',
    skyTop: '#3c6b8a',
    skyBottom: '#8fb6c6',
    surface: '#5fb7d8',
    accent: '#3aa7ff',
    glow: '#6fd0ff',
    decor: 'trench',
  },
  {
    id: 'mangrove',
    name: 'scene.mangrove',
    waterTop: '#2c5a34',
    waterBottom: '#07150b',
    skyTop: '#b8c86a',
    skyBottom: '#e9f0c2',
    surface: '#d8e58a',
    accent: '#d9c34a',
    glow: '#f2e27a',
    decor: 'mangrove',
  },
];

export const SEGMENTS = [
  // ---- 珊瑚浅滩（亮青）----
  {
    index: 1, scene: 'coral', baseSpeed: 230, length: 3000,
    newElement: '气泡：吃泡加速 + 回鱼（教上下躲避 + 核心循环）',
    pattern: ['bubble', 'wide', 'bubble', 'jelly', 'wide', 'bubble'],
  },
  {
    index: 2, scene: 'coral', baseSpeed: 238, length: 3100,
    newElement: '窄缝区：按住收拢才能过（教散聚决定）',
    pattern: ['narrow', 'bubble', 'narrow', 'wide', 'bubble', 'narrow'],
  },
  {
    index: 3, scene: 'coral', baseSpeed: 246, length: 3200,
    newElement: '洋流带：箭形光带加速（首次 signature）',
    pattern: ['current', 'wide', 'jelly', 'current', 'narrow', 'current'],
  },
  {
    index: 4, scene: 'coral', baseSpeed: 254, length: 3300,
    newElement: '水母阵：散开抢速 vs 收拢避险（风险抉择）',
    pattern: ['jelly', 'bubble', 'jelly', 'current', 'jelly', 'wide'],
  },
  // ---- 深沟（深蓝）----
  {
    index: 5, scene: 'trench', baseSpeed: 262, length: 3400,
    newElement: '逆流区：逆流减速，气泡续速（节奏控制）',
    pattern: ['counter', 'bubble', 'counter', 'wide', 'counter', 'current'],
  },
  {
    index: 6, scene: 'trench', baseSpeed: 270, length: 3500,
    newElement: '深沟暗区：视野缩小（信息稀缺）',
    pattern: ['narrow', 'jelly', 'wide', 'current', 'narrow', 'jelly'],
  },
  {
    index: 7, scene: 'trench', baseSpeed: 278, length: 3600,
    newElement: '跃面捷径：跳出水面滑翔跨礁（首次滑翔）',
    pattern: ['jump', 'bubble', 'jump', 'wide', 'current', 'jump'],
  },
  {
    index: 8, scene: 'trench', baseSpeed: 286, length: 3700,
    newElement: '礁石阵：密集底部礁石（连续判断）',
    pattern: ['reef', 'narrow', 'reef', 'jelly', 'reef', 'current'],
  },
  // ---- 红树林（绿金）----
  {
    index: 9, scene: 'mangrove', baseSpeed: 294, length: 3800,
    newElement: '红树根：从水面垂下的新障碍（换障碍形）',
    pattern: ['root', 'wide', 'root', 'bubble', 'root', 'current'],
  },
  {
    index: 10, scene: 'mangrove', baseSpeed: 302, length: 3900,
    newElement: '双窄缝：连续两处窄缝（散聚连打）',
    pattern: ['narrow', 'narrow', 'wide', 'narrow', 'narrow', 'current'],
  },
  {
    index: 11, scene: 'mangrove', baseSpeed: 310, length: 4000,
    newElement: '逆流 + 水母：双机制叠加（复合压力）',
    pattern: ['counter', 'jelly', 'counter', 'jump', 'counter', 'jelly'],
  },
  {
    index: 12, scene: 'mangrove', baseSpeed: 318, length: 4200,
    newElement: '终局冲刺：礁石阵 + 跃面捷径的终极组合',
    pattern: ['reef', 'jump', 'narrow', 'current', 'reef', 'jump'],
  },
];

export function segmentAt(index) {
  return SEGMENTS[Math.min(Math.max(1, index), SEGMENTS.length) - 1];
}

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}
