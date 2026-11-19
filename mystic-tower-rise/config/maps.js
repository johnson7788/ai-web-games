// 魔塔玩法数据（P0 1:1 保留战斗/钥匙门/宝石药水/商店/楼梯的规则骨架，主题全面换皮为霓虹街机）
// 地图图例：
//   # 墙    . 地板   P 起始(仅1层)   ^ 上楼   v 下楼
//   Y/B/R 黄/蓝/红门   y/b/r 黄/蓝/红钥匙
//   a 攻击宝石   d 防御宝石   q 小红瓶   Q 大蓝瓶
//   s/S/G 铁/银/金剑(+攻)   t/T/F 铁/银/金盾(+防)
//   k 磁能镐(破水晶)   C 能量水晶(挡路, 破开得核心)   ! 传送星门(成对)
//   $ 商店   N 提示NPC   x 能量尖刺(踩上掉血)
//   1~9/V/L 怪物    @ 首领
export const START = {
  hp: 400,
  atk: 10,
  def: 10,
  gold: 0,
  yellow: 0,
  blue: 0,
  red: 0,
  pick: 0,
  x: 1,
  y: 1,
};

export const GAME = {
  SPIKE_DAMAGE: 70,
  CRYSTAL_BONUS_ATK: 5,
  CRYSTAL_BONUS_DEF: 5,
  COMBO_GOLD_MULT: 2,   // 完美击杀双倍金币
  SHOP: { beginGold: 20, ratio: 20, hp: 100, atk: 2, def: 4 },
};

export const MONSTERS = {
  '1': { id: 'slime',   name: { en: 'Neon Slime',    zh: '霓虹史莱姆' }, hp: 20,  atk: 8,  def: 1,  gold: 3 },
  '2': { id: 'bat',     name: { en: 'Volt Bat',      zh: '伏特蝙蝠' },   hp: 30,  atk: 14, def: 3,  gold: 5 },
  '3': { id: 'golem',   name: { en: 'Chrome Golem',  zh: '铬金魔像' },   hp: 55,  atk: 20, def: 6,  gold: 9 },
  '4': { id: 'skeleton',name: { en: 'Data Skull',    zh: '数据骷髅' },   hp: 50,  atk: 24, def: 8,  gold: 10 },
  '5': { id: 'mage',    name: { en: 'Pixel Mage',    zh: '像素法师' },   hp: 65,  atk: 32, def: 10, gold: 14 },
  '6': { id: 'brute',   name: { en: 'Iron Brute',    zh: '铁甲蛮兵' },   hp: 110, atk: 38, def: 14, gold: 20 },
  '7': { id: 'wraith',  name: { en: 'Ghost Wraith',  zh: '幽灵怨魂' },   hp: 100, atk: 46, def: 16, gold: 24 },
  '8': { id: 'knight',  name: { en: 'Neon Knight',   zh: '霓虹骑士' },   hp: 130, atk: 56, def: 20, gold: 30 },
  '9': { id: 'guard',   name: { en: 'Core Guard',    zh: '核心卫兵' },   hp: 150, atk: 50, def: 28, gold: 32 },
  'V': { id: 'vampire', name: { en: 'Volt Vampire',  zh: '高压吸血鬼' }, hp: 200, atk: 74, def: 24, gold: 45 },
  'L': { id: 'dragon',  name: { en: 'Neon Dragon',   zh: '霓虹魔龙' },   hp: 260, atk: 90, def: 32, gold: 80 },
  '@': { id: 'boss',    name: { en: 'Tower Overlord',zh: '高塔霸主' },   hp: 460, atk: 82, def: 26, gold: 200, boss: true },
};

