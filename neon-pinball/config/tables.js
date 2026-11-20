// NEON PINBALL · 12 台台面参数（每台目标分 + 机关轮换；位置由 src/game/table.js 用 seed 生成）
// scene: 1 电玩厅粉紫 / 2 主机房青蓝 / 3 霓虹雨街橙红（换章必换）
export const TABLES = [
  { index: 1, targetScore: 1500, scene: 1, bumpers: 4, targets: 3, ramps: 0, magnets: 0, blackHoles: 0, doubleBall: false, rotatingFlipper: false, narrowOutlanes: false, movingTargets: false,
    newElement: '基础台：推杆发射 + 左右挡板 + 电容球 bumper + 目标灯 + 超导灯（教核心循环）' },
  { index: 2, targetScore: 2000, scene: 1, bumpers: 5, targets: 4, ramps: 1, magnets: 0, blackHoles: 0, doubleBall: false, rotatingFlipper: false, narrowOutlanes: false, movingTargets: false,
    newElement: '回球坡道：新增左回球道，把球送回上方' },
  { index: 3, targetScore: 2500, scene: 1, bumpers: 5, targets: 4, ramps: 1, magnets: 0, blackHoles: 1, doubleBall: false, rotatingFlipper: false, narrowOutlanes: false, movingTargets: false,
    newElement: '黑洞孔：周期开合，吸入 5s 后从随机喷射口射回（风险机位）' },
  { index: 4, targetScore: 3000, scene: 2, bumpers: 5, targets: 5, ramps: 2, magnets: 0, blackHoles: 1, doubleBall: false, rotatingFlipper: false, narrowOutlanes: false, movingTargets: false,
    newElement: '顶环任务链：双坡道把球送上顶环抢超导' },
  { index: 5, targetScore: 3500, scene: 2, bumpers: 5, targets: 5, ramps: 2, magnets: 1, blackHoles: 1, doubleBall: false, rotatingFlipper: false, narrowOutlanes: false, movingTargets: false,
    newElement: '磁力区：把球吸过去（改变落点路线）' },
  { index: 6, targetScore: 4000, scene: 2, bumpers: 6, targets: 5, ramps: 2, magnets: 1, blackHoles: 1, doubleBall: false, rotatingFlipper: true, narrowOutlanes: false, movingTargets: false,
    newElement: '旋转挡板：中央新增一个持续摆动的旋转挡板' },
  { index: 7, targetScore: 4500, scene: 2, bumpers: 6, targets: 6, ramps: 3, magnets: 1, blackHoles: 1, doubleBall: true, rotatingFlipper: true, narrowOutlanes: false, movingTargets: false,
    newElement: '双球：开局双球 + 坡道任务链连击 ×2' },
  { index: 8, targetScore: 5000, scene: 3, bumpers: 6, targets: 6, ramps: 3, magnets: 1, blackHoles: 1, doubleBall: true, rotatingFlipper: true, narrowOutlanes: false, movingTargets: true,
    newElement: '移动目标灯：目标横向移动，命中时机要求提高' },
  { index: 9, targetScore: 5500, scene: 3, bumpers: 7, targets: 6, ramps: 3, magnets: 2, blackHoles: 1, doubleBall: true, rotatingFlipper: true, narrowOutlanes: false, movingTargets: true,
    newElement: '双磁力区：两侧磁力拉扯，路线更难预测' },
  { index: 10, targetScore: 6000, scene: 3, bumpers: 7, targets: 7, ramps: 4, magnets: 2, blackHoles: 2, doubleBall: true, rotatingFlipper: true, narrowOutlanes: false, movingTargets: true,
    newElement: '双黑洞：两个黑洞周期交错开合' },
  { index: 11, targetScore: 6500, scene: 3, bumpers: 7, targets: 7, ramps: 4, magnets: 2, blackHoles: 2, doubleBall: true, rotatingFlipper: true, narrowOutlanes: true, movingTargets: true,
    newElement: '窄 outlane：两侧回球道收窄，掉球风险大增' },
  { index: 12, targetScore: 8000, scene: 3, bumpers: 8, targets: 8, ramps: 4, magnets: 2, blackHoles: 2, doubleBall: true, rotatingFlipper: true, narrowOutlanes: true, movingTargets: true,
    newElement: '终局全要素：高目标分 + 全机关全开' },
];

export const TABLE_COUNT = TABLES.length;

export function tableAt(index) {
  return TABLES[Math.max(0, Math.min(TABLE_COUNT - 1, index - 1))];
}
