// EGG BOOM · 场景主题（三套场景包：清晨厨房 / 甜品站 / 午夜食堂）
// 换章必换：色板 + 构图 + 装饰（不只是换色）。
export const THEMES = {
  kitchen: {
    key: 'scene.kitchen',
    skyTop: '#fdf6e3',
    skyBottom: '#f6e7c1',
    counter: '#e8d9b8',
    counterEdge: '#d8c39a',
    wall: '#f3ecd8',
    accent: '#f2a65a',       // 暖橙
    eggBody: '#fff3dd',
    eggShade: '#f6d9a8',
    shellColor: '#b9834f',
    dough: '#f4e3c6',
    doughShade: '#e2cda2',
    number: '#7a5b3a',
    decor: ['#d9a06b', '#c88a4f', '#b9743c'],
    night: false,
  },
  dessert: {
    key: 'scene.dessert',
    skyTop: '#ffe9f2',
    skyBottom: '#ffd3e6',
    counter: '#f7cfdf',
    counterEdge: '#eda7c6',
    wall: '#fde6ef',
    accent: '#ff6fa5',       // 莓粉
    eggBody: '#fff4f8',
    eggShade: '#ffd6e6',
    shellColor: '#e678a8',
    dough: '#fde1ec',
    doughShade: '#f3c2d9',
    number: '#a04a72',
    decor: ['#ff8fb8', '#f76fa8', '#e95f9d'],
    night: false,
  },
  canteen: {
    key: 'scene.canteen',
    skyTop: '#1b2440',
    skyBottom: '#2b3557',
    counter: '#26314f',
    counterEdge: '#1a2238',
    wall: '#232c4a',
    accent: '#7f9cff',       // 靛蓝冷光
    eggBody: '#e9ecff',
    eggShade: '#bcc6f0',
    shellColor: '#5a6cbd',
    dough: '#d9deff',
    doughShade: '#b7c0ee',
    number: '#2c3a70',
    decor: ['#6f86e8', '#8aa0f0', '#5a6cc8'],
    night: true,
  },
};

export function themeOf(scene) {
  return THEMES[scene] || THEMES.kitchen;
}
