// NEO TETRA · 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date.now）。
// 契约：createRun({seed}) → run.step(input) / run.getHud() / run.drainEvents() / run.phase。
// 事件名：pieceSpawn/move/rotate/softDrop/hardDrop/hold/lock/lineClear/tetra/heatUp/
//         whiteHotStart/whiteHotEnd/levelUp/layerEnter/gift/milestone/death/win。
import { STEP } from '../../config/game.config.js';
import {
  WELL, GRAVITY, DAS, LOCK, SCORE_SOFT, SCORE_HARD, HEAT, GIFT, STONE, MILESTONE,
  gravitySeconds, lineScore, levelForLines,
} from '../../config/gameplay.js';
import { LAYERS, LAYER_COUNT, layerAt } from '../../config/levels.js';
import { TYPES, COLOR_ID, cellsFor, rotState, kicksFor } from './tetromino.js';
import { mulberry32, shuffled } from './rng.js';
import {
  emptyBoard, cloneBoard, isEmptyCell, canPlaceAt, dropResult, placeCells,
  clearableRows, clearRows, lowestFilledRow, CELL,
} from './board.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    board: emptyBoard(),
    bag: [],       // 7-bag 队列（前端 = 下一个出块）
    next: [],      // 预览（nextCount 个）
    nextCount: 1,
    active: null,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,      // 累计消行
    layerLines: 0, // 本层已消行
    level: 1,
    layer: 1,
    heat: 0,
    whiteHot: false,
    whiteHotLeft: 0,
    slowUntil: -Infinity,
    narrow: false,
    dark: false,
    gravityTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    dasDir: 0,
    dasTimer: 0,
    _lastScoreMile: 0,
    stats: { score: 0, layerReached: 1, level: 1, pieces: 0 },
    events: [],
  };

  applyLayerFeatures(run);
  spawnNext(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 事件 ----------
function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}
function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  updateDAS(run, !!input.moveLeft, !!input.moveRight);
  if (input.rotateCW) tryRotate(run, 1);
  if (input.rotateCCW) tryRotate(run, -1);
  if (input.hold) doHold(run);
  if (input.hardDrop) doHardDrop(run);
  if (run.phase !== 'playing') { syncStats(run); return; }

  updateGravity(run, !!input.softDrop);
  updateWhiteHot(run);
  syncStats(run);
}

// ---------- 左右移动（DAS：首动立即，之后按 REPEAT 重复） ----------
function updateDAS(run, left, right) {
  if (!run.active) return;
  let dir = 0;
  if (left && !right) dir = -1;
  else if (right && !left) dir = 1;

  if (dir === 0) {
    run.dasDir = 0;
    run.dasTimer = 0;
    return;
  }
  if (dir !== run.dasDir) {
    run.dasDir = dir;
    tryMove(run, dir, 0);
    run.dasTimer = DAS.DELAY;
  } else {
    run.dasTimer -= STEP;
    if (run.dasTimer <= 0) {
      tryMove(run, dir, 0);
      run.dasTimer = DAS.REPEAT;
    }
  }
}

function canMove(run, dx, dy) {
  if (!run.active) return false;
  for (const [x, y] of run.active.cells) {
    if (!isEmptyCell(run.board, x + dx, y + dy)) return false;
  }
  return true;
}

function tryMove(run, dx, dy) {
  if (!canMove(run, dx, dy)) return false;
  run.active.x += dx;
  run.active.y += dy;
  run.active.cells = cellsFor(run.active.type, run.active.rot)
    .map(([cx, cy]) => [run.active.x + cx, run.active.y + cy]);
  if (dx !== 0) {
    emit(run, 'move', { x: run.active.x });
    resetLock(run);
  }
  return true;
}

function resetLock(run) {
  if (run.lockResets >= LOCK.MAX_RESETS) return;
  if (!canMove(run, 0, 1)) run.lockResets += 1;
  run.lockTimer = 0;
}

// ---------- 旋转（SRS 踢墙） ----------
function tryRotate(run, dir) {
  if (!run.active || run.active.type === 'O') return false;
  const from = run.active.rot;
  const to = rotState(run.active.type, from, dir);
  for (const [kx, ky] of kicksFor(run.active.type, from, to)) {
    const nx = run.active.x + kx;
    const ny = run.active.y + ky;
    if (canPlaceAt(run.board, run.active.type, to, nx, ny)) {
      run.active.rot = to;
      run.active.x = nx;
      run.active.y = ny;
      run.active.cells = cellsFor(run.active.type, to)
        .map(([cx, cy]) => [nx + cx, ny + cy]);
      emit(run, 'rotate', { rot: to });
      resetLock(run);
      return true;
    }
  }
  return false;
}

// ---------- hold ----------
function doHold(run) {
  if (!run.active || run.holdUsed) return;
  const cur = run.active.type;
  const prev = run.hold;
  run.hold = cur;
  run.holdUsed = true;
  emit(run, 'hold', { type: cur });

  if (prev) {
    activatePiece(run, spawnPiece(prev, false, false));
  } else {
    run.active = null;
    spawnNext(run);
  }
}

