// src/render/theme.js — 4 套场景包色板与装饰主题（换章必换：色板 + 构图 + 装饰）。
// 章节：1 实验室 lab / 2 厨房 kitchen / 3 花园 garden / 4 太空控制室 space。
export const SCENES = {
  lab: {
    name: 'lab',
    bgTop: '#0c2126',
    bgBottom: '#071418',
    accent: '#49e0c0',
    accent2: '#ffd166',
    ink: '#d9f6ef',
    deco: 'lab',
  },
  kitchen: {
    name: 'kitchen',
    bgTop: '#2a1c10',
    bgBottom: '#180f08',
    accent: '#ffb347',
    accent2: '#ff8a5c',
    ink: '#fde9d4',
    deco: 'kitchen',
  },
  garden: {
    name: 'garden',
    bgTop: '#17351a',
    bgBottom: '#0b1f0d',
    accent: '#8fe36a',
    accent2: '#ffd166',
    ink: '#e9fbe4',
    deco: 'garden',
  },
  space: {
    name: 'space',
    bgTop: '#12122a',
    bgBottom: '#07071a',
    accent: '#9d8cff',
    accent2: '#5fc3ff',
    ink: '#e6e4ff',
    deco: 'space',
  },
};

export function sceneOf(chapter) {
  const key = { 1: 'lab', 2: 'kitchen', 3: 'garden', 4: 'space' }[chapter] || 'lab';
  return SCENES[key];
}
