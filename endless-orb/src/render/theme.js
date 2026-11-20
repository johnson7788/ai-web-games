// ENDLESS ORB · 三套场景色板（蓝星核 / 红巨核 / 黑洞核）——换章必换色板+构图+装饰。
// 只承载颜色与装饰参数；绘制逻辑在 src/render/index.js。
export const THEMES = [
  {
    id: 'blue',
    label: 'BLUE CORE',
    bgTop: '#03121e',
    bgBottom: '#07283a',
    coreInner: '#0a2430',
    coreEdge: '#54e7ff',
    coreGlow: 'rgba(84,231,255,0.55)',
    photon: '#9ff3ff',
    photonGlow: 'rgba(159,243,255,0.8)',
    heavy: '#e8feff',
    heavyGlow: 'rgba(232,254,255,0.95)',
    particle: ['#54e7ff', '#2aa9c4', '#9ff3ff'],
    decorArc: 'rgba(84,231,255,0.16)',
    ripple: 'rgba(84,231,255,0.9)',
    vignette: 'rgba(2,10,18,0.55)',
  },
  {
    id: 'red',
    label: 'RED GIANT',
    bgTop: '#1a0508',
    bgBottom: '#3a0d12',
    coreInner: '#2a0a08',
    coreEdge: '#ff7a3c',
    coreGlow: 'rgba(255,122,60,0.55)',
    photon: '#ffd09a',
    photonGlow: 'rgba(255,208,154,0.8)',
    heavy: '#fff2d6',
    heavyGlow: 'rgba(255,242,214,0.95)',
    particle: ['#ff7a3c', '#ffb45c', '#ff5d3c'],
    decorArc: 'rgba(255,122,60,0.16)',
    ripple: 'rgba(255,140,80,0.9)',
    vignette: 'rgba(20,4,6,0.6)',
  },
  {
    id: 'black',
    label: 'BLACK HOLE',
    bgTop: '#0a0414',
    bgBottom: '#1c0a2e',
    coreInner: '#140820',
    coreEdge: '#b06cff',
    coreGlow: 'rgba(176,108,255,0.5)',
    photon: '#d9a6ff',
    photonGlow: 'rgba(217,166,255,0.8)',
    heavy: '#f0d9ff',
    heavyGlow: 'rgba(240,217,255,0.95)',
    particle: ['#b06cff', '#7a4fd6', '#d79bff'],
    decorArc: 'rgba(176,108,255,0.18)',
    ripple: 'rgba(176,108,255,0.9)',
    vignette: 'rgba(8,3,14,0.65)',
  },
];

export function themeOf(sceneId) {
  return THEMES.find((t) => t.id === sceneId) || THEMES[0];
}
