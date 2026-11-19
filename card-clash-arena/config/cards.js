// 卡池：28 张原创霓虹斗士（名称/配色/文案均为原创，不来自参考源码）。
// attributes = [POWER 战力, VITALITY 活力, SPEED 速度]，数值范围 ≈250–500。
// 玩法骨架沿用参考的「三属性比牌 + 百分比伤害」，但角色与数值全部重做。
export const CARDS = [
  { name: { en: 'Neon Ronin', zh: '霓虹浪人' }, color: '#ff2d78', stats: [490, 346, 402], flavor: { en: 'A blade that hums in the dark.', zh: '黑暗中嗡鸣的刀刃。' } },
  { name: { en: 'Circuit Sage', zh: '电路贤者' }, color: '#609ffc', stats: [346, 490, 474], flavor: { en: 'Knows every wire by heart.', zh: '对每根线路了如指掌。' } },
  { name: { en: 'Volt Vandal', zh: '伏特破坏王' }, color: '#ffb020', stats: [426, 450, 354], flavor: { en: 'Tags the grid for fun.', zh: '以涂鸦电网为乐。' } },
  { name: { en: 'Pixel Paladin', zh: '像素圣骑' }, color: '#38c172', stats: [450, 394, 306], flavor: { en: 'Armor rendered in 8-bit faith.', zh: '以 8-bit 信仰铸甲。' } },
  { name: { en: 'Glitch Golem', zh: '故障魔像' }, color: '#9b59b6', stats: [274, 402, 450], flavor: { en: 'Solid, until it is not.', zh: '坚不可摧，直到崩解。' } },
  { name: { en: 'Chrome Valkyrie', zh: '铬金女武神' }, color: '#aeb6c2', stats: [434, 482, 258], flavor: { en: 'Polished wings, cold judgment.', zh: '磨亮的羽翼，冷静的裁决。' } },
  { name: { en: 'Neon Djinn', zh: '霓虹灯神' }, color: '#8e44ad', stats: [410, 458, 490], flavor: { en: 'Three wishes, all electric.', zh: '三个愿望，全都带电。' } },
  { name: { en: 'Holo Hare', zh: '全息灵兔' }, color: '#00d2ff', stats: [474, 378, 458], flavor: { en: 'Faster than the frame rate.', zh: '比帧率更快。' } },
  { name: { en: 'Vapor Wraith', zh: '蒸汽幽灵' }, color: '#7f8c8d', stats: [322, 290, 266], flavor: { en: 'Appears only in the afterglow.', zh: '只现身于余辉之中。' } },
  { name: { en: 'Tetra Titan', zh: '四面泰坦' }, color: '#e74c3c', stats: [290, 274, 330], flavor: { en: 'Four sides, no mercy.', zh: '四面俱全，不留情面。' } },
  { name: { en: 'Synth Samurai', zh: '合成武士' }, color: '#f1c40f', stats: [418, 418, 346], flavor: { en: 'Cuts to the beat.', zh: '跟着节拍出刀。' } },
  { name: { en: 'Laser Lancer', zh: '激光枪骑' }, color: '#e91e63', stats: [482, 474, 370], flavor: { en: 'Charge first, aim never.', zh: '先冲刺，从不需要瞄准。' } },
  { name: { en: 'Grid Reaper', zh: '网格收割者' }, color: '#e67e22', stats: [362, 258, 466], flavor: { en: 'Scythes rows like wheat.', zh: '像割麦一样收割行与列。' } },
  { name: { en: 'Plasma Pixie', zh: '等离子小妖' }, color: '#2ecc71', stats: [250, 250, 298], flavor: { en: 'Tiny, bright, and vicious.', zh: '小小一只，又亮又凶。' } },
  { name: { en: 'Prism Warden', zh: '棱镜守卫' }, color: '#3498db', stats: [370, 426, 482], flavor: { en: 'Splits light into shields.', zh: '把光折成护盾。' } },
  { name: { en: 'Static Shogun', zh: '静电将军' }, color: '#8e44ad', stats: [386, 282, 290], flavor: { en: 'Commands a crackling army.', zh: '统率一支噼啪作响的大军。' } },
  { name: { en: 'Frost Drifter', zh: '冰霜游侠' }, color: '#1abc9c', stats: [378, 434, 322], flavor: { en: 'Leaves winter in its wake.', zh: '身后只留下寒冬。' } },
  { name: { en: 'Neon Maw', zh: '霓虹巨口' }, color: '#f39c12', stats: [306, 330, 314], flavor: { en: 'One big bite of the grid.', zh: '对电网就是一大口。' } },
  { name: { en: 'Spark Sphinx', zh: '电光狮身兽' }, color: '#c0392b', stats: [394, 338, 442], flavor: { en: 'Riddles delivered at 60Hz.', zh: '以 60Hz 频发谜题。' } },
  { name: { en: 'Echo Enforcer', zh: '回声执法者' }, color: '#2c3e50', stats: [466, 498, 378], flavor: { en: 'Justice, on repeat.', zh: '正义，循环播放。' } },
  { name: { en: 'Chrome Merc', zh: '铬金佣兵' }, color: '#7f6b3c', stats: [354, 314, 386], flavor: { en: 'Sold to the highest bidder.', zh: '价高者得。' } },
  { name: { en: 'Voltaic Viper', zh: '伏特毒蛇' }, color: '#16a085', stats: [402, 442, 394], flavor: { en: 'Strikes once, then strikes again.', zh: '一击接一击。' } },
  { name: { en: 'Neon Umpire', zh: '霓虹裁判' }, color: '#7f8c8d', stats: [258, 370, 418], flavor: { en: 'Every call is final.', zh: '每个判罚都是最终裁定。' } },
  { name: { en: 'Pixel Brawler', zh: '像素拳手' }, color: '#e74c3c', stats: [266, 306, 250], flavor: { en: 'Throws hands in sprites.', zh: '用精灵图挥拳。' } },
  { name: { en: 'Holo Warden', zh: '全息狱长' }, color: '#2980b9', stats: [298, 266, 410], flavor: { en: 'Cells of pure light.', zh: '纯粹由光构成的牢房。' } },
  { name: { en: 'Raster Ronin', zh: '光栅浪人' }, color: '#d35400', stats: [442, 354, 498], flavor: { en: 'Draws its blade in lines.', zh: '以线条拔出刀刃。' } },
  { name: { en: 'Quiet Current', zh: '静默电流' }, color: '#34495e', stats: [282, 410, 426], flavor: { en: 'You never hear the surge.', zh: '你永远听不到那阵电涌。' } },
  { name: { en: 'Overclock Brute', zh: '超频蛮兽' }, color: '#a93226', stats: [458, 322, 434], flavor: { en: 'Redlines the whole arena.', zh: '让整座竞技场满负荷运转。' } },
];

export const ATTR_KEYS = ['power', 'vitality', 'speed'];
