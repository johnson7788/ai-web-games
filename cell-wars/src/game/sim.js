// src/game/sim.js — CELL WARS · 回合状态机（纯逻辑，零 DOM/零 window）。
// 契约：createRun() → run；run.step(input) 每帧推进；run.getHud() 取 HUD；run.drainEvents() 清空事件。
// 回合：player 行动（infect/nutrient，可额外 free 用 phage）→ enemy 思考后行动 → 循环。
import { STEP, OWNER, INFECT, NUTRIENT, PHAGE, TURN, VIRUS, FX } from '../../config/gameplay.js';
import { DISH_COUNT, dishAt, scenePackAt } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import {
  buildBoard, createAura, countTerritory, isFrontier, resolveInfect, resolvePhage, applyAura,
} from './board.js';
import { chooseEnemyAction } from './ai.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startDish = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',        // playing | cleared | lost | victory
    time: 0,
    dish: 0,
    level: null,
    size: 0,
    board: null,
    aura: null,
    enemyAura: null,
    turn: 'player',          // player | enemy
    rounds: 0,
    playerNutrientAvailable: true,
    enemyNutrientAvailable: true,
    playerPhage: { ready: true, cooldown: 0 },
    enemyPhage: { ready: false, cooldown: PHAGE.CHARGE_TURNS },
    playerDeadline: 0,
    enemyThinkUntil: 0,
    fx: [],
    stats: { dishesCleared: 0, maxDish: 0, captures: 0, bigChains: 0 },
    events: [],
    _lastHeartbeat: -1,
    _lastVirusRound: -1,
  };

  loadDish(run, startDish);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.continue = () => continueRun(run);
  return run;
}

// ---------- 皿加载 ----------
function loadDish(run, dish) {
  run.dish = dish;
  run.level = dishAt(dish);
  run.size = run.level.size;
  run.board = buildBoard(run.level, run.rng);
  run.aura = createAura(run.size);
  run.enemyAura = createAura(run.size);
  run.turn = 'player';
  run.rounds = 0;
  run.playerNutrientAvailable = true;
  run.enemyNutrientAvailable = true;
  run.playerPhage = { ready: false, cooldown: PHAGE.CHARGE_TURNS };
  run.enemyPhage = { ready: false, cooldown: PHAGE.CHARGE_TURNS };
  run.playerDeadline = run.time + TURN.PLAYER_TIMEOUT_SEC;
  run.enemyThinkUntil = run.time;
  run._lastVirusRound = -1;
  if (run.stats.maxDish < dish) run.stats.maxDish = dish;
  emit(run, 'dishStart', { dish, size: run.size, scenePack: run.level.scenePack });
}

function continueRun(run) {
  if (run.phase !== 'cleared') return;
  run.phase = 'playing';
  loadDish(run, run.dish + 1);
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase === 'cleared' || run.phase === 'lost' || run.phase === 'victory') return;
  run.time += STEP;

  // 心跳里程碑（每秒一次，压事件间隔，保证无长静默）
  const sec = Math.floor(run.time);
  if (sec > run._lastHeartbeat) {
    run._lastHeartbeat = sec;
    emit(run, 'heartbeat', { sec });
  }

  // 特效清理
  if (run.fx.length) run.fx = run.fx.filter((f) => run.time - f.born < 1.2);

  if (run.turn === 'player') {
    if (input.action) tryPlayerAction(run, input.action);
    else if (run.time >= run.playerDeadline) passPlayer(run);
  } else {
    if (run.time >= run.enemyThinkUntil) doEnemyTurn(run);
  }
}

