// SKY STRIKE ALPHA · 关卡定义（每关一个「新元素」，难度随 scroll/interval/gap/rockP/oscAmp 递增）
// sim 只读这里；render/main 不写。
export const LEVELS = [
  {
    index: 1,
    name: { en: 'Approach Run', zh: '进场突袭' },
    newElement: '能量闸门（gate）：固定缝隙的霓虹门，按住爬升对准缝隙穿过',
    scroll: 235,     // 障碍左移速度 px/s
    interval: 2.2,   // 障碍生成间隔 s
    gap: 235,        // 缝隙高度 px
    rockP: 0.0,      // 本关陨石障碍占比
    oscAmp: 0,       // 缝隙纵向摆动幅度 px
    oscFreq: 0.6,
    shieldEvery: 4,  // 每 N 个障碍附带一枚护盾（0=关）
  },
  {
    index: 2,
    name: { en: 'Asteroid Drift', zh: '陨石漂移' },
    newElement: '陨石阵（rock）：更快、缝隙摆动的散碎小行星，必须预判高度',
    scroll: 285,
    interval: 2.0,
    gap: 210,
    rockP: 0.35,
    oscAmp: 34,
    oscFreq: 0.8,
    shieldEvery: 4,
  },
  {
    index: 3,
    name: { en: 'Oscillating Grid', zh: '摆荡网阵' },
    newElement: '摆荡闸门：缝隙中心上下摆动，逼你持续微调而非一次瞄准',
    scroll: 330,
    interval: 1.8,
    gap: 195,
    rockP: 0.5,
    oscAmp: 66,
    oscFreq: 1.0,
    shieldEvery: 3,
  },
  {
    index: 4,
    name: { en: 'Twin Gates', zh: '双子门' },
    newElement: '双子门：更窄的缝隙 + 更密的闸门节奏',
    scroll: 360,
    interval: 1.7,
    gap: 182,
    rockP: 0.6,
    oscAmp: 72,
    oscFreq: 1.1,
    shieldEvery: 3,
  },
  {
    index: 5,
    name: { en: 'Mine Field', zh: '雷区' },
    newElement: '雷区：高密度陨石群夹缝求生，护盾成为关键资源',
    scroll: 390,
    interval: 1.6,
    gap: 176,
    rockP: 0.7,
    oscAmp: 84,
    oscFreq: 1.2,
    shieldEvery: 2,
  },
  {
    index: 6,
    name: { en: 'Alpha Gauntlet', zh: '阿尔法试炼' },
    newElement: '终章试炼：最快卷速 + 最大摆幅 + 陨石饱和，全部机制叠加',
    scroll: 420,
    interval: 1.5,
    gap: 168,
    rockP: 0.8,
    oscAmp: 96,
    oscFreq: 1.3,
    shieldEvery: 2,
  },
];

export const LEVEL_COUNT = LEVELS.length;
