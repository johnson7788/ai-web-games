// config/gameplay.js — 电路点灯（Lights Out 变体）的规则与数值（config-first）
// 纯数据 + 纯函数，不碰 DOM/localStorage/Date.now；随机由 config/levels.js 用种子驱动。
//
// 格型（原创改造，全部在「点一下翻转一组格」的线性/状态模型里）：
//   node       标准节点：翻转自身 + 上下左右
//   diode      二极管：单向翻转，自身 + 下方两格（下、下下）
//   capacitor  电容：状态式「点两次才翻转」——第一下蓄能（不翻转），第二下放电翻转自身+上下左右
//   relay      继电器：联动对角，自身 + 四个对角
//   insulator  绝缘格：不可直接点按（仍可被邻格翻转）
//
// 关卡生成用「从全亮状态施加一组线性按压（不直接点电容/绝缘格）得到初始盘面」，
// 该组按压本身就是一个可行解 → 保证每关可解（详见 config/levels.js 与 src/game/solver.js）。

export const STEP = 1 / 60;
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

// 线性格型的按压偏移表（相对被点格）。capcitor 单独走状态机，不在此表。
export const PRESS_PATTERNS = {
  orth: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  down2: [[0, 0], [1, 0], [2, 0]],
  diag: [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  none: [],
};

// 电容放电时的翻转集合（自身 + 上下左右）。
export const CAP_PATTERN = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

export const TYPE_PATTERN = {
  node: 'orth',
  diode: 'down2',
  relay: 'diag',
  insulator: 'none',
  capacitor: 'capacitor',
};

export const CELL_TYPES = ['node', 'diode', 'capacitor', 'relay', 'insulator'];

export function inBounds(N, r, c) {
  return r >= 0 && c >= 0 && r < N && c < N;
}

export function allLit(board) {
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (board[r][c] !== 1) return false;
    }
  }
  return true;
}

export function litCount(board) {
  let n = 0;
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (board[r][c] === 1) n += 1;
    }
  }
  return n;
}

/** 翻转 board 上以 (r,c) 为中心、按 offsets 展开的格子（越界忽略）。 */
export function toggleOffsets(board, N, r, c, offsets) {
  for (const [dr, dc] of offsets) {
    const rr = r + dr;
    const cc = c + dc;
    if (inBounds(N, rr, cc)) board[rr][cc] ^= 1;
  }
}

/** 线性按压（生成器/求解器用）：不处理电容的两段状态，只按格型翻转固定集合。 */
export function applyLinearPress(state, r, c) {
  if (!inBounds(state.N, r, c)) return false;
  const t = state.types[r][c];
  if (t === 'insulator' || t === 'capacitor') return false;
  toggleOffsets(state.board, state.N, r, c, PRESS_PATTERNS[TYPE_PATTERN[t]]);
  return true;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}
