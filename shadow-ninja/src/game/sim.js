// Shadow Ninja Cat · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：确定性关卡生成、自动奔跑物理（跳/俯冲/二段跳）、风铃收集、判定、星级结算、事件表。
// 依赖：config/levels.js、config/game.config.js。随机：注入 seed 的 mulberry32，可复现。
// 契约：docs/README.md §3（createRun API / state 形状 / 事件表）。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export const CELL_W = GAME.CELL_W;

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

// ------------------------------------------------------------------ 关卡生成
function flat() {
  return { t: 'flat', high: false, chime: false, chimeHigh: false, dog: false, fog: false, glide: false, collected: false };
}

export function generateCourse(level, rng) {
  const f = level.features || {};
  const n = level.length;
  const START = 6;
  const END = 4;
  const cells = [];
  for (let i = 0; i < n; i += 1) cells.push(flat());

  const bodyLen = n - START - END;
  const abs = (rel) => START + Math.floor(rel * bodyLen);

  const dogRange = f.dog ? [abs(0.38), abs(0.50)] : null;
  const fogRange = f.fog ? [abs(0.44), abs(0.70)] : null;
  const glideRange = f.glide ? [abs(0.50), abs(0.68)] : null;

  for (let i = 0; i < n; i += 1) {
    cells[i].dog = !!(dogRange && i >= dogRange[0] && i < dogRange[1]);
    cells[i].fog = !!(fogRange && i >= fogRange[0] && i < fogRange[1]);
    if (glideRange && i >= glideRange[0] && i < glideRange[1]) {
      cells[i].t = 'glide';
      cells[i].chime = ((i - glideRange[0]) % 2 === 0);
      cells[i].glide = true;
    }
  }

  // 地面障碍：gap 恒有；spike/enemy 按特性开启。spacing 保证 greedy bot 可通关（前 3 关）。
  const groundHazards = ['gap'];
  if (f.spike) groundHazards.push('spike');
  if (f.enemy) groundHazards.push('enemy');
  const spacing = f.dense ? 4 : 5;
  const wide = !!f.wideGap;

  let hi = 0;
  let i = START + 2;
  while (i < n - END - 1) {
    if ((i - START) % spacing === 2) {
      if (!cells[i].glide) {
        cells[i].t = groundHazards[hi % groundHazards.length];
        hi += 1;
        if (wide && cells[i].t === 'gap' && i + 1 < n - END && !cells[i + 1].glide) {
          cells[i + 1].t = 'gap';
          i += 1;
        }
      }
    }
    i += 1;
  }

  // 飞镖（敌方忍者）铺在障碍后 2 格的平地：贴地跑安全，乱跳会撞。
  if (f.shuriken) {
    let si = START + 4;
    while (si < n - END - 1) {
      if ((si - START) % spacing === 4 && !cells[si].glide && cells[si].t === 'flat') {
        cells[si].t = 'shuriken';
      }
      si += 1;
    }
  }

  // 风铃：每个 spacing 块的第 0 格放低空风铃（贴着跑就吃到）。
  for (let j = START; j < n - END; j += 1) {
    if ((j - START) % spacing === 0 && cells[j].t === 'flat' && !cells[j].glide) {
      cells[j].chime = true;
    }
  }

  // 高低双层：每隔一段放一块悬浮平台 + 高空风铃（跳起来才吃得到）。
  if (f.highLow) {
    for (let j = START; j < n - END; j += 1) {
      if ((j - START) % 7 === 3 && cells[j].t === 'flat' && !cells[j].glide && !cells[j].chime) {
        cells[j].high = true;
        cells[j].chimeHigh = true;
      }
    }
  }

  // 风铃链：一段连续高空风铃。
  if (f.bellChain) {
    const chainStart = abs(0.28);
    for (let k = 0; k < 5; k += 1) {
      const idx = chainStart + k;
      if (idx >= START && idx < n - END && cells[idx].t === 'flat' && !cells[idx].glide) {
        cells[idx].high = true;
        cells[idx].chimeHigh = true;
      }
    }
  }

  const chimeTotal = cells.reduce((s, c) => s + (c.chime || c.chimeHigh ? 1 : 0), 0);
  const goalDist = (n - 1) * CELL_W;

  return {
    cells,
    goalDist,
    chimeTotal,
    dogRange,
    fogRange,
    glideRange,
    length: n,
  };
}

