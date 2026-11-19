// 关卡表：目标方块值（到达即通关）+ 岩石生成节奏 + 场景主题色
// 玩法骨架 1:1 还原「云浮消消乐」的 5×7 落块合并；主题换皮为霓虹街机。
export const LEVELS = [
  { index: 1, target: 32,   rockEvery: 0, theme: 'dawn' },
  { index: 2, target: 64,   rockEvery: 0, theme: 'dusk' },
  { index: 3, target: 128,  rockEvery: 6, theme: 'night' },
  { index: 4, target: 256,  rockEvery: 5, theme: 'dawn' },
  { index: 5, target: 512,  rockEvery: 5, theme: 'dusk' },
  { index: 6, target: 1024, rockEvery: 4, theme: 'night' },
  { index: 7, target: 2048, rockEvery: 4, theme: 'dawn' },
  { index: 8, target: 4096, rockEvery: 3, theme: 'dusk' },
  { index: 9, target: 8192, rockEvery: 3, theme: 'night' },
];

export const LEVEL_COUNT = LEVELS.length;
