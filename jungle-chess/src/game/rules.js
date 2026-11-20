// 斗兽棋（Jungle Chess / Animal Chess）核心规则 —— 纯逻辑，零 DOM/window/Date.now。
// 棋盘 7 列 × 9 行（r=0..8 顶，c=0..6 左）。棋盘用扁平 Int 数组表示，长度 63，idx = r*7+c。
//   0 = 空；正数 = 蓝方（BLUE=0，玩家，底）；负数 = 红方（RED=1，对手，顶）。
//   |v| - 1 = rank：rat=0 cat=1 dog=2 wolf=3 leopard=4 tiger=5 lion=6 elephant=7（象>狮>虎>豹>狼>狗>猫>鼠）。
// 规则：鼠可吃象 / 同级互吃 / 鼠入河（水中只有鼠互吃）/ 狮虎跳河（直线越水、无鼠阻挡）/
//       己方陷阱内敌方兽任意被吃 / 占领对方兽穴获胜 / 每回合动一子（上下左右一格）。

export const COLS = 7;
export const ROWS = 9;
export const N = COLS * ROWS; // 63

export const BLUE = 0;
export const RED = 1;

// rank 常量（0=最弱鼠 … 7=最强象）
export const RAT = 0;
export const CAT = 1;
export const DOG = 2;
export const WOLF = 3;
export const LEOPARD = 4;
export const TIGER = 5;
export const LION = 6;
export const ELEPHANT = 7;

export const ANIMALS = ['rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant'];
export const RANK_ORDER = ANIMALS; // 由弱到强，展示用

export const rc = (r, c) => r * COLS + c;
export const rOf = (i) => Math.floor(i / COLS);
export const cOf = (i) => i % COLS;

export const pieceSide = (v) => (v > 0 ? BLUE : RED);
export const pieceRank = (v) => Math.abs(v) - 1;
export const pieceValue = (side, rank) => (side === BLUE ? rank + 1 : -(rank + 1));
export const hasPiece = (v) => v !== 0;

// 地形
export function isWaterRC(r, c) {
  return r >= 3 && r <= 5 && (c === 1 || c === 2 || c === 4 || c === 5);
}
export function isWater(i) {
  return isWaterRC(rOf(i), cOf(i));
}

// 兽穴：红顶 (0,3)，蓝底 (8,3)
export const DEN = { [RED]: rc(0, 3), [BLUE]: rc(8, 3) };
export function denOf(side) {
  return DEN[side];
}

// 陷阱：红 [(0,2),(0,4),(1,3)]，蓝 [(8,2),(8,4),(7,3)]
const TRAP_SETS = {
  [RED]: new Set([rc(0, 2), rc(0, 4), rc(1, 3)]),
  [BLUE]: new Set([rc(8, 2), rc(8, 4), rc(7, 3)]),
};
export function trapsOf(side) {
  return TRAP_SETS[side];
}
export function isTrapOf(i, side) {
  return TRAP_SETS[side].has(i);
}

