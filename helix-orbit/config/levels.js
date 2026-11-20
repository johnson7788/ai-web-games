// HELIX ORBIT · 12 段层形轮换（每段深度目标 + 层形规则）。
// 每层 = 8 槽圆环；段/缺口按角度画楔形。profileFor(depth) 决定当前层形态。
// 三场景包由 depth 映射：岩壳(0-3)/黑曜(4-7)/冰帽(8-11)。

export const SEGMENTS = [
  {
    name: 'single-teach',
    theme: 0,                 // 岩壳
    gapCount: 1,              // 1 个宽缺口
    gapWidth: 1,              // 1 槽宽
    magmaRatio: 0.04,         // 岩浆占比
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'single',
    theme: 0,
    gapCount: 1,
    gapWidth: 1,
    magmaRatio: 0.10,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'double',
    theme: 0,
    gapCount: 2,
    gapWidth: 1,
    magmaRatio: 0.16,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'double',
    theme: 0,
    gapCount: 2,
    gapWidth: 1,
    magmaRatio: 0.22,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'reverse',
    theme: 1,                 // 黑曜
    gapCount: 1,
    gapWidth: 1,
    magmaRatio: 0.18,
    reverse: true,            // 反向层：自旋与输入相反
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'reverse',
    theme: 1,
    gapCount: 1,
    gapWidth: 1,
    magmaRatio: 0.26,
    reverse: true,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'moving',
    theme: 1,
    gapCount: 1,
    gapWidth: 1,
    magmaRatio: 0.22,
    reverse: false,
    movingDir: 1,             // 缺口自行缓慢漂移
    movingSpeed: 0.8,
  },
  {
    name: 'moving',
    theme: 1,
    gapCount: 1,
    gapWidth: 1,
    magmaRatio: 0.30,
    reverse: false,
    movingDir: -1,
    movingSpeed: 0.9,
  },
  {
    name: 'narrow',
    theme: 2,                 // 冰帽
    gapCount: 1,
    gapWidth: 0.5,            // 半槽窄缝
    magmaRatio: 0.22,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'narrow',
    theme: 2,
    gapCount: 1,
    gapWidth: 0.5,
    magmaRatio: 0.30,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'magma-narrow',
    theme: 2,
    gapCount: 1,
    gapWidth: 0.5,
    magmaRatio: 0.42,         // 岩浆占比升
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
  },
  {
    name: 'magma-narrow-reverse',
    theme: 2,
    gapCount: 1,
    gapWidth: 0.5,
    magmaRatio: 0.50,
    reverse: true,
    movingDir: 0,
    movingSpeed: 0,
  },
];

export const SEGMENT_COUNT = SEGMENTS.length;

export function profileFor(depth) {
  return SEGMENTS[((depth % SEGMENT_COUNT) + SEGMENT_COUNT) % SEGMENT_COUNT];
}

// 三场景包：色板 + 构图 + 装饰（换章必换）
export const THEMES = [
  {
    key: 'crust',
    name: 'Crust',             // 岩壳（赭红）
    bgTop: '#2b0f0c',
    bgBottom: '#120505',
    ringSafe: '#8a4a2a',
    ringSafeLit: '#c98b52',
    ringMagma: '#ff5a2a',
    ringMagmaGlow: '#ffd08a',
    ringCrack: '#ffb84a',
    accent: '#ff8a3d',
    ball: '#ffd9a0',
    ballGlow: '#ff9a3d',
    decoration: 'ember',
  },
  {
    key: 'obsidian',
    name: 'Obsidian',          // 黑曜（墨黑紫纹）
    bgTop: '#120a1c',
    bgBottom: '#050208',
    ringSafe: '#2a1f3a',
    ringSafeLit: '#5d4a7a',
    ringMagma: '#d13bff',
    ringMagmaGlow: '#ff9dff',
    ringCrack: '#c57bff',
    accent: '#a55bff',
    ball: '#f0dcff',
    ballGlow: '#a55bff',
    decoration: 'shard',
  },
  {
    key: 'ice',
    name: 'Ice Cap',           // 冰帽（青白）
    bgTop: '#08222b',
    bgBottom: '#020a10',
    ringSafe: '#2a5a66',
    ringSafeLit: '#7fd0e0',
    ringMagma: '#ff4a6a',
    ringMagmaGlow: '#ffb0c0',
    ringCrack: '#8ff0ff',
    accent: '#5fe0ff',
    ball: '#eaffff',
    ballGlow: '#5fe0ff',
    decoration: 'snow',
  },
];

export function themeFor(depth) {
  return THEMES[profileFor(depth).theme];
}
