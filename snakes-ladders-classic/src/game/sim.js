// 纯逻辑：蛇梯棋（48 格，掷骰竞速）。
// 无 DOM、无渲染依赖；selfplay 直接驱动，浏览器经 main.js 装配。
//
// 规则（P0 1:1 参考源码）：
//   - 48 格（0-47），0 起点，47 终点；掷 1-6 前进，超出终点回弹（now = 2*47 - now）。
//   - 梯子上爬、蛇下滑（1 格 tree 空事件）；先手由「比点数」决定，平局重掷。
// 新机制（原创换皮）：岩石眩晕跳回合 / 宝石收集前进一步 / 幸运 6 连击再掷一次 / 名次星级。
import { GAME } from '../../config/game.config.js';
import { LEVELS, BOARD } from '../../config/levels.js';

const HUMAN = GAME.HUMAN_SEAT;
const MAX = BOARD.MAX;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDie(rng, sides) {
  return 1 + Math.floor(rng() * sides);
}

function resolveFirstHand(run) {
  const s = run.state;
  let contenders = s.players.map((p) => p.seat);
  let winner = -1;
  let guard = 0;
  while (guard < 12 && contenders.length > 1) {
    guard += 1;
    const rolls = contenders.map((seat) => ({ seat, n: rollDie(run.rng, 6) }));
    for (const r of rolls) run.emit('roll', { seat: r.seat, n: r.n, firsthand: true });
    const maxN = Math.max(...rolls.map((r) => r.n));
    const tied = rolls.filter((r) => r.n === maxN).map((r) => r.seat);
    if (tied.length === 1) { winner = tied[0]; break; }
    contenders = tied.slice();
  }
  if (winner < 0) winner = contenders[0] ?? 0;
  const order = [winner];
  for (let seat = 0; seat < GAME.PLAYER_COUNT; seat += 1) if (seat !== winner) order.push(seat);
  s.order = order;
  s.turn = winner;
  s.phase = 'playing';
  run.emit('firsthand', { seat: winner, order: [...order] });
}

function nextTurn(run, fromSeat) {
  const s = run.state;
  const order = s.order;
  const n = order.length || 1;
  let idx = order.indexOf(fromSeat);
  if (idx < 0) idx = 0;
  for (let k = 1; k <= n; k += 1) {
    const cand = order[(idx + k) % n];
    const p = s.players[cand];
    if (p.finished) continue;
    if (p.stunned) { p.stunned = 0; run.emit('rock', { seat: cand, skip: true }); continue; }
    return cand;
  }
  return fromSeat;
}

function resolveLanding(run, seat, cell) {
  const s = run.state;
  const p = s.players[seat];
  const lvl = run.level;
  let stun = false;
  let finished = false;
  const visited = new Set();
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    if (cell === MAX) { finished = true; break; }
    if (cell < 0 || cell > MAX) break;
    const ev = lvl.events[cell];
    if (!ev) break;
    if (visited.has(cell)) break;
    visited.add(cell);
    if (ev.type === 'ladder') {
      run.emit('ladder', { seat, from: cell, to: ev.to });
      cell = ev.to;
    } else if (ev.type === 'snake') {
      run.emit('snake', { seat, from: cell, to: ev.to });
      run.emit('lose', { seat, from: cell, to: ev.to });
      cell = ev.to;
    } else if (ev.type === 'gem') {
      p.gems += 1;
      run.emit('gem', { seat, cell, gems: p.gems });
      cell = ev.to;
    } else if (ev.type === 'rock') {
      stun = true;
      run.emit('rock', { seat, cell });
      break;
    } else if (ev.type === 'tree') {
      run.emit('tree', { seat, cell });
      break;
    } else {
      break;
    }
  }
  return { finalCell: cell, stun, finished };
}

function finishTurn(run, seat, finalCell, stun, finished, rollVal) {
  const s = run.state;
  const p = s.players[seat];
  p.pos = finalCell;
  if (stun) p.stunned = 1;
  if (finished) {
    p.finished = true;
    s.finishCount += 1;
    p.finishOrder = s.finishCount;
    if (seat === HUMAN) {
      p.stars = Math.max(1, 3 - (s.finishCount - 1));
      s.phase = 'won';
      run.emit('win', { seat, stars: p.stars, place: s.finishCount, gems: p.gems });
      return;
    }
    run.emit('rival-finish', { seat, place: s.finishCount });
    s.turn = nextTurn(run, seat);
    return;
  }

  // 幸运 6：玩家（且该关开放连击）再掷一次
  if (rollVal === 6 && run.level.combo && seat === HUMAN) {
    p.combo = (p.combo || 0) + 1;
    run.emit('combo', { seat, combo: p.combo });
    s.turn = seat;
    return;
  }
  p.combo = 0;
  s.turn = nextTurn(run, seat);
}

