// src/game/sim.js — DIG DEEP 纯逻辑模拟（不碰 DOM/window/Date.now；随机用 seed）
// 玩法：5 列竖井主动下挖。玩家选列、换工具、挖格子；深度即进度。
// 硬约束：砖块硬度多次点击 / 障碍岩不可挖（激光可切）/ 钻石化石计分 / 体力限制 / 洪水上涨 / 断层塌方 / 熔岩重开。
import { WORLD, STEP } from '../../config/game.config.js';
import { TOOLS, RIG, CELL, REWARDS, COLLAPSE, LAVA, FLOOD, SCORING, clamp } from '../../config/gameplay.js';
import { LAYERS, layerAt, layerStartDepth, TOTAL_ROWS } from '../../config/levels.js';
import { mulberry32, weighted } from './rng.js';

const COLS = WORLD.COLS;

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function makeCell(type, layer, rng) {
  switch (type) {
    case 'dirt': return { type, hard: randInt(rng, CELL.dirtHardMin, CELL.dirtHardMax), alive: true };
    case 'rock': return { type, hard: Infinity, alive: true };
    case 'diamond': return { type, hard: CELL.diamondHard, alive: true };
    case 'fossil': return { type, hard: layer.fossilHard || CELL.fossilHard, alive: true };
    case 'fault': return { type, hard: CELL.faultHard, alive: true };
    case 'lava': return { type, hard: Infinity, alive: true };
    default: return { type: 'dirt', hard: 1, alive: true };
  }
}

function genRow(run, depth) {
  const layer = layerAt(depth);
  const seed = (run.seed ^ Math.imul(depth + 1, 2654435761) ^ Math.imul(run.reroll + 1, 40503)) >>> 0;
  const rng = mulberry32(seed);
  const row = [];
  let diggable = 0;
  for (let c = 0; c < COLS; c += 1) {
    const type = weighted(rng, layer.weights);
    const cell = makeCell(type, layer, rng);
    if (cell.hard !== Infinity) diggable += 1;
    row.push(cell);
  }
  if (diggable === 0) row[2] = makeCell('dirt', layer, rng); // 保证每行至少一格可挖
  return row;
}

function cellAt(run, col, depth) {
  let row = run.rows.get(depth);
  if (!row) {
    row = genRow(run, depth);
    run.rows.set(depth, row);
  }
  return row[col];
}

function kill(run, reason) {
  run.phase = 'dead';
  run.deadReason = reason;
  run.stats.zoneReached = Math.max(run.stats.zoneReached, run.layer);
  run.events.push({ type: 'death', reason });
}

function collapse(run, col, depth) {
  run.stamina -= COLLAPSE.staminaDamage;
  run.events.push({ type: 'collapse', col, depth });
  // 下方相邻列的软格被砸成瓦砾（硬度 +2），形成「规划承重」的代价
  for (const nc of [col - 1, col + 1]) {
    if (nc < 0 || nc >= COLS) continue;
    const below = cellAt(run, nc, depth + 1);
    if (below && below.alive && below.hard !== Infinity && below.type !== 'lava') {
      below.hard += COLLAPSE.rubbleAdd;
      below.rubble = true;
    }
  }
  if (run.stamina <= 0) kill(run, 'exhaust');
}

function breakCell(run, cell, col, depth) {
  if (cell.type === 'diamond') {
    run.score += REWARDS.diamondScore;
    run.stamina = Math.min(RIG.maxStamina, run.stamina + REWARDS.diamondStamina);
    run.stats.diamonds += 1;
    run.events.push({ type: 'diamond', col, depth });
  } else if (cell.type === 'fossil') {
    run.score += REWARDS.fossilScore;
    run.stamina = Math.min(RIG.maxStamina, run.stamina + REWARDS.fossilStamina);
    run.laserCharges += REWARDS.fossilLaserCharge;
    run.stats.fossils += 1;
    run.events.push({ type: 'fossil', col, depth });
  } else if (cell.type === 'fault') {
    run.events.push({ type: 'faultBreak', col, depth });
    if (run.tool === 0) collapse(run, col, depth); // 铲子挖断层会塌方
  }
  cell.alive = false;
  run.depth += 1;
  run.score += SCORING.depthPerRow;
  run.stats.maxDepth = Math.max(run.stats.maxDepth, run.depth);
  run.events.push({ type: 'cellBreak', col, depth });
  if (run.depth % SCORING.milestoneEvery === 0) run.events.push({ type: 'milestone', depth: run.depth });
  checkLayerAndCore(run);
}

function restartLayer(run) {
  run.stamina -= LAVA.staminaPenalty;
  run.stats.lavaTouches += 1;
  const layerIdx = layerAt(run.depth).index;
  const start = layerStartDepth(layerIdx);
  run.reroll += 1; // 本层重新随机生成（「碰到重开本层」）
  for (const d of Array.from(run.rows.keys())) {
    if (d >= start) run.rows.delete(d);
  }
  run.depth = start;
  run.events.push({ type: 'layerRestart', layer: layerIdx });
  if (run.stamina <= 0) kill(run, 'lava');
}

