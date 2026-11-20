// CANNON ECHO · 三场景包色板 + 装饰配置（换章必换：色板 + 构图 + 装饰）
export const THEMES = [
  {
    // 晨谷（金绿）
    id: 'morning',
    skyTop: '#123b2a',
    skyBottom: '#7fc46a',
    sun: '#ffd98a',
    farMountains: '#1e5a3a',
    nearMountains: '#143f28',
    cliff: '#2a4a34',
    cliffLight: '#5d8a5f',
    fortress: '#3a3526',
    fortressLight: '#8a7a4a',
    groundGlow: 'rgba(255, 214, 120, 0.18)',
    accent: '#ffd98a',
    fog: 'rgba(255, 226, 160, 0.10)',
  },
  {
    // 雪隘（蓝白）
    id: 'snow',
    skyTop: '#16283f',
    skyBottom: '#cfe6f5',
    sun: '#eaf6ff',
    farMountains: '#2a4a66',
    nearMountains: '#1c3a52',
    cliff: '#2f4a63',
    cliffLight: '#8fb7d6',
    fortress: '#33404e',
    fortressLight: '#8fb0c8',
    groundGlow: 'rgba(190, 228, 255, 0.20)',
    accent: '#cfeaff',
    fog: 'rgba(220, 240, 255, 0.16)',
  },
  {
    // 熔峡（红黑）
    id: 'lava',
    skyTop: '#1a0a0c',
    skyBottom: '#8a2a1e',
    sun: '#ff7a3a',
    farMountains: '#3a1410',
    nearMountains: '#260d0a',
    cliff: '#3a1712',
    cliffLight: '#a8482e',
    fortress: '#2e1a12',
    fortressLight: '#c86a3a',
    groundGlow: 'rgba(255, 120, 50, 0.22)',
    accent: '#ff9a4a',
    fog: 'rgba(255, 130, 60, 0.12)',
  },
];

export function themeAt(scene) {
  return THEMES[Math.max(0, Math.min(THEMES.length - 1, scene))];
}

// 目标盒配色（与场景无关，保证三场景下都能一眼看清）
export const TARGET_COLORS = {
  crate: { fill: '#e8a94a', rim: '#fff0c0', text: '#4a2a08' },
  diver: { fill: '#3fd0c0', rim: '#d0fffa', text: '#04352f' },
  shielded: { fill: '#4a7de8', rim: '#cfe0ff', text: '#0a1f4a', shield: 'rgba(120, 190, 255, 0.55)' },
  armored: { fill: '#b84a3a', rim: '#ffd0c0', text: '#3a0a04' },
  boss: { fill: '#8a3a4a', rim: '#ffb0a0', text: '#3a060e' },
};