function rollSeat(run, seat) {
  const s = run.state;
  const p = s.players[seat];
  if (p.finished || s.phase !== 'playing') return { ok: false };
  const sides = seat === HUMAN ? GAME.HUMAN_DIE_SIDES : GAME.AI_DIE_SIDES;
  const rollVal = rollDie(run.rng, sides);
  s.dice = rollVal;
  s.rollCount += 1;
  run.emit('roll', { seat, n: rollVal });

  let land = p.pos + rollVal;
  let bounced = false;
  if (land > MAX) {
    bounced = true;
    run.emit('bounce', { seat, out: land - MAX });
    land = 2 * MAX - land;
  }

  const queue = [];
  if (!bounced) {
    for (let c = p.pos + 1; c <= land; c += 1) queue.push({ cell: c, dur: GAME.HOP_TIME });
  } else {
    for (let c = p.pos + 1; c <= MAX; c += 1) queue.push({ cell: c, dur: GAME.HOP_TIME });
    for (let c = MAX - 1; c >= land; c -= 1) queue.push({ cell: c, dur: GAME.HOP_TIME });
  }

  const res = resolveLanding(run, seat, land);
  if (res.finalCell !== land && res.finalCell >= 0 && res.finalCell <= MAX) {
    queue.push({ cell: res.finalCell, dur: GAME.SLIDE_TIME });
  }

  s.anim = {
    seat, queue, idx: 0, timer: GAME.HOP_TIME,
    finalCell: res.finalCell, stun: res.stun, finished: res.finished, rollVal,
  };
  if (queue.length === 0) {
    s.anim = null;
    finishTurn(run, seat, res.finalCell, res.stun, res.finished, rollVal);
  }
  return { ok: true, rollVal, land, finalCell: res.finalCell };
}

function stepRun(run, dt) {
  const s = run.state;
  s.time += dt;
  if (s.phase === 'countdown') { resolveFirstHand(run); return; }
  if (s.phase !== 'playing') return;

  if (s.anim) {
    const anim = s.anim;
    anim.timer -= dt;
    while (anim.timer <= 0 && anim.idx < anim.queue.length) {
      const entry = anim.queue[anim.idx];
      s.players[anim.seat].pos = entry.cell;
      run.emit('move', { seat: anim.seat, cell: entry.cell });
      anim.idx += 1;
      anim.timer += entry.dur;
    }
    if (anim.idx >= anim.queue.length) {
      s.anim = null;
      finishTurn(run, anim.seat, anim.finalCell, anim.stun, anim.finished, anim.rollVal);
    }
    return;
  }

  if (s.turn >= 0) {
    const p = s.players[s.turn];
    if (p.kind === 'ai' && !p.finished) {
      rollSeat(run, s.turn);
    }
  }
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed);
  const players = [];
  for (let seat = 0; seat < GAME.PLAYER_COUNT; seat += 1) {
    players.push({
      seat,
      kind: seat === HUMAN ? 'human' : 'ai',
      pos: 0, gems: 0, stars: 0, stunned: 0, finished: false, finishOrder: 0, combo: 0,
    });
  }
  const state = {
    phase: 'countdown',            // countdown | playing | won
    level: level.index + 1,
    levelIndex: level.index,
    turn: -1,
    order: [],
    dice: 0,
    time: 0,
    players,
    anim: null,
    events: [],
    finishCount: 0,
    rollCount: 0,
  };

  const run = {
    state,
    level,
    rng,
    emit(type, payload = {}) { state.events.push({ type, ...payload }); },
    step(dt) { stepRun(run, dt); },
    drainEvents() { const ev = state.events; state.events = []; return ev; },
    canRoll() {
      return state.phase === 'playing' && state.turn === HUMAN && !state.anim && !players[HUMAN].finished;
    },
    roll() {
      if (!run.canRoll()) return { ok: false, reason: 'not-your-turn' };
      return rollSeat(run, HUMAN);
    },
    getHud() {
      return {
        phase: state.phase,
        level: state.level,
        turn: state.turn,
        dice: state.dice,
        time: state.time,
        players: players.map((p) => ({
          seat: p.seat, kind: p.kind, pos: p.pos, gems: p.gems, stars: p.stars,
          stunned: p.stunned, finished: p.finished, combo: p.combo,
        })),
      };
    },
  };

  return run;
}
