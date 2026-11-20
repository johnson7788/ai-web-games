// src/render/theme.js — 三场景包（换章必换色板 + 构图 + 装饰）+ 版面布局
// 场景：0 河内(紫蓝) / 1 猎户(青白) / 2 南门(金橙)。每色一个形状，色盲可辨。
export const SCENES = [
  {
    id: 0,
    key: 'scene.river',
    bg: ['#0a0618', '#140a2e', '#1b0f3a'],
    nebula: ['#3a1d6e', '#1c2f6e'],
    frame: '#6a4bd8',
    grid: 'rgba(120, 100, 220, 0.10)',
    colors: ['#a06bff', '#5b8cff', '#ff5bd6', '#54e7ff', '#c9d4ff', '#ff8ab5'],
  },
  {
    id: 1,
    key: 'scene.orion',
    bg: ['#03141a', '#062530', '#08303a'],
    nebula: ['#0e4a56', '#123a52'],
    frame: '#2fb8c9',
    grid: 'rgba(90, 200, 220, 0.10)',
    colors: ['#54e7ff', '#f0f7ff', '#6ee7c8', '#9ad0ff', '#b7c4d8', '#ffe27a'],
  },
  {
    id: 2,
    key: 'scene.south',
    bg: ['#180a06', '#2a1208', '#381708'],
    nebula: ['#5c2a10', '#4a1c24'],
    frame: '#d98c2b',
    grid: 'rgba(230, 160, 70, 0.10)',
    colors: ['#ffc94a', '#ff8a3d', '#ff5d57', '#ffe6b0', '#d98c2b', '#ff6fae'],
  },
];

export const SHAPES = ['circle', 'diamond', 'star', 'triangle', 'hexagon', 'ring'];

export function scenePalette(index) {
  return SCENES[Math.max(0, Math.min(SCENES.length - 1, index))];
}

// 版面（1280×720 世界坐标）：8×8 星阵居中，顶部留 HUD，四周留呼吸边
export function layout() {
  const cell = 68;
  const gap = 4;
  const rows = 8;
  const cols = 8;
  const bw = cols * cell + (cols - 1) * gap;
  const bh = rows * cell + (rows - 1) * gap;
  const x = Math.round((1280 - bw) / 2);
  const y = 84;
  return { x, y, cell, gap, rows, cols, bw, bh };
}

export function cellCenter(i) {
  const L = layout();
  const r = Math.floor(i / L.cols);
  const c = i % L.cols;
  return {
    x: L.x + c * (L.cell + L.gap) + L.cell / 2,
    y: L.y + r * (L.cell + L.gap) + L.cell / 2,
  };
}
