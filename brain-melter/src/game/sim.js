// BRAIN MELTER · 纯逻辑 sim（无 DOM，可被 node --test / tools/selfplay.mjs 直接 import）
// 机制：sequence / select / sum / pair / rotation，通用结算：星级 / 连击 / 限时 / 提示道具。
import { LEVELS } from '../../config/levels.js';
import { RULES } from '../../config/game.config.js';

export const MAX_FAULTS = RULES.MAX_FAULTS;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  const events = [];

  const s = {
    phase: 'playing',           // playing | won | lost
    level: (level.index | 0),
    levelIndex: LEVELS.indexOf(level),
    type: level.type,
    faults: 0,
    maxFaults: MAX_FAULTS,
    combo: 0,
    bestCombo: 0,
    time: 0,
    timeLimit: level.timeLimit || 0,
    timeLeft: level.timeLimit || Infinity,
    stars: 0,
    hints: RULES.HINTS_PER_LEVEL,
    // 机制状态
    seq: 0,                    // sequence 已正确推进的步数
    picked: [],                // sum / pair 当前已选
    sum: 0,                    // sum 累计
    cleared: [],               // pair 已消除的 id
    rot: {},                   // rotation 当前朝向
  };

  if (level.type === 'rotation') {
    for (const it of level.items) s.rot[it.id] = it.rot || 0;
  }

  function emit(type, payload = {}) {
    events.push({ type, ...payload, t: s.time });
  }

  function comboAdd() {
    s.combo += 1;
    if (s.combo > s.bestCombo) s.bestCombo = s.combo;
    if (s.combo >= 2) emit('combo', { combo: s.combo });
  }

  function faultAdd() {
    s.faults += 1;
    s.combo = 0;
  }

  function starFor() {
    return s.faults === 0 ? 3 : s.faults === 1 ? 2 : 1;
  }

  function finish(won, reason) {
    if (s.phase !== 'playing') return;
    s.phase = won ? 'won' : 'lost';
    if (won) {
      s.stars = starFor();
      emit('win', { stars: s.stars, reason, level: s.level });
      emit('star', { stars: s.stars, level: s.level });
    } else {
      emit('lose', { stars: 0, reason, level: s.level });
    }
  }

  function checkLose() {
    if (s.faults >= s.maxFaults) finish(false, 'faults');
  }

  function itemById(id) {
    return level.items.find((x) => x.id === id) || null;
  }

  function sortedSeq() {
    return [...level.items].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function tap(id) {
    if (s.phase !== 'playing') return { ok: false, reason: 'notPlaying' };
    const it = itemById(id);
    if (!it) return { ok: false, reason: 'badId' };

    emit('input', { id });
    switch (level.type) {
      case 'sequence': {
        const expect = sortedSeq()[s.seq];
        if (expect && expect.id === id) {
          s.seq += 1;
          comboAdd();
          emit('correct', { id, seq: s.seq });
          if (s.seq >= level.items.length) finish(true, 'solved');
        } else {
          faultAdd();
          emit('wrong', { id });
          s.seq = 0;
          checkLose();
        }
        break;
      }
      case 'select': {
        if (it.isCorrect) {
          comboAdd();
          emit('correct', { id });
          finish(true, 'solved');
        } else {
          faultAdd();
          emit('wrong', { id });
          checkLose();
        }
        break;
      }
      case 'sum': {
        if (s.picked.includes(id)) return { ok: false, reason: 'alreadyPicked' };
        s.picked.push(id);
        s.sum += (it.value || 0);
        emit('sumAdd', { id, sum: s.sum });
        if (s.sum === level.target) {
          comboAdd();
          emit('correct', { id, sum: s.sum });
          finish(true, 'solved');
        } else if (s.sum > level.target) {
          faultAdd();
          emit('wrong', { id, sum: s.sum });
          s.sum = 0;
          s.picked = [];
          checkLose();
        }
        break;
      }
      case 'pair': {
        if (s.cleared.includes(id)) return { ok: false, reason: 'cleared' };
        if (s.picked.length === 0) {
          s.picked = [id];
          emit('pick', { id });
        } else if (s.picked[0] === id) {
          s.picked = [];
        } else {
          const a = itemById(s.picked[0]);
          if (a && a.match === it.match) {
            s.cleared.push(a.id, it.id);
            s.picked = [];
            comboAdd();
            emit('correct', { id, pair: [a.id, it.id] });
            if (s.cleared.length >= level.items.length) finish(true, 'solved');
          } else {
            faultAdd();
            emit('wrong', { id });
            s.picked = [];
            checkLose();
          }
        }
        break;
      }
      case 'rotation': {
        s.rot[id] = ((s.rot[id] || 0) + 90) % 360;
        emit('rotate', { id, rot: s.rot[id] });
        const aligned = level.items.every((x) => s.rot[x.id] === (x.target % 360));
        if (aligned) {
          comboAdd();
          emit('correct', { id });
          finish(true, 'solved');
        }
        break;
      }
      default:
        return { ok: false, reason: 'badType' };
    }
    return { ok: true };
  }

  function nextHintId() {
    switch (level.type) {
      case 'sequence': {
        const e = sortedSeq()[s.seq];
        return e ? e.id : null;
      }
      case 'select':
        return (level.items.find((x) => x.isCorrect) || {}).id ?? null;
      case 'sum': {
        const next = level.solution.find((id) => !s.picked.includes(id));
        return next ?? null;
      }
      case 'pair': {
        const uncleared = level.items.find((x) => !s.cleared.includes(x.id));
        return uncleared ? uncleared.id : null;
      }
      case 'rotation': {
        const bad = level.items.find((x) => s.rot[x.id] !== (x.target % 360));
        return bad ? bad.id : null;
      }
      default:
        return null;
    }
  }

  function hint() {
    if (s.phase !== 'playing') return { ok: false, reason: 'notPlaying' };
    if (s.hints <= 0) return { ok: false, reason: 'noHints' };
    s.hints -= 1;
    faultAdd(); // 提示有代价：消耗一次失误机会（可能少一颗星）
    const id = nextHintId();
    emit('hint', { id });
    checkLose();
    return { ok: true, id };
  }

  function step(dt) {
    if (s.phase !== 'playing') return;
    s.time += dt;
    if (s.timeLimit > 0) {
      const prev = Math.ceil(s.timeLeft);
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        finish(false, 'timeOut');
        return;
      }
      const now = Math.ceil(s.timeLeft);
      if (now < prev && now > 0 && now <= 5) emit('timeTick', { timeLeft: now });
    }
  }

  // 供 selfplay / verify 的确定性解法：按此顺序 tap 即可通关
  function solutionTaps() {
    switch (level.type) {
      case 'sequence':
        return sortedSeq().map((x) => x.id);
      case 'select':
        return level.items.filter((x) => x.isCorrect).map((x) => x.id);
      case 'sum':
        return level.solution.slice();
      case 'pair': {
        const out = [];
        const seen = new Set();
        for (const it of level.items) {
          if (seen.has(it.match)) continue;
          const mate = level.items.find((y) => y.match === it.match && y.id !== it.id);
          if (mate) { out.push(it.id, mate.id); seen.add(it.match); }
        }
        return out;
      }
      case 'rotation': {
        const out = [];
        for (const it of level.items) {
          let n = (((it.target % 360) - (s.rot[it.id] || 0)) / 90) % 4;
          if (n < 0) n += 4;
          for (let i = 0; i < n; i += 1) out.push(it.id);
        }
        return out;
      }
      default:
        return [];
    }
  }

  function getHud() {
    return {
      level: s.level,
      type: s.type,
      phase: s.phase,
      faults: s.faults,
      maxFaults: s.maxFaults,
      combo: s.combo,
      bestCombo: s.bestCombo,
      timeLeft: s.timeLimit > 0 ? Math.max(0, s.timeLeft) : null,
      stars: s.stars,
      hints: s.hints,
      target: level.target ?? null,
      sum: s.sum,
    };
  }

  function drainEvents() {
    const out = events.splice(0, events.length);
    return out;
  }

  emit('levelStart', { level: s.level, type: s.type });

  return {
    state: s,
    level,
    step,
    tap,
    hint,
    nextHintId,
    solutionTaps,
    getHud,
    drainEvents,
  };
}