export function inBoard(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

// ---------- 初始局面（完整对局） ----------
export function initialBoard() {
  const b = new Array(N).fill(0);
  // 蓝（底，side 0）：row8 = rat/cat/wolf/leopard/tiger/lion，row7 = dog/elephant
  const blue = [
    [8, 0, RAT], [8, 1, CAT], [8, 2, WOLF], [8, 4, LEOPARD], [8, 5, TIGER], [8, 6, LION],
    [7, 1, DOG], [7, 5, ELEPHANT],
  ];
  // 红（顶，side 1）对称
  const red = [
    [0, 0, RAT], [0, 1, CAT], [0, 2, WOLF], [0, 4, LEOPARD], [0, 5, TIGER], [0, 6, LION],
    [1, 1, DOG], [1, 5, ELEPHANT],
  ];
  for (const [r, c, rank] of blue) b[rc(r, c)] = pieceValue(BLUE, rank);
  for (const [r, c, rank] of red) b[rc(r, c)] = pieceValue(RED, rank);
  return b;
}

// 从稀疏摆放构造局面：pieces = [{ r, c, side, rank }]
export function setupBoard(pieces = []) {
  const b = new Array(N).fill(0);
  for (const p of pieces) b[rc(p.r, p.c)] = pieceValue(p.side, p.rank);
  return b;
}

// ---------- 吃子判定 ----------
// 返回 'capture'（进攻方吃掉防守方）| 'mutual'（同归于尽）| null（不可吃/不可进）
// defenderOnTrap：防守方是否站在进攻方陷阱上
export function captureOutcome(atkRank, defRank, atkSide, atkInWater, defInWater, defenderOnTrap) {
  // 水对水：只有鼠能互吃（鼠对鼠 → mutual）
  if (defInWater) {
    if (!atkInWater) return null;       // 陆地兽不能吃水中兽（包括陆鼠）
    if (atkRank !== RAT) return null;   // 水中只有鼠能互吃（理论上 atk 也是鼠才能下水）
    if (defRank !== RAT) return null;
    return 'mutual';                    // 鼠 vs 鼠 同归于尽
  }
  // 防守方在陆地上；进攻方若在水中，鼠不能出水吃陆兽
  if (atkInWater) return null;

  // 双方都在陆地
  if (defenderOnTrap) return 'capture'; // 敌在我陷阱内 → 任意吃
  if (atkRank === RAT && defRank === ELEPHANT) return 'capture'; // 鼠克象
  if (atkRank > defRank) return 'capture';
  if (atkRank === defRank) return 'mutual';
  return null; // 攻方更弱：不可走（自杀步非法）
}

// ---------- 生成某方全部合法走法 ----------
// 返回 [{ from, to, outcome: 'capture'|'mutual'|null, jump: bool }]
export function genMoves(board, side) {
  const moves = [];
  const ownDen = DEN[side];
  const enemySide = 1 - side;
  const trap = TRAP_SETS[side];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (let i = 0; i < N; i += 1) {
    const v = board[i];
    if (v === 0 || pieceSide(v) !== side) continue;
    const rank = pieceRank(v);
    const r = rOf(i);
    const c = cOf(i);
    const inWater = isWaterRC(r, c);

    // 1) 普通一步（上下左右）
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBoard(nr, nc)) continue;
      const to = rc(nr, nc);
      if (to === ownDen) continue;                 // 不能进自己兽穴
      const tv = board[to];
      if (tv !== 0 && pieceSide(tv) === side) continue; // 不能吃自己
      if (!inWater && isWaterRC(nr, nc) && rank !== RAT) continue; // 非鼠不能下水

      let outcome = null;
      if (tv !== 0) {
        const defRank = pieceRank(tv);
        const defInWater = isWaterRC(nr, nc);
        const onTrap = trap.has(to);
        outcome = captureOutcome(rank, defRank, side, inWater, defInWater, onTrap);
        if (outcome === null) continue;            // 非法吃子（自杀）
      }
      moves.push({ from: i, to, outcome, jump: false });
    }

    // 2) 狮虎跳河（直线越水，水中无鼠阻挡）
    if (rank === TIGER || rank === LION) {
      if (!inWater) {
        // 横向跳：水行 (r=3,4,5)，从 c0↔c3 或 c3↔c6，越水 2 格
        if (r >= 3 && r <= 5) {
          const hops = [];
          if (c === 0) hops.push([3, [rc(r, 1), rc(r, 2)]]);
          else if (c === 6) hops.push([3, [rc(r, 4), rc(r, 5)]]);
          else if (c === 3) hops.push([0, [rc(r, 1), rc(r, 2)]], [6, [rc(r, 4), rc(r, 5)]]);
          for (const [tc, mids] of hops) {
            if (mids.some((m) => board[m] !== 0)) continue; // 有鼠阻挡（任何子）
            const to = rc(r, tc);
            pushJump(board, side, i, to, ownDen, moves);
          }
        }
        // 纵向跳：水列 (c=1,2,4,5)，从 r2↔r6，越水 3 格
        if (c === 1 || c === 2 || c === 4 || c === 5) {
          if (r === 2 || r === 6) {
            const tr = r === 2 ? 6 : 2;
            const mids = [rc(3, c), rc(4, c), rc(5, c)];
            if (mids.some((m) => board[m] !== 0)) continue;
            const to = rc(tr, c);
            pushJump(board, side, i, to, ownDen, moves);
          }
        }
      }
    }
  }
  return moves;
}

function pushJump(board, side, from, to, ownDen, moves) {
  if (to === ownDen) return;
  const tv = board[to];
  if (tv !== 0 && pieceSide(tv) === side) return; // 落点是自己子
  let outcome = null;
  if (tv !== 0) {
    const atkRank = pieceRank(board[from]);
    const defRank = pieceRank(tv);
    const onTrap = TRAP_SETS[side].has(to);
    outcome = captureOutcome(atkRank, defRank, side, false, false, onTrap);
    if (outcome === null) return;
  }
  moves.push({ from, to, outcome, jump: true });
}

// ---------- 走子（返回新棋盘 + 结果） ----------
// result: { board, captured: null|{side,rank}, denCaptured: side|null, winner: side|null }
export function applyMove(board, from, to) {
  const b = board.slice();
  const atk = b[from];
  const def = b[to];
  const atkSide = pieceSide(atk);
  const outcome = def === 0 ? null : captureOutcome(
    pieceRank(atk), pieceRank(def), atkSide,
    isWater(from), isWater(to), TRAP_SETS[atkSide].has(to),
  );

  let captured = null;
  let denCaptured = null;
  let winner = null;

  if (to === DEN[1 - atkSide]) {
    // 踏入对方兽穴 → 获胜
    b[to] = atk;
    b[from] = 0;
    denCaptured = 1 - atkSide;
    winner = atkSide;
  } else if (def === 0) {
    b[to] = atk;
    b[from] = 0;
  } else if (outcome === 'mutual') {
    b[to] = 0;
    b[from] = 0;
    captured = { side: pieceSide(def), rank: pieceRank(def) };
  } else {
    // capture
    b[to] = atk;
    b[from] = 0;
    captured = { side: pieceSide(def), rank: pieceRank(def) };
  }

  return { board: b, captured, denCaptured, winner, outcome };
}

// ---------- 判定某方是否"无子可动 / 被吃光"（用于对局结束） ----------
export function sidePieceCount(board, side) {
  let n = 0;
  for (let i = 0; i < N; i += 1) {
    if (board[i] !== 0 && pieceSide(board[i]) === side) n += 1;
  }
  return n;
}

// 是否有子在场
export function anyPiece(board, side) {
  return sidePieceCount(board, side) > 0;
}

// ---------- 展示辅助：piece int → 描述 ----------
export function describe(v) {
  if (v === 0) return null;
  return { side: pieceSide(v), rank: pieceRank(v), animal: ANIMALS[pieceRank(v)] };
}
