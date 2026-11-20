// FOOD CHAIN · 三场景包色板（换章必换：色板 + 构图 + 装饰）
// zone 0 光合带（亮青）/ zone 1 中层带（深蓝）/ zone 2 热泉带（暗红）
// particleColor 为 rgb 三元组字符串（不带 rgba 前缀，渲染层拼 alpha）。
export const ZONE_THEMES = [
  {
    name: 'photic',
    bgTop: '#0a3d46',
    bgMid: '#0c2f3a',
    bgBottom: '#061a22',
    sunRays: true,
    particle: 'bubble',
    particleColor: '160,240,255',
    decor: 'coral',
  },
  {
    name: 'twilight',
    bgTop: '#050b1e',
    bgMid: '#0a1030',
    bgBottom: '#040814',
    sunRays: false,
    particle: 'spark',
    particleColor: '120,150,255',
    decor: 'silt',
  },
  {
    name: 'vent',
    bgTop: '#260a08',
    bgMid: '#1c0a0c',
    bgBottom: '#0c0405',
    sunRays: false,
    particle: 'ember',
    particleColor: '255,120,80',
    decor: 'spire',
  },
];

export function zoneTheme(zone) {
  return ZONE_THEMES[zone] || ZONE_THEMES[0];
}
