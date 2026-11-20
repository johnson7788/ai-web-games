// 三场景包色板：车库（暖白）/ 孵化器（青）/ 摩天办公（蓝紫）。
// 换章必换色板+构图+装饰；构图/装饰差异在 src/render/index.js 的 drawScene。
export const THEMES = {
  garage: {
    id: 'garage',
    bg: '#f6efdf',
    bg2: '#efe3c8',
    ink: '#3a2c1a',
    muted: '#8a6f4d',
    accent: '#ffb84d',
    accent2: '#e88a2e',
    glass: 'rgba(58,44,26,0.08)',
    line: 'rgba(58,44,26,0.22)',
    glow: 'rgba(255,184,77,0.55)',
  },
  incubator: {
    id: 'incubator',
    bg: '#06383e',
    bg2: '#052a30',
    ink: '#d7fffb',
    muted: '#79b8b2',
    accent: '#2ee6d6',
    accent2: '#17b3a4',
    glass: 'rgba(46,230,214,0.10)',
    line: 'rgba(46,230,214,0.28)',
    glow: 'rgba(46,230,214,0.55)',
  },
  skyscraper: {
    id: 'skyscraper',
    bg: '#131936',
    bg2: '#0e1228',
    ink: '#e7eaff',
    muted: '#8d93c4',
    accent: '#7b5cff',
    accent2: '#4d9bff',
    glass: 'rgba(123,92,255,0.10)',
    line: 'rgba(123,92,255,0.28)',
    glow: 'rgba(123,92,255,0.55)',
  },
};

export function themeFor(sceneId) {
  return THEMES[sceneId] || THEMES.garage;
}
