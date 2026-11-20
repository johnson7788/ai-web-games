// src/render/theme.js — 三套场景色板 + 五行色（水墨仙侠风格，全程序化）。
// 场景包：1 青竹林（翠）/ 2 雪山道（白蓝）/ 3 锁妖塔（紫黑）。

export const SCENES = {
  1: {
    id: 'bamboo',
    key: 'scene.1',
    skyTop: '#0a1a12',
    skyBottom: '#12301f',
    groundA: '#0e2417',
    groundB: '#16381f',
    groundLine: '#2a5a34',
    deco: '#35a05e',      // 竹竿
    deco2: '#7fd68a',     // 竹叶
    accent: '#9ef0b0',
    fog: 'rgba(20, 60, 34, 0.55)',
    ink: '#0b2b16',
  },
  2: {
    id: 'snow',
    key: 'scene.2',
    skyTop: '#0d1424',
    skyBottom: '#1b2740',
    groundA: '#151d30',
    groundB: '#22304a',
    groundLine: '#3a4c6e',
    deco: '#cfe0f0',      // 雪
    deco2: '#8fb6dd',     // 冰
    accent: '#eaf4ff',
    fog: 'rgba(40, 60, 90, 0.5)',
    ink: '#101a2e',
  },
  3: {
    id: 'tower',
    key: 'scene.3',
    skyTop: '#120a18',
    skyBottom: '#241230',
    groundA: '#170d20',
    groundB: '#2a1538',
    groundLine: '#4a2460',
    deco: '#7a4a9e',      // 塔砖
    deco2: '#a86ad0',     // 符文
    accent: '#d9b0ff',
    fog: 'rgba(40, 20, 60, 0.6)',
    ink: '#170a22',
  },
};

export const ELEM_COLORS = {
  metal: '#e6e6f0',
  wood: '#4fd07a',
  earth: '#d6b25e',
  water: '#58b6e6',
  fire: '#ef6a48',
};

export const ELEM_GLOW = {
  metal: 'rgba(230,230,240,0.9)',
  wood: 'rgba(79,208,122,0.9)',
  earth: 'rgba(214,178,94,0.9)',
  water: 'rgba(88,182,230,0.9)',
  fire: 'rgba(239,106,72,0.9)',
};

export function sceneOf(n) {
  return SCENES[((n - 1) % 3) + 1] || SCENES[1];
}
