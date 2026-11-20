// Hook & Gold · 关卡数据（12 关 3 场景）
// 场景：shallow-reef（浅礁碧海 L1-4）/ deep-blue（深蓝沉船 L5-8）/ night-sea（夜海月光 L9-12）
// 字段：index/scene/target/time + 特性开关（current 洋流 / clam 珍珠贝 / jelly 水母 /
//       dynamite 炸药桶 / blackPearl 黑珍珠 / heavy 深海拖拽变慢 / dense 物件密度 / dynamiteTool 弃钩炸药次数）
export const LEVELS = [
  { index: 1, scene: 'shallow-reef', target: 420, time: 60, current: 0, clam: false, jelly: false, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '机械锚爪发射与钟摆（常规打捞）' },
  { index: 2, scene: 'shallow-reef', target: 500, time: 60, current: 26, clam: false, jelly: false, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '洋流（物件随流缓缓横移）' },
  { index: 3, scene: 'shallow-reef', target: 560, time: 60, current: 0, clam: true, jelly: false, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '珍珠贝（会开合，闭合时钩空）' },
  { index: 4, scene: 'shallow-reef', target: 620, time: 55, current: 0, clam: false, jelly: true, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '水母群（触碰到扣时间）' },
  { index: 5, scene: 'deep-blue', target: 680, time: 55, current: 0, clam: false, jelly: false, dynamite: true, blackPearl: false, heavy: false, dense: 1.2, dynamiteTool: 2, newElement: '炸药桶（误钩会炸掉周边）' },
  { index: 6, scene: 'deep-blue', target: 740, time: 45, current: 0, clam: false, jelly: false, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '时间紧缩（倒计时更短）' },
  { index: 7, scene: 'deep-blue', target: 800, time: 55, current: 0, clam: false, jelly: false, dynamite: false, blackPearl: false, heavy: true, dense: 1.0, dynamiteTool: 2, newElement: '深海拖拽（回收更慢，逼你挑值钱的）' },
  { index: 8, scene: 'deep-blue', target: 860, time: 50, current: 0, clam: false, jelly: false, dynamite: false, blackPearl: true, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '黑珍珠（稀有高值轻物）' },
  { index: 9, scene: 'night-sea', target: 920, time: 50, current: 20, clam: true, jelly: false, dynamite: false, blackPearl: false, heavy: false, dense: 1.0, dynamiteTool: 2, newElement: '夜海月光（能见度降低，物件半影）' },
  { index: 10, scene: 'night-sea', target: 980, time: 45, current: 0, clam: false, jelly: true, dynamite: true, blackPearl: false, heavy: false, dense: 1.1, dynamiteTool: 2, newElement: '时间紧缩 + 水母 + 炸药混合' },
  { index: 11, scene: 'night-sea', target: 1040, time: 55, current: 0, clam: true, jelly: false, dynamite: false, blackPearl: true, heavy: true, dense: 1.1, dynamiteTool: 2, newElement: '综合海域（深海 + 黑珍珠 + 珍珠贝）' },
  { index: 12, scene: 'night-sea', target: 1120, time: 60, current: 20, clam: true, jelly: true, dynamite: true, blackPearl: true, heavy: true, dense: 1.35, dynamiteTool: 3, newElement: '终章综合（全要素叠加）' },
];

export const LEVEL_COUNT = LEVELS.length;

export const SCENE_KEYS = ['shallow-reef', 'deep-blue', 'night-sea'];
