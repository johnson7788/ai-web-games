// MERGE 2048 · 三场景包（换章必换：色板 + 构图 + 装饰）
// 近地轨道 orbit（深蓝）/ 小行星带 asteroid（灰橙）/ 星云深处 nebula（紫粉）
export const THEMES = {
  orbit: {
    bgTop: '#02070f',
    bgBottom: '#08203a',
    board: 'rgba(9, 26, 48, 0.92)',
    cellEmpty: 'rgba(14, 34, 60, 0.9)',
    gridLine: 'rgba(84, 231, 255, 0.18)',
    accent: '#54e7ff',
    accentDim: '#2aa9c4',
    gold: '#ffc94a',
    star: ['#9fd8ff', '#54e7ff', '#c9f2ff', '#ffffff'],
    tileText: '#eaffff',
    tileLock: '#ff5d73',
  },
  asteroid: {
    bgTop: '#120c06',
    bgBottom: '#2a1a0a',
    board: 'rgba(38, 26, 13, 0.92)',
    cellEmpty: 'rgba(48, 32, 16, 0.9)',
    gridLine: 'rgba(255, 176, 87, 0.18)',
    accent: '#ffb057',
    accentDim: '#c97a2e',
    gold: '#ffd98a',
    star: ['#ffe0b0', '#ffb057', '#f6e7cf', '#ffffff'],
    tileText: '#fff3e2',
    tileLock: '#ff7a5c',
  },
  nebula: {
    bgTop: '#120318',
    bgBottom: '#2c0b30',
    board: 'rgba(40, 13, 48, 0.92)',
    cellEmpty: 'rgba(52, 18, 62, 0.9)',
    gridLine: 'rgba(242, 121, 242, 0.18)',
    accent: '#f279f2',
    accentDim: '#b24ac0',
    gold: '#ffd0ff',
    star: ['#f4c6ff', '#f279f2', '#ffe2ff', '#ffffff'],
    tileText: '#ffeaff',
    tileLock: '#ff6ea8',
  },
};

// 吨位 → 舰体颜色（经典 2048 色板做星际化调整）
export function tileColor(value) {
  const map = {
    2: '#1e3a5f', 4: '#24507a', 8: '#2f6a9a', 16: '#3d8ab8',
    32: '#4aa3c8', 64: '#57b8d8', 128: '#f2b84b', 256: '#e89a3c',
    512: '#e07a2f', 1024: '#d45a3a', 2048: '#b23ce0', 4096: '#7a2ee0',
  };
  return map[value] || '#3b1f5c';
}

// 吨位徽记：高值舰带不同形状的舱室徽记
export function emblemFor(value) {
  if (value >= 2048) return 'warp';
  if (value >= 1024) return 'gate';
  if (value >= 512) return 'station';
  if (value >= 256) return 'mine';
  if (value >= 128) return 'green';
  return 'ship';
}
