// FROG HOP LEAF · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：青蛙在叶上自动左右走、碰墙折返；玩家只按「跳跃」。跳起后笔直上升（慢漂移），
// 下落段竖直下落，落在更上一片荷叶上就往上爬，直到「莲花门」。抓萤火虫连击，
// 躲瓢虫/滚石/尖刺/香蒲气泡；跌回池底或撞到危险即判负。
// 依赖：config/game.config.js（WORLD/PHYS/LEAF/SCORE/CAMERA/STEP）、config/levels.js、
//       level.js（generateLevel / mulberry32）。
// 随机：注入 seed（mulberry32），可复现。

import { LEVELS, SCENES } from '../../config/levels.js';
import { WORLD, PHYS, LEAF, SCORE, CAMERA, STEP, GAME } from '../../config/game.config.js';
import { generateLevel, mulberry32 } from './level.js';

const HALF_W = LEAF.FROG_W / 2;
const HALF_H = LEAF.FROG_H / 2;

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const layout = generateLevel(level, seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'playing',            // 'playing' | 'won' | 'lost'
    score: 0,
    fireflies: 0,
    combo: 0,
    maxCombo: 0,
    goalY: layout.goalY,
    stars: 0,
    deaths: 0,
    result: null,
    reason: null,
    clock: 0,
    camAlt: 0,                   // 相机底边高度（只增不减）
    _lastBounceLeaf: -1,
    frog: {
      x: WORLD.WIDTH / 2,
      y: HALF_H,                 // alt 中心，站上池底大荷叶
      vx: 0,
      vy: 0,
      dir: 1,
      onLeaf: true,
      leafId: 0,
    },
    leaves: layout.leaves,
    enemies: layout.enemies.map((e) => ({ ...e, timer: 0 })),
    thorns: layout.thorns,
    cattails: layout.cattails.map((c) => ({ ...c, timer: c.phase })),
    fireflyList: layout.fireflies.map((f) => ({ ...f })),
    bubbles: [],
  };

  const run = {
    state,
    _level: level,
    _events: [],
    _eventSeq: 0,
    _bubbleSeq: 0,

    jump() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!s.frog.onLeaf) return { ok: false, reason: 'air' };
      s.frog.onLeaf = false;
      s.frog.leafId = -1;
      s.frog.vy = PHYS.JUMP_V;
      this._emit({ type: 'jump', alt: Math.round(s.frog.y) });
      return { ok: true };
    },

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.clock += dt;

      this._updateEnemies(dt);
      this._updateCattails(dt);
      this._updateFrog(dt);

      if (s.phase !== 'playing') return;
      this._updateCamera();
      if (s.frog.y >= s.goalY) return this._win();
      if (s.frog.y < s.camAlt - 24) return this._lose('fall');
      this._collect();
      this._checkHazards();
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        fireflies: s.fireflies,
        fireflyGoal: this._level.fireflyGoal,
        combo: s.combo,
        maxCombo: s.maxCombo,
        alt: Math.round(s.frog.y),
        goalY: Math.round(s.goalY),
        stars: s.stars,
      };
    },

    // ---------------- 内部 ----------------
    _emit(e) {
      e.seq = this._eventSeq++;
      this._events.push(e);
    },

    _updateEnemies(dt) {
      for (const e of this.state.enemies) {
        if (e.kind === 'pebble' && e.pauseT > 0) {
          e.pauseT -= dt;
          if (e.pauseT < 0) e.pauseT = 0;
          continue;
        }
        e.x += e.dir * e.speed * dt;
        if (e.x < e.minX) {
          e.x = e.minX;
          e.dir = 1;
          if (e.kind === 'pebble') e.pauseT = 0.5;
        } else if (e.x > e.maxX) {
          e.x = e.maxX;
          e.dir = -1;
          if (e.kind === 'pebble') e.pauseT = 0.5;
        }
      }
    },

    _updateCattails(dt) {
      const s = this.state;
      for (const c of s.cattails) {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer += c.period;
          s.bubbles.push({ id: this._bubbleSeq++, x: c.x, y: c.y + 24, vx: c.side * 260, r: 11 });
          this._emit({ type: 'bubbleSpawn', x: Math.round(c.x) });
        }
      }
      for (let i = s.bubbles.length - 1; i >= 0; i -= 1) {
        const b = s.bubbles[i];
        b.x += b.vx * dt;
        if (b.x < -40 || b.x > WORLD.WIDTH + 40) s.bubbles.splice(i, 1);
      }
    },

    _updateFrog(dt) {
      const s = this.state;
      const f = s.frog;

      // 水平速度：落地恒速走，上升慢漂移，下落竖直（忠实原作）
      if (f.onLeaf) f.vx = f.dir * PHYS.WALK;
      else if (f.vy > 0) f.vx = f.dir * PHYS.RISE_DRIFT;
      else f.vx = 0;

      f.x += f.vx * dt;

      // 碰左右屏幕墙折返
      if (f.x < HALF_W) {
        f.x = HALF_W;
        if (f.dir < 0) { f.dir = 1; this._emit({ type: 'wallBounce' }); }
      } else if (f.x > WORLD.WIDTH - HALF_W) {
        f.x = WORLD.WIDTH - HALF_W;
        if (f.dir > 0) { f.dir = -1; this._emit({ type: 'wallBounce' }); }
      }

      if (f.onLeaf) {
        // 站定：贴在叶顶；在叶边折返（忠实原作：平台两端像有墙，不会自己走下叶去）
        f.vy = 0;
        const leaf = s.leaves[f.leafId];
        f.y = leaf.y + HALF_H;
        if (f.x < leaf.x + 3) {
          f.x = leaf.x + 3;
          if (f.dir < 0) f.dir = 1;
        } else if (f.x > leaf.x + leaf.w - 3) {
          f.x = leaf.x + leaf.w - 3;
          if (f.dir > 0) f.dir = -1;
        }
        return;
      }

      // 空中：重力 + 单向落台
      f.vy -= PHYS.GRAVITY * dt;
      if (f.vy < -PHYS.MAX_FALL) f.vy = -PHYS.MAX_FALL;
      const prevBottom = f.y - HALF_H;
      f.y += f.vy * dt;
      if (f.vy <= 0) {
        for (const leaf of s.leaves) {
          if (f.x >= leaf.x - 2 && f.x <= leaf.x + leaf.w + 2) {
            const bottom = f.y - HALF_H;
            if (prevBottom >= leaf.y - 0.5 && bottom <= leaf.y + 1) {
              f.y = leaf.y + HALF_H;
              f.vy = 0;
              f.onLeaf = true;
              f.leafId = leaf.id;
              this._onLand(leaf);
              break;
            }
          }
        }
      }
    },

    _onLand(leaf) {
      const s = this.state;
      s.combo = 0; // 任何落地都打断连击
      this._emit({ type: 'land', leafId: leaf.id, kind: leaf.kind });
      if (leaf.kind === 'spring') {
        // 弹簧叶：落地弹起（同一片叶连续落两次则不再弹，避免死循环）
        s.score += 15;
        if (s._lastBounceLeaf !== leaf.id) {
          s._lastBounceLeaf = leaf.id;
          s.frog.onLeaf = false;
          s.frog.leafId = -1;
          s.frog.vy = PHYS.SPRING_V;
          this._emit({ type: 'spring' });
        } else {
          s._lastBounceLeaf = -1;
        }
        this._emit({ type: 'score', score: s.score });
      } else if (leaf.kind === 'golden') {
        // 金叶：落地加分，正常站定（不改变物理，稳妥）
        s._lastBounceLeaf = -1;
        s.score += SCORE.GOLDEN_BONUS;
        this._emit({ type: 'golden', bonus: SCORE.GOLDEN_BONUS });
        this._emit({ type: 'score', score: s.score });
      } else {
        s._lastBounceLeaf = -1;
      }
    },

    _updateCamera() {
      const s = this.state;
      const follow = s.frog.y - CAMERA.FOLLOW_FRAC * WORLD.HEIGHT;
      if (follow > s.camAlt) s.camAlt = follow;
    },

    _collect() {
      const s = this.state;
      const f = s.frog;
      for (const fly of s.fireflyList) {
        if (fly.taken) continue;
        const dx = fly.x - f.x;
        const dy = fly.y - f.y;
        if (dx * dx + dy * dy < (HALF_W + 9) * (HALF_W + 9)) {
          fly.taken = true;
          s.combo += 1;
          s.fireflies += 1;
          s.maxCombo = Math.max(s.maxCombo, s.combo);
          const gained = SCORE.FIREFLY_BASE * s.combo;
          s.score += gained;
          this._emit({ type: 'firefly', combo: s.combo, gained, score: s.score });
          this._emit({ type: 'score', score: s.score });
          if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
        }
      }
    },

    _checkHazards() {
      const s = this.state;
      const f = s.frog;
      const hw = HALF_W - 6;
      const hh = HALF_H - 6;

      for (const e of s.enemies) {
        if (f.x + hw > e.x - e.w / 2 && f.x - hw < e.x + e.w / 2 &&
            f.y + hh > e.y - e.h / 2 && f.y - hh < e.y + e.h / 2) {
          return this._lose(e.kind === 'pebble' ? 'pebble' : 'enemy');
        }
      }

      for (const t of s.thorns) {
        // 尖刺只扎「站上/落上这片叶」的青蛙；从旁经过不受影响
        if (f.onLeaf && f.leafId === t.leafId && f.x + hw > t.x && f.x - hw < t.x + t.w) {
          return this._lose('thorn');
        }
      }

      for (const b of s.bubbles) {
        const dx = b.x - f.x;
        const dy = b.y - f.y;
        const rr = b.r + hw - 4;
        if (dx * dx + dy * dy < rr * rr) return this._lose('bubble');
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const lv = this._level;
      let stars = 1;
      if (s.fireflies >= lv.fireflyGoal) stars += 1;
      if (s.maxCombo >= lv.comboGoal) stars += 1;
      s.stars = stars;
      s.score += SCORE.WIN_BONUS;
      s.result = { won: true, stars, score: s.score, fireflies: s.fireflies, maxCombo: s.maxCombo };
      this._emit({ type: 'win', stars, score: s.score, fireflies: s.fireflies });
      this._emit({ type: 'levelClear', level: s.level, stars });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.deaths += 1;
      s.reason = reason;
      s.result = { won: false, stars: 0, score: s.score, fireflies: s.fireflies, reason };
      this._emit({ type: 'death', reason });
      this._emit({ type: 'lose', reason, score: s.score, fireflies: s.fireflies });
    },
  };

  run._emit({ type: 'start', level: state.level });
  run._emit({ type: 'spawn', leaves: state.leaves.length });
  return run;
}

export { STEP, GAME, mulberry32 };