function doDig(run) {
  const cell = cellAt(run, run.col, run.depth);
  const tool = TOOLS[run.tool];
  const cost = tool.cost;

  if (cell.type === 'lava') {
    run.events.push({ type: 'lava', col: run.col, depth: run.depth });
    restartLayer(run);
    return;
  }
  if (cell.type === 'rock') {
    if (tool.laser && run.laserCharges > 0) {
      run.laserCharges -= 1;
      run.events.push({ type: 'rockCut', col: run.col, depth: run.depth });
      breakCell(run, cell, run.col, run.depth);
    } else {
      run.events.push({ type: 'rockBlocked', col: run.col, depth: run.depth });
    }
    return;
  }
  if (run.stamina < cost) {
    run.events.push({ type: 'staminaLow', col: run.col, depth: run.depth });
    if (run.stamina <= 0) kill(run, 'exhaust');
    return;
  }
  run.stamina -= cost;
  run.events.push({ type: 'dig', col: run.col, depth: run.depth, tool: tool.id });
  cell.hard -= tool.power;
  if (cell.hard <= 0) breakCell(run, cell, run.col, run.depth);
  else run.events.push({ type: 'cellHit', col: run.col, depth: run.depth, hard: cell.hard });
}

function checkLayerAndCore(run) {
  const layer = layerAt(run.depth);
  if (layer.index !== run.layer) {
    run.layer = layer.index;
    run.stats.zoneReached = Math.max(run.stats.zoneReached, layer.index);
    run.stats.maxLayer = Math.max(run.stats.maxLayer, layer.index);
    run.events.push({ type: 'layerEnter', layer: layer.index, theme: layer.theme });
    const newMax = layer.unlock - 1; // unlock: 1→shovel, 2→drill, 3→laser
    if (newMax > run.maxTool) {
      run.maxTool = newMax;
      run.events.push({ type: 'toolUnlock', tool: TOOLS[newMax].id });
    }
  }
  if (run.depth >= TOTAL_ROWS && !run.coreReached) {
    run.coreReached = true;
    run.events.push({ type: 'coreReach' });
  }
}

export function createRun({ seed = 1 } = {}) {
  const run = {
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    depth: 0,
    col: 2,
    stamina: RIG.startStamina,
    score: 0,
    layer: 1,
    tool: 0,
    maxTool: 0,
    laserCharges: 0,
    flood: FLOOD.start,
    coreReached: false,
    deadReason: null,
    reroll: 0,
    rows: new Map(),
    lastDig: -Infinity,
    lastMove: -Infinity,
    events: [],
    stats: { zoneReached: 1, maxDepth: 0, maxLayer: 1, diamonds: 0, fossils: 0, lavaTouches: 0 },
  };

  run.step = function step(input = {}) {
    if (run.phase !== 'playing') return;
    run.time += STEP;

    // 横移（真实操作模型：有节奏的列切换）
    if (input.move && run.time - run.lastMove >= RIG.moveInterval) {
      run.col = clamp(run.col + Math.sign(input.move), 0, COLS - 1);
      run.lastMove = run.time;
      run.events.push({ type: 'move', col: run.col });
    }

    // 切工具
    if (input.tool != null && input.tool !== run.tool && input.tool >= 0 && input.tool <= run.maxTool) {
      run.tool = input.tool;
      run.events.push({ type: 'toolChange', tool: TOOLS[run.tool].id });
    }

    // 挖掘（有节奏：连续按住也按固定频率挖）
    if (input.dig && run.time - run.lastDig >= RIG.digInterval) {
      run.lastDig = run.time;
      doDig(run);
    }

    // 洪水上涨（用当前深度对应的层速度）
    if (run.phase === 'playing') {
      run.flood += layerAt(run.depth).floodRise * STEP;
      if (run.flood >= run.depth) kill(run, 'drown');
    }
  };

  run.drainEvents = function drainEvents() {
    const evs = run.events;
    run.events = [];
    return evs;
  };

  // 公开窥视接口：渲染/机器人需要查看尚未挖到的行（生成并缓存）
  run.peek = function peek(depth) {
    let row = run.rows.get(depth);
    if (!row) {
      row = genRow(run, depth);
      run.rows.set(depth, row);
    }
    return row;
  };

  run.getHud = function getHud() {
    return {
      phase: run.phase,
      depth: run.depth,
      score: run.score,
      stamina: Math.max(0, Math.floor(run.stamina)),
      staminaMax: RIG.maxStamina,
      layer: run.layer,
      theme: layerAt(run.depth).theme,
      tool: run.tool,
      maxTool: run.maxTool,
      laserCharges: run.laserCharges,
      flood: run.flood,
      col: run.col,
      coreReached: run.coreReached,
      deadReason: run.deadReason,
    };
  };

  // 兼容 selfplay / verify：zone 别名
  Object.defineProperty(run, 'zone', { get() { return run.stats.zoneReached; } });

  return run;
}
