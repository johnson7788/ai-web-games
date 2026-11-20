// NOTE RIDER · 关卡数据（12 关 3 章逐字落实 spec）
// 契约：docs/README.md §4。
// 字段：index / scene / name / bpm / chartDuration / leadTime / lanes /
//       noteDensity / features{hold,red,double} / bossHp / noteDamage / bossDamage /
//       skillSelect / tempoShift / newElement。
// scene 三章：dawn 晨曦弦桥 / rain 雨夜琴城 / star 星海音阶（换章必换色板构图装饰）。

export const LEVELS = [
  {
    index: 1, scene: 'dawn', name: { en: 'First Pluck', zh: '初拨琴弦' },
    bpm: 90, chartDuration: 40, leadTime: 2.5, lanes: 1,
    noteDensity: 0.55, features: { hold: false, red: false, double: false },
    bossHp: 1, noteDamage: 6, bossDamage: 10,
    skillSelect: false, tempoShift: false,
    newElement: '单音（single tap notes）',
  },
  {
    index: 2, scene: 'dawn', name: { en: 'Held Chord', zh: '长按蓄斩' },
    bpm: 95, chartDuration: 44, leadTime: 2.5, lanes: 1,
    noteDensity: 0.58, features: { hold: true, red: false, double: false },
    bossHp: 2, noteDamage: 8, bossDamage: 12,
    skillSelect: false, tempoShift: false,
    newElement: '长按蓄斩（hold notes）',
  },
  {
    index: 3, scene: 'dawn', name: { en: 'Two Strings', zh: '上下两行换轨' },
    bpm: 100, chartDuration: 46, leadTime: 2.5, lanes: 2,
    noteDensity: 0.6, features: { hold: true, red: false, double: false },
    bossHp: 3, noteDamage: 9, bossDamage: 14,
    skillSelect: false, tempoShift: false,
    newElement: '上下两行换轨（↑↓ 切换轨道）',
  },
  {
    index: 4, scene: 'dawn', name: { en: 'Counter Melody', zh: '反击红音' },
    bpm: 105, chartDuration: 48, leadTime: 2.5, lanes: 2,
    noteDensity: 0.62, features: { hold: true, red: true, double: false },
    bossHp: 3, noteDamage: 10, bossDamage: 16,
    skillSelect: false, tempoShift: false,
    newElement: '反击 note（红色必须躲）',
  },
  {
    index: 5, scene: 'rain', name: { en: 'Skill Forge', zh: '技能三选一' },
    bpm: 108, chartDuration: 50, leadTime: 2.5, lanes: 2,
    noteDensity: 0.64, features: { hold: true, red: true, double: false },
    bossHp: 4, noteDamage: 11, bossDamage: 18,
    skillSelect: true, tempoShift: false,
    newElement: '技能三选一升级点（护盾/爆发/吸血）',
  },
  {
    index: 6, scene: 'rain', name: { en: 'Tempo Shift', zh: '变速乐章' },
    bpm: 118, chartDuration: 50, leadTime: 2.5, lanes: 2,
    noteDensity: 0.66, features: { hold: true, red: true, double: false },
    bossHp: 4, noteDamage: 12, bossDamage: 20,
    skillSelect: false, tempoShift: true,
    newElement: '变速乐章（更快 BPM + 中途视觉加速）',
  },
  {
    index: 7, scene: 'rain', name: { en: 'Double Strike', zh: '双音连击' },
    bpm: 120, chartDuration: 52, leadTime: 2.5, lanes: 2,
    noteDensity: 0.68, features: { hold: true, red: true, double: true },
    bossHp: 5, noteDamage: 13, bossDamage: 22,
    skillSelect: false, tempoShift: false,
    newElement: '双音 note（double，快速连击两下）',
  },
  {
    index: 8, scene: 'rain', name: { en: 'Rain Ascends', zh: '再选强化' },
    bpm: 124, chartDuration: 54, leadTime: 2.5, lanes: 2,
    noteDensity: 0.7, features: { hold: true, red: true, double: true },
    bossHp: 5, noteDamage: 14, bossDamage: 24,
    skillSelect: true, tempoShift: false,
    newElement: '第二次技能三选一强化',
  },
  {
    index: 9, scene: 'star', name: { en: 'Starlight Bridge', zh: '星海换轨' },
    bpm: 126, chartDuration: 54, leadTime: 2.5, lanes: 2,
    noteDensity: 0.72, features: { hold: true, red: true, double: true },
    bossHp: 6, noteDamage: 15, bossDamage: 26,
    skillSelect: false, tempoShift: false,
    newElement: '星海场景 + 密集换轨',
  },
  {
    index: 10, scene: 'star', name: { en: 'Counter Cascade', zh: '反击连弹' },
    bpm: 128, chartDuration: 56, leadTime: 2.5, lanes: 2,
    noteDensity: 0.74, features: { hold: true, red: true, double: true },
    bossHp: 6, noteDamage: 16, bossDamage: 28,
    skillSelect: false, tempoShift: false,
    newElement: '红音 + 双音混合连弹',
  },
  {
    index: 11, scene: 'star', name: { en: 'Final Forte', zh: '终极强化' },
    bpm: 132, chartDuration: 56, leadTime: 2.5, lanes: 2,
    noteDensity: 0.76, features: { hold: true, red: true, double: true },
    bossHp: 7, noteDamage: 18, bossDamage: 30,
    skillSelect: true, tempoShift: false,
    newElement: '第三次技能三选一强化',
  },
  {
    index: 12, scene: 'star', name: { en: 'The Silent Demon King', zh: '寂静魔王' },
    bpm: 136, chartDuration: 60, leadTime: 2.5, lanes: 2,
    noteDensity: 0.8, features: { hold: true, red: true, double: true },
    bossHp: 10, noteDamage: 20, bossDamage: 34,
    skillSelect: false, tempoShift: false,
    newElement: '终章 Boss 寂静魔王（高血量 + 全机制叠加）',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export const SCENES = ['dawn', 'rain', 'star'];
