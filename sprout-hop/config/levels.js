// Sprout Hop · 关卡数据（12 关，3 个场景包）
// 字段：
//   index / scene / goalJumps（通关所需落台数）/ perfectGoal（三星所需完美落点数）
//   gapMin / gapMax（平台水平间距，world px）/ yMin / yMax（平台顶面相对首平台的 y 偏移，负=更高）
//   width（平台基准宽度）/ kinds（平台类型权重，['pod','pumpkin','basket','broken']）
//   wind（风速倍率：1 无风，>1 顺风更远，<1 逆风更近）
//   moving（移动竹筐）/ broken（断藤）/ twoTier（高低双层路线）
//   newElement（本关新元素，供 fun-audit 与 UI 展示）
// 平台类型语义（sim 落地时生效）：
//   pod 豆荚：标准；pumpkin 南瓜：nextBoost=1.3（下一跳更远）；
//   basket 竹筐：nextBoost=0.7（下一跳更近）；broken 断藤：落上 0.6s 后塌。

export const LEVELS = [
  { index: 1, scene: 'dawn', goalJumps: 4, perfectGoal: 1, gapMin: 240, gapMax: 320, yMin: -60, yMax: 40, width: 120, kinds: { pod: 1 }, wind: 1.0, moving: false, broken: false, twoTier: false, newElement: '固定藤架（标准豆荚平台）' },
  { index: 2, scene: 'dawn', goalJumps: 5, perfectGoal: 1, gapMin: 270, gapMax: 360, yMin: -70, yMax: 50, width: 116, kinds: { pod: 1 }, wind: 1.0, moving: false, broken: false, twoTier: false, newElement: '渐距（平台间距拉大）' },
  { index: 3, scene: 'dawn', goalJumps: 5, perfectGoal: 2, gapMin: 250, gapMax: 340, yMin: -70, yMax: 50, width: 118, kinds: { pod: 0.6, pumpkin: 0.4 }, wind: 1.0, moving: false, broken: false, twoTier: false, newElement: '弹性南瓜（回弹 1.3×）' },
  { index: 4, scene: 'dawn', goalJumps: 5, perfectGoal: 2, gapMin: 230, gapMax: 320, yMin: -60, yMax: 40, width: 112, kinds: { pod: 0.7, basket: 0.3 }, wind: 1.0, moving: true, broken: false, twoTier: false, newElement: '移动藤筐（左右摆动）' },
  { index: 5, scene: 'noon', goalJumps: 5, perfectGoal: 2, gapMin: 290, gapMax: 400, yMin: -80, yMax: 50, width: 116, kinds: { pod: 1 }, wind: 1.25, moving: false, broken: false, twoTier: false, newElement: '顺风段（同样力度跳更远）' },
  { index: 6, scene: 'noon', goalJumps: 5, perfectGoal: 2, gapMin: 230, gapMax: 320, yMin: -70, yMax: 40, width: 112, kinds: { pod: 0.6, broken: 0.4 }, wind: 1.0, moving: false, broken: true, twoTier: false, newElement: '断藤（落上 0.6s 后塌）' },
  { index: 7, scene: 'noon', goalJumps: 6, perfectGoal: 2, gapMin: 250, gapMax: 360, yMin: -60, yMax: 40, width: 112, kinds: { pod: 1 }, wind: 1.0, moving: false, broken: false, twoTier: true, newElement: '高低双层路线（上稳下险近）' },
  { index: 8, scene: 'noon', goalJumps: 6, perfectGoal: 3, gapMin: 220, gapMax: 310, yMin: -60, yMax: 40, width: 118, kinds: { pod: 1 }, wind: 0.75, moving: false, broken: false, twoTier: false, newElement: '风向反转（逆风减距）' },
  { index: 9, scene: 'night', goalJumps: 6, perfectGoal: 3, gapMin: 210, gapMax: 300, yMin: -60, yMax: 40, width: 110, kinds: { pod: 0.4, basket: 0.6 }, wind: 1.0, moving: false, broken: false, twoTier: false, newElement: '竹筐吸力（跳距大减）' },
  { index: 10, scene: 'night', goalJumps: 7, perfectGoal: 3, gapMin: 250, gapMax: 370, yMin: -60, yMax: 40, width: 110, kinds: { pod: 1 }, wind: 1.2, moving: false, broken: false, twoTier: true, newElement: '双层 + 顺风叠加' },
  { index: 11, scene: 'night', goalJumps: 7, perfectGoal: 3, gapMin: 230, gapMax: 340, yMin: -70, yMax: 40, width: 112, kinds: { pod: 0.5, pumpkin: 0.3, broken: 0.2 }, wind: 1.0, moving: false, broken: true, twoTier: false, newElement: '断藤 + 弹性南瓜混合' },
  { index: 12, scene: 'night', goalJumps: 8, perfectGoal: 4, gapMin: 260, gapMax: 390, yMin: -80, yMax: 50, width: 112, kinds: { pod: 0.5, pumpkin: 0.3, basket: 0.2 }, wind: 1.1, moving: false, broken: false, twoTier: true, newElement: '终章大藤架（三要素叠加）' },
];

export const LEVEL_COUNT = LEVELS.length;

// 平台类型 → 落地后的 nextBoost（下一跳速度倍率）
export const BOOST = { pod: 1, pumpkin: 1.3, basket: 0.7, broken: 1 };
