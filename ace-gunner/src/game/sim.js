// ACE GUNNER · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：敌人波次/移动/攻城、箭矢飞行与命中、盾匪破防、炸药桶爆炸、连杀鹰眼慢动作、
//       换弹节奏、波间升级、胜负判定、事件表。
// 依赖：config/levels.js + config/game.config.js。
// 契约：docs/README.md（createRun API / state 形状 / 事件表）。
// 随机：注入 seed 的 mulberry32，可复现。

import { ENEMY, LANE_Y, WAVE_ENEMIES, WAVE_REWARD, WAVE_COUNT, LEVELS } from '../../config/levels.js';
import { GAME, WORLD, LAYOUT, STEP } from '../../config/game.config.js';

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

// ------------------------------------------------------------------ 升级目录
export const UPGRADES = {
  rapidFire:    { kind: 'stat', apply: (s) => { s.fireCooldown *= 0.72; } },
  longRange:    { kind: 'stat', apply: (s) => { s.range += 120; } },
  bigQuiver:    { kind: 'stat', apply: (s) => { s.maxArrows += 4; s.arrows += 4; } },
  goldRush:     { kind: 'stat', apply: (s) => { s.goldMult += 0.5; } },
  piercingShot: { kind: 'rule', apply: (s) => { s.pierce += 1; } },
  tripleShot:   { kind: 'rule', apply: (s) => { s.triple = true; } },
  explosiveTips:{ kind: 'rule', apply: (s) => { s.explosive = true; } },
  eagleEyePlus: { kind: 'rule', apply: (s) => { s.eagleDuration += 1.4; s.eagleTimeScale = Math.max(0.25, s.eagleTimeScale - 0.12); } },
  legShot:      { kind: 'rule', apply: (s) => { s.legShot = true; } },
  wallRepair:   { kind: 'rule', apply: (s) => { s.baseMaxHp += 20; s.baseHp = Math.min(s.baseMaxHp, s.baseHp + 20); } },
};

const ALL_UPGRADES = Object.keys(UPGRADES);

