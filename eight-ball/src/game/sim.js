// 一局的运行对象：包住纯规则 match，附加表现层状态（瞄准、球杆动画、顿帧/震屏、落袋与粒子）。
// 仍然不碰 DOM / window / Date.now —— 渲染器只读这里的数据，主循环负责驱动。
import { AI, AIM, BALL, FX, TABLE } from '../../config/game.config.js';
import { CUE, kindOf } from './balls.js';
import { PLAYER, RIVAL, createMatch } from './match.js';
import { castBall, castCushion } from './geometry.js';

const STICK_PULL = FX.CUE_BACK_S;
const STICK_STRIKE = FX.CUE_STRIKE_S;
const CONTACT_AT = 0.72; // 前推动画进行到此处时白球获得速度

export function createSim(options = {}) {
  const match = createMatch(Object.assign({ autoAi: false }, options));
  const world = match.world;

  const sim = {
    match,
    world,
    time: 0,
    reduceMotion: !!options.reduceMotion,
    aim: { active: false, x: 0, y: 0, downX: 0, downY: 0, angle: 0, power: 0 },
    place: { active: false, x: 0, y: 0, ok: false, revert: null },
    stick: { state: 'idle', t: 0, angle: 0, power: 0, fired: false, by: RIVAL },
    ai: { timer: 0, angle: 0, power: 0, aiming: false, waiting: false },
    fx: { shake: 0, freeze: 0, pots: [], particles: [], flash: [] },
    sfx: [],
  };

  const cueBall = () => world.balls.find((b) => b.id === CUE) || null;
  const humanShootable = () =>
    match.turn === PLAYER && (match.phase === 'aim' || match.phase === 'break');

  function addShake(amount) {
    if (sim.reduceMotion) return;
    sim.fx.shake = Math.min(FX.SHAKE_PX, sim.fx.shake + amount);
  }

  function spawnParticles(x, y, color, count) {
    if (sim.reduceMotion) return;
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + match.rng.next() * 0.6;
      const sp = 40 + match.rng.next() * 130;
      sim.fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color });
    }
  }

  function consume(events) {
    for (const e of events) {
      if (e.type === 'shot') {
        sim.fx.freeze = FX.FREEZE_MS / 1000;
        addShake(2 + e.power * FX.SHAKE_PX * 0.5);
        sim.sfx.push({ name: 'cue', gain: 0.4 + e.power * 0.6 });
      } else if (e.type === 'hit') {
        const g = Math.min(1, e.impulse / 900);
        if (g > 0.02) {
          sim.sfx.push({ name: 'clack', gain: 0.1 + g * 0.9, tone: 1 + (1 - g) * 0.9 });
          if (g > 0.45) addShake(g * 2.4);
        }
      } else if (e.type === 'cushion') {
        sim.sfx.push({ name: 'rail', gain: 0.3 });
      } else if (e.type === 'pocket') {
        if (e.id !== CUE) {
          sim.fx.pots.push({
            id: e.id,
            kind: kindOf(e.id),
            from: { x: e.x, y: e.y },
            to: { x: e.pocket.x, y: e.pocket.y },
            t: 0,
          });
        }
        sim.fx.flash.push({ x: e.pocket.x, y: e.pocket.y, t: 0 });
        spawnParticles(e.pocket.x, e.pocket.y, '#0a0c11', FX.PARTICLES);
        sim.sfx.push({ name: 'pocket', gain: 0.9 });
        addShake(2.4);
      } else if (e.type === 'foul') {
        sim.sfx.push({ name: 'foul', gain: 0.7 });
      } else if (e.type === 'group') {
        sim.sfx.push({ name: 'ding', gain: 0.6 });
      } else if (e.type === 'over') {
        sim.sfx.push({ name: e.result === 'win' ? 'win' : 'lose', gain: 0.9 });
      }
    }
  }

  // 击球动画：后拉 → 前推 → 接触瞬间给白球速度（此刻才走物理）
  function stepStick(dt) {
    const st = sim.stick;
    if (st.state === 'idle') return;
    st.t += dt;
    if (st.state === 'pull') {
      if (st.t >= STICK_PULL) {
        st.state = 'strike';
        st.t = 0;
      }
    } else if (st.state === 'strike') {
      if (!st.fired && st.t >= STICK_STRIKE * CONTACT_AT) {
        st.fired = true;
        match.shoot({ by: st.by, angle: st.angle, power: st.power });
      }
      if (st.t >= STICK_STRIKE) {
        st.state = 'follow';
        st.t = 0;
      }
    } else if (st.state === 'follow' && st.t >= STICK_STRIKE) {
      st.state = 'idle';
      st.t = 0;
    }
  }

  function stepFx(dt) {
    sim.fx.shake = Math.max(0, sim.fx.shake - dt * FX.SHAKE_DECAY * FX.SHAKE_PX);
    for (const p of sim.fx.pots) p.t += dt;
    sim.fx.pots = sim.fx.pots.filter((p) => p.t < FX.POT_S);
    for (const f of sim.fx.flash) f.t += dt;
    sim.fx.flash = sim.fx.flash.filter((f) => f.t < 0.5);
    for (const q of sim.fx.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.9;
      q.vy *= 0.9;
      q.life -= dt;
    }
    sim.fx.particles = sim.fx.particles.filter((q) => q.life > 0);
  }

  // AI 回合：思考 AI.THINK 秒后出杆（含球权在手时先摆位）
  function stepRival(dt) {
    if (match.turn !== RIVAL || match.phase === 'over') return;
    if (match.phase === 'moving' || sim.stick.state !== 'idle' || sim.aim.active || sim.place.active) return;
    if (!sim.ai.waiting) {
      if (match.ballInHand) {
        const spot = match.planAiPlacement();
        if (spot) match.placeCueBall(spot.x, spot.y);
      }
      const plan = match.planAiShot();
      sim.ai.waiting = true;
      sim.ai.timer = 0;
      sim.ai.aiming = !!plan;
      if (plan) {
        sim.ai.angle = plan.angle;
        sim.ai.power = plan.power;
      }
      if (!plan) {
        // 台面上已无可打目标：直接判和，避免死等
        match.abortToOver('stalemate');
      }
      return;
    }
    sim.ai.timer += dt;
    if (sim.ai.timer < AI.THINK) return;
    sim.ai.waiting = false;
    if (sim.ai.aiming) sim.beginStrike({ angle: sim.ai.angle, power: sim.ai.power, by: RIVAL });
  }

  sim.step = (dt) => {
    sim.time += dt;
    if (sim.fx.freeze > 0) {
      sim.fx.freeze -= dt;
      stepFx(dt);
      return;
    }
    stepStick(dt);
    if (match.phase !== 'moving' && sim.stick.state !== 'idle' && !sim.stick.fired) {
      // 杆还在后拉/前推，物理保持静止
      stepRival(dt);
    } else {
      match.step(dt);
      consume(match.drainEvents());
      stepRival(dt);
    }
    stepFx(dt);
  };

  sim.beginStrike = (shot) => {
    if (sim.stick.state !== 'idle') return false;
    if (match.phase !== 'aim' && match.phase !== 'break') return false;
    sim.stick = {
      state: 'pull',
      t: 0,
      angle: shot.angle,
      power: Math.max(0, Math.min(1, shot.power)),
      fired: false,
      by: shot.by || match.turn,
    };
    sim.ai.aiming = false;
    sim.ai.waiting = false;
    sim.aim.active = false;
    return true;
  };

  // —— 人类瞄准：按住白球附近往后拖，方向 = 白球背离手指，距离 = 拖拽位移 ——
  sim.beginAim = (x, y) => {
    if (!humanShootable() || match.ballInHand) return false;
    if (match.phase === 'moving' || sim.stick.state !== 'idle') return false;
    const cue = cueBall();
    if (!cue) return false;
    sim.aim.active = true;
    sim.aim.downX = x;
    sim.aim.downY = y;
    sim.aim.x = x;
    sim.aim.y = y;
    return true;
  };

  sim.moveAim = (x, y) => {
    if (!sim.aim.active) return false;
    const cue = cueBall();
    if (!cue) return false;
    sim.aim.x = x;
    sim.aim.y = y;
    const dx = cue.x - x;
    const dy = cue.y - y;
    if (Math.hypot(dx, dy) > AIM.MIN_DRAG) sim.aim.angle = Math.atan2(dy, dx);
    const pulled = Math.hypot(x - sim.aim.downX, y - sim.aim.downY);
    sim.aim.power = Math.max(0, Math.min(1, pulled / AIM.MAX_DRAG));
    return true;
  };

  sim.endAim = () => {
    if (!sim.aim.active) return false;
    sim.aim.active = false;
    const power = sim.aim.power;
    const angle = sim.aim.angle;
    if (power < 0.03) {
      sim.aim.power = 0;
      return false;
    }
    sim.aim.power = 0;
    return sim.beginStrike({ angle, power, by: PLAYER });
  };

  sim.hoverAim = (x, y) => {
    if (sim.aim.active || !humanShootable() || match.ballInHand) return false;
    const cue = cueBall();
    if (!cue) return false;
    const dx = cue.x - x;
    const dy = cue.y - y;
    if (Math.hypot(dx, dy) < AIM.MIN_DRAG) return false;
    sim.aim.angle = Math.atan2(dy, dx);
    return true;
  };

  // —— 自由球摆位 ——
  sim.beginPlace = (x, y) => {
    if (!humanShootable() || !match.ballInHand) return false;
    const cue = cueBall();
    if (!cue) return false;
    sim.place.active = true;
    sim.place.revert = { x: cue.x, y: cue.y };
    return sim.movePlace(x, y);
  };

  sim.movePlace = (x, y) => {
    if (!sim.place.active) return false;
    const cue = cueBall();
    sim.place.x = x;
    sim.place.y = y;
    sim.place.ok = match.canPlaceCueBall(x, y);
    if (cue) {
      cue.x = x;
      cue.y = y;
    }
    return true;
  };

  sim.endPlace = () => {
    if (!sim.place.active) return false;
    sim.place.active = false;
    const placed = match.placeCueBall(sim.place.x, sim.place.y);
    if (!placed) {
      const cue = cueBall();
      if (cue && sim.place.revert) {
        cue.x = sim.place.revert.x;
        cue.y = sim.place.revert.y;
      }
    } else {
      sim.sfx.push({ name: 'place', gain: 0.4 });
    }
    return placed;
  };

  // 瞄准线上的首次碰撞预测（P1）
  sim.aimPreview = () => {
    const cue = cueBall();
    if (!cue) return null;
    const angle = sim.aim.active ? sim.aim.angle : sim.ai.aiming ? sim.ai.angle : sim.aim.angle;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const hit = castBall(cue.x, cue.y, dirX, dirY, world.balls);
    const wall = castCushion(cue.x, cue.y, dirX, dirY);
    if (hit && (!wall || hit.t < wall)) {
      const gx = cue.x + dirX * hit.t;
      const gy = cue.y + dirY * hit.t;
      const nx = hit.ball.x - gx;
      const ny = hit.ball.y - gy;
      const nl = Math.hypot(nx, ny) || 1;
      return {
        angle,
        end: { x: gx, y: gy },
        ghost: { x: gx, y: gy },
        ball: hit.ball,
        object: { x: hit.ball.x, y: hit.ball.y, dx: nx / nl, dy: ny / nl },
      };
    }
    const t = wall > 0 ? wall : AIM.MAX_DRAG;
    return { angle, end: { x: cue.x + dirX * t, y: cue.y + dirY * t }, ghost: null, ball: null, object: null };
  };

  sim.showAimLine = () =>
    match.phase !== 'moving' &&
    match.phase !== 'over' &&
    !(match.ballInHand && match.turn === PLAYER) &&
    (sim.aim.active || (sim.ai.aiming && match.turn === RIVAL) || match.turn === PLAYER);

  sim.hud = () => match.getHud();
  sim.drainEvents = () => match.drainEvents();
  sim.power = () => {
    if (sim.aim.active) return sim.aim.power;
    return sim.stick.state === 'idle' ? 0 : sim.stick.power;
  };
  sim.cueRadius = BALL.R;
  sim.pocketRadius = TABLE.POCKET_R;
  return sim;
}