// 道具：kind 决定拾取后的效果
export const PROPS = {
  'a': { id: 'gemAtk',   kind: 'gem',    value: 3,   name: { en: 'Power Core',  zh: '力量核心' } },
  'd': { id: 'gemDef',   kind: 'gem',    value: 3,   name: { en: 'Guard Core',  zh: '守护核心' } },
  'q': { id: 'potRed',   kind: 'potion', value: 60,  name: { en: 'Nano Vial',   zh: '纳米小瓶' } },
  'Q': { id: 'potBlue',  kind: 'potion', value: 180, name: { en: 'Mega Vial',   zh: '超级大瓶' } },
  's': { id: 'sword1',   kind: 'sword',   value: 8,  name: { en: 'Iron Blade',  zh: '铁刃' } },
  'S': { id: 'sword2',   kind: 'sword',   value: 16, name: { en: 'Silver Blade',zh: '银刃' } },
  'G': { id: 'sword3',   kind: 'sword',   value: 30, name: { en: 'Gold Blade',  zh: '金刃' } },
  't': { id: 'shield1',  kind: 'shield',  value: 8,  name: { en: 'Iron Aegis',  zh: '铁盾' } },
  'T': { id: 'shield2',  kind: 'shield',  value: 16, name: { en: 'Silver Aegis',zh: '银盾' } },
  'F': { id: 'shield3',  kind: 'shield',  value: 30, name: { en: 'Gold Aegis',  zh: '金盾' } },
  'y': { id: 'keyY',     kind: 'key',     key: 'yellow', value: 1, name: { en: 'Yellow Key', zh: '黄钥匙' } },
  'b': { id: 'keyB',     kind: 'key',     key: 'blue',   value: 1, name: { en: 'Blue Key',   zh: '蓝钥匙' } },
  'r': { id: 'keyR',     kind: 'key',     key: 'red',    value: 1, name: { en: 'Red Key',    zh: '红钥匙' } },
  'k': { id: 'pick',     kind: 'pick',    value: 2,   name: { en: 'Magnet Pick',zh: '磁能镐' } },
};

export const DOORS = {
  'Y': { id: 'yellow', key: 'yellow', name: { en: 'Yellow Gate', zh: '黄色闸门' } },
  'B': { id: 'blue',   key: 'blue',   name: { en: 'Blue Gate',   zh: '蓝色闸门' } },
  'R': { id: 'red',    key: 'red',    name: { en: 'Red Gate',    zh: '红色闸门' } },
};

export const HINTS = [
  { en: 'Grab the yellow key, then open the yellow gate to climb.', zh: '拿到黄钥匙，打开黄色闸门才能上楼。' },
  { en: 'Perfect kills (no damage taken) double your gold.', zh: '无伤击杀（完美连击）金币翻倍。' },
  { en: 'Star gates teleport you across the floor. Red gate needs the red key.', zh: '星门能跨层传送；红色闸门需要红钥匙。' },
  { en: 'Crystal walls block the way — spend the magnet pick to break them.', zh: '能量水晶挡路，用磁能镐可以破开。' },
  { en: 'Defeat the Tower Overlord to claim the spire.', zh: '击败高塔霸主，夺下这座塔。' },
];

// 5 层霓虹塔（每层 11×11）
export const MAPS = [
  // 第 1 层：黄门教学
  [
    '###########',
    '#P..a.y...#',
    '#..s...d..#',
    '#.q.......#',
    '#...t..N..#',
    '#....Y....#',
    '#...1.....#',
    '#...2..q..#',
    '#..d...s..#',
    '#..x.....^#',
    '###########',
  ],
  // 第 2 层：蓝门 + 无伤连击
  [
    '###########',
    '#v..b.d...#',
    '#..a...2..#',
    '#.q.......#',
    '#...4..N..#',
    '#....B....#',
    '#...3..q..#',
    '#..t..d...#',
    '#...1..s..#',
    '#..x.2...^#',
    '###########',
  ],
  // 第 3 层：红门 + 传送星门 + 商店
  [
    '###########',
    '#v..r....!#',
    '#..a...5..#',
    '#.q..d....#',
    '#...$.....#',
    '#....R....#',
    '#...5..q..#',
    '#..t..$...#',
    '#...6..s..#',
    '#!....6..^#',
    '###########',
  ],
  // 第 4 层：怪物门 + 能量水晶/磁能镐 + 尖刺
  [
    '###########',
    '#v..k..7..#',
    '#..a...d..#',
    '#.q.......#',
    '#...C..N..#',
    '#....8....#',
    '#...C..q..#',
    '#..t...7..#',
    '#.x...G...#',
    '#...x....^#',
    '###########',
  ],
  // 第 5 层：首领决战
  [
    '###########',
    '#v..a.....#',
    '#..a...d..#',
    '#.q...Q...#',
    '#...F...N.#',
    '#....@....#',
    '#...Q..q..#',
    '#..d...a..#',
    '#.x...S...#',
    '#...x.....#',
    '###########',
  ],
];
