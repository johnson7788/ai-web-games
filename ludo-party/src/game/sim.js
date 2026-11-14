// 纯逻辑：飞行棋（2 玩家各 4 子）+ 骰子 + 走子/撞回/到家 + AI。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { PLAYERS, RULES } from '../../config/game.config.js';

const TRACK = RULES.trackLen;
const FINISH = RULES.finish;

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ seed = 1 } = {}) {
  return {
    seed,
    players: PLAYERS.map(() => ({ tokens: Array(RULES.tokensPerPlayer).fill(-1) })),
    turn: 0,
    dice: null,
    movable: [],
    phase: 'roll', // roll | move | over
    winner: null,
    events: [],
    rng: makeRng(seed),
  };
}

// progress: -1 基地；0..50 主跑道；51..56 home 列；57 完成。
export function trackPos(playerIdx, progress) {
  if (progress < 0 || progress > 50) return null;
  return (PLAYERS[playerIdx].start + progress) % TRACK;
}

function isSafe(absPos) {
  return PLAYERS.some((p) => p.start === absPos);
}

export function movableTokens(run, playerIdx, dice) {
  const out = [];
  run.players[playerIdx].tokens.forEach((p, i) => {
    if (p === -1) {
      if (dice === RULES.enterRoll) out.push(i);
    } else if (p < FINISH) {
      if (p + dice <= FINISH) out.push(i);
    }
  });
  return out;
}

function wouldCapture(run, playerIdx, tokenIdx, dice) {
  const p = run.players[playerIdx].tokens[tokenIdx];
  const newP = p === -1 ? 0 : p + dice;
  if (newP > 50) return false;
  const abs = trackPos(playerIdx, newP);
  if (isSafe(abs)) return false;
  for (let op = 0; op < run.players.length; op += 1) {
    if (op === playerIdx) continue;
    for (const tp of run.players[op].tokens) {
      if (tp >= 0 && tp <= 50 && trackPos(op, tp) === abs) return true;
    }
  }
  return false;
}

function nextTurn(run) {
  run.turn = (run.turn + 1) % run.players.length;
  run.phase = 'roll';
  run.dice = null;
  run.movable = [];
}

export function rollDice(run) {
  if (run.phase !== 'roll') return { ok: false };
  const dice = 1 + Math.floor(run.rng() * 6);
  run.dice = dice;
  run.movable = movableTokens(run, run.turn, dice);
  run.events.push({ type: 'roll', player: run.turn, dice });
  if (run.movable.length === 0) {
    run.events.push({ type: 'noMoves', player: run.turn });
    nextTurn(run);
    return { ok: true, dice, movable: [] };
  }
  run.phase = 'move';
  return { ok: true, dice, movable: run.movable };
}

export function moveToken(run, tokenIdx) {
  if (run.phase !== 'move') return { ok: false };
  if (!run.movable.includes(tokenIdx)) return { ok: false };
  const player = run.turn;
  const tokens = run.players[player].tokens;
  const p = tokens[tokenIdx];
  const dice = run.dice;
  const newP = p === -1 ? 0 : p + dice;
  tokens[tokenIdx] = newP;
  run.events.push({ type: 'move', player, token: tokenIdx, from: p, to: newP });

  // 撞回
  let captured = false;
  if (newP <= 50) {
    const abs = trackPos(player, newP);
    if (!isSafe(abs)) {
      for (let op = 0; op < run.players.length; op += 1) {
        if (op === player) continue;
        run.players[op].tokens.forEach((tp, ti) => {
          if (tp >= 0 && tp <= 50 && trackPos(op, tp) === abs) {
            run.players[op].tokens[ti] = -1;
            captured = true;
            run.events.push({ type: 'capture', player: op, token: ti });
          }
        });
      }
    }
  }
  if (newP === FINISH) run.events.push({ type: 'finish', player, token: tokenIdx });

  // 胜利
  if (tokens.every((t) => t === FINISH)) {
    run.phase = 'over';
    run.winner = player;
    run.events.push({ type: 'win', player });
    return { ok: true, captured, win: true };
  }

  if (dice === RULES.extraRoll) {
    run.phase = 'roll';
    run.dice = null;
    run.movable = [];
    run.events.push({ type: 'extra', player });
  } else {
    nextTurn(run);
  }
  return { ok: true, captured, win: false };
}

// AI：优先撞回 > 到家 > 起飞 > 前进。
export function aiChoose(run) {
  let best = run.movable[0];
  let bestScore = -Infinity;
  for (const i of run.movable) {
    const p = run.players[run.turn].tokens[i];
    let score = 0;
    if (wouldCapture(run, run.turn, i, run.dice)) score += 1000;
    const newP = p === -1 ? 0 : p + run.dice;
    if (newP === FINISH) score += 500;
    if (p === -1) score += 200;
    score += newP;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function aiStep(run) {
  if (run.phase === 'over') return null;
  if (run.phase === 'roll') {
    rollDice(run);
    if (run.phase === 'move') {
      const choice = aiChoose(run);
      moveToken(run, choice);
    }
    return { acted: true };
  }
  if (run.phase === 'move') {
    const choice = aiChoose(run);
    moveToken(run, choice);
    return { acted: true };
  }
  return null;
}

export function getHud(run) {
  return {
    turn: run.turn,
    dice: run.dice,
    phase: run.phase,
    movable: [...run.movable],
    winner: run.winner,
    tokens: run.players.map((p) => [...p.tokens]),
    finished: run.players.map((p) => p.tokens.filter((t) => t === FINISH).length),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const PLAYER_COUNT = PLAYERS.length;