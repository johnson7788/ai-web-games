// BOUNCY BALL RUN3D · 纯逻辑 sim（无 DOM，Node/浏览器通用）
// 玩法骨架 1:1 还原《欢乐球球》P0：弹球沿螺旋塔下坠，撞安全块弹起、红块死、同一块滞留死。
// 新机制：连击倍率（连续穿缺口叠加得分）、岩石块（踩一次碎裂成缺口）、宝石（穿缺口收集/星级）。
import { TOWER, STEP, RATING } from '../../config/game.config.js';

const T = TOWER;
const N = T.N_SLOTS;

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

const mod = (a, m) => ((a % m) + m) % m;

// 槽位在圆环上的角度差（最短方向，-3..3 槽）
export function slotDelta(from, to) {
  let d = mod(to - from, N);
  if (d > N / 2) d -= N;
  return d;
}

// 贪心旋转方向：对准「球正在接近的那层」最近的缺口/宝石（连续角度，避免槽位边界振荡）
export function greedyDir(run) {
  const di = run.nextDiscIndex();
  const disc = run.discs[di];
  const local = mod(-run.state.towerRot - disc.rotOffset, 360);
  let bestDiff = Infinity;
  for (let s = 0; s < N; s += 1) {
    const t = disc.slots[s];
    if (t !== 'gap' && t !== 'gem') continue;
    const center = s * T.SEG_ARC + T.SEG_ARC / 2;
    let diff = center - local;
    diff = mod(diff + 180, 360) - 180;
    if (Math.abs(diff) < Math.abs(bestDiff)) bestDiff = diff;
  }
  if (Math.abs(bestDiff) <= 1) return 0;
  return -Math.sign(bestDiff);
}

function gemChance(depth) {
  return depth < 2 ? 0.15 : Math.min(0.35, 0.18 + depth * 0.008);
}
function dangerProb(depth) {
  if (depth < 3) return 0;
  return Math.min(0.46, 0.08 + depth * 0.024);
}
function rockProb(depth) {
  if (depth < 4) return 0;
  return Math.min(0.34, 0.05 + depth * 0.018);
}

