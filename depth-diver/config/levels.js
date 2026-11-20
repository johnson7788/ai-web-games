// depth-diver · 关卡数据（12 关 3 章：阳光浅海 / 微光中层 / 午夜深渊）
// 字段：index/scene/name/depthTarget(米)/oxygen(秒)/sampleTotal/lightRadius(px)/
//       diveSpeed(px/s 滚动)/spawnGap(s)/hazard('rock'|'mine'|'mix')/maxBlocked(1-4)/
//       currentDir(±1)/currentSpeed/vent/chaser/pressure/pressureFactor/newElement。
// 危险物按「航迹」生成：每波封锁 maxBlocked 条相邻航迹，其余航迹保证可通过（gap）。
// 样本在固定深度百分比处生成，采满 sampleTotal 颗本关升星。

export const LEVELS = [
  {
    index: 1, scene: 'sunlit', name: { en: 'Sunlit Shallows', zh: '阳光浅海' },
    depthTarget: 300, oxygen: 40, sampleTotal: 3, lightRadius: 260,
    diveSpeed: 125, spawnGap: 1.5, hazard: 'rock', maxBlocked: 1,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '基础岩礁与发光样本',
  },
  {
    index: 2, scene: 'sunlit', name: { en: 'Mine Field', zh: '水雷阵' },
    depthTarget: 360, oxygen: 42, sampleTotal: 3, lightRadius: 250,
    diveSpeed: 138, spawnGap: 1.35, hazard: 'mine', maxBlocked: 1,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '水雷（触爆即毁）',
  },
  {
    index: 3, scene: 'sunlit', name: { en: 'Current Drift', zh: '洋流区' },
    depthTarget: 420, oxygen: 44, sampleTotal: 3, lightRadius: 240,
    diveSpeed: 150, spawnGap: 1.3, hazard: 'rock', maxBlocked: 2,
    currentDir: 1, currentSpeed: 90, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '洋流（恒推力，须反向修正）',
  },
  {
    index: 4, scene: 'twilight', name: { en: 'Hydrothermal Vents', zh: '热泉上喷' },
    depthTarget: 480, oxygen: 44, sampleTotal: 4, lightRadius: 220,
    diveSpeed: 160, spawnGap: 1.2, hazard: 'rock', maxBlocked: 2,
    currentDir: 0, currentSpeed: 0, vent: true, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '热泉上喷（气泡柱推升）',
  },
  {
    index: 5, scene: 'twilight', name: { en: 'The Chaser', zh: '追逐者' },
    depthTarget: 520, oxygen: 46, sampleTotal: 4, lightRadius: 210,
    diveSpeed: 162, spawnGap: 1.2, hazard: 'rock', maxBlocked: 2,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: true, pressure: false, pressureFactor: 0,
    newElement: '鮟鱇追逐者（追一段）',
  },
  {
    index: 6, scene: 'twilight', name: { en: 'The Crevice', zh: '窄缝洞窟' },
    depthTarget: 560, oxygen: 46, sampleTotal: 4, lightRadius: 200,
    diveSpeed: 175, spawnGap: 1.15, hazard: 'rock', maxBlocked: 4,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '窄缝洞窟（岩礁只留一条缝）',
  },
  {
    index: 7, scene: 'abyss', name: { en: 'Dim Light', zh: '灯照缩小' },
    depthTarget: 600, oxygen: 46, sampleTotal: 4, lightRadius: 150,
    diveSpeed: 176, spawnGap: 1.15, hazard: 'mine', maxBlocked: 2,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '头灯缩窄（限视）',
  },
  {
    index: 8, scene: 'abyss', name: { en: 'Pressure Limit', zh: '压力限时' },
    depthTarget: 640, oxygen: 48, sampleTotal: 5, lightRadius: 190,
    diveSpeed: 188, spawnGap: 1.1, hazard: 'rock', maxBlocked: 2,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: true, pressureFactor: 1.4,
    newElement: '压力限时（越深耗氧越快）',
  },
  {
    index: 9, scene: 'abyss', name: { en: 'Bioluminescent Swarm', zh: '生物群' },
    depthTarget: 680, oxygen: 48, sampleTotal: 5, lightRadius: 180,
    diveSpeed: 189, spawnGap: 1.05, hazard: 'mix', maxBlocked: 3,
    currentDir: 0, currentSpeed: 0, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '生物群（样本与风险密集）',
  },
  {
    index: 10, scene: 'abyss', name: { en: 'Twin Currents', zh: '双洋流' },
    depthTarget: 720, oxygen: 48, sampleTotal: 5, lightRadius: 170,
    diveSpeed: 200, spawnGap: 1.05, hazard: 'mix', maxBlocked: 3,
    currentDir: 2, currentSpeed: 100, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '双洋流（方向交替）',
  },
  {
    index: 11, scene: 'abyss', name: { en: 'Cold Descent', zh: '深海寒流' },
    depthTarget: 760, oxygen: 50, sampleTotal: 5, lightRadius: 130,
    diveSpeed: 170, spawnGap: 1.0, hazard: 'rock', maxBlocked: 3,
    currentDir: -1, currentSpeed: 70, vent: false, chaser: false, pressure: false, pressureFactor: 0,
    newElement: '寒流（减速+更暗+密集岩礁）',
  },
  {
    index: 12, scene: 'abyss', name: { en: 'The Final Abyss', zh: '终局深渊' },
    depthTarget: 820, oxygen: 52, sampleTotal: 6, lightRadius: 160,
    diveSpeed: 205, spawnGap: 1.0, hazard: 'mix', maxBlocked: 3,
    currentDir: 0, currentSpeed: 0, vent: true, chaser: true, pressure: true, pressureFactor: 1.6,
    newElement: '终局深渊（全要素叠加）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
