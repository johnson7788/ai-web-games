// 地图表 —— 世界固定 1280×720，地面 y=636。
// 平台是单向（只能从上方落上去，可从下方跳穿）。
// 色板与装饰供渲染层使用；平台/危险区供逻辑层使用。
export const MAPS = {
  draft: {
    id: 'draft',
    act: 1,
    nameKey: 'act.draft.name',
    style: 'pencil',                 // 纸·铅笔草稿
    palette: {
      bg: '#f2eee3', bg2: '#e7e1d2', ink: '#2c2a26', inkSoft: '#6d675c',
      accent: '#b8422f', accent2: '#8a8577', line: '#3a362f', glow: 'rgba(0,0,0,0)',
      grid: 'rgba(70,64,54,0.10)', dust: 'rgba(60,55,45,0.35)', fog: 'rgba(242,238,227,0.0)',
    },
    platforms: [
      { x: 118, y: 516, w: 232, h: 16 },
      { x: 930, y: 516, w: 232, h: 16 },
      { x: 548, y: 434, w: 184, h: 16 },
      { x: 318, y: 352, w: 132, h: 14 },
      { x: 830, y: 352, w: 132, h: 14 },
    ],
    hazards: [],
    spawns: [{ x: 300, y: 636 }, { x: 980, y: 636 }, { x: 200, y: 516 }, { x: 1080, y: 516 }, { x: 640, y: 434 }],
    airSpawns: [{ x: 60, y: 80 }, { x: 1220, y: 80 }, { x: 420, y: 40 }, { x: 860, y: 40 }],
    playerSpawn: { x: 300, y: 560 },
    decor: [
      { type: 'stain', x: 1010, y: 150, s: 1.15, a: 0.5 },
      { type: 'fold', x: 620, y: 0, s: 1, a: 0.5 },
      { type: 'tape', x: 120, y: 26, s: 1, a: 0.7 },
      { type: 'tape', x: 1160, y: 26, s: -1, a: 0.7 },
      { type: 'shaving', x: 220, y: 640, s: 1, a: 0.6 },
      { type: 'shaving', x: 1050, y: 640, s: 0.8, a: 0.5 },
      { type: 'construction', x: 640, y: 300, s: 1, a: 0.25 },
    ],
    ambient: 'dust',
    music: { root: 62, scale: [0, 2, 4, 7, 9], tempo: 70, layers: ['pad', 'pluck'], mood: 'quiet' },
  },

  blueprint: {
    id: 'blueprint',
    act: 2,
    nameKey: 'act.blueprint.name',
    style: 'blueprint',
    palette: {
      bg: '#0a2744', bg2: '#0e3357', ink: '#d8f2ff', inkSoft: '#7fb6d8',
      accent: '#46d8ff', accent2: '#ffb03a', line: '#bfe9ff', glow: 'rgba(70,216,255,0.55)',
      grid: 'rgba(140,215,255,0.16)', dust: 'rgba(160,225,255,0.45)', fog: 'rgba(10,45,80,0.35)',
    },
    platforms: [
      { x: 52, y: 474, w: 300, h: 14 },
      { x: 928, y: 474, w: 300, h: 14 },
      { x: 474, y: 386, w: 332, h: 14 },
      { x: 196, y: 300, w: 206, h: 12 },
      { x: 878, y: 300, w: 206, h: 12 },
      { x: 618, y: 254, w: 44, h: 10 },
    ],
    hazards: [
      { type: 'ink', x: 560, y: 624, w: 160, h: 12 },
    ],
    spawns: [{ x: 260, y: 636 }, { x: 1020, y: 636 }, { x: 160, y: 474 }, { x: 1120, y: 474 }, { x: 640, y: 386 }],
    airSpawns: [{ x: 80, y: 90 }, { x: 1200, y: 90 }, { x: 640, y: 60 }],
    playerSpawn: { x: 260, y: 560 },
    decor: [
      { type: 'grid', x: 640, y: 360, s: 1, a: 1 },
      { type: 'dimension', x: 380, y: 690, s: 1, a: 0.7 },
      { type: 'stamp', x: 1080, y: 150, s: 1, a: 0.8 },
      { type: 'rivet', x: 100, y: 300, s: 1, a: 0.6 },
      { type: 'rivet', x: 1180, y: 300, s: 1, a: 0.6 },
      { type: 'cable', x: 640, y: 120, s: 1, a: 0.5 },
      { type: 'tower', x: 200, y: 560, s: 1, a: 0.18 },
      { type: 'tower', x: 1080, y: 560, s: 0.8, a: 0.14 },
    ],
    ambient: 'dust',
    music: { root: 57, scale: [0, 2, 3, 7, 8], tempo: 84, layers: ['pulse', 'pad'], mood: 'mechanical' },
  },

  neon: {
    id: 'neon',
    act: 3,
    nameKey: 'act.neon.name',
    style: 'neon',
    palette: {
      bg: '#07060f', bg2: '#0d0a1c', ink: '#f2eeff', inkSoft: '#8f86b8',
      accent: '#ff2e88', accent2: '#25e6d8', line: '#ffffff', glow: 'rgba(255,46,136,0.65)',
      grid: 'rgba(120,90,255,0.10)', dust: 'rgba(255,120,200,0.6)', fog: 'rgba(30,10,60,0.5)',
    },
    platforms: [
      { x: 126, y: 506, w: 262, h: 14 },
      { x: 892, y: 506, w: 262, h: 14 },
      { x: 552, y: 404, w: 176, h: 14 },
      { x: 292, y: 336, w: 186, h: 12 },
      { x: 802, y: 336, w: 186, h: 12 },
    ],
    hazards: [
      { type: 'ink', x: 596, y: 626, w: 120, h: 10 },
    ],
    spawns: [{ x: 240, y: 636 }, { x: 1040, y: 636 }, { x: 200, y: 506 }, { x: 1080, y: 506 }, { x: 640, y: 404 }],
    airSpawns: [{ x: 90, y: 70 }, { x: 1190, y: 70 }, { x: 640, y: 50 }],
    playerSpawn: { x: 240, y: 560 },
    decor: [
      { type: 'sign', x: 1050, y: 210, s: 1, a: 1 },
      { type: 'sign', x: 180, y: 240, s: -1, a: 0.8 },
      { type: 'moon', x: 1090, y: 130, s: 1, a: 0.9 },
      { type: 'puddle', x: 420, y: 650, s: 1, a: 0.8 },
      { type: 'puddle', x: 880, y: 660, s: -1, a: 0.6 },
      { type: 'cable', x: 640, y: 90, s: 1, a: 0.7 },
      { type: 'tower', x: 90, y: 560, s: 1, a: 0.3 },
      { type: 'tower', x: 1190, y: 560, s: 1.1, a: 0.25 },
    ],
    ambient: 'rain',
    music: { root: 50, scale: [0, 3, 5, 7, 10], tempo: 104, layers: ['bass', 'arp', 'pad'], mood: 'neon' },
  },

  wash: {
    id: 'wash',
    act: 4,
    nameKey: 'act.wash.name',
    style: 'wash',
    palette: {
      bg: '#efe8d8', bg2: '#e2d8c2', ink: '#1c1a16', inkSoft: '#6b6252',
      accent: '#a6272a', accent2: '#3c4a3a', line: '#24211b', glow: 'rgba(0,0,0,0)',
      grid: 'rgba(0,0,0,0)', dust: 'rgba(90,80,60,0.35)', fog: 'rgba(239,232,216,0.4)',
    },
    platforms: [
      { x: 64, y: 520, w: 248, h: 14 },
      { x: 968, y: 520, w: 248, h: 14 },
      { x: 496, y: 448, w: 288, h: 14 },
      { x: 244, y: 358, w: 168, h: 12 },
      { x: 868, y: 358, w: 168, h: 12 },
      { x: 604, y: 296, w: 72, h: 10 },
    ],
    hazards: [
      { type: 'ink', x: 300, y: 626, w: 220, h: 10 },
      { type: 'eraser', x: 900, y: 626, w: 150, h: 10 },
    ],
    spawns: [{ x: 280, y: 636 }, { x: 1000, y: 636 }, { x: 170, y: 520 }, { x: 1110, y: 520 }, { x: 640, y: 448 }],
    airSpawns: [{ x: 70, y: 80 }, { x: 1210, y: 80 }, { x: 640, y: 40 }],
    playerSpawn: { x: 280, y: 560 },
    decor: [
      { type: 'mountain', x: 640, y: 380, s: 1, a: 0.5 },
      { type: 'seal', x: 1120, y: 180, s: 1, a: 0.85 },
      { type: 'petal', x: 300, y: 200, s: 1, a: 0.6 },
      { type: 'petal', x: 980, y: 280, s: 0.8, a: 0.5 },
      { type: 'fold', x: 640, y: 0, s: 1, a: 0.4 },
      { type: 'brushmark', x: 760, y: 170, s: 1, a: 0.3 },
    ],
    ambient: 'petal',
    music: { root: 55, scale: [0, 2, 3, 5, 7, 10], tempo: 62, layers: ['koto', 'pad'], mood: 'fading' },
  },

  blank: {
    id: 'blank',
    act: 5,
    nameKey: 'act.blank.name',
    style: 'blank',
    boss: true,
    palette: {
      bg: '#f7f6f2', bg2: '#ffffff', ink: '#141414', inkSoft: '#7c7c7c',
      accent: '#c9432f', accent2: '#141414', line: '#1a1a1a', glow: 'rgba(0,0,0,0.12)',
      grid: 'rgba(0,0,0,0.05)', dust: 'rgba(0,0,0,0.3)', fog: 'rgba(255,255,255,0.5)',
    },
    platforms: [
      { x: 250, y: 490, w: 190, h: 12, shard: true },
      { x: 840, y: 490, w: 190, h: 12, shard: true },
    ],
    hazards: [],
    spawns: [{ x: 180, y: 636 }, { x: 1100, y: 636 }],
    airSpawns: [{ x: 120, y: 90 }, { x: 1160, y: 90 }],
    playerSpawn: { x: 300, y: 560 },
    decor: [
      { type: 'fragment', x: 320, y: 180, s: 1, a: 0.5 },
      { type: 'fragment', x: 980, y: 240, s: -1, a: 0.4 },
      { type: 'brushmark', x: 640, y: 120, s: 1.6, a: 0.12 },
    ],
    ambient: 'ash',
    music: { root: 45, scale: [0, 1, 5, 6, 10], tempo: 54, layers: ['drone', 'heart'], mood: 'void' },
  },
};

export const MAP_ORDER = ['draft', 'blueprint', 'neon', 'wash', 'blank'];

export default MAPS;
