// 纯逻辑核心（无 DOM / 无渲染 / 无音频）：霓虹牧羊人。
// 玩法骨架 1:1 还原参考源码 game03（牧羊人）：
//   - 羊群匀速直线随机游走，撞墙/撞岩石反弹（Sheep.ts：speed 常数、方向单位向量、边界反射）
//   - 点未喂过的羊 → 发射光种，飞行约 0.3s 后落地喂食；点已喂过的羊 → 失误抖动
//   - 每次喂食冷却 cd=0.5s；开局倒计时 countdown=1.5s；限时喂完所有羊
// 原创增量机制：连击（combo）、星级（1–3）、金色羊（喂食奖励时间）、岩石（反弹障碍）。
import { WORLD, STEP, PLAY } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const F = WORLD.FIELD;

function emit(s, ev) {
  s.events.push(ev);
}

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, (levelIndex | 0) || 0));
  const lv = LEVELS[idx];
  const seed = (opts.seed | 0) || 1;
  const rng = mulberry32(seed);

  const s = {
    level: lv.index,
    levelIndex: idx,
    lv,
    phase: 'countdown',        // countdown | playing | won | lost
    countdown: lv.countdown,
    timeLeft: lv.time,
    totalTime: lv.time,
    sheep: [],
    rocks: [],
    foodRemaining: lv.sheep,
    fedCount: 0,
    goldenFedCount: 0,
    cooldown: 0,
    cd: lv.cd,
    score: 0,
    combo: 0,
    comboWindow: 0,
    mistakes: 0,
    flights: [],
    events: [],
    stars: 0,
    t: 0,
    rng,
    seed,
    _tickInt: Math.ceil(lv.time),
  };

  spawnRocks(s, rng);
  spawnSheep(s, rng);
  emit(s, { type: 'countdown', timeLeft: s.countdown });
  emit(s, { type: 'countdownTick', timeLeft: s.countdown });

  return decorate(s);
}

function spawnRocks(s, rng) {
  for (let i = 0; i < s.lv.rocks; i += 1) {
    let x = 0;
    let y = 0;
    let ok = false;
    let guard = 0;
    while (!ok && guard++ < 240) {
      x = F.left + 110 + rng() * (F.right - F.left - 220);
      y = F.top + 110 + rng() * (F.bottom - F.top - 220);
      ok = true;
      for (const r of s.rocks) {
        if (Math.hypot(r.x - x, r.y - y) < 130) { ok = false; break; }
      }
    }
    s.rocks.push({ x, y, r: 34, wobble: rng() * 6.283 });
  }
}

function spawnSheep(s, rng) {
  const golden = new Set();
  while (golden.size < s.lv.golden) golden.add(Math.floor(rng() * s.lv.sheep));
  for (let i = 0; i < s.lv.sheep; i += 1) {
    const isGolden = golden.has(i);
    const speed = s.lv.speed * (isGolden ? PLAY.GOLDEN_SPEED : 1);
    let x = 0;
    let y = 0;
    let ok = false;
    let guard = 0;
    const r = PLAY.SHEEP_R;
    while (!ok && guard++ < 240) {
      x = F.left + r + rng() * (F.right - F.left - 2 * r);
      y = F.top + r + rng() * (F.bottom - F.top - 2 * r);
      ok = true;
      for (const o of s.sheep) {
        if (Math.hypot(o.x - x, o.y - y) < r * 2.4) { ok = false; break; }
      }
      for (const rock of s.rocks) {
        if (Math.hypot(rock.x - x, rock.y - y) < r + rock.r + 24) { ok = false; break; }
      }
    }
    const ang = rng() * Math.PI * 2;
    s.sheep.push({
      id: i, x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      speed, r, fed: false, golden: isGolden, wobble: rng() * 6.283,
    });
    if (isGolden) emit(s, { type: 'goldenSpawn', id: i });
  }
}

function moveSheep(s, dt) {
  for (const sh of s.sheep) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    let bounced = false;
    if (sh.x - sh.r < F.left) { sh.x = F.left + sh.r; sh.vx = Math.abs(sh.vx); bounced = true; }
    else if (sh.x + sh.r > F.right) { sh.x = F.right - sh.r; sh.vx = -Math.abs(sh.vx); bounced = true; }
    if (sh.y - sh.r < F.top) { sh.y = F.top + sh.r; sh.vy = Math.abs(sh.vy); bounced = true; }
    else if (sh.y + sh.r > F.bottom) { sh.y = F.bottom - sh.r; sh.vy = -Math.abs(sh.vy); bounced = true; }
    for (const rock of s.rocks) {
      const dx = sh.x - rock.x;
      const dy = sh.y - rock.y;
      const dist = Math.hypot(dx, dy);
      const min = sh.r + rock.r;
      if (dist < min && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        sh.x = rock.x + nx * min;
        sh.y = rock.y + ny * min;
        const dot = sh.vx * nx + sh.vy * ny;
        sh.vx -= 2 * dot * nx;
        sh.vy -= 2 * dot * ny;
        bounced = true;
      }
    }
    if (bounced) emit(s, { type: 'sheepBounce', id: sh.id });
  }
}

