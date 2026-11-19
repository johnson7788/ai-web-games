// LIL HERO SAGA · 模拟层（纯逻辑，零 DOM/window/canvas）
// 职责：玩家物理（跑/二段跳/冲刺）、三原色混色施法、敌人 AI、Boss、投射物、
//       彩色晶岩、连击、星级结算、事件表。可被 selfplay.mjs 在 Node 无头驱动。
// 契约：createRun API / state 形状 / drainEvents 事件表（见 docs）。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVEL } from '../../config/levels.js';

const {
  GRAVITY, FALL_MULT, RISE_MULT, JUMP_CUT,
  PLAYER_W, PLAYER_H, MOVE_SPEED, JUMP_V, DOUBLE_JUMP_V, DASH_SPEED, DASH_TIME,
  INVINCIBLE_AFTER_HIT, MAX_HP, MP_MAX, MP_COST, MP_REFILL,
  COMBO_WINDOW, ORANGE_RANGE_X, ORANGE_RANGE_Y, PURPLE_RADIUS,
  FIREBALL_SPEED, FIREBALL_DMG, FROST_SPEED, FROST_DMG, FROST_SLOW, STAR_PAR_TIME,
} = GAME;

const GROUND_Y = LEVEL.groundY;
const ENEMY_SCORE = { walker: 100, archer: 150, sworder: 350, bat: 200, wizard: 500, boss: 2000 };
const ENEMY_SIZE = {
  walker: { w: 34, h: 40 }, sworder: { w: 34, h: 42 }, archer: { w: 30, h: 44 },
  bat: { w: 34, h: 24 }, wizard: { w: 34, h: 46 }, boss: { w: 84, h: 96 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 三色组合 → 法术
export function spellOf(set) {
  const r = set.has('red'); const y = set.has('yellow'); const b = set.has('blue');
  if (r && y && b) return 'white';
  if (r && y) return 'orange';
  if (b && y) return 'green';
  if (b && r) return 'purple';
  if (r) return 'fire';
  if (y) return 'dash';
  if (b) return 'frost';
  return null;
}

export function createRun(opts = {}) {
  const rng = mulberry32((opts.seed ?? 1) >>> 0);

  const state = {
    level: LEVEL.index,
    phase: 'playing',          // playing | won | lost
    act: 1,                    // 1 level · 2 boss · 3 clear
    width: LEVEL.width,
    height: WORLD.HEIGHT,
    time: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    player: makePlayer(),
    enemies: [],
    projectiles: [],
    beams: [],
    rocks: [],
    pickups: [],
    flag: { x: LEVEL.flag.x, reached: false },
    boss: null,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    input: { left: false, right: false, jump: false },
    _prevJump: false,
    _events: [],
    _rng: rng,
    _spawnedBoss: false,

    step(dt) {
      if (state.phase === 'won' || state.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      const STEP = 1 / 60;
      let remaining = dt;
      while (remaining > 0) {
        const s = Math.min(STEP, remaining);
        this._tick(s);
        remaining -= s;
        if (state.phase === 'won' || state.phase === 'lost') break;
      }
    },

    teleport(x, y) {
      const p = state.player;
      p.x = clamp(x, 0, state.width - p.w);
      p.y = y != null ? y : LEVEL.groundY - p.h;
      p.vx = 0;
      p.vy = 0;
      p.dashT = 0;
      p.onGround = true;
      p.airJumps = 1;
      return true;
    },

    setInput(inp) {
      if (inp) {
        this.input.left = !!inp.left;
        this.input.right = !!inp.right;
        this.input.jump = !!inp.jump;
      }
    },

    pressColor(c) {
      const p = state.player;
      if (!p.held.includes(c)) p.held.push(c);
    },

    releaseColor() {
      const p = state.player;
      if (p.held.length) {
        this.cast([...p.held]);
        p.held = [];
      }
    },

    cast(colors) {
      if (state.phase === 'won' || state.phase === 'lost') return { ok: false, reason: 'phase' };
      const p = state.player;
      const set = new Set(colors.filter((c) => ['red', 'yellow', 'blue'].includes(c)));
      const spell = spellOf(set);
      if (!spell) return { ok: false, reason: 'empty' };
      // 蓝耗检查
      for (const c of set) {
        if (p.mp[c] < MP_COST) return { ok: false, reason: 'mp', color: c };
      }
      for (const c of set) p.mp[c] = Math.max(0, p.mp[c] - MP_COST);
      p.aura = spell;
      p.attackT = 0.28;
      this._emit({ type: 'cast', spell, colors: [...set] });
      this._executeSpell(spell, set);
      return { ok: true, spell };
    },

    _executeSpell(spell, set) {
      const p = state.player;
      const dir = p.facing;
      if (spell === 'fire') {
        this._emit({ type: 'fire' });
        state.projectiles.push(this._proj({
          type: 'fire', color: 'red', dmg: FIREBALL_DMG,
          x: p.x + p.w / 2 - 9 + dir * 4, y: p.y + p.h * 0.32,
          w: 18, h: 10, vx: dir * FIREBALL_SPEED, vy: 0, life: 1.15,
        }));
      } else if (spell === 'frost') {
        this._emit({ type: 'frost' });
        state.projectiles.push(this._proj({
          type: 'frost', color: 'blue', dmg: FROST_DMG,
          x: p.x + p.w / 2 - 8 + dir * 4, y: p.y + p.h * 0.30,
          w: 16, h: 16, vx: dir * FROST_SPEED, vy: -280, life: 1.4,
        }));
      } else if (spell === 'dash') {
        this._emit({ type: 'dash' });
        p.dashT = DASH_TIME;
        p.dashVx = dir * DASH_SPEED;
        p.invincible = Math.max(p.invincible, DASH_TIME + 0.12);
      } else if (spell === 'green') {
        this._emit({ type: 'green' });
        p.vy = -1120;
        p.onGround = false;
      } else if (spell === 'orange') {
        this._emit({ type: 'orange' });
        const e = this._nearestEnemy(ORANGE_RANGE_X, ORANGE_RANGE_Y);
        if (e) this._hitEnemy(e, 2, 'orange');
        else this._breakNearestRock('orange');
      } else if (spell === 'purple') {
        this._emit({ type: 'purple' });
        for (const e of [...state.enemies]) {
          if (Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)) < PURPLE_RADIUS && Math.abs(e.y + e.h / 2 - (p.y + p.h / 2)) < PURPLE_RADIUS) {
            this._hitEnemy(e, 2, 'purple');
          }
        }
      } else if (spell === 'white') {
        this._emit({ type: 'white' });
        const cx = p.x + p.w / 2;
        for (const e of [...state.enemies]) {
          if (Math.abs(e.x + e.w / 2 - cx) < 900) this._hitEnemy(e, 1, 'white');
        }
        for (const r of [...state.rocks]) {
          if (Math.abs(r.x + r.w / 2 - cx) < 900) this._breakRock(r);
        }
        state.projectiles = state.projectiles.filter((pr) => pr.from === 'player');
      }
    },

    _nearestEnemy(rangeX, rangeY) {
      const p = state.player;
      const pcx = p.x + p.w / 2; const pcy = p.y + p.h / 2;
      let best = null; let bestD = Infinity;
      for (const e of state.enemies) {
        const ecx = e.x + e.w / 2; const ecy = e.y + e.h / 2;
        const dx = ecx - pcx; const dy = ecy - pcy;
        if (Math.abs(dx) <= rangeX && Math.abs(dy) <= rangeY) {
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = e; }
        }
      }
      return best;
    },

    _breakNearestRock(color) {
      const p = state.player;
      const pcx = p.x + p.w / 2;
      let best = null; let bestD = Infinity;
      for (const r of state.rocks) {
        const d = Math.abs(r.x + r.w / 2 - pcx);
        if (d < ORANGE_RANGE_X && d < bestD) { bestD = d; best = r; }
      }
      if (best) this._breakRock(best);
    },

    _proj(o) {
      return { from: 'player', dead: false, ...o };
    },

    _tick(dt) {
      const s = state;
      s.time += dt;
      this._tickPlayer(dt);
      this._tickEnemies(dt);
      this._tickProjectiles(dt);
      this._tickBeams(dt);
      this._tickPickups();
      this._tickFlag();
      if (s.combo > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 0;
      }
    },

    _tickPlayer(dt) {
      const p = state.player;
      // 回蓝
      p.mp.red = Math.min(MP_MAX, p.mp.red + MP_REFILL * dt);
      p.mp.yellow = Math.min(MP_MAX, p.mp.yellow + MP_REFILL * dt);
      p.mp.blue = Math.min(MP_MAX, p.mp.blue + MP_REFILL * dt);
      p.invincible = Math.max(0, p.invincible - dt);
      p.attackT = Math.max(0, p.attackT - dt);

      // 水平速度
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.dashVx;
      } else {
        const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
        p.vx = dir * MOVE_SPEED;
        if (dir !== 0) p.facing = dir;
      }

      // 跳跃（边沿触发）
      if (this.input.jump && !this._prevJump && !p.dashT) {
        if (p.onGround) {
          p.vy = JUMP_V;
          p.onGround = false;
          p.airJumps = 1;
          this._emit({ type: 'jump' });
        } else if (p.airJumps > 0) {
          p.vy = DOUBLE_JUMP_V;
          p.airJumps -= 1;
          this._emit({ type: 'jump' });
        }
      }
      this._prevJump = this.input.jump;

      // 重力
      let g = GRAVITY;
      if (p.vy > 0) g *= FALL_MULT;
      else if (p.vy < 0) { g *= RISE_MULT; if (!this.input.jump) g *= JUMP_CUT; }
      p.vy += g * dt;
      p.vy = Math.min(p.vy, 1400);

      // 积分
      const prevFeet = p.y + p.h;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = clamp(p.x, 0, state.width - p.w);

      // 地面
      let wasOnGround = p.onGround;
      p.onGround = false;
      const feet = p.y + p.h;
      for (const seg of LEVEL.groundSegments) {
        if (p.x + p.w > seg.x && p.x < seg.x + seg.w && p.vy >= 0 && feet >= GROUND_Y && prevFeet <= GROUND_Y + 8) {
          p.y = GROUND_Y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.airJumps = 1;
        }
      }
      // 单向平台
      for (const pl of LEVEL.platforms) {
        if (p.x + p.w > pl.x && p.x < pl.x + pl.w && p.vy >= 0 && feet >= pl.y && prevFeet <= pl.y + 8) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.airJumps = 1;
        }
      }
      if (p.onGround && !wasOnGround) this._emit({ type: 'land' });

      // 岩石（实体，r.y 已是 GROUND_Y - r.h）
      for (const r of state.rocks) {
        if (aabb(p.x, p.y, p.w, p.h, r.x, r.y, r.w, r.h)) {
          this._resolveRock(p, r);
        }
      }

      // 深渊
      if (p.y > WORLD.HEIGHT + 80) this._pitDeath();
    },

    _resolveRock(p, r) {
      const rx = r.x; const ry = GROUND_Y - r.h; const rw = r.w; const rh = r.h;
      const ol = p.x + p.w - rx;
      const orr = rx + rw - p.x;
      const ot = p.y + p.h - ry;
      const ob = ry + rh - p.y;
      const m = Math.min(ol, orr, ot, ob);
      if (m === ot && p.vy >= 0) { p.y = ry - p.h; p.vy = 0; p.onGround = true; p.airJumps = 1; }
      else if (m === ol) { p.x = rx - p.w; p.vx = 0; }
      else if (m === orr) { p.x = rx + rw; p.vx = 0; }
      else if (m === ob) { p.y = ry + rh; p.vy = Math.max(0, p.vy); }
    },

    _pitDeath() {
      const p = state.player;
      p.hp -= 1;
      this._emit({ type: 'hurt', hp: p.hp, cause: 'pit' });
      state.combo = 0;
      if (p.hp <= 0) { this._lose(); return; }
      // 重生到旗帜或出生点
      const spawnX = state.flag.reached ? state.flag.x : LEVEL.spawn.x;
      p.x = spawnX;
      p.y = GROUND_Y - p.h;
      p.vx = 0; p.vy = 0; p.dashT = 0;
      p.invincible = INVINCIBLE_AFTER_HIT;
    },

    _hurtPlayer(cause) {
      const p = state.player;
      if (p.invincible > 0 || p.dashT > 0) return;
      p.hp -= 1;
      p.invincible = INVINCIBLE_AFTER_HIT;
      p.vx = -p.facing * 220;
      state.combo = 0;
      this._emit({ type: 'hurt', hp: p.hp, cause });
      if (p.hp <= 0) this._lose();
    },

    _tickEnemies(dt) {
      const p = state.player;
      for (const e of state.enemies) {
        if (e.slow > 0) e.slow -= dt;
        const spd = (e.speed || 120) * (e.slow > 0 ? 0.45 : 1);
        if (e.type === 'walker' || e.type === 'sworder') {
          const detect = e.type === 'sworder' ? 520 : 420;
          const dx = p.x - e.x;
          if (Math.abs(dx) < detect && Math.abs((p.y + p.h) - (e.y + e.h)) < 140) {
            e.facing = dx >= 0 ? 1 : -1;
            e.vx = e.facing * spd;
          } else {
            if (e.patrolL != null) {
              if (e.x <= e.patrolL) e.facing = 1;
              else if (e.x + e.w >= e.patrolR) e.facing = -1;
              e.vx = e.facing * spd;
            } else e.vx = 0;
          }
          e.x = clamp(e.x + e.vx * dt, 0, state.width - e.w);
          if (aabb(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) this._hurtPlayer(e.type);
        } else if (e.type === 'bat') {
          if (e.x <= e.patrolL) e.facing = 1;
          else if (e.x + e.w >= e.patrolR) e.facing = -1;
          e.x = clamp(e.x + e.facing * spd * dt, 0, state.width - e.w);
          e.y = e.baseY + Math.sin(state.time * 3 + e.phase) * 38;
          if (aabb(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) this._hurtPlayer('bat');
        } else if (e.type === 'archer') {
          const dx = p.x - e.x;
          e.facing = dx >= 0 ? 1 : -1;
          if (Math.abs(dx) < 440 && Math.abs((p.y + p.h) - (e.y + e.h)) < 150) {
            e.shootCd -= dt;
            if (e.shootCd <= 0) {
              e.shootCd = 1.6;
              state.projectiles.push({
                from: 'enemy', type: 'arrow', color: 'enemy', dmg: 1,
                x: e.x + (e.facing > 0 ? e.w : -20), y: e.y + e.h * 0.36,
                w: 20, h: 8, vx: e.facing * 440, vy: 0, life: 1.6, dead: false,
              });
              this._emit({ type: 'enemyShoot', kind: 'arrow' });
            }
          }
        } else if (e.type === 'wizard') {
          e.y = e.baseY + Math.sin(state.time * 2) * 14;
          e.facing = (p.x - e.x) >= 0 ? 1 : -1;
          if (Math.abs(p.x - e.x) < 560) {
            e.shootCd -= dt;
            if (e.shootCd <= 0) {
              e.shootCd = 1.9;
              for (const a of [-0.3, 0, 0.3]) {
                state.projectiles.push({
                  from: 'enemy', type: 'bolt', color: 'enemy', dmg: 1,
                  x: e.x + e.w / 2, y: e.y + e.h / 2,
                  w: 14, h: 14, vx: e.facing * 360 + a * 140, vy: a * 260, life: 1.8, dead: false,
                });
              }
              this._emit({ type: 'enemyShoot', kind: 'bolt' });
            }
          }
        } else if (e.type === 'boss') {
          e.y = e.baseY + Math.sin(state.time * 1.4) * 12;
          e.boltCd -= dt;
          if (e.boltCd <= 0) {
            e.boltCd = 1.1;
            const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
            const dy = (p.y + p.h / 2) - (e.y + e.h / 2);
            const len = Math.hypot(dx, dy) || 1;
            const spd = 300;
            state.projectiles.push({
              from: 'enemy', type: 'bossBolt', color: 'enemy', dmg: 1,
              x: e.x + e.w / 2, y: e.y + e.h / 2,
              w: 16, h: 16, vx: (dx / len) * spd, vy: (dy / len) * spd,
              life: 1.55, dead: false, range: 470,
            });
            this._emit({ type: 'enemyShoot', kind: 'bossBolt' });
          }
        }
      }
    },

    _tickProjectiles(dt) {
      const p = state.player;
      const keep = [];
      for (const pr of state.projectiles) {
        pr.life -= dt;
        if (pr.type === 'frost') pr.vy += GRAVITY * 0.55 * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        let gone = pr.life <= 0 || pr.x < -60 || pr.x > state.width + 60 || pr.y < -200 || pr.y > WORLD.HEIGHT + 100;
        if (pr.range != null) {
          pr.travelled = (pr.travelled || 0) + Math.hypot(pr.vx, pr.vy) * dt;
          if (pr.travelled >= pr.range) gone = true;
        }

        if (!gone && pr.from === 'player') {
          for (const e of state.enemies) {
            if (aabb(pr.x, pr.y, pr.w, pr.h, e.x, e.y, e.w, e.h)) {
              this._hitEnemy(e, pr.dmg, pr.color);
              gone = true;
              break;
            }
          }
          if (!gone) {
            for (const r of state.rocks) {
              if (aabb(pr.x, pr.y, pr.w, pr.h, r.x, GROUND_Y - r.h, r.w, r.h)) {
                this._hitRock(r, pr.color);
                gone = true;
                break;
              }
            }
          }
          if (!gone) {
            // 撞地面/平台
            if (pr.y + pr.h >= GROUND_Y) gone = true;
            for (const pl of LEVEL.platforms) {
              if (pr.y + pr.h >= pl.y && pr.y <= pl.y + pl.h && pr.x + pr.w > pl.x && pr.x < pl.x + pl.w) { gone = true; break; }
            }
          }
        } else if (!gone && pr.from === 'enemy') {
          if (aabb(pr.x, pr.y, pr.w, pr.h, p.x, p.y, p.w, p.h)) {
            this._hurtPlayer(pr.type);
            gone = true;
          } else if (pr.y + pr.h >= GROUND_Y || pr.x < -40 || pr.x > state.width + 40) {
            gone = true;
          }
        }
        if (!gone) keep.push(pr);
      }
      state.projectiles = keep;
    },

    _tickBeams(dt) {
      const p = state.player;
      const keep = [];
      for (const b of state.beams) {
        b.ttl -= dt;
        if (aabb(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) this._hurtPlayer('beam');
        if (b.ttl > 0) keep.push(b);
      }
      state.beams = keep;
    },

    _tickPickups() {
      const p = state.player;
      for (const pk of state.pickups) {
        if (pk.taken) continue;
        if (aabb(p.x, p.y, p.w, p.h, pk.x - 14, pk.y - 14, 28, 28)) {
          pk.taken = true;
          if (pk.kind === 'bottle') {
            p.mp[pk.color] = Math.min(MP_MAX, p.mp[pk.color] + 4);
          } else {
            state.score += 50;
          }
          this._emit({ type: 'collect', kind: pk.kind, color: pk.color || null });
        }
      }
    },

    _tickFlag() {
      const p = state.player;
      if (!state.flag.reached && p.x + p.w >= state.flag.x) {
        state.flag.reached = true;
        state.act = 2;
        state.score += 1000;
        p.hp = p.maxHp; // 旗帜恢复满血（原版旗子回血）
        state.projectiles = state.projectiles.filter((pr) => pr.from === 'player'); // 切幕清残留弹幕
        state.beams = [];
        this._emit({ type: 'flag' });
        this._spawnBoss();
      }
    },

    _spawnBoss() {
      if (this._spawnedBoss) return;
      this._spawnedBoss = true;
      const b = LEVEL.boss;
      const size = ENEMY_SIZE.boss;
      const boss = {
        id: 'boss', type: 'boss', x: b.x, y: b.y, baseY: b.y, w: size.w, h: size.h,
        hp: b.hp, maxHp: b.hp, speed: 0, facing: -1, boltCd: 0.6, slow: 0,
      };
      state.boss = boss;
      state.enemies.push(boss);
      this._emit({ type: 'boss' });
    },

    _hitEnemy(e, dmg, color) {
      e.hp -= dmg;
      if (color === 'blue') e.slow = FROST_SLOW;
      this._emit({ type: 'hit', enemy: e.type, color });
      if (e.hp <= 0) this._killEnemy(e);
    },

    _killEnemy(e) {
      const idx = state.enemies.indexOf(e);
      if (idx >= 0) state.enemies.splice(idx, 1);
      if (e.type === 'boss') {
        state.boss = null;
        this._win();
        return;
      }
      const base = ENEMY_SCORE[e.type] || 100;
      state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
      state.comboTimer = COMBO_WINDOW;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += base * state.combo;
      this._emit({ type: 'kill', enemy: e.type, score: base * state.combo, combo: state.combo });
      this._emit({ type: 'combo', combo: state.combo });
    },

    _hitRock(r, color) {
      const match = r.color === color || color === 'white';
      if (match) this._breakRock(r);
      else {
        r.hp -= 1;
        this._emit({ type: 'rock_hit', color: r.color });
        if (r.hp <= 0) this._breakRock(r);
      }
    },

    _breakRock(r) {
      const idx = state.rocks.indexOf(r);
      if (idx >= 0) state.rocks.splice(idx, 1);
      state.score += 150;
      this._emit({ type: 'rock_break', color: r.color });
    },

    _win() {
      const p = state.player;
      state.phase = 'won';
      state.act = 3;
      const stars = 1 + (p.hp >= MAX_HP ? 1 : 0) + (state.time <= STAR_PAR_TIME ? 1 : 0);
      state.stars = stars;
      state.result = { won: true, stars, score: state.score, time: state.time, maxCombo: state.maxCombo };
      this._emit({ type: 'win', stars, score: state.score });
    },

    _lose() {
      state.phase = 'lost';
      state.result = { won: false, stars: 0, score: state.score, time: state.time, maxCombo: state.maxCombo };
      this._emit({ type: 'lose', reason: 'hp0', score: state.score });
    },

    getHud() {
      const p = state.player;
      return {
        level: state.level,
        act: state.act,
        phase: state.phase,
        time: state.time,
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        hp: p.hp,
        maxHp: p.maxHp,
        mp: { ...p.mp },
        stars: state.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },
  };

  _spawnLevel(state, rng);

  return run;
}

function makePlayer() {
  return {
    x: LEVEL.spawn.x, y: GROUND_Y - PLAYER_H,
    w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, facing: 1,
    onGround: true, airJumps: 1, dashT: 0, dashVx: 0, invincible: 0, attackT: 0,
    hp: MAX_HP, maxHp: MAX_HP,
    mp: { red: MP_MAX, yellow: MP_MAX, blue: MP_MAX },
    held: [], aura: null,
  };
}

function _spawnLevel(state, rng) {
  // 岩石
  for (const r of LEVEL.rocks) {
    state.rocks.push({ x: r.x, y: GROUND_Y - r.h, w: r.w, h: r.h, color: r.color, hp: 2 });
  }
  // 敌人
  for (const e of LEVEL.enemies) {
    const size = ENEMY_SIZE[e.type] || { w: 34, h: 40 };
    state.enemies.push({
      id: `${e.type}-${e.x}`, type: e.type,
      x: e.x, y: e.type === 'bat' || e.type === 'wizard' ? e.y : GROUND_Y - size.h,
      baseY: e.type === 'bat' || e.type === 'wizard' ? e.y : GROUND_Y - size.h,
      w: size.w, h: size.h,
      hp: e.type === 'wizard' ? 5 : (e.type === 'archer' ? 3 : (e.type === 'sworder' ? 2 : 2)),
      maxHp: 5, speed: e.type === 'sworder' ? 300 : 120,
      facing: -1, vx: 0, vy: 0, patrolL: e.patrolL ?? null, patrolR: e.patrolR ?? null,
      shootCd: 0.8, slow: 0, phase: rng() * Math.PI * 2,
    });
  }
  // 道具
  for (const pk of LEVEL.pickups) {
    state.pickups.push({ ...pk, taken: false });
  }
}

// 兼容骨架别名（Lead 重写 main 后可移除）
export function createSim() {
  return createRun({ seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
