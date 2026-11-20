// config/levels.js — 12 站推进结构 + 三场景包 + 每站障碍轮换（M1）
// station 从 1 开始；scene 1=早高峰(暖白) 2=午后(青) 3=夜班(蓝紫霓虹)，每 4 站换一章。
import { STATION } from './gameplay.js';

export const STATIONS = [
  { index: 1,  name: 'depot',       scene: 1, hazards: ['car'],              hazardLanes: [1, 2],      gate: false, reverse: false, narrow: false, density: 0.6 },
  { index: 2,  name: 'pit-stop',    scene: 1, hazards: ['car', 'pit'],       hazardLanes: [1, 2],      gate: false, reverse: false, narrow: false, density: 0.7 },
  { index: 3,  name: 'narrow-alley',scene: 1, hazards: ['car', 'pit'],       hazardLanes: [2],         gate: false, reverse: false, narrow: true,  density: 0.8 },
  { index: 4,  name: 'turnstile',   scene: 1, hazards: ['car', 'pit'],       hazardLanes: [1, 2],      gate: true,  reverse: false, narrow: false, density: 0.85 },
  { index: 5,  name: 'noon-rush',   scene: 2, hazards: ['car', 'reverse'],   hazardLanes: [1, 2],      gate: false, reverse: true,  narrow: false, density: 0.9 },
  { index: 6,  name: 'food-run',    scene: 2, hazards: ['car', 'pit', 'reverse'], hazardLanes: [1, 2], gate: false, reverse: true,  narrow: false, density: 0.95 },
  { index: 7,  name: 'balloon-sky', scene: 2, hazards: ['car'],              hazardLanes: [1, 2],      gate: false, reverse: false, narrow: false, density: 0.9,  balloonHeavy: true },
  { index: 8,  name: 'night-narrow',scene: 3, hazards: ['car', 'pit'],       hazardLanes: [2],         gate: true,  reverse: false, narrow: true,  density: 1.0 },
  { index: 9,  name: 'neon-chase',  scene: 3, hazards: ['reverse', 'pit'],   hazardLanes: [2],         gate: false, reverse: true,  narrow: true,  density: 1.05 },
  { index: 10, name: 'gate-maze',   scene: 3, hazards: ['car', 'pit'],       hazardLanes: [1, 2],      gate: true,  reverse: true,  narrow: false, density: 1.1 },
  { index: 11, name: 'parked-maze', scene: 3, hazards: ['car'],              hazardLanes: [2],         gate: false, reverse: false, narrow: true,  density: 1.15 },
  { index: 12, name: 'final-sprint',scene: 3, hazards: ['car', 'pit', 'reverse'], hazardLanes: [2],    gate: true,  reverse: true,  narrow: true,  density: 1.25 },
];

// 三场景包（换章必换：色板 + 构图 + 装饰）
export const SCENES = [
  {
    index: 1,
    key: 'morning',
    skyTop: '#fff7ea', skyBottom: '#ffe0b8',
    road: '#4b4f57', roadLine: '#f5e9d0',
    sidewalk: '#d9d2c0',
    accent: '#ffb45c',       // 暖橙
    glow: '#ffd9a0',
    decorations: ['tower', 'sun'],
    label: 'scene.morning',
  },
  {
    index: 2,
    key: 'afternoon',
    skyTop: '#d8f4f7', skyBottom: '#a9dfe6',
    road: '#3f4a52', roadLine: '#e2f7f4',
    sidewalk: '#b7cdd0',
    accent: '#3fd0c9',       // 青
    glow: '#aef4ee',
    decorations: ['cloud', 'metro'],
    label: 'scene.afternoon',
  },
  {
    index: 3,
    key: 'night',
    skyTop: '#14122e', skyBottom: '#2c1c55',
    road: '#232039', roadLine: '#8f7dff',
    sidewalk: '#1d1830',
    accent: '#8f7dff',       // 蓝紫
    glow: '#c7b9ff',
    decorations: ['neon', 'moon'],
    label: 'scene.night',
  },
];

export function stationAt(distance) {
  const idx = Math.min(STATION.COUNT, Math.floor(distance / STATION.DISTANCE_M) + 1);
  return STATIONS[idx - 1];
}

export function sceneAt(station) {
  return SCENES[(stationAt(station === undefined ? 0 : station).scene - 1)] || SCENES[0];
}

export function sceneIndexForStation(station) {
  return stationAt((station - 1) * STATION.DISTANCE_M).scene;
}