// ---------- 玩家行动 ----------
function tryPlayerAction(run, action) {
  if (!action || run.turn !== 'player') return;

  if (action.kind === 'phage') {
    if (!run.playerPhage.ready) return;
    const cleared = resolvePhage(run.board, run.size, action.r, action.c, OWNER.PLAYER, PHAGE.SIZE);
    if (cleared.length) {
      emit(run, 'phage', { side: OWNER.PLAYER, r: action.r, c: action.c, cleared: cleared.length });
      run.fx.push({ kind: 'wipe', r: action.r, c: action.c, cells: cleared, born: run.time });
      run.playerPhage.ready = false;
      run.playerPhage.cooldown = PHAGE.CHARGE_TURNS;
      checkEnd(run);
    }
    return; // 噬菌体是 free 动作，不结束回合
  }

  if (action.kind === 'infect') {
    if (!isFrontier(run.board, run.size, action.r, action.c, OWNER.PLAYER)) return;
    const auraBonus = run.aura[action.r][action.c];
    const res = resolveInfect(run.board, run.size, action.r, action.c, OWNER.PLAYER, auraBonus);
    clearAura(run.aura);
    emit(run, 'infect', { side: OWNER.PLAYER, r: action.r, c: action.c, power: res.power, def: res.def, captured: res.captured.length, blocked: res.blocked });
    if (res.blocked) {
      emit(run, 'blocked', { side: OWNER.PLAYER, r: action.r, c: action.c, power: res.power, def: res.def });
    } else {
      onCapture(run, OWNER.PLAYER, action.r, action.c, res.captured, res.wasEnemy);
    }
    endTurn(run);
    checkEnd(run);
    return;
  }

  if (action.kind === 'nutrient') {
    if (!run.playerNutrientAvailable) return;
    clearAura(run.aura);
    applyAura(run.aura, run.size, action.r, action.c, NUTRIENT.AURA_BONUS);
    emit(run, 'nutrient', { side: OWNER.PLAYER, r: action.r, c: action.c });
    run.playerNutrientAvailable = false;
    endTurn(run);
    checkEnd(run);
    return;
  }
}

function onCapture(run, side, r, c, captured, wasEnemy) {
  captured.forEach(([cr, cc], i) => {
    emit(run, 'capture', { side, r: cr, c: cc, chain: i, wasEnemy: i === 0 ? wasEnemy : false });
  });
  run.stats.captures += captured.length;
  if (captured.length >= INFECT.CHAIN_BIG) {
    run.stats.bigChains += 1;
    emit(run, 'bigChain', { side, r, c, count: captured.length });
  }
  run.fx.push({ kind: 'spread', r, c, cells: captured, born: run.time });
}

function passPlayer(run) {
  emit(run, 'pass', { side: OWNER.PLAYER });
  endTurn(run);
}

// ---------- 敌方行动 ----------
function doEnemyTurn(run) {
  const action = chooseEnemyAction(run);
  if (!action) {
    emit(run, 'pass', { side: OWNER.ENEMY });
    startPlayerTurn(run);
    return;
  }

  if (action.kind === 'phage') {
    const cleared = resolvePhage(run.board, run.size, action.r, action.c, OWNER.ENEMY, PHAGE.SIZE);
    if (cleared.length) {
      emit(run, 'phage', { side: OWNER.ENEMY, r: action.r, c: action.c, cleared: cleared.length });
      run.fx.push({ kind: 'wipe', r: action.r, c: action.c, cells: cleared, born: run.time });
      run.enemyPhage.ready = false;
      run.enemyPhage.cooldown = PHAGE.CHARGE_TURNS;
      checkEnd(run);
    }
    return; // free 动作
  }

  if (action.kind === 'infect') {
    if (!isFrontier(run.board, run.size, action.r, action.c, OWNER.ENEMY)) { startPlayerTurn(run); return; }
    const auraBonus = run.enemyAura[action.r][action.c];
    const res = resolveInfect(run.board, run.size, action.r, action.c, OWNER.ENEMY, auraBonus);
    clearAura(run.enemyAura);
    emit(run, 'infect', { side: OWNER.ENEMY, r: action.r, c: action.c, power: res.power, def: res.def, captured: res.captured.length, blocked: res.blocked });
    if (res.blocked) {
      emit(run, 'blocked', { side: OWNER.ENEMY, r: action.r, c: action.c, power: res.power, def: res.def });
    } else {
      onCapture(run, OWNER.ENEMY, action.r, action.c, res.captured, res.wasEnemy);
    }
    startPlayerTurn(run);
    checkEnd(run);
    return;
  }

  if (action.kind === 'nutrient') {
    if (!run.enemyNutrientAvailable) { startPlayerTurn(run); return; }
    clearAura(run.enemyAura);
    applyAura(run.enemyAura, run.size, action.r, action.c, NUTRIENT.AURA_BONUS);
    emit(run, 'nutrient', { side: OWNER.ENEMY, r: action.r, c: action.c });
    run.enemyNutrientAvailable = false;
    startPlayerTurn(run);
    checkEnd(run);
    return;
  }
}

