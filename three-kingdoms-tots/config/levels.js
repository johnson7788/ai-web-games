// 卡牌 + 战役配置（Lead 拥有；数值改动只改这里）
// 卡牌：id / nameKey / cost(能量) / kind / 属性 / 特效
// kind: troop(近战兵) ranged(远程) cavalry(骑兵) general(武将) machine(器械) spell(法术) building(建筑)
export const CARDS = [
  { id: 'militia',   cost: 1, kind: 'troop',   hp: 92,  atk: 12, range: 36,  cd: 1.0, speed: 80, aoe: 0,  color: '#E8703A', label: '盾' },
  { id: 'archer',    cost: 2, kind: 'ranged',  hp: 60,  atk: 13, range: 150, cd: 1.1, speed: 60, aoe: 0,  color: '#E0A23C', label: '弓' },
  { id: 'cavalry',   cost: 3, kind: 'cavalry', hp: 130, atk: 18, range: 38,  cd: 1.2, speed: 130, aoe: 0, color: '#C96A2E', label: '骑' },
  { id: 'general',   cost: 4, kind: 'general', hp: 340, atk: 30, range: 46,  cd: 1.4, speed: 70, aoe: 0,  color: '#D9342B', label: '将' },
  { id: 'catapult',  cost: 5, kind: 'machine', hp: 140, atk: 40, range: 210, cd: 3.0, speed: 45, aoe: 62, color: '#8A6A40', label: '石' },
  { id: 'fire',      cost: 2, kind: 'spell',   hp: 0,   atk: 70, range: 0,   cd: 6.0, speed: 0,  aoe: 90, color: '#F06030', label: '火' },
  { id: 'heal',      cost: 2, kind: 'spell',   hp: 0,   atk: 130, range: 0,  cd: 9.0, speed: 0,  aoe: 150, color: '#4CC46A', label: '愈' },
  { id: 'rock',      cost: 2, kind: 'building',hp: 260, atk: 0,  range: 0,   cd: 8.0, speed: 0,  aoe: 0,  color: '#6E7A8A', label: '岩' },
  { id: 'frost',     cost: 3, kind: 'spell',   hp: 0,   atk: 24, range: 0,   cd: 8.0, speed: 0,  aoe: 110, color: '#5BC4E8', label: '冰' },
];

export const CARD_MAP = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// 战役：每关一个新的敌方元素；敌军卡组 + 主城血量 + 敌方单位等级
export const LEVELS = [
  {
    index: 1,
    nameKey: 'battle1',
    keepPlayerHp: 1000,
    keepEnemyHp: 600,
    enemyLevel: 1,
    enemyDeck: ['militia', 'archer'],
    enemyRush: false,
    preRocks: 0,
    scene: 'dawn',
    tutorial: true,
    teachSteps: ['deploy', 'fight', 'combo'],
  },
  {
    index: 2,
    nameKey: 'battle2',
    keepPlayerHp: 1000,
    keepEnemyHp: 850,
    enemyLevel: 1,
    enemyDeck: ['militia', 'archer', 'cavalry', 'rock'],
    enemyRush: false,
    preRocks: 1,
    scene: 'dusk',
    tutorial: false,
    teachSteps: [],
  },
  {
    index: 3,
    nameKey: 'battle3',
    keepPlayerHp: 1000,
    keepEnemyHp: 1250,
    enemyLevel: 2,
    enemyDeck: ['militia', 'cavalry', 'general', 'catapult', 'rock'],
    enemyRush: true,
    preRocks: 2,
    scene: 'night',
    tutorial: false,
    teachSteps: [],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(i) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0))];
}