// 随机打乱 [0..N-1] 的下标
function shuffledIdx(rng) {
  const arr = [];
  for (let i = 0; i < N; i += 1) arr.push(i);
  for (let i = N - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 生成一层：保证至少 1 个缺口/宝石；随深度递增红块与岩石密度。
function makeDisc(depth, rng) {
  const slots = new Array(N).fill('safe');
  const order = shuffledIdx(rng);
  const gapCount = depth < 3 ? 1 : (rng() < 0.45 ? 2 : 1);

  for (let i = 0; i < gapCount; i += 1) {
    const s = order[i];
    // 前几层缺口固定放宝石，保证新手第一眼能看到可收集物
    slots[s] = depth < 3 ? 'gem' : (rng() < gemChance(depth) ? 'gem' : 'gap');
  }

  const dP = dangerProb(depth);
  for (let i = gapCount; i < N; i += 1) {
    if (slots[order[i]] === 'safe' && rng() < dP) slots[order[i]] = 'danger';
  }

  const rP = rockProb(depth);
  for (let i = gapCount; i < N; i += 1) {
    if (slots[order[i]] === 'safe' && rng() < rP) slots[order[i]] = 'rock';
  }

  return { slots, rotOffset: rng() * 360 };
}

function rating(floors) {
  if (floors >= RATING.star3) return 3;
  if (floors >= RATING.star2) return 2;
  if (floors >= RATING.star1) return 1;
  return 0;
}

export function createRun(opts = {}) {
  const rng = mulberry32(opts.seed == null ? 12345 : opts.seed);
  const targetFloors = opts.targetFloors == null ? T.TARGET_FLOORS : opts.targetFloors;

  const discs = [];
  let genDepth = T.NUM_DISCS - 1;
  const startY = 0; // 第 0 层中心 y = 0
  for (let i = 0; i < T.NUM_DISCS; i += 1) {
    const d = makeDisc(i, rng);
    d.y = startY - i * T.SPACING;
    d.index = i;
    d.passed = false;
    discs.push(d);
  }

  const state = {
    phase: 'playing', // playing | won | gameover
    score: 0,
    floors: 0,
    gems: 0,
    combo: 0,
    bestCombo: 0,
    towerRot: 0,
    time: 0,
    stars: 0,
    targetFloors,
    ball: { y: startY + 5, vy: 0 },
    lastBounceDisc: -1,
    lastBounceSlot: -1,
    deadlock: 0,
  };

  let events = [];

  function emit(type, payload) {
    events.push({ type, payload: payload || {} });
  }

  emit('start', {});

  function ballSlotOnDisc(i) {
    const disc = discs[i];
    const local = mod(-state.towerRot - disc.rotOffset, 360);
    return Math.floor(local / T.SEG_ARC) % N;
  }

  function adjacentDanger(i, slot) {
    const s = discs[i].slots;
    return s[mod(slot + 1, N)] === 'danger' || s[mod(slot - 1, N)] === 'danger';
  }

  function nextDiscIndex() {
    const ballBottom = state.ball.y - T.BALL_R;
    let idx = -1;
    for (let i = 0; i < discs.length; i += 1) {
      const top = discs[i].y + T.THICK / 2;
      if (top <= ballBottom && (idx === -1 || discs[i].y > discs[idx].y)) idx = i;
    }
    return idx < 0 ? 0 : idx;
  }

  function collide(i, top) {
    const disc = discs[i];
    const slot = ballSlotOnDisc(i);
    const type = disc.slots[slot];

    // 缺口 / 宝石：直接下坠 → 通过一层
    if (type === 'gap' || type === 'gem') {
      if (!disc.passed) {
        disc.passed = true;
        state.floors += 1;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += state.combo; // 连击倍率：第 1 层 +1，第 2 层 +2 …
        if (type === 'gem') {
          state.gems += 1;
          state.score += 3;
          emit('gem', { slot, floor: state.floors, gems: state.gems });
        }
        emit('pass', { floor: state.floors, combo: state.combo, score: state.score });
        if (state.combo >= 2) emit('combo', { combo: state.combo });
        if (state.combo === 3 || state.combo === 6 || state.combo === 9) emit('fast', { combo: state.combo });
        if (state.floors === RATING.star1 || state.floors === RATING.star2 || state.floors === RATING.star3) {
          emit('milestone', { stars: rating(state.floors), floors: state.floors });
        }
        if (adjacentDanger(i, slot)) emit('nearMiss', { slot, floor: state.floors });
        if (state.floors >= targetFloors) {
          state.phase = 'won';
          state.stars = rating(state.floors);
          emit('win', { score: state.score, stars: state.stars, floors: state.floors });
        }
      }
      return;
    }

    // 红块：死
    if (type === 'danger') {
      state.phase = 'gameover';
      state.stars = rating(state.floors);
      emit('die', { reason: 'danger', score: state.score, floors: state.floors });
      return;
    }

    // 安全块 / 岩石：弹起
    state.ball.y = top + T.BALL_R;
    state.ball.vy = T.BOUNCE_V;
    if (i === state.lastBounceDisc && slot === state.lastBounceSlot) {
      state.deadlock += 1;
    } else {
      state.deadlock = 0;
      state.lastBounceDisc = i;
      state.lastBounceSlot = slot;
    }
    if (type === 'rock') {
      disc.slots[slot] = 'gap';
      emit('crumble', { slot, floor: state.floors });
    }
    emit('bounce', { slot, floor: state.floors, deadlock: state.deadlock });
    state.combo = 0;
    if (adjacentDanger(i, slot)) emit('nearMiss', { slot, floor: state.floors });
    if (state.deadlock >= T.DEADLOCK_LIMIT) {
      state.phase = 'gameover';
      state.stars = rating(state.floors);
      emit('die', { reason: 'deadlock', score: state.score, floors: state.floors });
    }
  }

  function step(input = {}) {
    if (state.phase !== 'playing') return;

    const prevY = state.ball.y;

    // 旋转（dRot 直接转 / rotate 连续方向）
    if (input.dRot != null && input.dRot !== 0) {
      state.towerRot = mod(state.towerRot + input.dRot, 360);
    } else if (input.rotate) {
      state.towerRot = mod(state.towerRot + input.rotate * T.ROT_SPEED * STEP, 360);
    }

    // 重力 + 下落速度封顶（原版）
    state.ball.vy -= T.GRAVITY * STEP;
    if (state.ball.vy < -T.MAX_FALL) state.ball.vy = -T.MAX_FALL;
    state.ball.y += state.ball.vy * STEP;
    if (state.ball.vy > T.BOUNCE_V) state.ball.vy = T.BOUNCE_V;

    // 下落时检测跨过某层顶面（单帧最多跨一层）
    if (state.ball.vy < 0) {
      const prevBottom = prevY - T.BALL_R;
      const newBottom = state.ball.y - T.BALL_R;
      for (let i = 0; i < discs.length; i += 1) {
        const top = discs[i].y + T.THICK / 2;
        if (newBottom <= top && prevBottom > top) {
          collide(i, top);
          break;
        }
      }
    }

    // 回收：层中心高于球中心一个层距以上 → 移到塔底重新生成（无限塔）
    let lowest = Infinity;
    for (const d of discs) if (d.y < lowest) lowest = d.y;
    for (const d of discs) {
      if (d.y > state.ball.y + T.SPACING) {
        genDepth += 1;
        const nd = makeDisc(genDepth, rng);
        d.slots = nd.slots;
        d.rotOffset = nd.rotOffset;
        d.index = genDepth;
        d.y = lowest - T.SPACING;
        d.passed = false;
        lowest = d.y;
      }
    }

    state.time += STEP;
  }

  function drainEvents() {
    const out = events;
    events = [];
    return out;
  }

  return {
    state,
    discs,
    step,
    drainEvents,
    ballSlotOnDisc,
    nextDiscIndex,
    adjacentDanger,
    targetFloors,
    // 便捷读取（verify/自对弈用）
    getHud() {
      return {
        phase: state.phase,
        score: state.score,
        floors: state.floors,
        gems: state.gems,
        combo: state.combo,
        stars: state.stars,
        time: state.time,
      };
    },
  };
}
