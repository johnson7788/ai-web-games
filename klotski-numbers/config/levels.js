// KLOTSKI NUMBERS · 关卡表
// size      棋盘边长（size×size）
// timeLimit 超时上限（秒），到点判负（对应死亡/失败状态）
// hintCount 每局提示次数；shuffleCount 每局重洗次数（道具，有限 = 有代价）
// timePar   时间星门槛（≤ 该秒数 +1 星）；movePar 步数星门槛（≤ 该步数 +1 星）
export const LEVELS = [
  { index: 1, size: 3, timeLimit: 180, hintCount: 1, shuffleCount: 1, timePar: 45,  movePar: 25  },
  { index: 2, size: 4, timeLimit: 300, hintCount: 2, shuffleCount: 1, timePar: 150, movePar: 90  },
  { index: 3, size: 5, timeLimit: 480, hintCount: 3, shuffleCount: 2, timePar: 300, movePar: 260 },
  { index: 4, size: 6, timeLimit: 720, hintCount: 4, shuffleCount: 2, timePar: 480, movePar: 560 },
  { index: 5, size: 7, timeLimit: 900, hintCount: 5, shuffleCount: 3, timePar: 720, movePar: 980 },
];

export const LEVEL_COUNT = LEVELS.length;