// ---------- 硬降 ----------
function doHardDrop(run) {
  if (!run.active) return;
  const res = dropResult(run.board, run.active.type, run.active.rot, run.active.x);
  if (!res.ok) return;
  const dist = res.y - run.active.y;
  run.active.y = res.y;
  run.active.cells = res.cells;
  if (dist > 0) run.score += dist * SCORE_HARD;
  emit(run, 'hardDrop', { distance: dist });
  lockPiece(run);
}

// ---------- 重力 / 软降 ----------
function updateGravity(run, softDrop) {
  if (!run.active) return;
  if (!canMove(run, 0, 1)) {
    run.lockTimer += STEP;
    if (run.lockTimer >= LOCK.DELAY) lockPiece(run);
    return;
  }
  run.lockTimer = 0;
  run.lockResets = 0;

  const slow = run.slowUntil > run.time;
  const interval = softDrop
    ? GRAVITY.SOFT_DROP
    : gravitySeconds(run.level, { whiteHot: run.whiteHot, slow });

  run.gravityTimer += STEP;
  while (run.gravityTimer >= interval) {
    run.gravityTimer -= interval;
    if (canMove(run, 0, 1)) {
      run.active.y += 1;
      run.active.cells = cellsFor(run.active.type, run.active.rot)
        .map(([cx, cy]) => [run.active.x + cx, run.active.y + cy]);
      if (softDrop) {
        run.score += SCORE_SOFT;
        emit(run, 'softDrop', { y: run.active.y });
      }
    } else {
      break;
    }
  }
}

// ---------- 白热态计时 ----------
function updateWhiteHot(run) {
  if (!run.whiteHot) return;
  run.whiteHotLeft -= STEP;
  if (run.whiteHotLeft <= 0) {
    run.whiteHot = false;
    run.whiteHotLeft = 0;
    emit(run, 'whiteHotEnd', {});
  }
}

// ---------- 出块 ----------
function spawnPiece(type, stone, gift) {
  const p = {
    type,
    rot: 0,
    x: WELL.SPAWN_X,
    y: WELL.SPAWN_Y,
    stone: !!stone,
    gift: !!gift,
  };
  p.cells = cellsFor(type, 0).map(([cx, cy]) => [p.x + cx, p.y + cy]);
  return p;
}

function refillBag(run) {
  if (run.bag.length <= run.nextCount) {
    run.bag.push(...shuffled(run.rng, TYPES));
  }
}

function activatePiece(run, p) {
  run.active = p;
  run.lockTimer = 0;
  run.lockResets = 0;
  run.gravityTimer = 0;
  emit(run, 'pieceSpawn', { type: p.type, stone: p.stone, gift: p.gift });
  if (!canPlaceAt(run.board, p.type, p.rot, p.x, p.y)) {
    die(run);
  }
}

function spawnNext(run) {
  refillBag(run);
  const type = run.bag.shift();
  refillBag(run);
  run.next = run.bag.slice(0, run.nextCount);
  const layer = layerAt(run.layer);
  const stone = !!(layer.features.heavy && run.rng() < STONE.CHANCE);
  const gift = !!(layer.features.gift && run.rng() < GIFT.CHANCE);
  run.stats.pieces += 1;
  activatePiece(run, spawnPiece(type, stone, gift));
}

// ---------- 锁定 / 消行 / 得分 / 热力 / 等级 / 矿层 ----------
function lockPiece(run) {
  if (!run.active) return;
  const piece = run.active;
  run.active = null;

  const board = cloneBoard(run.board);
  let anyAbove = false;
  for (const [x, y] of piece.cells) {
    if (y < 0) { anyAbove = true; continue; }
    board[y][x] = piece.stone ? CELL.STONE : COLOR_ID[piece.type];
  }
  if (anyAbove) { die(run); return; }
  run.board = board;

  if (piece.gift) applyGift(run);

  const rows = clearableRows(run.board, { narrow: run.narrow });
  if (rows.length) {
    run.board = clearRows(run.board, rows);
    applyLayerFeatures(run); // 消行下移后重铺窄井墙
    applyClear(run, rows.length);
  } else {
    emit(run, 'lock', { lines: 0 });
  }

  run.holdUsed = false;
  spawnNext(run);
}

function applyGift(run) {
  const kinds = ['heat', 'score', 'slow', 'clear'];
  const kind = kinds[Math.floor(run.rng() * kinds.length)];
  emit(run, 'gift', { kind });
  if (kind === 'heat') {
    run.heat = Math.min(HEAT.MAX, run.heat + GIFT.HEAT);
    emit(run, 'heatUp', { heat: run.heat });
    maybeWhiteHot(run);
  } else if (kind === 'score') {
    run.score += GIFT.SCORE;
    emitMilestone(run);
  } else if (kind === 'slow') {
    run.slowUntil = run.time + GIFT.SLOW_SEC;
  } else if (kind === 'clear') {
    const row = lowestFilledRow(run.board, { narrow: run.narrow });
    if (row >= 0) {
      run.board = clearRows(run.board, [row]);
      applyLayerFeatures(run);
      applyClear(run, 1);
    }
  }
}

