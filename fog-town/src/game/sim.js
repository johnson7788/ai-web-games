// FOG TOWN · 模拟/玩法核心（纯逻辑，零依赖）
// 契约：createRun({seed,startBlock}) → { step(input), getHud(), drainEvents() }
// 事件名：step / reveal / keyGain / clueGain / leverFlip / doorOpen / truthMoment / trap /
//         guardAlert / echo / blocked / blockClear / win / oilLow / death / milestone
import {
  GRID, T, DIRS, OIL, ECHO, TRUTH, TRAP, MOVING_FOG,
  clamp, lightRadius, ratingOf, inBounds, idx,
} from '../../config/gameplay.js';
import { STEP } from '../../config/game.config.js';
import { BLOCKS, BLOCK_COUNT, blockAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { genBlock, doorUnlocked } from './mapgen.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startBlock = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    blockIndex: clamp(startBlock, 0, BLOCK_COUNT - 1),
    map: null,
    player: { x: 0, y: 0 },
    oil: 0,
    oilStart: 0,
    steps: 0,
    keyCollected: 0,
    leverOn: false,
    cluesCollected: 0,
    clueTaken: [],
    doorOpen: false,
    movingFog: false,
    revealed: new Set(),
    revealOrder: [],
    lastEchoStep: -99,
    truthUntil: 0,
    deathReason: null,
    stats: {
      blocksCleared: 0,
      bestBlock: startBlock + 1,
      totalSteps: 0,
      totalClues: 0,
      ratings: [],
    },
    events: [],
  };

  loadBlock(run);
  run.events = []; // 初始揭示不算游戏事件

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架别名
export function createSim() {
  return createRun({ seed: 0 });
}

function loadBlock(run) {
  const block = blockAt(run.blockIndex);
  run.map = genBlock(block, run.rng);
  run.player = { x: run.map.start.x, y: run.map.start.y };
  run.oil = run.map.oil;
  run.oilStart = run.map.oil;
  run.steps = 0;
  run.keyCollected = 0;
  run.leverOn = false;
  run.cluesCollected = 0;
  run.clueTaken = new Array(run.map.clues.length).fill(false);
  run.doorOpen = doorUnlocked(run.map, run);
  run.movingFog = !!block.movingFog;
  run.revealed = new Set([idx(run.player.x, run.player.y)]);
  run.revealOrder = [idx(run.player.x, run.player.y)];
  run.lastEchoStep = -99;
  run.truthUntil = 0;
  revealAround(run);
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  if (input.echo) {
    doEcho(run);
  } else if (input.dir) {
    doMove(run, input.dir);
  }

  // 真相时刻到期
  if (run.truthUntil > 0 && run.time >= run.truthUntil) {
    run.truthUntil = 0;
  }
}

// ---------- 移动 ----------
function doMove(run, dir) {
  const d = DIRS[dir];
  if (!d) return;
  const nx = run.player.x + d.dx;
  const ny = run.player.y + d.dy;
  if (!inBounds(nx, ny)) { emit(run, 'blocked', { x: nx, y: ny }); return; }
  const i = idx(nx, ny);
  const cell = run.map.cells[i];

  if (cell === T.WALL) { emit(run, 'blocked', { x: nx, y: ny }); return; }
  if (cell === T.EXIT && !run.doorOpen) { emit(run, 'blocked', { x: nx, y: ny, door: true }); return; }

  // 守卫视线：踏入危险区 = 被抓
  if (run.map.danger[i] === 1) {
    emit(run, 'guardAlert', { x: nx, y: ny });
    die(run, 'guard');
    return;
  }

  run.player = { x: nx, y: ny };
  run.steps += 1;
  run.stats.totalSteps += 1;
  run.oil = Math.max(0, run.oil - 1);
  emit(run, 'step', { x: nx, y: ny, steps: run.steps });

  revealAround(run);
  resolveCell(run, cell, i);

  if (run.phase !== 'playing') return;

  // 灯油告急
  const frac = run.oilStart > 0 ? run.oil / run.oilStart : 0;
  if (frac <= OIL.LOW_WARN && !run._oilLowFlag) {
    run._oilLowFlag = true;
    emit(run, 'oilLow', { oil: run.oil });
  }

  // 移动雾：旧格重新起雾
  if (run.movingFog) applyMovingFog(run);

  // 步数上限：迷雾吞噬
  if (run.steps > run.map.maxSteps) {
    die(run, 'steps');
  }
}

function resolveCell(run, cell, i) {
  const { x, y } = run.player;
  if (cell === T.EXIT) {
    onBlockClear(run);
    return;
  }
  if (cell === T.KEY) {
    run.keyCollected = 1;
    emit(run, 'keyGain', { x, y });
    maybeDoorOpen(run);
  } else if (cell === T.CLUE) {
    const ci = clueIndexAt(run, x, y);
    if (ci >= 0 && !run.clueTaken[ci]) {
      run.clueTaken[ci] = true;
      run.cluesCollected += 1;
      run.stats.totalClues += 1;
      emit(run, 'clueGain', { x, y, count: run.cluesCollected });
      if (run.cluesCollected >= TRUTH.CLUE_TARGET) {
        run.truthUntil = run.time + TRUTH.DURATION;
        // 真相时刻：永久点亮出口，短暂全图点亮
        run.revealed.add(idx(run.map.exit.x, run.map.exit.y));
        run.revealOrder.push(idx(run.map.exit.x, run.map.exit.y));
        emit(run, 'truthMoment', { x, y });
      }
      maybeDoorOpen(run);
    }
  } else if (cell === T.LEVER) {
    if (!run.leverOn) {
      run.leverOn = true;
      emit(run, 'leverFlip', { x, y });
      maybeDoorOpen(run);
    }
  } else if (cell === T.TRAP) {
    const before = run.oil;
    run.oil = Math.max(0, run.oil - TRAP.OIL_COST);
    emit(run, 'trap', { x, y, oilLost: before - run.oil });
  }
}

