// config/levels.js — RING CYCLE · 12 带（每带目标分 + 环阵轮换）与 3 场景包
// 场景包：果味车间(1-4) / 薄荷库(5-8) / 夜光仓(9-12)——换章必换色板+构图+装饰（render/theme.js 消费）
// 每带一个 twist（新元素）：sparse/moving/colorSwap/narrow/whiteScarce/finale 的组合与升级

export const SCENES = [
  { id: 'fruity', name: 'scene.fruity', bands: [1, 2, 3, 4] },
  { id: 'mint', name: 'scene.mint', bands: [5, 6, 7, 8] },
  { id: 'glow', name: 'scene.glow', bands: [9, 10, 11, 12] },
];

export const BANDS = [
  {
    index: 1, scene: 'fruity', name: 'band.1', twist: 'standard',
    scroll: 300, gap: 520, cells: 6, targetCells: 2, whiteProb: 0.26, woodProb: 0.10,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 2, scene: 'fruity', name: 'band.2', twist: 'sparse',
    scroll: 300, gap: 660, cells: 6, targetCells: 2, whiteProb: 0.24, woodProb: 0.10,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 3, scene: 'fruity', name: 'band.3', twist: 'moving',
    scroll: 320, gap: 520, cells: 6, targetCells: 2, whiteProb: 0.22, woodProb: 0.10,
    moving: true, moveSpeed: 60, swap: false, swapEvery: 0,
  },
  {
    index: 4, scene: 'fruity', name: 'band.4', twist: 'colorSwap',
    scroll: 330, gap: 520, cells: 6, targetCells: 2, whiteProb: 0.22, woodProb: 0.09,
    moving: false, moveSpeed: 0, swap: true, swapEvery: 4.0,
  },
  {
    index: 5, scene: 'mint', name: 'band.5', twist: 'standard',
    scroll: 340, gap: 500, cells: 6, targetCells: 2, whiteProb: 0.20, woodProb: 0.09,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 6, scene: 'mint', name: 'band.6', twist: 'narrow',
    scroll: 350, gap: 500, cells: 8, targetCells: 1, whiteProb: 0.20, woodProb: 0.09,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 7, scene: 'mint', name: 'band.7', twist: 'whiteScarce',
    scroll: 360, gap: 500, cells: 7, targetCells: 2, whiteProb: 0.0, woodProb: 0.12,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 8, scene: 'mint', name: 'band.8', twist: 'movingNarrow',
    scroll: 370, gap: 500, cells: 8, targetCells: 1, whiteProb: 0.18, woodProb: 0.09,
    moving: true, moveSpeed: 70, swap: false, swapEvery: 0,
  },
  {
    index: 9, scene: 'glow', name: 'band.9', twist: 'standard',
    scroll: 390, gap: 470, cells: 7, targetCells: 2, whiteProb: 0.16, woodProb: 0.08,
    moving: false, moveSpeed: 0, swap: false, swapEvery: 0,
  },
  {
    index: 10, scene: 'glow', name: 'band.10', twist: 'swapScarce',
    scroll: 400, gap: 470, cells: 7, targetCells: 2, whiteProb: 0.0, woodProb: 0.09,
    moving: false, moveSpeed: 0, swap: true, swapEvery: 3.2,
  },
  {
    index: 11, scene: 'glow', name: 'band.11', twist: 'movingFast',
    scroll: 430, gap: 470, cells: 8, targetCells: 1, whiteProb: 0.14, woodProb: 0.08,
    moving: true, moveSpeed: 90, swap: false, swapEvery: 0,
  },
  {
    index: 12, scene: 'glow', name: 'band.12', twist: 'finale',
    scroll: 460, gap: 440, cells: 8, targetCells: 1, whiteProb: 0.0, woodProb: 0.08,
    moving: true, moveSpeed: 90, swap: true, swapEvery: 2.8,
  },
];

export const BAND_COUNT = BANDS.length;

export function bandIndexAt(ringsCleared) {
  const i = Math.floor(Math.max(0, ringsCleared) / 5);
  return Math.min(BANDS.length - 1, i);
}

export function bandAt(ringsCleared) {
  return BANDS[bandIndexAt(ringsCleared)];
}

export function sceneAt(bandIndex) {
  const b = BANDS[Math.max(0, Math.min(BANDS.length - 1, bandIndex))];
  return SCENES.find((s) => s.id === b.scene) || SCENES[0];
}

// depth（px）→ 带 index（1-based，供 HUD/埋点）
export function bandNumber(ringsCleared) {
  return bandIndexAt(ringsCleared) + 1;
}