// ---------- 回合切换 ----------
function endTurn(run) {
  run.rounds += 1;
  run.turn = 'enemy';
  run.enemyNutrientAvailable = true;
  run.enemyThinkUntil = run.time + TURN.AI_THINK_SEC;
}

function startPlayerTurn(run) {
  run.turn = 'player';
  run.playerNutrientAvailable = true;
  run.playerDeadline = run.time + TURN.PLAYER_TIMEOUT_SEC;
  tickPhage(run, 'player');
  tickPhage(run, 'enemy');
  maybeVirus(run);
  emit(run, 'turn', { side: OWNER.PLAYER, round: run.rounds });
}

function tickPhage(run, side) {
  const ph = side === 'player' ? run.playerPhage : run.enemyPhage;
  if (ph.ready) return;
  ph.cooldown -= 1;
  if (ph.cooldown <= 0) {
    ph.ready = true;
    ph.cooldown = 0;
    emit(run, 'phageReady', { side: side === 'player' ? OWNER.PLAYER : OWNER.ENEMY });
  }
}

function maybeVirus(run) {
  const every = run.level.virusEvery;
  if (!every || run.rounds <= 0 || run.rounds % every !== 0 || run._lastVirusRound === run.rounds) return;
  run._lastVirusRound = run.rounds;
  // 随机一个己方/敌方格突变为中立
  const owned = [];
  for (let r = 0; r < run.size; r += 1) {
    for (let c = 0; c < run.size; c += 1) {
      const o = run.board[r][c].o;
      if (o === OWNER.PLAYER || o === OWNER.ENEMY) owned.push([r, c]);
    }
  }
  if (!owned.length) return;
  const [r, c] = owned[randInt(run.rng, 0, owned.length - 1)];
  run.board[r][c].o = OWNER.NEUTRAL;
  run.board[r][c].d = 0;
  emit(run, 'virus', { r, c });
}

// ---------- 胜负 ----------
function checkEnd(run) {
  if (run.phase !== 'playing') return;
  const p = countTerritory(run.board, OWNER.PLAYER);
  const e = countTerritory(run.board, OWNER.ENEMY);
  if (e === 0) { onDishCleared(run); return; }
  if (p === 0) { onGameOver(run); return; }
  if (run.rounds >= run.level.maxRounds) {
    if (p > e) onDishCleared(run);
    else onGameOver(run);
  }
}

function onDishCleared(run) {
  run.stats.dishesCleared += 1;
  emit(run, 'dishClear', { dish: run.dish, cleared: run.stats.dishesCleared });
  if (run.dish >= DISH_COUNT) {
    run.phase = 'victory';
    emit(run, 'victory', {});
  } else {
    run.phase = 'cleared';
  }
}

function onGameOver(run) {
  run.phase = 'lost';
  emit(run, 'gameOver', { dish: run.dish, cleared: run.stats.dishesCleared });
}

// ---------- HUD / 事件 ----------
function clearAura(aura) {
  for (let r = 0; r < aura.length; r += 1) {
    for (let c = 0; c < aura[r].length; c += 1) aura[r][c] = 0;
  }
}

function getHud(run) {
  return {
    dish: run.dish,
    totalDishes: DISH_COUNT,
    rounds: run.rounds,
    maxRounds: run.level.maxRounds,
    playerCells: countTerritory(run.board, OWNER.PLAYER),
    enemyCells: countTerritory(run.board, OWNER.ENEMY),
    neutralCells: countTerritory(run.board, OWNER.NEUTRAL),
    turn: run.turn,
    playerNutrientAvailable: run.playerNutrientAvailable,
    playerPhageReady: run.playerPhage.ready,
    playerPhageCooldown: run.playerPhage.cooldown,
    sceneName: scenePackAt(run.dish).nameKey,
    phase: run.phase,
    virusEvery: run.level.virusEvery,
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
