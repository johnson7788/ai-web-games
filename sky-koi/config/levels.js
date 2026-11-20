// SKY KOI · 关卡数据（12 关 / 3 场景包）
// 契约：docs/README.md。字段：
//   index/scene/targetGates/speed/gap/spacing/gapRange/pearl/pearlPerGate/
//   pearlTarget/skimTarget/narrow/moving/movingAmp/wind/double/wave/dash/newElement。
// scene：dawn(晨曦云海) / sakura(落樱湖面) / night(夜空星河)。

export const LEVELS = [
  {
    index: 1, scene: 'dawn',
    targetGates: 3, speed: 210, gap: 240, spacing: 360, gapRange: [150, 460],
    pearl: false, pearlPerGate: 0, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: false, wave: 0, dash: false,
    newElement: '基础鸟居门（宽门）',
  },
  {
    index: 2, scene: 'dawn',
    targetGates: 4, speed: 215, gap: 240, spacing: 355, gapRange: [150, 460],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: false, wave: 0, dash: false,
    newElement: '珍珠收集（吃满 3 颗升 1 星）',
  },
  {
    index: 3, scene: 'dawn',
    targetGates: 4, speed: 225, gap: 210, spacing: 350, gapRange: [160, 450],
    pearl: false, pearlPerGate: 0, pearlTarget: 3, skimTarget: 2,
    narrow: true, moving: false, movingAmp: 0, wind: 0, double: false, wave: 0, dash: false,
    newElement: '窄门（门缝更窄）',
  },
  {
    index: 4, scene: 'sakura',
    targetGates: 4, speed: 225, gap: 235, spacing: 350, gapRange: [160, 450],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: true, movingAmp: 70, wind: 0, double: false, wave: 0, dash: false,
    newElement: '移动门（门上下浮动）',
  },
  {
    index: 5, scene: 'sakura',
    targetGates: 4, speed: 230, gap: 240, spacing: 350, gapRange: [160, 450],
    pearl: false, pearlPerGate: 0, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 130, double: false, wave: 0, dash: false,
    newElement: '侧风湍流（上下阵风）',
  },
  {
    index: 6, scene: 'sakura',
    targetGates: 4, speed: 230, gap: 240, spacing: 350, gapRange: [170, 440],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: true, wave: 0, dash: false,
    newElement: '双门选择（上下两缝选其一）',
  },
  {
    index: 7, scene: 'night',
    targetGates: 4, speed: 235, gap: 240, spacing: 350, gapRange: [160, 440],
    pearl: false, pearlPerGate: 0, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: false, wave: 34, dash: false,
    newElement: '巨浪周期（水面升降）',
  },
  {
    index: 8, scene: 'night',
    targetGates: 5, speed: 240, gap: 235, spacing: 345, gapRange: [165, 445],
    pearl: true, pearlPerGate: 2, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: false, wave: 0, dash: false,
    newElement: '珍珠连珠（一门双珠）',
  },
  {
    index: 9, scene: 'night',
    targetGates: 5, speed: 245, gap: 210, spacing: 345, gapRange: [170, 440],
    pearl: false, pearlPerGate: 0, pearlTarget: 3, skimTarget: 2,
    narrow: true, moving: true, movingAmp: 60, wind: 0, double: false, wave: 0, dash: false,
    newElement: '窄门 + 移动叠加',
  },
  {
    index: 10, scene: 'night',
    targetGates: 5, speed: 250, gap: 235, spacing: 340, gapRange: [170, 440],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 110, double: false, wave: 26, dash: false,
    newElement: '侧风 + 巨浪叠加',
  },
  {
    index: 11, scene: 'dawn',
    targetGates: 6, speed: 250, gap: 240, spacing: 340, gapRange: [165, 445],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: false, moving: false, movingAmp: 0, wind: 0, double: false, wave: 0, dash: true,
    newElement: '鳞光冲刺（第 3 颗珍珠触发）',
  },
  {
    index: 12, scene: 'night',
    targetGates: 6, speed: 260, gap: 205, spacing: 335, gapRange: [170, 435],
    pearl: true, pearlPerGate: 1, pearlTarget: 3, skimTarget: 2,
    narrow: true, moving: false, movingAmp: 0, wind: 90, double: false, wave: 30, dash: false,
    newElement: '三轴终章（窄门+侧风+巨浪）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
