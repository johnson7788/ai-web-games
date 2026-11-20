// HOLE MUNCH · 场景包主题（M2 渲染配色 + 装饰）
// 三场景包：old-town 暖黄 / harbor 青蓝 / future-city 霓虹粉紫 —— 换章必换：色板 + 构图 + 装饰。

export const SCENES = {
  'old-town': {
    bg: '#171008',
    bg2: '#241809',
    ground: '#1c1409',
    road: '#2a2012',
    roadLine: '#3d2f1b',
    block: '#2e2316',
    blockEdge: '#4a3720',
    window: '#ffd27a',
    windowDim: '#8a6a35',
    accent: '#ffb84d',
    glow: '#ffcf7a',
    decor: 'oldtown',
    water: null,
  },
  harbor: {
    bg: '#051019',
    bg2: '#08222e',
    ground: '#062028',
    road: '#0b2a33',
    roadLine: '#13414d',
    block: '#0e2c38',
    blockEdge: '#1a4a59',
    window: '#7fe8ff',
    windowDim: '#2e8ea6',
    accent: '#4fd8ff',
    glow: '#a5f0ff',
    decor: 'harbor',
    water: '#0a3a4c',
  },
  'future-city': {
    bg: '#0c0416',
    bg2: '#1a0a2c',
    ground: '#10051e',
    road: '#1b0a2e',
    roadLine: '#2a1542',
    block: '#180a2e',
    blockEdge: '#3a1d5e',
    window: '#ff6ef0',
    windowDim: '#a83bd8',
    accent: '#ff5ad0',
    glow: '#ffb1f0',
    decor: 'future',
    water: null,
  },
};

export function sceneOf(name) {
  return SCENES[name] || SCENES['old-town'];
}

// 每种可吞物的主题无关配色（发光色）
export const OBJECT_COLORS = {
  lamp: '#ffd98a',
  car: '#ff9d5c',
  bus: '#ffd94d',
  building: '#ffcf7a',
  skyscraper: '#ffb1f0',
  meteor: '#7ef0ff',
};
