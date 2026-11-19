// src/render/theme.js — 4 套场景包色板与装饰主题（换章必换：色板 + 构图 + 装饰）。
// 章节：1 甜品街 sweet / 2 心形花园 garden / 3 丘比特工作室 studio / 4 月光舞会 moon。
export const SCENES = {
  sweet: {
    name: 'sweet',
    bgTop: '#ffe3ee',
    bgBottom: '#ffc4dd',
    accent: '#ff6fa5',
    accent2: '#ffd166',
    ink: '#6b2b44',
    deco: 'sweet',
  },
  garden: {
    name: 'garden',
    bgTop: '#ffd9ec',
    bgBottom: '#ffb3d4',
    accent: '#ff6fa5',
    accent2: '#8fe36a',
    ink: '#6b2b44',
    deco: 'garden',
  },
  studio: {
    name: 'studio',
    bgTop: '#ffe9f2',
    bgBottom: '#ffc7dc',
    accent: '#ff6fa5',
    accent2: '#9d8cff',
    ink: '#6b2b44',
    deco: 'studio',
  },
  moon: {
    name: 'moon',
    bgTop: '#1c1533',
    bgBottom: '#0e0a1e',
    accent: '#ff6fa5',
    accent2: '#ffd166',
    ink: '#ffe3ee',
    deco: 'moon',
  },
};

export function sceneOf(chapter) {
  const key = { 1: 'sweet', 2: 'garden', 3: 'studio', 4: 'moon' }[chapter] || 'sweet';
  return SCENES[key];
}
