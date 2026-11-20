// 关卡表：12 关渐进引入新约束（顶点数 / 岩核 / 连击 / 倒计时 / 旋转水晶）。
// 每关 newElement 唯一，供 fun-audit 与 title/关卡名展示。
export const LEVELS = [
  { minVerts: 3, maxVerts: 4, rockCount: 0, time: 30, rotate: 0, name: { en: 'First Cut', zh: '第一刀' } },
  { minVerts: 4, maxVerts: 5, rockCount: 0, time: 28, rotate: 0, name: { en: 'More Corners', zh: '更多棱角' } },
  { minVerts: 5, maxVerts: 5, rockCount: 1, time: 28, rotate: 0, name: { en: 'Rock Core', zh: '岩核' } },
  { minVerts: 5, maxVerts: 6, rockCount: 1, time: 26, rotate: 0, name: { en: 'Off-Center Core', zh: '偏心岩核' } },
  { minVerts: 6, maxVerts: 6, rockCount: 0, time: 24, rotate: 0, name: { en: 'Combo Chain', zh: '连击链' } },
  { minVerts: 6, maxVerts: 6, rockCount: 1, time: 22, rotate: 0.15, name: { en: 'Ticking Clock', zh: '倒计时加速' } },
  { minVerts: 6, maxVerts: 7, rockCount: 2, time: 24, rotate: 0, name: { en: 'Twin Cores', zh: '双岩核' } },
  { minVerts: 7, maxVerts: 8, rockCount: 0, time: 20, rotate: 0, name: { en: 'Many Corners', zh: '多棱水晶' } },
  { minVerts: 8, maxVerts: 8, rockCount: 1, time: 20, rotate: 0, name: { en: 'Core + Combo', zh: '岩核连击' } },
  { minVerts: 8, maxVerts: 8, rockCount: 1, time: 18, rotate: 0.25, name: { en: 'Spinning Crystal', zh: '旋转水晶' } },
  { minVerts: 8, maxVerts: 9, rockCount: 2, time: 18, rotate: 0, name: { en: 'Pressure Cut', zh: '高压切割' } },
  { minVerts: 9, maxVerts: 9, rockCount: 1, time: 16, rotate: 0.35, name: { en: 'Final Boss', zh: '终极水晶' } },
];

export const LEVEL_COUNT = LEVELS.length;
