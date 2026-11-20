// SAUCER STRIKE · 碟型定义 + 12 波 + 3 场景章
// 纯数据；所有随机来自 spawner 传入的 rng。

// 碟型：hp / score / radius / speed / path / 是否隐形 / 颜色（render 用）
export const SAUCER_TYPES = {
  scout:     { id: 'scout',     hp: 1, score: 100,  radius: 22, speed: 150, path: 'straight', invisible: false, color: '#7df9ff' },
  transport: { id: 'transport', hp: 3, score: 300,  radius: 34, speed: 88,  path: 'straight', invisible: false, color: '#ffd166' },
  z:         { id: 'z',         hp: 2, score: 200,  radius: 26, speed: 130, path: 'zigzag',   invisible: false, color: '#c792ff' },
  invisible: { id: 'invisible', hp: 1, score: 400,  radius: 24, speed: 140, path: 'hover',    invisible: true,  color: '#8ff4ff' },
  mother:    { id: 'mother',    hp: 8, score: 1000, radius: 46, speed: 78,  path: 'swoop',    invisible: false, color: '#ff5d73' },
};

export const SAUCER_IDS = Object.keys(SAUCER_TYPES);

// 12 波：index / chapter / saucers（typeId 列表）/ meteor（流星雨干扰）
export const WAVES = [
  { index: 1,  chapter: 1, saucers: ['scout', 'scout', 'scout'], meteor: false },
  { index: 2,  chapter: 1, saucers: ['scout', 'scout', 'scout', 'scout'], meteor: false },
  { index: 3,  chapter: 1, saucers: ['transport', 'transport'], meteor: false },
  { index: 4,  chapter: 1, saucers: ['z', 'z', 'z'], meteor: false },
  { index: 5,  chapter: 2, saucers: ['scout', 'scout', 'transport', 'transport'], meteor: false },
  { index: 6,  chapter: 2, saucers: ['scout', 'scout', 'scout', 'scout'], meteor: true },
  { index: 7,  chapter: 2, saucers: ['invisible', 'invisible'], meteor: false },
  { index: 8,  chapter: 2, saucers: ['z', 'z', 'transport', 'transport'], meteor: false },
  { index: 9,  chapter: 3, saucers: ['mother', 'scout', 'scout'], meteor: false },
  { index: 10, chapter: 3, saucers: ['invisible', 'invisible', 'invisible'], meteor: true },
  { index: 11, chapter: 3, saucers: ['z', 'z', 'invisible', 'transport'], meteor: false },
  { index: 12, chapter: 3, saucers: ['mother', 'mother', 'z', 'z'], meteor: false },
];

export const WAVE_COUNT = WAVES.length;

// 场景章（换章必换：色板+构图+装饰，见 src/render/theme.js）
export const CHAPTERS = [
  { index: 1, name: 'chapter.1', decor: 'desert', waves: [1, 2, 3, 4] },
  { index: 2, name: 'chapter.2', decor: 'aurora', waves: [5, 6, 7, 8] },
  { index: 3, name: 'chapter.3', decor: 'city',   waves: [9, 10, 11, 12] },
];

export function waveAt(waveIndex) {
  return WAVES[Math.min(WAVES.length - 1, Math.max(0, waveIndex - 1))];
}

export function chapterOf(waveIndex) {
  const w = waveAt(waveIndex);
  return w ? w.chapter : 1;
}
