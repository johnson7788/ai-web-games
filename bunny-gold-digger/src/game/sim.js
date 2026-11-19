// Bunny Gold Digger · 模拟层（纯逻辑，零 DOM/window/canvas/Date.now）
// 黄金矿工钩爪：摆角度 → 下放 → 命中金/钻石/石头/胡萝卜 → 回收 → 结算。
// 新机制：连击（combo）、黄金狂热（Gold Fever，胡萝卜蓄能后金价翻倍）、星级结算。
// 随机：注入 seed 的 mulberry32，可复现（selfplay 依赖确定性）。
import { WORLD, STEP, DEG, CLAW, ITEM, POWER, COMBO, SCORE } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

export { STEP };

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// 物品角度槽（间距 7°，配合窄深度带，保证抓钩射线互不误抓）
const ANGLE_POOL = [-42, -35, -28, -21, -14, -7, 0, 7, 14, 21, 28, 35, 42];

// ------------------------------------------------------------------ 物品生成
function generateItems(level, rng) {
  const angles = shuffle(ANGLE_POOL.slice(), rng);
  const kinds = [];
  const c = level.counts || {};
  for (const k of Object.keys(ITEM)) {
    for (let i = 0; i < (c[k] || 0); i += 1) kinds.push(k);
  }
  shuffle(kinds, rng);
  const items = [];
  let id = 0;
  for (const kind of kinds) {
    const deg = angles.length ? angles.shift() : (rng() * 2 - 1) * 40;
    const angle = deg * DEG;
    const depth = 380 + rng() * 60;
    const x = CLAW.pivotX + Math.sin(angle) * depth;
    const y = CLAW.pivotY + Math.cos(angle) * depth;
    const def = ITEM[kind];
    items.push({
      id: id++,
      kind,
      x: Math.round(x),
      y: Math.round(y),
      r: def.r,
      weight: def.weight,
      value: def.value,
      alive: true,
      angle: Math.atan2(x - CLAW.pivotX, y - CLAW.pivotY),
    });
  }
  return items;
}

