// PULSE TAP · 关卡数据（12 关 3 章）
// 每关一段 45–60s 程序化谱面（seeded，与内置节拍锁相），特性逐关递进：
// 单点 → 双轨交替 → 长按 → 滑键 → 变速 → 密度爬升 → 假 note → 和弦 → 律动耐力 →
// 切分 → 冲刺 → 终章全曲。
// 字段：index/scene/bpm/durationSec/density/lanes/pattern/holdP/slideP/fakeP/chordP/
//       segments(可选，变速段)/newElement/name。
// density = 目标每秒 note 数；pattern = 轨道分配策略（single|alt2|alt4|chord|free）。

export const LEVELS = [
  {
    index: 1, scene: 'neon-bar', bpm: 120, durationSec: 45, density: 1.1,
    pattern: 'single', lanes: [0, 1, 2, 3],
    holdP: 0, slideP: 0, fakeP: 0, chordP: 0,
    newElement: '单点 pulse：四轨能量条下落，到判定线点击',
    name: { en: 'First Pulse', zh: '第一束脉冲' },
  },
  {
    index: 2, scene: 'neon-bar', bpm: 120, durationSec: 45, density: 1.3,
    pattern: 'alt2', lanes: [0, 1, 2, 3],
    holdP: 0, slideP: 0, fakeP: 0, chordP: 0,
    newElement: '双轨交替：左右两条能量条来回切',
    name: { en: 'Left, Right', zh: '左一下，右一下' },
  },
  {
    index: 3, scene: 'neon-bar', bpm: 120, durationSec: 48, density: 1.2,
    pattern: 'alt4', lanes: [0, 1, 2, 3],
    holdP: 0.24, slideP: 0, fakeP: 0, chordP: 0,
    newElement: '长按 note：按住持续发光，提前松开会断连',
    name: { en: 'Hold The Glow', zh: '按住这束光' },
  },
  {
    index: 4, scene: 'neon-bar', bpm: 122, durationSec: 48, density: 1.3,
    pattern: 'free', lanes: [0, 1, 2, 3],
    holdP: 0.1, slideP: 0.22, fakeP: 0, chordP: 0,
    newElement: '滑键：相邻轨滑接，连上触发 slideChain',
    name: { en: 'Slide Chain', zh: '滑键连锁' },
  },
  {
    index: 5, scene: 'rooftop-electro', bpm: 128, durationSec: 50, density: 1.3,
    pattern: 'alt4', lanes: [0, 1, 2, 3],
    holdP: 0.12, slideP: 0.1, fakeP: 0, chordP: 0,
    segments: [
      { t: 0, density: 1.1 },
      { t: 18, density: 2.4 },
      { t: 34, density: 1.2 },
    ],
    newElement: '变速段：中段谱面加速，节奏突然变快',
    name: { en: 'Tempo Shift', zh: '变速段落' },
  },
  {
    index: 6, scene: 'rooftop-electro', bpm: 132, durationSec: 50, density: 1.8,
    pattern: 'free', lanes: [0, 1, 2, 3],
    holdP: 0.12, slideP: 0.08, fakeP: 0, chordP: 0.1,
    newElement: '密度爬升：note 更密，保连击开始考验专注',
    name: { en: 'Density Climb', zh: '密度爬升' },
  },
  {
    index: 7, scene: 'rooftop-electro', bpm: 132, durationSec: 52, density: 1.4,
    pattern: 'alt4', lanes: [0, 1, 2, 3],
    holdP: 0.12, slideP: 0.08, fakeP: 0.16, chordP: 0,
    newElement: '假 note：灰色不可点，点它扣血断连',
    name: { en: 'Don\'t Tap Gray', zh: '别点灰色' },
  },
  {
    index: 8, scene: 'rooftop-electro', bpm: 136, durationSec: 52, density: 1.5,
    pattern: 'chord', lanes: [0, 1, 2, 3],
    holdP: 0.14, slideP: 0.08, fakeP: 0.08, chordP: 0.34,
    newElement: '和弦：多轨同拍落下，需要双手同时按',
    name: { en: 'Two Hands', zh: '双手齐按' },
  },
  {
    index: 9, scene: 'midnight-subway', bpm: 138, durationSec: 54, density: 1.4,
    pattern: 'free', lanes: [0, 1, 2, 3],
    holdP: 0.3, slideP: 0.06, fakeP: 0.06, chordP: 0.08,
    newElement: '律动耐力：长按 + 连续 Perfect 触发律动模式',
    name: { en: 'Groove Gauntlet', zh: '律动耐力' },
  },
  {
    index: 10, scene: 'midnight-subway', bpm: 140, durationSec: 54, density: 1.5,
    pattern: 'free', lanes: [0, 1, 2, 3],
    holdP: 0.14, slideP: 0.1, fakeP: 0.08, chordP: 0.14,
    segments: [
      { t: 0, density: 1.2, syncopate: true },
      { t: 26, density: 1.6, syncopate: true },
    ],
    newElement: '切分节奏：note 落点偏移，打破正拍习惯',
    name: { en: 'Off The Grid', zh: '切分节奏' },
  },
  {
    index: 11, scene: 'midnight-subway', bpm: 150, durationSec: 55, density: 2.0,
    pattern: 'chord', lanes: [0, 1, 2, 3],
    holdP: 0.14, slideP: 0.08, fakeP: 0.06, chordP: 0.2,
    newElement: '生存冲刺：又快又密，放掉难 note 保血量还是硬撑连击',
    name: { en: 'Survival Sprint', zh: '生存冲刺' },
  },
  {
    index: 12, scene: 'midnight-subway', bpm: 156, durationSec: 60, density: 2.2,
    pattern: 'chord', lanes: [0, 1, 2, 3],
    holdP: 0.18, slideP: 0.1, fakeP: 0.08, chordP: 0.24,
    newElement: '终章全曲：长按+滑键+假 note+和弦三轴叠加',
    name: { en: 'Finale: Full Song', zh: '终章：全曲' },
  },
];

export const LEVEL_COUNT = LEVELS.length;

// 三章场景包（换章必换色板/构图/装饰）。
export const CHAPTERS = [
  { scene: 'neon-bar', index: 1, name: { en: 'Neon Bar', zh: '霓虹吧' } },
  { scene: 'rooftop-electro', index: 5, name: { en: 'Rooftop Electro', zh: '天台电音' } },
  { scene: 'midnight-subway', index: 9, name: { en: 'Midnight Subway', zh: '深夜地铁' } },
];