function pickOffers(rng, owned, n = GAME.UPGRADES_PER_WAVE) {
  const pool = ALL_UPGRADES.filter((id) => !owned.has(id));
  const out = [];
  const copy = [...pool];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const idx = Math.max(0, Math.min(WAVE_COUNT - 1, levelIndex | 0));

  const state = {
    wave: idx + 1,               // 1 基
    phase: 'wave',               // wave | upgrade | won | lost
    sceneKey: LEVELS[idx].scene || 'noon-desert',
    baseHp: GAME.BASE_HP,
    baseMaxHp: GAME.BASE_MAX_HP,
    gold: 0,
    goldMult: 1,
    arrows: GAME.QUIVER,
    maxArrows: GAME.QUIVER,
    reloading: false,
    reloadLeft: 0,
    charge: 0,
    charging: false,
    cooldown: 0,
    aim: { x: 700, y: 400 },
    // 玩家派生属性（升级可改）
    fireCooldown: GAME.FIRE_COOLDOWN,
    reloadTime: GAME.RELOAD_TIME,
    damage: GAME.ARROW_DAMAGE,
    range: GAME.RANGE,
    pierce: 0,
    triple: false,
    explosive: false,
    eagleDuration: GAME.EAGLE_DURATION,
    eagleTimeScale: GAME.EAGLE_TIMESCALE,
    legShot: false,
    // 状态
    killStreak: 0,
    streakTimer: 0,
    eagleLeft: 0,
    timeScale: 1,
    enemies: [],
    bolts: [],
    upgrades: [],
    offered: [],
    score: 0,
    kills: 0,
    result: null,
    sandstorm: false,
    night: false,
    waveTime: 0,
    waveSpawned: 0,
  };

  let nextId = 1;

  const run = {
    state,
    _level: LEVELS[idx],
    _rng: rng,
    _events: [],
    _clock: 0,
    _spawnQueue: [],
    _spawnTimer: 0,
    _wallHitThrottle: new Map(),
    _drawn: false,
    _bossMinionT: 0,

    // ---------- 时间推进 ----------
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      // 连杀窗口 / 鹰眼时间用真实时间推进
      if (s.streakTimer > 0) {
        s.streakTimer -= dt;
        if (s.streakTimer <= 0) { s.streakTimer = 0; s.killStreak = 0; }
      }
      if (s.eagleLeft > 0) {
        s.eagleLeft -= dt;
        if (s.eagleLeft <= 0) { s.eagleLeft = 0; this._setTimeScale(1); }
      }

      const sdt = dt * s.timeScale;

      if (s.phase === 'wave') {
        s.waveTime += dt;
        this._stepSpawns(dt);
        this._stepEnemies(sdt);
        this._stepBolts(sdt);
        if (s.phase === 'wave') this._checkWaveClear();
      }
    },

    // ---------- 输入 ----------
    aim(x, y) {
      const s = this.state;
      s.aim.x = Math.max(0, Math.min(WORLD.WIDTH, x));
      s.aim.y = Math.max(0, Math.min(WORLD.HEIGHT, y));
    },

    pressFire() {
      const s = this.state;
      if (s.phase !== 'wave') return;
      s.charging = true;
      s.charge = 0;
      this._drawn = false;
    },

    releaseFire() {
      const s = this.state;
      s.charging = false;
      if (s.phase !== 'wave') return { ok: false, reason: 'phase' };
      return this._fire(s.charge);
    },

    // 立即满弦射击（bot / 触屏点按用）
    fire() {
      const s = this.state;
      if (s.phase !== 'wave') return { ok: false, reason: 'phase' };
      s.charging = false;
      return this._fire(1);
    },

    // 手动换弹（键盘 R）
    reload() {
      const s = this.state;
      if (s.phase !== 'wave' || s.reloading || s.arrows >= s.maxArrows) return { ok: false, reason: 'noop' };
      this._startReload();
      return { ok: true };
    },

    // ---------- 波间 ----------
    chooseUpgrade(id) {
      const s = this.state;
      if (s.phase !== 'upgrade') return { ok: false, reason: 'phase' };
      if (!s.offered.includes(id)) return { ok: false, reason: 'notOffered' };
      if (UPGRADES[id]) UPGRADES[id].apply(s);
      s.upgrades.push(id);
      this._emit({ type: 'upgradeChosen', id });
      return { ok: true, id };
    },

    nextWave() {
      const s = this.state;
      if (s.phase !== 'upgrade') return { ok: false, reason: 'phase' };
      if (s.wave >= WAVE_COUNT) return { ok: false, reason: 'end' };
      s.wave += 1;
      this._startWave(s.wave);
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        wave: s.wave,
        phase: s.phase,
        baseHp: Math.max(0, Math.round(s.baseHp)),
        baseMaxHp: s.baseMaxHp,
        gold: Math.floor(s.gold),
        arrows: s.arrows,
        maxArrows: s.maxArrows,
        reloading: s.reloading,
        reloadLeft: s.reloadLeft,
        killStreak: s.killStreak,
        eagleLeft: s.eagleLeft,
        score: s.score,
        enemiesLeft: s.enemies.length + this._spawnQueue.length,
        offered: s.offered,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _setTimeScale(ts) {
      const s = this.state;
      s.timeScale = ts;
    },

    _startWave(waveIdx) {
      const s = this.state;
      const wi = waveIdx - 1;
      s.phase = 'wave';
      s.waveTime = 0;
      s.sceneKey = LEVELS[wi].scene || 'noon-desert';
      s.sandstorm = LEVELS[wi].newElement.indexOf('沙暴') >= 0;
      s.night = LEVELS[wi].newElement.indexOf('夜袭') >= 0;
      s.arrows = s.maxArrows;            // 每波开场补满箭袋
      s.reloading = false;
      s.reloadLeft = 0;
      s.charge = 0;
      s.charging = false;
      s.cooldown = 0;
      s.killStreak = 0;
      s.streakTimer = 0;
      s.eagleLeft = 0;
      this._setTimeScale(1);
      this._spawnQueue = (WAVE_ENEMIES[wi] || []).map((e) => ({ ...e }));
      this._spawnTimer = 0;
      s.waveSpawned = 0;
      this._emit({ type: 'waveStart', wave: s.wave });
    },

    _stepSpawns(dt) {
      const s = this.state;
      this._spawnTimer += dt;
      let guard = 0;
      while (this._spawnQueue.length && guard++ < 40) {
        const next = this._spawnQueue[0];
        if (next.at > this._spawnTimer) break;
        this._spawnQueue.shift();
        this._spawnEnemy(next);
      }
    },

    _spawnEnemy(spec) {
      const s = this.state;
      const base = ENEMY[spec.kind] || ENEMY.foot;
      const enemy = {
        id: nextId++,
        kind: spec.kind,
        lane: spec.lane ?? 1,
        door: (spec.lane ?? 1) < 2 ? 0 : 1,
        x: LAYOUT.SPAWN_X,
        y: LANE_Y[spec.lane ?? 1] ?? 330,
        hp: base.hp,
        maxHp: base.hp,
        speed: base.speed,
        damage: base.damage,
        radius: base.radius,
        gold: base.gold,
        mass: base.mass || 'infantry',
        explodeRadius: base.explodeRadius ?? 0,
        wallDanger: base.wallDanger ?? 0,
        shieldHp: base.shieldHp ?? 0,
        state: 'walking',
        attackTick: 0,
        bossPhase: 0,
        spawnT: s.waveTime,
      };
      // Boss 血量随波次微调（首登场为第 8 波标准值）
      if (enemy.kind === 'boss' && s.wave > 8) enemy.hp = enemy.maxHp = base.hp + (s.wave - 8) * 60;
      s.enemies.push(enemy);
      s.waveSpawned += 1;
      this._emit({ type: 'spawn', kind: enemy.kind, lane: enemy.lane });
    },

    _stepEnemies(sdt) {
      const s = this.state;
      for (const e of s.enemies) {
        if (e.state === 'dead') continue;
        const wallLine = LAYOUT.WALL_X + 22 + e.radius;
        if (e.state === 'walking') {
          e.x -= e.speed * sdt;
          // 爆炸桶到达城墙直接引爆
          if (e.kind === 'barrel' && e.x <= wallLine) {
            this._explodeBarrel(e, true);
            continue;
          }
          if (e.x <= wallLine) {
            e.x = wallLine;
            e.state = 'attacking';
            e.attackTick = 0;
          }
          // Boss 二阶段：半血后提速并召唤小兵
          if (e.kind === 'boss' && e.bossPhase === 0 && e.hp <= e.maxHp * 0.5) {
            e.bossPhase = 1;
            e.speed *= 1.5;
            this._emit({ type: 'bossPhase', phase: 1 });
          }
          if (e.kind === 'boss' && e.bossPhase === 1) {
            this._bossMinionT += sdt;
            if (this._bossMinionT > 3.2 && s.enemies.length < 16) {
              this._bossMinionT = 0;
              this._spawnEnemy({ kind: 'foot', lane: (e.door ? 3 : 0) });
            }
          }
        } else if (e.state === 'attacking') {
          e.attackTick += sdt;
          s.baseHp -= e.damage * sdt;
          if (e.attackTick >= 0.5) {
            e.attackTick = 0;
            this._emit({ type: 'wallHit', kind: e.kind, baseHp: Math.max(0, s.baseHp) });
          }
          if (s.baseHp <= 0) { s.baseHp = 0; this._lose('wall'); return; }
        }
      }
    },

    _stepBolts(sdt) {
      const s = this.state;
      const out = [];
      for (const b of s.bolts) {
        if (b.dead) continue;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.dist += Math.hypot(b.vx, b.vy) * sdt;
        if (b.x < 0 || b.x > WORLD.WIDTH || b.y < 0 || b.y > WORLD.HEIGHT || b.dist > s.range) {
          b.dead = true;
          continue;
        }
        const hit = this._hitEnemy(b);
        if (hit) {
          b.dead = true;
          this._applyHit(b, hit);
          continue;
        }
        out.push(b);
      }
      s.bolts = s.bolts.filter((b) => !b.dead);
    },

    _hitEnemy(b) {
      const s = this.state;
      let best = null;
      let bestD = Infinity;
      for (const e of s.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d <= e.radius + b.radius && d < bestD) { bestD = d; best = e; }
      }
      return best;
    },

    _applyHit(b, e) {
      const s = this.state;
      // 盾匪：盾未破时，箭先打在盾上（legShot 强化对盾伤害翻倍）
      if (e.kind === 'shield' && e.shieldHp > 0) {
        const shieldDmg = b.damage * (s.legShot ? 2 : 1);
        e.shieldHp -= shieldDmg;
        this._emit({ type: 'block', kind: e.kind, shieldHp: Math.max(0, e.shieldHp) });
        if (e.shieldHp <= 0) {
          e.shieldHp = 0;
          this._emit({ type: 'shieldBreak', kind: e.kind });
        }
        return;
      }
      let dmg = b.damage;
      e.hp -= dmg;
      this._emit({ type: 'arrowHit', kind: e.kind, x: b.x, y: b.y, blocked: false });

      // 爆裂箭镞：命中即 AoE
      if (b.explosive) {
        this._explodeAt(b.x, b.y, 70, 0.5 * b.damage, 'bolt');
      }
      // 穿透：继续飞行
      if (b.pierce > 0) {
        b.pierce -= 1;
        b.dead = false;
      }
      // 爆炸桶被射中 → 引爆
      if (e.kind === 'barrel' && e.hp <= 0) {
        this._explodeBarrel(e, false);
        return;
      }
      if (e.hp <= 0) this._kill(e);
    },

    _kill(e) {
      const s = this.state;
      e.state = 'dead';
      const gold = Math.round(e.gold * s.goldMult);
      s.gold += gold;
      s.kills += 1;
      s.score += 10 + Math.max(0, e.maxHp);
      s.killStreak += 1;
      s.streakTimer = GAME.KILL_STREAK_WINDOW;
      this._emit({ type: 'kill', kind: e.kind, gold, streak: s.killStreak });
      if (s.eagleLeft > 0) {
        s.eagleLeft += GAME.EAGLE_EXTEND;
        this._emit({ type: 'eagleExtend' });
      } else if (s.killStreak >= GAME.EAGLE_STREAK) {
        s.eagleLeft = s.eagleDuration;
        this._setTimeScale(s.eagleTimeScale);
        this._emit({ type: 'eagleEye' });
      }
      // 移除尸体（延迟由 render 用粒子表现；sim 直接清掉，避免被重复命中）
    },

    _explodeBarrel(e, atWall) {
      const s = this.state;
      if (e.state !== 'dead') e.state = 'dead';
      this._emit({ type: 'explosion', x: e.x, y: e.y, atWall });
      this._explodeAt(e.x, e.y, e.explodeRadius || 110, 26, 'barrel');
      // 靠墙爆炸反伤城门
      const dmg = atWall ? e.damage : Math.round(e.damage * 0.55);
      s.baseHp -= dmg;
      this._emit({ type: 'wallHit', kind: 'barrel', baseHp: Math.max(0, s.baseHp) });
      if (s.baseHp <= 0) { s.baseHp = 0; this._lose('wall'); }
    },

    _explodeAt(x, y, radius, damage, source) {
      const s = this.state;
      for (const e of s.enemies) {
        if (e.state === 'dead' || e === null) continue;
        if (Math.hypot(e.x - x, e.y - y) <= radius + e.radius) {
          e.hp -= damage;
          if (e.hp <= 0) this._kill(e);
        }
      }
    },

    _fire(charge) {
      const s = this.state;
      if (s.reloading) return { ok: false, reason: 'reloading' };
      if (s.cooldown > 0) return { ok: false, reason: 'cooldown' };
      if (s.arrows <= 0) { this._startReload(); return { ok: false, reason: 'empty' }; }

      s.arrows -= 1;
      s.cooldown = s.fireCooldown;
      const c = Math.max(0, Math.min(1, charge));
      const mult = GAME.CHARGE_MIN + c * (GAME.CHARGE_MAX - GAME.CHARGE_MIN);
      const dx = s.aim.x - LAYOUT.ARCHER_X;
      const dy = s.aim.y - LAYOUT.ARCHER_Y;
      const len = Math.hypot(dx, dy) || 1;
      let ang = Math.atan2(dy, dx);
      if (s.sandstorm) ang += (this._rng() * 2 - 1) * 0.10;   // 沙暴命中受扰
      const angles = s.triple ? [ang - 0.14, ang, ang + 0.14] : [ang];
      for (const a of angles) {
        s.bolts.push({
          id: nextId++,
          x: LAYOUT.ARCHER_X + Math.cos(a) * 30,
          y: LAYOUT.ARCHER_Y + Math.sin(a) * 30,
          vx: Math.cos(a) * GAME.ARROW_SPEED,
          vy: Math.sin(a) * GAME.ARROW_SPEED,
          damage: GAME.ARROW_DAMAGE * mult * (s.triple ? 0.8 : 1),
          radius: GAME.ARROW_RADIUS,
          pierce: s.pierce,
          explosive: s.explosive,
          dist: 0,
          dead: false,
        });
      }
      this._emit({ type: 'shot', mult: +mult.toFixed(2), arrows: s.arrows });
      if (s.arrows <= 0) this._startReload();
      return { ok: true, mult };
    },

    _startReload() {
      const s = this.state;
      s.reloading = true;
      s.reloadLeft = s.reloadTime;
      s.charging = false;
      s.charge = 0;
      this._emit({ type: 'reload' });
      // 换弹在 step 里推进（真实时间）
    },

    _tickReload(dt) {
      const s = this.state;
      if (!s.reloading) return;
      s.reloadLeft -= dt;
      if (s.reloadLeft <= 0) {
        s.reloading = false;
        s.reloadLeft = 0;
        s.arrows = s.maxArrows;
        this._emit({ type: 'reloadDone' });
      }
    },

    _checkWaveClear() {
      const s = this.state;
      if (this._spawnQueue.length > 0) return;
      if (s.enemies.some((e) => e.state !== 'dead')) return;
      // 波清
      const reward = WAVE_REWARD[s.wave - 1] || 20;
      s.gold += reward;
      s.score += 50;
      if (s.wave >= WAVE_COUNT) {
        s.phase = 'won';
        s.result = { won: true, wave: s.wave, score: s.score, kills: s.kills };
        this._emit({ type: 'win', wave: s.wave, score: s.score });
        return;
      }
      s.phase = 'upgrade';
      s.offered = pickOffers(this._rng, new Set(s.upgrades), GAME.UPGRADES_PER_WAVE);
      this._emit({ type: 'waveClear', wave: s.wave, reward });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase === 'lost') return;
      s.phase = 'lost';
      s.result = { won: false, wave: s.wave, score: s.score, kills: s.kills, reason };
      this._emit({ type: 'lose', reason, wave: s.wave });
    },
  };

  // 初始 wave 1
  run._startWave(idx + 1);

  // 包裹 step 以便每帧推进换弹/拉弦（这些走真实时间，不受慢动作影响）
  const origStep = run.step.bind(run);
  run.step = (dt) => {
    const s = run.state;
    if (s.phase === 'won' || s.phase === 'lost') { origStep(dt); return; }
    // 拉弦
    if (s.charging && s.phase === 'wave') {
      s.charge = Math.min(1, s.charge + dt / GAME.CHARGE_TIME);
      if (s.charge >= 1 && !run._drawn) { run._drawn = true; run._emit({ type: 'draw' }); }
    }
    if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
    run._tickReload(dt);
    origStep(dt);
  };

  return run;
}

// 兼容骨架别名（Lead 重写 main 后可移除）
export function createSim() {
  return createRun(0, { seed: 1 });
}
export function updateSim(sim, _input) {
  sim.step(STEP);
  return sim;
}
