// PLUMBER RUN · 三场景包（换章必换：色板 + 构图 + 装饰）
// 主题：1 晨市屋顶（暖）/ 2 下水道（青绿）/ 3 夜工厂（靛红）
export const THEMES = [
  {
    id: 'morning',
    skyTop: '#ffdca8',
    skyBottom: '#ff8f66',
    sun: '#fff3c4',
    farDecor: '#e98a5e',
    nearDecor: '#c96a44',
    ground: '#b06a3a',
    groundDark: '#8a4f28',
    groundLine: '#6d3c1e',
    brick: '#c97a3e',
    brickLine: '#8a4f28',
    question: '#f6b93b',
    solid: '#d9925b',
    fog: 'rgba(255, 214, 160, 0.0)',
  },
  {
    id: 'sewer',
    skyTop: '#06302e',
    skyBottom: '#0b4f48',
    sun: '#2fe0b0',
    farDecor: '#0f6a5c',
    nearDecor: '#0a4c42',
    ground: '#1e6b5e',
    groundDark: '#165248',
    groundLine: '#0d3c34',
    brick: '#2f8a74',
    brickLine: '#14574a',
    question: '#43e0b0',
    solid: '#2a7766',
    fog: 'rgba(6, 48, 46, 0.25)',
  },
  {
    id: 'factory',
    skyTop: '#150a24',
    skyBottom: '#3a1020',
    sun: '#ff4d5a',
    farDecor: '#3a1a3a',
    nearDecor: '#2a1030',
    ground: '#3c2a4e',
    groundDark: '#2c1d3c',
    groundLine: '#1c1230',
    brick: '#5a3a66',
    brickLine: '#2c1d3c',
    question: '#ff7a5c',
    solid: '#4a3560',
    fog: 'rgba(20, 8, 30, 0.3)',
  },
];

export function themeFor(level) {
  return THEMES[Math.floor((level - 1) / 4) % 3];
}