function computeStars(s) {
  const ratio = s.timeLeft / s.totalTime;
  if (s.mistakes === 0 && ratio >= 0.30) return 3;
  if (s.mistakes <= 2 && ratio >= 0.15) return 2;
  return 1;
}

function landFeed(s, targetId) {
  const sh = s.sheep.find((x) => x.id === targetId);
  if (!sh || sh.fed) return;
  sh.fed = true;
  s.fedCount += 1;
  s.foodRemaining -= 1;
  s.combo = s.comboWindow > 0 ? s.combo + 1 : 1;
  s.comboWindow = PLAY.COMBO_WINDOW;
  let gain = PLAY.BASE_SCORE + (s.combo - 1) * PLAY.COMBO_SCORE;
  if (sh.golden) {
    gain += PLAY.GOLDEN_SCORE;
    s.timeLeft = Math.min(s.totalTime, s.timeLeft + PLAY.GOLDEN_TIME_BONUS);
    s.goldenFedCount += 1;
    emit(s, { type: 'goldenFed', id: sh.id });
  }
  s.score += gain;
  emit(s, { type: 'feedLand', id: sh.id, gain, combo: s.combo, golden: sh.golden });
  if (s.combo >= 2) emit(s, { type: 'combo', combo: s.combo });
  if (s.foodRemaining === 0) {
    s.stars = computeStars(s);
    s.score += s.stars * 100;
    s.phase = 'won';
    emit(s, { type: 'win', stars: s.stars, score: s.score, timeLeft: s.timeLeft });
  }
}

function updateFlights(s, dt) {
  for (let i = s.flights.length - 1; i >= 0; i -= 1) {
    const f = s.flights[i];
    f.t += dt;
    if (f.t >= f.dur) {
      s.flights.splice(i, 1);
      landFeed(s, f.targetId);
    }
  }
}

function step(s, dt) {
  if (s.phase === 'won' || s.phase === 'lost') return;
  s.t += dt;

  if (s.phase === 'countdown') {
    moveSheep(s, dt);
    s.countdown -= dt;
    if (s.countdown <= 0) {
      s.countdown = 0;
      s.phase = 'playing';
      s._tickInt = Math.ceil(s.timeLeft);
      emit(s, { type: 'play' });
    }
    return;
  }

  // playing
  s.timeLeft -= dt;
  if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
  if (s.comboWindow > 0) {
    s.comboWindow -= dt;
    if (s.comboWindow <= 0) { s.comboWindow = 0; s.combo = 0; }
  }
  moveSheep(s, dt);
  updateFlights(s, dt);

  const intNow = Math.ceil(s.timeLeft);
  if (intNow < s._tickInt) {
    s._tickInt = intNow;
    emit(s, { type: 'tick', timeLeft: intNow });
    if (intNow >= 1 && intNow <= 5) emit(s, { type: 'countdownTick', timeLeft: intNow });
  }

  if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    s.phase = 'lost';
    emit(s, { type: 'lose', reason: 'timeOut' });
  }
}

function tap(s, x, y) {
  if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
  if (s.cooldown > 0) return { ok: false, reason: 'cooldown' };
  let best = null;
  let bestDist = Infinity;
  for (const sh of s.sheep) {
    const d = Math.hypot(sh.x - x, sh.y - y);
    if (d <= sh.r + PLAY.TAP_MARGIN && d < bestDist) { best = sh; bestDist = d; }
  }
  if (!best) return { ok: false, reason: 'miss' };
  if (best.fed) {
    s.mistakes += 1;
    s.combo = 0;
    s.comboWindow = 0;
    s.cooldown = s.cd;
    emit(s, { type: 'mistake', id: best.id });
    return { ok: true, kind: 'mistake' };
  }
  s.cooldown = s.cd;
  s.flights.push({ targetId: best.id, t: 0, dur: PLAY.FLIGHT_SEC, fromX: WORLD.TRAY.x, fromY: WORLD.TRAY.y });
  emit(s, { type: 'feedLaunch', id: best.id });
  return { ok: true, kind: 'feed' };
}

function decorate(s) {
  s.step = (dt) => step(s, dt);
  s.drainEvents = () => {
    const e = s.events;
    s.events = [];
    return e;
  };
  s.tap = (x, y) => tap(s, x, y);
  s.getHud = () => ({
    level: s.level,
    timeLeft: Math.max(0, s.timeLeft),
    combo: s.combo,
    foodRemaining: s.foodRemaining,
    fedCount: s.fedCount,
    total: s.lv.sheep,
    score: s.score,
    cooldown: s.cooldown,
    phase: s.phase,
  });
  s.state = s;
  return s;
}

export { STEP, mulberry32 };