function cellIndexAt(x, n) {
  const i = Math.floor(x / CELL_W);
  if (i < 0) return 0;
  if (i >= n) return n - 1;
  return i;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const abilities = opts.abilities || {};
  const props = opts.props || { fly: 0, magnet: 0, double: 0 };

  const course = generateCourse(level, rng);
  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'countdown', // countdown | playing | won | lost
    clock: 0,
    countdown: GAME.COUNTDOWN,
    x: 0,               // 玩家前缘世界 x（px）
    y: 0,               // 脚底离低层地面的高度（px）
    vy: 0,
    onGround: true,
    diving: false,
    coyote: 0,
    jumpBuffer: 0,
    jumps: 0,
    doubleJumpUsed: false,
    hits: 0,
    chimes: 0,
    chimeTotal: course.chimeTotal,
    chimeGoal: level.chimeGoal,
    goalDist: course.goalDist,
    baseSpeed: level.speed,
    speed: level.speed,
    shield: abilities.bell ? 1 : 0,
    flyT: 0,
    magnetT: 0,
    doubleT: 0,
    invincibleT: 0,
    props: { fly: props.fly || 0, magnet: props.magnet || 0, double: props.double || 0 },
    abilities: { cloak: !!abilities.cloak, hook: !!abilities.hook },
    stars: 0,
    result: null,
    course: course.cells,
    fogRange: course.fogRange,
    glideRange: course.glideRange,
    dogRange: course.dogRange,
  };

  const run = {
    state,
    _events: [],
    _lastSecond: Math.ceil(GAME.COUNTDOWN),
    _lastCell: 0,
    _wasDog: false,
    _nearMissDone: new Set(),

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.clock += dt;

      // 计时器
      if (s.flyT > 0) s.flyT = Math.max(0, s.flyT - dt);
      if (s.magnetT > 0) s.magnetT = Math.max(0, s.magnetT - dt);
      if (s.doubleT > 0) s.doubleT = Math.max(0, s.doubleT - dt);
      if (s.invincibleT > 0) s.invincibleT = Math.max(0, s.invincibleT - dt);
      if (s.jumpBuffer > 0) s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);

      if (s.phase === 'countdown') {
        s.countdown -= dt;
        const sec = Math.ceil(s.countdown);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.countdown <= 0) {
          s.countdown = 0;
          s.phase = 'playing';
          this._emit({ type: 'go' });
        }
        return;
      }

      // ---------- playing ----------
      const frontCell = s.course[cellIndexAt(s.x, s.course.length)] || {};
      const inDog = !!frontCell.dog;
      s.speed = s.baseSpeed * (inDog ? GAME.DOG_MUL : 1);
      if (inDog && !this._wasDog) {
        this._wasDog = true;
        this._emit({ type: 'speedup', x: s.x });
      } else if (!inDog) {
        this._wasDog = false;
      }

      s.x += s.speed * dt;

      const newCell = cellIndexAt(s.x, s.course.length);
      if (newCell !== this._lastCell) {
        this._lastCell = newCell;
        this._emit({ type: 'cellEnter', cell: newCell, x: s.x });
      }

      this._stepVertical(dt);
      if (s.phase === 'lost') return;

      this._collide(newCell);
      if (s.phase === 'lost') return;

      this._collect(newCell);
      if (s.phase === 'lost') return;

      if (s.x >= s.goalDist) this._win();
    },

    _stepVertical(dt) {
      const s = this.state;
      if (s.flyT > 0) {
        // 竹蜻蜓：无敌滑翔，缓降/缓升到安全高度
        const target = 96;
        s.y += (target - s.y) * 0.18;
        s.vy = 0;
        s.onGround = false;
        s.diving = false;
        this._collectNearby();
        return;
      }
      const idx = cellIndexAt(s.x, s.course.length);
      const cell = s.course[idx] || {};
      if (cell.glide && s.flyT <= 0) {
        // 滑索：自动滑行
        s.y += (GAME.GLIDE_H - s.y) * 0.14;
        s.vy = 0;
        s.onGround = false;
        s.diving = false;
        return;
      }

      const fh = this._floorHeightAt(s.x);

      if (s.onGround) {
        if (fh == null) {
          s.onGround = false;
          s.vy = 0;
        } else if (s.y > fh + 1) {
          s.onGround = false;
          s.vy = 0;
        } else {
          s.y = fh;
          s.coyote = 0;
        }
        return;
      }

      // 空中
      s.coyote += dt;
      s.vy -= GAME.GRAVITY * dt;
      s.y += s.vy * dt;

      if (fh != null && s.vy <= 0 && s.y <= fh) {
        s.y = fh;
        s.vy = 0;
        s.onGround = true;
        s.diving = false;
        s.coyote = 0;
        this._emit({ type: 'land', x: s.x, y: s.y });
        // 跳跃缓冲：落地前按过跳
        if (s.jumpBuffer > 0) {
          s.jumpBuffer = 0;
          this._doJump(false);
        }
      } else if (fh == null && s.y < GAME.DEATH_Y) {
        this._die('fell');
      }
    },

    _floorHeightAt(x) {
      const s = this.state;
      const idx = cellIndexAt(x, s.course.length);
      const cell = s.course[idx] || {};
      if (cell.t === 'gap' || cell.glide) return null;
      return 0; // 高低双层不改变低层地面（平台悬浮在上）
    },

    _collide(newCell) {
      const s = this.state;
      const idx = newCell;
      const cell = s.course[idx] || {};
      if (s.flyT > 0 || s.invincibleT > 0) return;

      // 地面障碍：贴地即撞
      if (cell.t === 'spike' || cell.t === 'enemy') {
        if (s.y < GAME.SPIKE_TOP) {
          if (this._absorb()) return;
          this._die('hit');
          return;
        }
        // near miss：擦着尖刺顶过去
        if (s.y < GAME.SPIKE_TOP + GAME.NEAR_MISS_DIST && !this._nearMissDone.has(idx)) {
          this._nearMissDone.add(idx);
          this._emit({ type: 'nearMiss', x: s.x, cell: idx });
        }
      }
      // 飞镖：头顶高度撞
      if (cell.t === 'shuriken') {
        if (s.y + GAME.PLAYER_H > GAME.SHURIKEN_LO) {
          if (this._absorb()) return;
          this._die('hit');
          return;
        }
      }
    },

    _absorb() {
      const s = this.state;
      if (s.shield > 0) {
        s.shield -= 1;
        s.hits += 1;
        s.invincibleT = 1.2;
        this._emit({ type: 'shieldBreak', x: s.x });
        return true;
      }
      return false;
    },

    _collect(idx) {
      const s = this.state;
      const cell = s.course[idx] || {};
      if (cell.collected) return;
      if (cell.chime && Math.abs(s.y - 0) < 42) {
        cell.collected = true;
        const gain = s.doubleT > 0 ? 2 : 1;
        s.chimes += gain;
        this._emit({ type: 'collect', chime: gain, total: s.chimes, x: s.x });
      } else if (cell.chimeHigh && Math.abs(s.y - GAME.HIGH) < 46) {
        cell.collected = true;
        const gain = s.doubleT > 0 ? 2 : 1;
        s.chimes += gain;
        this._emit({ type: 'collect', chime: gain, total: s.chimes, high: true, x: s.x });
        this._emit({ type: 'bellBonus', total: s.chimes, x: s.x });
      }
    },

    _collectNearby() {
      const s = this.state;
      if (s.magnetT <= 0 && s.flyT <= 0) return;
      const center = cellIndexAt(s.x, s.course.length);
      for (let i = center - 2; i <= center + 2; i += 1) {
        if (i < 0 || i >= s.course.length) continue;
        const cell = s.course[i];
        if (cell.collected) continue;
        const cy = cell.chime ? 0 : cell.chimeHigh ? GAME.HIGH : null;
        if (cy == null) continue;
        if (Math.abs(s.y - cy) < 90) {
          cell.collected = true;
          const gain = s.doubleT > 0 ? 2 : 1;
          s.chimes += gain;
          this._emit({ type: 'collect', chime: gain, total: s.chimes, x: s.x, magnet: true });
        }
      }
    },

    _doJump(double) {
      const s = this.state;
      s.vy = s.abilities.hook ? GAME.JUMP_V * 1.32 : GAME.JUMP_V;
      s.onGround = false;
      s.diving = false;
      s.coyote = GAME.COYOTE_S + 0.01; // 消耗土狼时间，避免一跳后立刻再触发土狼跳
      s.jumps = double ? 2 : 1;
      s.doubleJumpUsed = !!double;
      this._emit({ type: 'jump', x: s.x, double: !!double });
    },

    jump() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const grounded = s.onGround || s.coyote <= GAME.COYOTE_S;
      if (grounded) {
        this._doJump(false);
        return { ok: true };
      }
      if (s.abilities.cloak && !s.doubleJumpUsed && s.jumps >= 1) {
        this._doJump(true);
        return { ok: true };
      }
      s.jumpBuffer = GAME.JUMP_BUFFER_S;
      return { ok: false, reason: 'air' };
    },

    dive() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.onGround || s.flyT > 0) return { ok: false, reason: s.onGround ? 'ground' : 'fly' };
      s.vy = -GAME.DIVE_V;
      s.diving = true;
      this._emit({ type: 'dive', x: s.x });
      return { ok: true };
    },

    useProp(type) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.props[type] <= 0) return { ok: false, reason: 'empty' };
      s.props[type] -= 1;
      if (type === 'fly') {
        s.flyT = GAME.PROP_DURATION;
        s.vy = 0;
        this._emit({ type: 'fly', x: s.x });
      } else if (type === 'magnet') {
        s.magnetT = GAME.PROP_DURATION;
        this._emit({ type: 'prop', prop: 'magnet', x: s.x });
      } else if (type === 'double') {
        s.doubleT = GAME.PROP_DURATION;
        this._emit({ type: 'prop', prop: 'double', x: s.x });
      }
      return { ok: true };
    },

    revive() {
      const s = this.state;
      if (s.phase !== 'lost') return { ok: false, reason: 'phase' };
      s.phase = 'playing';
      s.x = Math.max(0, s.x - GAME.CELL_W * 2);
      s.y = 0;
      s.vy = 0;
      s.onGround = true;
      s.diving = false;
      s.invincibleT = 1.5;
      this._lastCell = cellIndexAt(s.x, s.course.length);
      this._emit({ type: 'revive', x: s.x });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        x: s.x,
        goalDist: s.goalDist,
        dist: Math.floor(s.x / 10), // 距离（1 单位 = 10px，展示友好）
        chimes: s.chimes,
        chimeGoal: s.chimeGoal,
        speed: s.speed,
        shield: s.shield,
        hits: s.hits,
        countdown: Math.max(0, Math.ceil(s.countdown)),
        flyT: s.flyT,
        magnetT: s.magnetT,
        doubleT: s.doubleT,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },

    _die(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, chimes: s.chimes, chimeGoal: s.chimeGoal, dist: s.x, reason };
      this._emit({ type: 'lose', reason, x: s.x });
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      let stars = 1;
      if (s.chimes >= s.chimeGoal) stars += 1;
      if (s.hits === 0) stars += 1;
      s.stars = stars;
      s.result = { won: true, stars, chimes: s.chimes, chimeGoal: s.chimeGoal, dist: s.x, hits: s.hits };
      this._emit({ type: 'win', stars, chimes: s.chimes, chimeGoal: s.chimeGoal, x: s.x });
    },
  };

  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
