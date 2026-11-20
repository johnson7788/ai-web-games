// Balloon Burst · 关卡数据（12 关 3 场景）
// 字段：index/scene/rows/cols/time/target/colors/stones/specials/newElement/name。
// 坐标约定：[r, c]，r=行(0..rows-1)，c=列(0..cols-1)。
// specials 是「本关新增特殊灯笼的数量」，由 sim 用 seed 确定性摆放；
// 场景：dusk=黄昏集会 / night=夜空灯节 / mist=晨雾山谷。

export const LEVELS = [
  {
    index: 1, scene: 'dusk', rows: 6, cols: 6,
    time: 40, target: 1200, colors: 5,
    stones: [], specials: {},
    newElement: '基础同色点击消除',
    name: { en: 'First Lanterns', zh: '初升灯火' },
  },
  {
    index: 2, scene: 'dusk', rows: 6, cols: 6,
    time: 24, target: 1500, colors: 5,
    stones: [], specials: {},
    newElement: '限时紧缩',
    name: { en: 'Hurry Dusk', zh: '黄昏赶场' },
  },
  {
    index: 3, scene: 'dusk', rows: 6, cols: 6,
    time: 40, target: 1800, colors: 5,
    stones: [], specials: { metal: 4 },
    newElement: '金属灯笼（两击才破）',
    name: { en: 'Iron Cages', zh: '铁笼灯笼' },
  },
  {
    index: 4, scene: 'dusk', rows: 6, cols: 7,
    time: 40, target: 2000, colors: 6,
    stones: [], specials: { fire: 5 },
    newElement: '火星灯笼（点燃整行）',
    name: { en: 'Sparks Fly', zh: '火星引燃' },
  },
  {
    index: 5, scene: 'night', rows: 6, cols: 7,
    time: 40, target: 2300, colors: 6,
    stones: [], specials: { chainedPairs: 3 },
    newElement: '锁链灯笼（成对同消）',
    name: { en: 'Bound by Light', zh: '锁链相系' },
  },
  {
    index: 6, scene: 'night', rows: 6, cols: 7,
    time: 45, target: 2600, colors: 6,
    stones: [], specials: { shifting: 6 },
    newElement: '变色灯笼（5 秒换色）',
    name: { en: 'Shifting Glow', zh: '变色流萤' },
  },
  {
    index: 7, scene: 'night', rows: 6, cols: 7,
    time: 40, target: 2800, colors: 6,
    stones: [[5, 0], [5, 3], [5, 6]], specials: {},
    newElement: '石头配重（不可消占位）',
    name: { en: 'Stone Weights', zh: '石头配重' },
  },
  {
    index: 8, scene: 'night', rows: 6, cols: 7,
    time: 40, target: 3000, colors: 6,
    stones: [], specials: { bomb: 4 },
    newElement: '爆点灯笼（3×3 爆裂）',
    name: { en: 'Blossom Bombs', zh: '爆点烟花' },
  },
  {
    index: 9, scene: 'mist', rows: 7, cols: 7,
    time: 40, target: 3200, colors: 6,
    stones: [], specials: { timeBonus: 4 },
    newElement: '时间灯笼（补 5 秒）',
    name: { en: 'Borrowed Time', zh: '借时灯笼' },
  },
  {
    index: 10, scene: 'mist', rows: 7, cols: 7,
    time: 40, target: 3400, colors: 6,
    stones: [], specials: { double: 4 },
    newElement: '双倍灯笼（整组翻倍）',
    name: { en: 'Double Fortune', zh: '双倍吉兆' },
  },
  {
    index: 11, scene: 'mist', rows: 7, cols: 8,
    time: 45, target: 3800, colors: 6,
    stones: [], specials: {},
    newElement: '大网格 7×8',
    name: { en: 'Grand Valley', zh: '大谷晨雾' },
  },
  {
    index: 12, scene: 'mist', rows: 7, cols: 8,
    time: 45, target: 4200, colors: 6,
    stones: [[6, 1], [6, 3], [6, 5]],
    specials: { metal: 3, fire: 3, shifting: 4, chainedPairs: 1 },
    newElement: '终章综合大场面',
    name: { en: 'Festival Finale', zh: '灯节终章' },
  },
];

export const LEVEL_COUNT = LEVELS.length;
