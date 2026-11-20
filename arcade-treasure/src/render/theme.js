// src/render/theme.js — 三套场景皮肤 + 大厅霓虹色板（纯数据，渲染消费）。
// 换章必换色板+构图+装饰：机房暗绿 / 雨夜蓝灰 / 像素紫黑。

export const DPR_CAP = 2;

export const HALL = {
  bg0: '#0a0714',
  bg1: '#17102b',
  floor: '#241637',
  floorLine: '#3a2457',
  neon: '#ff4fd8',
  neonSoft: '#8a2fc9',
  gold: '#ffd166',
  wall: '#120d1f',
  sign: '#3a3a4a',
};

export const PALETTES = [
  { // 0 机房守夜
    bg0: '#02100c',
    bg1: '#04241a',
    accent: '#39ff9e',
    accent2: '#12b886',
    danger: '#ffd23e',
    floor: '#052015',
    name: 'machine.0',
  },
  { // 1 雨中拾荒
    bg0: '#050d18',
    bg1: '#0a1c30',
    accent: '#59c2ff',
    accent2: '#2f7fb0',
    danger: '#ffe066',
    floor: '#081522',
    name: 'machine.1',
  },
  { // 2 像素蜂群
    bg0: '#0c0416',
    bg1: '#1d0b30',
    accent: '#c26bff',
    accent2: '#7a2fd0',
    danger: '#ff5d8f',
    floor: '#130623',
    name: 'machine.2',
  },
];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