function computeStars(score, level) {
  if (score >= level.stars[2]) return 3;
  if (score >= level.stars[1]) return 2;
  if (score >= level.stars[0]) return 1;
  return 0;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    phase: 'playing',           // playing | won | lost
    timeLeft: level.time,
    initialTime: level.time,
    score: 0,
    target: level.target,
    stars: 0,
    combo: 0,
    maxCombo: 0,
    powerMeter: 0,
    powerReady: false,
    fever: { active: false, tLeft: 0 },
    hook: {
      phase: 'swinging',        // swinging | extending | returning
      angle: 0,
      dir: 1,
      len: 0,
      tip: { x: CLAW.pivotX, y: CLAW.pivotY },
      held: null,
      returnTime: 0,
      returnT: 0,
      returnFrom: { x: CLAW.pivotX, y: CLAW.pivotY },
    },
    items: generateItems(level, rng),
    stats: { drops: 0, grabs: 0, misses: 0, rocks: 0, carrots: 0, powers: 0 },
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _comboWindow: 0,
    _lastSecond: Math.ceil(level.time),
    _emit(ev) { this._events.push(ev); },

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }

      if (s.fever.active) {
        s.fever.tLeft -= dt;
        if (s.fever.tLeft <= 0) s.fever.active = false;
      }
      if (s.combo > 0) {
        this._comboWindow -= dt;
        if (this._comboWindow <= 0) s.combo = 0;
      }

      this._stepHook(dt);

      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._endRun(s.score >= s.target);
      }
    },

    _stepHook(dt) {
      const h = this.state.hook;
      if (h.phase === 'swinging') {
        h.angle += h.dir * CLAW.angularSpeed * dt;
        if (h.angle >= CLAW.swingMax) { h.angle = CLAW.swingMax; h.dir = -1; }
        else if (h.angle <= -CLAW.swingMax) { h.angle = -CLAW.swingMax; h.dir = 1; }
      } else if (h.phase === 'extending') {
        h.len += CLAW.dropSpeed * dt;
        h.tip.x = CLAW.pivotX + Math.sin(h.angle) * h.len;
        h.tip.y = CLAW.pivotY + Math.cos(h.angle) * h.len;
        const hit = this._hitItem();
        if (hit) {
          this._onHit(hit);
        } else if (h.len >= CLAW.maxLen || h.tip.y >= CLAW.floorY) {
          this._startReturn(null, 'miss');
        }
      } else if (h.phase === 'returning') {
        h.returnT += dt;
        const k = Math.min(1, h.returnT / h.returnTime);
        h.tip.x = h.returnFrom.x + (CLAW.pivotX - h.returnFrom.x) * k;
        h.tip.y = h.returnFrom.y + (CLAW.pivotY - h.returnFrom.y) * k;
        if (k >= 1) {
          const held = h.held;
          h.held = null;
          h.len = 0;
          h.tip.x = CLAW.pivotX;
          h.tip.y = CLAW.pivotY;
          h.phase = 'swinging';
          if (held) this._emit({ type: 'retrieve', kind: held.kind });
        }
      }
    },

    _hitItem() {
      const h = this.state.hook;
      for (const it of this.state.items) {
        if (!it.alive) continue;
        const dx = h.tip.x - it.x;
        const dy = h.tip.y - it.y;
        const rr = it.r + CLAW.hitMargin;
        if (dx * dx + dy * dy <= rr * rr) return it;
      }
      return null;
    },

    _onHit(it) {
      const s = this.state;
      it.alive = false;
      this._emit({ type: 'hit', kind: it.kind });

      if (it.kind === 'rock') {
        s.score = Math.max(0, s.score - SCORE.rockPenalty);
        s.combo = 0;
        s.stats.rocks += 1;
        this._emit({ type: 'rockHit' });
        this._emit({ type: 'score', delta: -SCORE.rockPenalty, score: s.score });
        this._startReturn(null, 'rock');
        return;
      }

      if (it.kind === 'carrot') {
        s.powerMeter = Math.min(1, s.powerMeter + POWER.carrotCharge);
        s.stats.carrots += 1;
        this._emit({ type: 'carrot' });
        if (s.powerMeter >= 1 && !s.powerReady) {
          s.powerReady = true;
          this._emit({ type: 'powerReady' });
        }
        this._startReturn(it, 'item');
        return;
      }

      // gold / diamond
      const base = it.value * (s.fever.active ? POWER.feverMultiplier : 1);
      s.combo += 1;
      this._comboWindow = COMBO.window;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      const bonus = s.combo >= 2 ? Math.min(s.combo - 1, COMBO.maxBonus) : 0;
      const gained = base + bonus;
      s.score += gained;
      if (!s.fever.active) s.powerMeter = Math.min(1, s.powerMeter + POWER.goldCharge);
      if (s.powerMeter >= 1 && !s.powerReady) {
        s.powerReady = true;
        this._emit({ type: 'powerReady' });
      }
      s.stats.grabs += 1;
      this._emit({ type: 'grab', kind: it.kind, value: gained });
      this._emit({ type: 'score', delta: gained, score: s.score });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      this._startReturn(it, 'item');
    },

    _startReturn(held, reason) {
      const h = this.state.hook;
      h.phase = 'returning';
      h.held = held;
      h.returnFrom = { x: h.tip.x, y: h.tip.y };
      h.returnT = 0;
      const weight = held ? held.weight : 0;
      h.returnTime = CLAW.returnBase + weight * CLAW.returnPerWeight;
      if (reason === 'miss') {
        this.state.combo = 0;
        this.state.stats.misses += 1;
        this._emit({ type: 'miss' });
      }
    },

    // ---- 玩家动作 ----
    drop() {
      const s = this.state;
      if (s.phase !== 'playing' || s.hook.phase !== 'swinging') return { ok: false, reason: 'busy' };
      s.hook.phase = 'extending';
      s.hook.len = 0;
      s.hook.tip.x = CLAW.pivotX + Math.sin(s.hook.angle) * 0;
      s.hook.tip.y = CLAW.pivotY + Math.cos(s.hook.angle) * 0;
      s.stats.drops += 1;
      this._emit({ type: 'drop', angle: s.hook.angle });
      return { ok: true };
    },

    power() {
      const s = this.state;
      if (s.phase !== 'playing' || !s.powerReady) return { ok: false, reason: 'notReady' };
      s.powerReady = false;
      s.powerMeter = 0;
      s.fever.active = true;
      s.fever.tLeft = POWER.feverDuration;
      s.stats.powers += 1;
      this._emit({ type: 'fever', duration: POWER.feverDuration });
      return { ok: true };
    },

    bank() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.score < s.target) return { ok: false, reason: 'belowTarget' };
      this._endRun(true);
      return { ok: true };
    },

    _endRun(won) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = won ? 'won' : 'lost';
      s.stars = won ? computeStars(s.score, this._level) : 0;
      s.result = { won, score: s.score, stars: s.stars, reason: won ? 'cleared' : 'timeUp' };
      this._emit({ type: won ? 'win' : 'lose', score: s.score, stars: s.stars });
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        timeLeft: s.timeLeft,
        score: s.score,
        target: s.target,
        combo: s.combo,
        maxCombo: s.maxCombo,
        powerMeter: s.powerMeter,
        powerReady: s.powerReady,
        fever: s.fever.active,
        stars: s.stars,
        drops: s.stats.drops,
        grabs: s.stats.grabs,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },
  };

  run._emit({ type: 'levelStart', level: level.index, target: level.target });
  return run;
}

export { LEVELS, LEVEL_COUNT };