function applyClear(run, n) {
  run.lines += n;
  run.layerLines += n;
  const gained = lineScore(n, run.level, run.whiteHot);
  run.score += gained;
  run.heat = Math.min(HEAT.MAX, run.heat + (HEAT.PER_CLEAR[n] || 0));
  emit(run, 'lineClear', { n, gained, level: run.level, score: run.score });
  emit(run, 'heatUp', { heat: run.heat });
  if (n === 4) emit(run, 'tetra', { gained });
  emitMilestone(run);
  maybeWhiteHot(run);
  updateLevel(run);
  advanceLayerIfReady(run);
}

function emitMilestone(run) {
  const mile = Math.floor(run.score / MILESTONE.SCORE_STEP);
  if (mile > (run._lastScoreMile ?? 0)) {
    run._lastScoreMile = mile;
    emit(run, 'milestone', { score: run.score });
  }
}

function maybeWhiteHot(run) {
  if (!run.whiteHot && run.heat >= HEAT.MAX) {
    run.whiteHot = true;
    run.whiteHotLeft = HEAT.WHITE_HOT_SEC;
    run.heat = 0;
    emit(run, 'whiteHotStart', {});
  }
}

function updateLevel(run) {
  const nl = levelForLines(run.lines);
  if (nl > run.level) {
    run.level = nl;
    emit(run, 'levelUp', { level: nl });
  }
}

function advanceLayerIfReady(run) {
  const layer = layerAt(run.layer);
  if (run.layerLines < layer.target) return;
  if (run.layer >= LAYER_COUNT) { win(run); return; }
  run.layer += 1;
  run.layerLines = 0;
  applyLayerFeatures(run);
  if (run.layer > run.stats.layerReached) run.stats.layerReached = run.layer;
  emit(run, 'layerEnter', {
    layer: run.layer,
    name: `layer.${run.layer}`,
    scene: layerAt(run.layer).scene,
  });
}

// ---------- 矿层特性 ----------
function applyLayerFeatures(run) {
  const layer = layerAt(run.layer);
  run.narrow = !!layer.features.narrow;
  run.dark = !!layer.features.dark;
  run.nextCount = layer.features.nextCount ? 2 : 1;
  if (run.narrow) fillNarrowWalls(run.board);
  else clearNarrowWalls(run.board);
}

function fillNarrowWalls(board) {
  for (let y = 0; y < board.length; y += 1) {
    board[y][0] = CELL.WALL;
    board[y][board[y].length - 1] = CELL.WALL;
  }
  return board;
}

function clearNarrowWalls(board) {
  for (let y = 0; y < board.length; y += 1) {
    if (board[y][0] === CELL.WALL) board[y][0] = CELL.EMPTY;
    if (board[y][board[y].length - 1] === CELL.WALL) board[y][board[y].length - 1] = CELL.EMPTY;
  }
  return board;
}

// ---------- 结束 ----------
function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', {});
}

function win(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'won';
  emit(run, 'win', {});
}

function syncStats(run) {
  run.stats.score = run.score;
  run.stats.level = run.level;
  if (run.layer > run.stats.layerReached) run.stats.layerReached = run.layer;
}

// ---------- HUD ----------
function getHud(run) {
  const layer = layerAt(run.layer);
  return {
    phase: run.phase,
    score: run.score,
    level: run.level,
    layer: run.layer,
    layerName: `layer.${run.layer}`,
    scene: layer.scene,
    lines: run.lines,
    layerLines: run.layerLines,
    layerTarget: layer.target,
    heat: run.heat,
    heatMax: HEAT.MAX,
    whiteHot: run.whiteHot,
    whiteHotLeft: run.whiteHotLeft,
    gravity: gravitySeconds(run.level, { whiteHot: run.whiteHot, slow: run.slowUntil > run.time }),
    next: run.next.slice(),
    hold: run.hold,
    holdUsed: run.holdUsed,
    narrow: run.narrow,
    dark: run.dark,
    nextCount: run.nextCount,
    slow: run.slowUntil > run.time,
    active: run.active
      ? { type: run.active.type, rot: run.active.rot, x: run.active.x, y: run.active.y, cells: run.active.cells.slice(), stone: run.active.stone, gift: run.active.gift }
      : null,
  };
}

// 供 selfplay / 测试复用的纯函数再导出（保持单一真相来源）。
export { cloneBoard, dropResult, clearableRows, clearRows, placeCells, canPlaceAt, isEmptyCell, CELL, cellsFor };
