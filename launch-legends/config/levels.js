// LAUNCH LEGENDS · 关卡数据（12 关 3 场景：小城夜空 / 云海之上 / 星环之巅）
// 字段：index/scene/name/targetHeight/cols/cloudP/steelP/corridorCloudP/wind/wallBounce/
//       rainBands/movingClouds/steelBarrierEvery/cloudStar/difficulty/newElement。
// targetHeight = 通关需爬升的层数（1 层 = 1 米 = 1 次弹跳判定）。
// corridorCloudP = 安全通道列上出现云絮的概率（云絮可撞碎，永远安全；钢棚不会落在通道上）。
// steelBarrierEvery = 每隔 N 层出现一道全钢棚（只有炽热态能烧穿）。

export const LEVELS = [
  {
    index: 1, scene: 'town', name: { en: 'First Spark', zh: '第一束火花' },
    targetHeight: 12, cols: 6, cloudP: 0.34, steelP: 0.05, corridorCloudP: 0.3,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 3, difficulty: 1,
    newElement: 'basic bounce & steer',
  },
  {
    index: 2, scene: 'town', name: { en: 'Crosswind', zh: '横风' },
    targetHeight: 16, cols: 6, cloudP: 0.4, steelP: 0.09, corridorCloudP: 0.35,
    wind: 140, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 5, difficulty: 1.8,
    newElement: 'crosswind drift',
  },
  {
    index: 3, scene: 'town', name: { en: 'Cloud Cascade', zh: '云絮连击' },
    targetHeight: 20, cols: 6, cloudP: 0.5, steelP: 0.12, corridorCloudP: 1.0,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 10, difficulty: 2.5,
    newElement: 'cloud combo chain',
  },
  {
    index: 4, scene: 'town', name: { en: 'Steel Canopy', zh: '钢棚' },
    targetHeight: 22, cols: 6, cloudP: 0.45, steelP: 0.16, corridorCloudP: 0.4,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 5,
    cloudStar: 9, difficulty: 3.2,
    newElement: 'steel canopy (incandescent-only)',
  },
  {
    index: 5, scene: 'clouds', name: { en: 'Wall Rider', zh: '贴墙弹' },
    targetHeight: 24, cols: 6, cloudP: 0.42, steelP: 0.14, corridorCloudP: 0.3,
    wind: 0, wallBounce: true, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 9, difficulty: 3.8,
    newElement: 'wall bounce boost',
  },
  {
    index: 6, scene: 'clouds', name: { en: 'Rain Band', zh: '阵雨带' },
    targetHeight: 26, cols: 6, cloudP: 0.46, steelP: 0.15, corridorCloudP: 0.35,
    wind: 0, wallBounce: false, rainBands: [[8, 15]], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 11, difficulty: 4.2,
    newElement: 'rain band slowdown',
  },
  {
    index: 7, scene: 'clouds', name: { en: 'Drifting Deck', zh: '移动云台' },
    targetHeight: 28, cols: 6, cloudP: 0.5, steelP: 0.16, corridorCloudP: 0.35,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: true, steelBarrierEvery: 0,
    cloudStar: 12, difficulty: 4.6,
    newElement: 'moving cloud platforms',
  },
  {
    index: 8, scene: 'clouds', name: { en: 'Narrow Well', zh: '窄井通道' },
    targetHeight: 28, cols: 3, cloudP: 0.55, steelP: 0.22, corridorCloudP: 0.4,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 13, difficulty: 5.0,
    newElement: 'narrow well columns',
  },
  {
    index: 9, scene: 'rings', name: { en: 'Storm Front', zh: '风暴前缘' },
    targetHeight: 32, cols: 6, cloudP: 0.6, steelP: 0.22, corridorCloudP: 0.4,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 0,
    cloudStar: 16, difficulty: 5.5,
    newElement: 'dense storm clouds',
  },
  {
    index: 10, scene: 'rings', name: { en: 'Gale & Steel', zh: '风与钢' },
    targetHeight: 34, cols: 6, cloudP: 0.55, steelP: 0.24, corridorCloudP: 0.4,
    wind: 160, wallBounce: false, rainBands: [], movingClouds: false, steelBarrierEvery: 4,
    cloudStar: 17, difficulty: 5.9,
    newElement: 'steel + wind double threat',
  },
  {
    index: 11, scene: 'rings', name: { en: 'Shifting Maze', zh: '摇摆迷阵' },
    targetHeight: 40, cols: 4, cloudP: 0.6, steelP: 0.26, corridorCloudP: 0.45,
    wind: 0, wallBounce: false, rainBands: [], movingClouds: true, steelBarrierEvery: 0,
    cloudStar: 20, difficulty: 6.3,
    newElement: 'shifting narrow maze',
  },
  {
    index: 12, scene: 'rings', name: { en: 'Final Summit', zh: '冲顶终章' },
    targetHeight: 48, cols: 6, cloudP: 0.62, steelP: 0.28, corridorCloudP: 0.45,
    wind: 120, wallBounce: false, rainBands: [[12, 24]], movingClouds: false, steelBarrierEvery: 3,
    cloudStar: 24, difficulty: 6.8,
    newElement: 'final summit gauntlet',
  },
];

export const LEVEL_COUNT = LEVELS.length;
