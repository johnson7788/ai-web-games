// cell-wars · 12 皿定义（推进结构）
// 每皿：地图形状 / 初始布局 / 中立堡垒 / 病毒风暴 / AI 强度 轮换；每关恰好一个新元素。
// scenePack: 0=经典皿(青白) 1=抗性皿(金紫) 2=变异皿(红黑)

export const SCENE_PACKS = [
  { id: 'classic', nameKey: 'scene.classic' },
  { id: 'resistance', nameKey: 'scene.resistance' },
  { id: 'mutation', nameKey: 'scene.mutation' },
];

export const DISHES = [
  { index: 1,  size: 7, scenePack: 0, maxRounds: 24, aiStrength: 0.14, fortressCount: 0, fortressDef: 2, virusEvery: 0, enemyStartDef: 1, scatter: 0, holes: [],
    newElement: '基础感染：点击相邻敌格/中立格，按邻接己方数量决定感染力' },
  { index: 2,  size: 7, scenePack: 0, maxRounds: 24, aiStrength: 0.20, fortressCount: 2, fortressDef: 2, virusEvery: 0, enemyStartDef: 1, scatter: 0, holes: [],
    newElement: '中立堡垒：带防御的灰菌落，需更高感染力才能占领' },
  { index: 3,  size: 8, scenePack: 0, maxRounds: 26, aiStrength: 0.26, fortressCount: 4, fortressDef: 2, virusEvery: 0, enemyStartDef: 1, scatter: 0, holes: [],
    newElement: '更大皿盘 + 更多堡垒，AI 开始用一步前瞻' },
  { index: 4,  size: 8, scenePack: 0, maxRounds: 26, aiStrength: 0.32, fortressCount: 3, fortressDef: 3, virusEvery: 4, enemyStartDef: 1, scatter: 0, holes: [],
    newElement: '病毒风暴：每 4 回合一个随机格突变为中立' },
  { index: 5,  size: 8, scenePack: 1, maxRounds: 26, aiStrength: 0.40, fortressCount: 2, fortressDef: 2, virusEvery: 0, enemyStartDef: 2, scatter: 0, holes: [],
    newElement: '抗性皿（金紫）：敌方菌落自带 2 级防御' },
  { index: 6,  size: 8, scenePack: 1, maxRounds: 26, aiStrength: 0.46, fortressCount: 4, fortressDef: 3, virusEvery: 0, enemyStartDef: 2, scatter: 0, holes: [[3, 3], [3, 4], [4, 3], [4, 4]],
    newElement: '环形地图：中心空洞不可占领' },
  { index: 7,  size: 9, scenePack: 1, maxRounds: 28, aiStrength: 0.52, fortressCount: 5, fortressDef: 3, virusEvery: 4, enemyStartDef: 2, scatter: 0, holes: [],
    newElement: '更大战场 + 病毒风暴叠加' },
  { index: 8,  size: 9, scenePack: 1, maxRounds: 28, aiStrength: 0.58, fortressCount: 4, fortressDef: 4, virusEvery: 0, enemyStartDef: 2, scatter: 0, holes: [],
    newElement: '高防御堡垒（4 级）' },
  { index: 9,  size: 9, scenePack: 2, maxRounds: 28, aiStrength: 0.62, fortressCount: 4, fortressDef: 3, virusEvery: 4, enemyStartDef: 2, scatter: 3, holes: [],
    newElement: '变异皿（红黑）：开局随机多占格（散菌）' },
  { index: 10, size: 9, scenePack: 2, maxRounds: 28, aiStrength: 0.68, fortressCount: 5, fortressDef: 4, virusEvery: 4, enemyStartDef: 2, scatter: 4, holes: [[4, 4], [3, 4], [5, 4], [4, 3], [4, 5]],
    newElement: '十字空洞地图' },
  { index: 11, size: 9, scenePack: 2, maxRounds: 30, aiStrength: 0.74, fortressCount: 5, fortressDef: 4, virusEvery: 3, enemyStartDef: 3, scatter: 5, holes: [],
    newElement: '病毒风暴频繁（每 3 回合）' },
  { index: 12, size: 9, scenePack: 2, maxRounds: 30, aiStrength: 0.82, fortressCount: 6, fortressDef: 4, virusEvery: 3, enemyStartDef: 3, scatter: 6, holes: [],
    newElement: '终局：密集堡垒 + 最强 AI' },
];

export const DISH_COUNT = DISHES.length;

export function dishAt(index) {
  return DISHES[Math.max(0, Math.min(DISH_COUNT - 1, index - 1))];
}

export function scenePackAt(index) {
  const d = dishAt(index);
  return SCENE_PACKS[d.scenePack] || SCENE_PACKS[0];
}
