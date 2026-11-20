// DUNE TAC TOE · 谜题关卡（12 关，3 章）
// board：9 格数组（行优先），'X'=仙人掌（玩家，先手），'O'=蝎子（AI，完美防守），null=空。
// 约定：X 先手，故 #X === #O。所有残局由 Minimax 单测验证：
//   - goal 'win'：X 能在 movesLimit 步内强制获胜（tests/levels.test.mjs 断言 winIn 恰好等于 movesLimit）；
//   - goal 'draw'：X 无法获胜，但能逼平完美 AI（第 12 关）。
// 场景三章换章必换：dawn（晨曦沙丘）/ dusk（黄昏峡谷）/ night（夜晚绿洲）。

export const LEVELS = [
  {
    index: 1, scene: 'dawn',
    board: ['X', 'X', null, null, 'O', null, null, null, 'O'],
    movesLimit: 1, goal: 'win',
    newElement: 'win-in-1：看清三连的最后一块',
    hint: 'Top row is one tile short.',
  },
  {
    index: 2, scene: 'dawn',
    board: ['X', 'X', null, null, null, 'O', null, null, 'O'],
    movesLimit: 1, goal: 'win',
    newElement: 'win-in-1 with pressure：蝎子已有成线威胁',
    hint: 'Win before the scorpion takes the right column.',
  },
  {
    index: 3, scene: 'dawn',
    board: ['X', null, null, 'O', null, null, null, 'X', 'O'],
    movesLimit: 2, goal: 'win',
    newElement: 'fork 双威胁：一步制造两条胜线',
    hint: 'One move, two winning lines.',
  },
  {
    index: 4, scene: 'dawn',
    board: ['X', 'O', null, null, null, 'X', null, null, 'O'],
    movesLimit: 2, goal: 'win',
    newElement: 'double threat 斜线+边线交叉',
    hint: 'The middle row unlocks the diagonal.',
  },
  {
    index: 5, scene: 'dusk',
    board: ['X', 'O', 'X', null, null, 'O', null, null, null],
    movesLimit: 2, goal: 'win',
    newElement: 'corner fork 角位双叉（两条等价胜路）',
    hint: 'Two different tiles both win.',
  },
  {
    index: 6, scene: 'dusk',
    board: [null, null, 'X', 'O', 'X', null, 'O', null, null],
    movesLimit: 2, goal: 'win',
    newElement: 'block-then-fork 先堵蝎子再反杀',
    hint: 'Deny the scorpion first, then strike.',
  },
  {
    index: 7, scene: 'dusk',
    board: [null, null, null, 'X', null, 'O', null, 'X', 'O'],
    movesLimit: 3, goal: 'win',
    newElement: 'counter-kill 反杀：三连长的连续逼迫',
    hint: 'Every move must be a threat.',
  },
  {
    index: 8, scene: 'dusk',
    board: [null, 'X', null, 'O', null, 'X', 'O', null, null],
    movesLimit: 3, goal: 'win',
    newElement: 'squeeze 挤压：让蝎子无路可堵',
    hint: 'Push the scorpion into a corner.',
  },
  {
    index: 9, scene: 'night',
    board: ['X', null, null, null, null, 'O', null, 'X', 'O'],
    movesLimit: 3, goal: 'win',
    newElement: 'triple threat 三连威胁的连锁',
    hint: 'Chain three threats in a row.',
  },
  {
    index: 10, scene: 'night',
    board: [null, 'X', 'O', 'X', null, 'O', null, null, null],
    movesLimit: 3, goal: 'win',
    newElement: 'long game 长线规划：唯一胜点',
    hint: 'Only one first move keeps the win alive.',
  },
  {
    index: 11, scene: 'night',
    board: [null, null, null, null, null, null, 'X', null, 'O'],
    movesLimit: 3, goal: 'win',
    newElement: 'plan-from-nothing 从近乎空盘起强制 3 步胜',
    hint: 'Plan three moves ahead from the start.',
  },
  {
    index: 12, scene: 'night',
    board: [null, null, 'X', 'O', null, 'X', 'O', 'X', 'O'],
    movesLimit: 9, goal: 'draw',
    newElement: 'perfect defense 逼平完美蝎子（无法获胜）',
    hint: 'Block the left column and force the draw.',
  },
];

export const LEVEL_COUNT = LEVELS.length;
