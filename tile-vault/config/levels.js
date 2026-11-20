// Tile Vault · 关卡参数（M1 拥有）
// 契约：docs/README.md §4。宝库堆由 src/game/level.js 的生成器 + 回溯求解器保证无道具可解。
// 字段：index/scene/types/layers/grid{x,z}/shape/trayCap/time/seed/difficulty/
//       items{undo,shuffle}/revives/timed/fakeLock/newElement。
// 三轴：品类 6→12、层数 2→6、槽位 7→6；三场景：vault(地下金库)/tomb(古墓回廊)/dragon(龙巢宝山)。

const name = (en, zh) => ({ en, zh });

export const LEVELS = [
  {
    index: 1, scene: 'vault', name: name('First Touch', '初探宝库'),
    types: 6, layers: 2, grid: { x: 6, z: 3 }, shape: 'pyramid', trayCap: 7,
    time: 90, seed: 101, difficulty: 1, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '压顶层 + 三同消除基础循环',
  },
  {
    index: 2, scene: 'vault', name: name('Deeper Stack', '叠得更深'),
    types: 7, layers: 3, grid: { x: 6, z: 5 }, shape: 'pyramid', trayCap: 7,
    time: 90, seed: 202, difficulty: 1.5, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '层数加深（3 层）',
  },
  {
    index: 3, scene: 'vault', name: name('Crowded Gold', '拥挤的金库'),
    types: 8, layers: 3, grid: { x: 6, z: 6 }, shape: 'pyramid', trayCap: 7,
    time: 95, seed: 303, difficulty: 2.2, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '品类 8 种，堆更宽更密',
  },
  {
    index: 4, scene: 'vault', name: name('The Deep Well', '深井层'),
    types: 8, layers: 5, grid: { x: 6, z: 5 }, shape: 'well', trayCap: 7,
    time: 95, seed: 404, difficulty: 3, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '深井层：中央深柱纵向 5 层',
  },
  {
    index: 5, scene: 'tomb', name: name('Twin Stacks', '分区双堆'),
    types: 9, layers: 3, grid: { x: 6, z: 6 }, shape: 'dual', trayCap: 7,
    time: 100, seed: 505, difficulty: 3.6, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '分区双堆：两座独立宝山并排',
  },
  {
    index: 6, scene: 'tomb', name: name('Fake Lock', '假锁'),
    types: 9, layers: 3, grid: { x: 6, z: 5 }, shape: 'pyramid', trayCap: 7,
    time: 100, seed: 606, difficulty: 4, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: true, newElement: '假锁：锁样块需先挖侧翼（视觉误导）',
  },
  {
    index: 7, scene: 'tomb', name: name('Guard Alarm', '守卫警报'),
    types: 10, layers: 3, grid: { x: 6, z: 5 }, shape: 'pyramid', trayCap: 7,
    time: 55, seed: 707, difficulty: 4.6, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: true, fakeLock: false, newElement: '限时：倒计时大幅收紧',
  },
  {
    index: 8, scene: 'tomb', name: name('Tools of the Trade', '道具关'),
    types: 10, layers: 3, grid: { x: 6, z: 6 }, shape: 'pyramid', trayCap: 7,
    time: 100, seed: 808, difficulty: 5, items: { undo: 2, shuffle: 1 }, revives: 2,
    timed: false, fakeLock: false, newElement: '道具关：撤回×2 + 洗牌×1',
  },
  {
    index: 9, scene: 'dragon', name: name('Tight Slot', '收窄的槽'),
    types: 11, layers: 5, grid: { x: 6, z: 5 }, shape: 'well', trayCap: 6,
    time: 105, seed: 909, difficulty: 5.4, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '深井层升级 + 槽位 7→6',
  },
  {
    index: 10, scene: 'dragon', name: name('Twin Hoards', '双宝山'),
    types: 11, layers: 3, grid: { x: 6, z: 6 }, shape: 'dual', trayCap: 6,
    time: 105, seed: 1010, difficulty: 5.8, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: false, newElement: '分区双堆升级 + 品类 11',
  },
  {
    index: 11, scene: 'dragon', name: name('Dragon Wards', '龙印假锁'),
    types: 12, layers: 3, grid: { x: 6, z: 6 }, shape: 'pyramid', trayCap: 6,
    time: 110, seed: 1111, difficulty: 6, items: { undo: 0, shuffle: 0 }, revives: 2,
    timed: false, fakeLock: true, newElement: '假锁升级 + 品类 12',
  },
  {
    index: 12, scene: 'dragon', name: name('Dragon Hoard', '龙巢宝山'),
    types: 12, layers: 6, grid: { x: 6, z: 6 }, shape: 'well', trayCap: 6,
    time: 110, seed: 1212, difficulty: 6.5, items: { undo: 1, shuffle: 1 }, revives: 2,
    timed: false, fakeLock: false, newElement: '龙巢终局：6 层 + 12 品类 + 6 槽三轴叠加',
  },
];

export const LEVEL_COUNT = LEVELS.length;
