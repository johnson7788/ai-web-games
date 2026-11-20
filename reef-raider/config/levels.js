// REEF RAIDER · 12 关目标分制（M1 拥有）
// 字段：index/scene/target/time/startCoins/speedMult/spawnInterval/maxFish/pool/
//       rare(稀有出没次数 0/1/2)/reef(暗礁)/combo(连击)/ghost(幽灵专场)/boss(灯笼鱼王)/newElement。
// 目标分制：在 time 秒内把 score（捕获所得金币）打到 target 即通关。
// 场景三章：coral-dawn 珊瑚晨光 / reef-dusk 岩礁黄昏 / phosphor-night 磷光夜海。

export const LEVELS = [
  {
    index: 1, scene: 'coral-dawn', target: 80, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 1.0, maxFish: 8, pool: ['lantern', 'butterfly', 'turtle'],
    rare: 0, reef: [], combo: false, ghost: false, boss: false,
    newElement: '基础炮台与灯鱼/蝶鱼/海龟',
  },
  {
    index: 2, scene: 'coral-dawn', target: 110, time: 60, startCoins: 100,
    speedMult: 1.3, spawnInterval: 0.9, maxFish: 9, pool: ['lantern', 'butterfly', 'turtle'],
    rare: 0, reef: [], combo: false, ghost: false, boss: false,
    newElement: '鱼速 +30%',
  },
  {
    index: 3, scene: 'coral-dawn', target: 140, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 1.0, maxFish: 8, pool: ['lantern', 'butterfly', 'turtle', 'manta'],
    rare: 1, reef: [], combo: false, ghost: false, boss: false,
    newElement: '稀有幽灵灯笼鱼限时出没（30s 捕获 ×2）',
  },
  {
    index: 4, scene: 'coral-dawn', target: 170, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 0.5, maxFish: 14, pool: ['lantern', 'butterfly', 'turtle'],
    rare: 0, reef: [], combo: false, ghost: false, boss: false,
    newElement: '密集鱼潮（低炮打群）',
  },
  {
    index: 5, scene: 'reef-dusk', target: 200, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 0.9, maxFish: 9, pool: ['lantern', 'butterfly', 'turtle', 'manta'],
    rare: 0, reef: [{ x: 340, y: 300, r: 52 }, { x: 760, y: 430, r: 60 }, { x: 1030, y: 250, r: 48 }],
    combo: false, ghost: false, boss: false,
    newElement: '障碍暗礁挡炮弹',
  },
  {
    index: 6, scene: 'reef-dusk', target: 160, time: 60, startCoins: 50,
    speedMult: 1.0, spawnInterval: 1.0, maxFish: 8, pool: ['lantern', 'butterfly', 'turtle'],
    rare: 0, reef: [], combo: false, ghost: false, boss: false,
    newElement: '金币紧缩（开局半资）',
  },
  {
    index: 7, scene: 'reef-dusk', target: 220, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 0.9, maxFish: 9, pool: ['lantern', 'butterfly', 'turtle', 'manta'],
    rare: 0, reef: [], combo: true, ghost: false, boss: false,
    newElement: '连击奖励（连续命中递增倍率）',
  },
  {
    index: 8, scene: 'reef-dusk', target: 250, time: 60, startCoins: 100,
    speedMult: 1.4, spawnInterval: 0.8, maxFish: 10, pool: ['lantern', 'butterfly', 'turtle', 'manta'],
    rare: 0, reef: [{ x: 300, y: 360, r: 50 }, { x: 640, y: 250, r: 54 }, { x: 980, y: 430, r: 56 }],
    combo: false, ghost: false, boss: false,
    newElement: '快鱼 + 更多暗礁',
  },
  {
    index: 9, scene: 'phosphor-night', target: 270, time: 60, startCoins: 100,
    speedMult: 1.0, spawnInterval: 0.8, maxFish: 9, pool: ['lantern', 'butterfly', 'turtle', 'manta', 'ghost'],
    rare: 0, reef: [], combo: false, ghost: true, boss: false,
    newElement: '幽灵灯笼鱼专场',
  },
  {
    index: 10, scene: 'phosphor-night', target: 220, time: 60, startCoins: 50,
    speedMult: 1.1, spawnInterval: 0.5, maxFish: 13, pool: ['lantern', 'butterfly', 'turtle'],
    rare: 0, reef: [], combo: false, ghost: false, boss: false,
    newElement: '金币紧缩 + 鱼潮',
  },
  {
    index: 11, scene: 'phosphor-night', target: 320, time: 70, startCoins: 100,
    speedMult: 1.0, spawnInterval: 0.9, maxFish: 9, pool: ['lantern', 'butterfly', 'turtle', 'manta', 'ghost'],
    rare: 2, reef: [], combo: false, ghost: true, boss: false,
    newElement: '双倍稀有出没',
  },
  {
    index: 12, scene: 'phosphor-night', target: 500, time: 90, startCoins: 120,
    speedMult: 1.0, spawnInterval: 1.0, maxFish: 7, pool: ['lantern', 'butterfly', 'turtle', 'manta'],
    rare: 0, reef: [], combo: false, ghost: true, boss: true,
    newElement: '终局灯笼鱼王',
  },
];

export const LEVEL_COUNT = LEVELS.length;