function clueIndexAt(run, x, y) {
  for (let i = 0; i < run.map.clues.length; i += 1) {
    const c = run.map.clues[i];
    if (c.x === x && c.y === y) return i;
  }
  return -1;
}

function maybeDoorOpen(run) {
  const now = doorUnlocked(run.map, run);
  if (now && !run.doorOpen) {
    run.doorOpen = true;
    emit(run, 'doorOpen', {});
  }
}

function onBlockClear(run) {
  emit(run, 'blockClear', { block: run.blockIndex + 1, steps: run.steps, par: run.map.par });
  run.stats.blocksCleared += 1;
  run.stats.ratings.push(ratingOf(run.steps, run.map.par));

  if (run.blockIndex + 1 >= BLOCK_COUNT) {
    run.phase = 'won';
    run.stats.bestBlock = BLOCK_COUNT;
    emit(run, 'win', { blocks: run.stats.blocksCleared });
    return;
  }
  run.blockIndex += 1;
  loadBlock(run);
  run.stats.bestBlock = Math.max(run.stats.bestBlock, run.blockIndex + 1);
  emit(run, 'milestone', { block: run.blockIndex + 1 });
}

function die(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.deathReason = reason;
  emit(run, 'death', { reason });
}

// ---------- 回声 ----------
function doEcho(run) {
  if (run.steps - run.lastEchoStep < ECHO.COOLDOWN_STEPS) return;
  run.steps += 1;
  run.stats.totalSteps += 1;
  run.lastEchoStep = run.steps;
  let count = 0;
  const { x, y } = run.player;
  for (let dy = -ECHO.RANGE; dy <= ECHO.RANGE; dy += 1) {
    for (let dx = -ECHO.RANGE; dx <= ECHO.RANGE; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const i = idx(nx, ny);
      const c = run.map.cells[i];
      if (c === T.TRAP || c === T.LEVER) {
        if (!run.revealed.has(i)) {
          run.revealed.add(i);
          run.revealOrder.push(i);
          count += 1;
        }
      }
    }
  }
  emit(run, 'echo', { x, y, count });
  if (run.steps > run.map.maxSteps) die(run, 'steps');
}

// ---------- 迷雾 ----------
function revealAround(run) {
  const radius = lightRadius(run.oil, run.oilStart);
  const { x, y } = run.player;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const i = idx(nx, ny);
      if (!run.revealed.has(i)) {
        run.revealed.add(i);
        run.revealOrder.push(i);
        count += 1;
      }
    }
  }
  if (count > 0) emit(run, 'reveal', { x, y, count });
}

function applyMovingFog(run) {
  if (run.revealOrder.length <= MOVING_FOG.MEMORY) return;
  const protect = new Set([
    idx(run.player.x, run.player.y),
    idx(run.map.exit.x, run.map.exit.y),
  ]);
  const keep = [];
  let budget = MOVING_FOG.MEMORY;
  for (let k = run.revealOrder.length - 1; k >= 0; k -= 1) {
    const i = run.revealOrder[k];
    if (protect.has(i)) {
      keep.push(i);
    } else if (budget > 0) {
      keep.push(i);
      budget -= 1;
    } else {
      run.revealed.delete(i);
    }
  }
  keep.reverse();
  run.revealOrder = keep;
}

// ---------- 是否已揭示 ----------
export function isRevealed(run, x, y) {
  if (run.truthUntil > 0 && run.time < run.truthUntil) return true;
  return run.revealed.has(idx(x, y));
}

// ---------- HUD / 事件 ----------
function goalKey(run) {
  if (run.map.clueCount >= TRUTH.CLUE_TARGET) return 'hud.goal.clues';
  if (run.map.doorNeeds === 'none') return 'hud.goal.exit';
  if (run.map.doorNeeds === 'key') return 'hud.goal.key';
  if (run.map.doorNeeds === 'lever') return 'hud.goal.lever';
  return 'hud.goal.keyAndLever';
}

function getHud(run) {
  const block = blockAt(run.blockIndex);
  return {
    phase: run.phase,
    block: run.blockIndex + 1,
    blockCount: BLOCK_COUNT,
    scene: block.scene,
    oil: run.oil,
    oilStart: run.oilStart,
    steps: run.steps,
    maxSteps: run.map.maxSteps,
    par: run.map.par,
    keys: run.keyCollected,
    lever: run.leverOn,
    clues: run.cluesCollected,
    clueTarget: run.map.clueCount >= TRUTH.CLUE_TARGET ? TRUTH.CLUE_TARGET : 0,
    goalKey: goalKey(run),
    doorOpen: run.doorOpen,
    radius: lightRadius(run.oil, run.oilStart),
    truthActive: run.truthUntil > 0 && run.time < run.truthUntil,
    movingFog: run.movingFog,
    deathReason: run.deathReason,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
