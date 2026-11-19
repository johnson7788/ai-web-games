// src/render/theme.js — 霓虹街机配色 + 三层火焰颜色（焰心蓝 / 内焰金 / 外焰橙）。
export const THEME = {
  bg0: '#0d0a18',
  bg1: '#150f2a',
  ground: '#1a1231',
  groundLine: '#3a2a66',
  hudText: '#f4ecff',
  hudDim: '#9b8fc2',
  danger: '#ff3b6b',

  // 三层火焰（对应 sim 的 tierColorName：core/inner/outer）
  flame: {
    core: { fill: '#38b6ff', glow: '#1f8fff' },
    inner: { fill: '#ffb020', glow: '#ff8a00' },
    outer: { fill: '#ff5a1f', glow: '#ff2e00' },
  },

  fuel: { fill: '#ffd166', glow: '#ffb020' },       // 通用燃料（金色）
  coal: { fill: '#2a2438', glow: '#ff7a1f', crack: '#ff9a3d' },
  water: { fill: '#3fa7ff', glow: '#1f7fff' },
  spark: { fill: '#ff4d2e', glow: '#ffd21f' },
  player: { fill: '#ffe9a8', glow: '#ffb020', core: '#ffffff' },
};
