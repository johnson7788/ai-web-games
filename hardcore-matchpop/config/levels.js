// HARDCORE MATCHPOP · 关卡表（纯配置，sim/render 只读）
// rocks = 本关岩石障碍数量（不可消除、阻挡下落与列移动）
// scene = 本关霓虹主题色（render 用于背景/描边强调）
export const LEVELS = [
  { index: 1,  name: { en: 'Neon Dawn',     zh: '霓虹黎明' }, rocks: 0, scene: 'cyan',    time: 60 },
  { index: 2,  name: { en: 'First Rift',    zh: '第一道裂缝' }, rocks: 1, scene: 'magenta', time: 60 },
  { index: 3,  name: { en: 'Prism Storm',   zh: '棱镜风暴' }, rocks: 2, scene: 'yellow',  time: 60 },
  { index: 4,  name: { en: 'Magma Veins',   zh: '熔岩脉络' }, rocks: 3, scene: 'coral',   time: 60 },
  { index: 5,  name: { en: 'Static Haze',   zh: '静电迷雾' }, rocks: 4, scene: 'lime',    time: 60 },
  { index: 6,  name: { en: 'Overload',      zh: '过载' },     rocks: 5, scene: 'cyan',    time: 60 },
  { index: 7,  name: { en: 'Heat Wave',     zh: '热浪' },     rocks: 6, scene: 'magenta', time: 60 },
  { index: 8,  name: { en: 'Prism Break',   zh: '棱镜崩解' }, rocks: 7, scene: 'yellow',  time: 60 },
  { index: 9,  name: { en: 'Nova Core',     zh: '新星核心' }, rocks: 8, scene: 'coral',   time: 60 },
  { index: 10, name: { en: 'Singularity',   zh: '奇点' },     rocks: 8, scene: 'lime',    time: 60 },
  { index: 11, name: { en: 'Event Horizon', zh: '事件视界' }, rocks: 8, scene: 'cyan',    time: 55 },
  { index: 12, name: { en: 'Heat Death',    zh: '热寂' },     rocks: 8, scene: 'magenta', time: 55 },
];

export const LEVEL_COUNT = LEVELS.length;
