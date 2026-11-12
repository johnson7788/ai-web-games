// 纯逻辑：拆螺丝关卡。不碰 DOM / window / Date.now，随机不参与判定。
// 数据来自 config/levels.js + config/game.config.js。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 螺丝世界坐标（相对板中心，随板旋转）
export function screwWorld(plate, screw) {
  const cos = Math.cos(plate.rot);
  const sin = Math.sin(plate.rot);
  return {
    x: plate.x + screw.x * cos - screw.y * sin,
    y: plate.y + screw.x * sin + screw.y * cos,
  };
}

// 世界点是否落在板的不透明矩形内（考虑旋转）
function pointInPlate(wx, wy, plate) {
  const dx = wx - plate.x;
  const dy = wy - plate.y;
  const cos = Math.cos(-plate.rot);
  const sin = Math.sin(-plate.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= plate.w / 2 && Math.abs(ly) <= plate.h / 2;
}

// 螺丝是否被上层仍固定的板遮挡
function screwCovered(plates, plate, screw) {
  const w = screwWorld(plate, screw);
  for (const q of plates) {
    if (q.id <= plate.id) continue;
    if (q.removed || q.screwsLeft <= 0) continue; // 掉下/已清的板不再遮挡
    if (pointInPlate(w.x, w.y, q)) return true;
  }
  return false;
}

// 由关卡定义构建运行时状态（也供测试直接构造任意布局）
export function createLevelFromDef(def) {
  const plates = def.plates.map((p, pi) => ({
    id: pi,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    angle: clamp(p.angle, -8, 8),
    rot: (clamp(p.angle, -8, 8) * Math.PI) / 180,
    color: p.color,
    screws: p.screws.map((s, si) => ({ id: `${pi}-${si}`, x: s.x, y: s.y, removed: false, cross: si % 2 === 0 })),
    screwsLeft: p.screws.length,
    released: false,
    removed: false,
    vx: 0,
    vy: 0,
    omega: 0,
  }));

  const level = {
    index: def.id ?? 0,
    name: def.name,
    plates,
    time: 0,
    cleared: false,
    totalScrews: plates.reduce((n, p) => n + p.screws.length, 0),
    _clearedEmitted: false,
    _events: [],
  };

  return {
    ...level,

    unscrew(id, force = false) {
      let plate = null;
      let screw = null;
      for (const p of plates) {
        const s = p.screws.find((x) => x.id === id);
        if (s) { plate = p; screw = s; break; }
      }
      if (!screw) return { ok: false, reason: 'missing' };
      if (screw.removed) return { ok: false, reason: 'removed' };
      if (!force && screwCovered(plates, plate, screw)) {
        this._events.push({ type: 'locked', screwId: screw.id, plateId: plate.id });
        return { ok: false, reason: 'covered' };
      }
      screw.removed = true;
      plate.screwsLeft -= 1;
      const w = screwWorld(plate, screw);
      this._events.push({ type: 'unscrew', screwId: screw.id, plateId: plate.id, x: w.x, y: w.y, cross: screw.cross });
      if (plate.screwsLeft === 0) {
        plate.released = true;
        plate.omega = (plate.angle || 0.1) * GAME.RELEASE_SPIN;
        this._events.push({ type: 'release', plateId: plate.id });
      }
      return { ok: true, released: plate.released };
    },

    step(dt) {
      if (this.cleared) return;
      this.time += dt;
      const adamp = Math.exp(-GAME.ANGULAR_DAMPING * dt);
      const ldamp = Math.exp(-GAME.LINEAR_DAMPING * dt);
      const falling = [];

      for (const p of plates) {
        if (p.removed || !p.released) continue;
        p.vy += GAME.GRAVITY * dt;
        p.vx *= ldamp;
        p.omega *= adamp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.omega * dt;
        falling.push(p);
        if (p.y - p.h / 2 > WORLD.HEIGHT + GAME.REMOVE_MARGIN) {
          p.removed = true;
          this._events.push({ type: 'impact', plateId: p.id, x: p.x, y: WORLD.HEIGHT });
        }
      }

      // 下落板之间做水平 AABB 分离，避免完全重叠（矩形近似，允许小角度翻滚）
      for (let i = 0; i < falling.length; i += 1) {
        for (let j = i + 1; j < falling.length; j += 1) {
          const a = falling[i];
          const b = falling[j];
          const overlap = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
          if (overlap <= 0) continue;
          if (a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2) continue;
          const push = overlap / 2;
          const dir = a.x < b.x ? -1 : 1;
          a.x += dir * push;
          b.x -= dir * push;
        }
      }

      if (this.totalScrews > 0 && plates.every((p) => p.removed) && !this._clearedEmitted) {
        this.cleared = true;
        this._clearedEmitted = true;
        this._events.push({ type: 'clear' });
      }
    },

    starThresholds() {
      const n = this.totalScrews;
      return {
        three: GAME.STARS.base.three + GAME.STARS.perScrew.three * n,
        two: GAME.STARS.base.two + GAME.STARS.perScrew.two * n,
      };
    },

    starRating() {
      const th = this.starThresholds();
      if (this.time <= th.three) return 3;
      if (this.time <= th.two) return 2;
      return 1;
    },

    getState() {
      let screwsLeft = 0;
      for (const p of plates) screwsLeft += p.screwsLeft;
      return {
        plates: plates.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          angle: p.angle,
          rot: p.rot,
          color: p.color,
          screwsLeft: p.screwsLeft,
          released: p.released,
          removed: p.removed,
          screws: p.screws.map((s) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            removed: s.removed,
            cross: s.cross,
            covered: !s.removed && screwCovered(plates, p, s),
          })),
        })),
        screwsLeft,
        platesLeft: plates.filter((p) => !p.removed).length,
        cleared: this.cleared,
        time: this.time,
        stars: this.starRating(),
      };
    },

    drainEvents() {
      const e = this._events;
      this._events = [];
      return e;
    },
  };
}

export function createLevel(levelIndex) {
  const i = ((levelIndex % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT;
  return createLevelFromDef(LEVELS[i]);
}
