// HOLE MUNCH · 12 场推进结构定义
// 每场：时长 / 物体密度 / AI 强度 / 场景包（换章必换）/ 新元素，场间三选一成长。
// 场景包：1-4 老城街区（old-town）/ 5-8 港口（harbor）/ 9-12 未来城（future-city）。

export const MATCHES = [
  { index: 1,  duration: 120, density: 55,  aiStrength: 0.22, scene: 'old-town',   newElement: 'street lamps' },
  { index: 2,  duration: 120, density: 65,  aiStrength: 0.30, scene: 'old-town',   newElement: 'sedans' },
  { index: 3,  duration: 120, density: 75,  aiStrength: 0.38, scene: 'old-town',   newElement: 'buses' },
  { index: 4,  duration: 120, density: 85,  aiStrength: 0.46, scene: 'old-town',   newElement: 'buildings' },
  { index: 5,  duration: 120, density: 90,  aiStrength: 0.54, scene: 'harbor',     newElement: 'gravity chain' },
  { index: 6,  duration: 120, density: 95,  aiStrength: 0.62, scene: 'harbor',     newElement: 'meteor rush' },
  { index: 7,  duration: 120, density: 100, aiStrength: 0.70, scene: 'harbor',     newElement: 'skyscrapers' },
  { index: 8,  duration: 120, density: 105, aiStrength: 0.78, scene: 'harbor',     newElement: 'hunter AI' },
  { index: 9,  duration: 120, density: 110, aiStrength: 0.86, scene: 'future-city', newElement: 'faster AI' },
  { index: 10, duration: 120, density: 118, aiStrength: 0.92, scene: 'future-city', newElement: 'dense old town' },
  { index: 11, duration: 120, density: 126, aiStrength: 0.96, scene: 'future-city', newElement: 'harbor scene' },
  { index: 12, duration: 120, density: 134, aiStrength: 1.0,  scene: 'future-city', newElement: 'future city scene' },
];

export const MATCH_COUNT = MATCHES.length;

export function matchAt(level) {
  const i = Math.max(0, Math.min(MATCH_COUNT - 1, (level || 1) - 1));
  return MATCHES[i];
}
