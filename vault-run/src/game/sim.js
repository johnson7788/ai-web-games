// src/game/sim.js — 纯逻辑核心：第一人称自动前进跑酷。
// 翻越 / 滑铲 / 蹬墙 状态机 + 体力冲刺 + 计时局 + 检查点回滚 + 分数/连击。
// 无 DOM/THREE/Date.now；随机用 seed。60Hz 固定步长由 main 调用。
import { STEP, RUN, ACTION, SCORE } from '../../config/game.config.js';
import { createCourse, cranePlatformX, ratingFor } from './course.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const course = createCourse(rng);
  return {
    seed,
    phase: 'running',          // running | finished
    reason: null, win: false,
    time: 0, clock: RUN.clockStart,
    speed: RUN.speedBase,
    player: { x: 0, y: 0, z: 0, acting: null },
    stamina: RUN.staminaMax,
    stunT: 0,
    score: 0, dist: 0, combo: 0, lastSuccessAt: -99,
    course,
    section: 1, checkpoint: { z: 0, section: 1 },
    nextMilestone: SCORE.milestoneEvery,
    nextStep: 3.5,
    stats: { vault: 0, slide: 0, wallrun: 0, hits: 0, falls: 0, pickups: 0, topCombo: 0 },
    events: [],
    rng,
  };
}

function emit(run, type, extra = {}) { run.events.push({ type, t: run.time, ...extra }); }

export function drainEvents(run) { const ev = run.events; run.events = []; return ev; }

// 调试/验收用：瞬移到某 z，清除其身后障碍（避免 teleport 触发一串误判）
export function teleportTo(run, z, x = 0) {
  const p = run.player;
  p.z = z; p.x = x; p.y = 0; p.acting = null;
  for (const o of run.course.obstacles) if (o.z < z) o.cleared = true;
  run.section = run.course.sectionAt(z);
  run.checkpoint = run.course.checkpointAt(z);
  run.nextMilestone = Math.ceil((z + 1) / SCORE.milestoneEvery) * SCORE.milestoneEvery;
  return run;
}

export function getHud(run) {
  let next = null;
  for (const o of run.course.obstacles) {
    if (o.cleared) continue;
    const dz = o.z - run.player.z;
    if (dz > -2 && dz < 12) { next = o.type; break; }
    if (dz >= 12) break;
  }
  return {
    phase: run.phase, reason: run.reason, win: run.win,
    time: run.clock, dist: run.dist, speed: run.speed,
    score: Math.round(run.score), combo: run.combo,
    stamina: run.stamina, section: run.section,
    acting: run.player.acting?.type || null,
    next,
  };
}

function success(run, type) {
  const since = run.time - run.lastSuccessAt;
  run.combo = (run.combo > 0 && since <= SCORE.comboWindow) ? Math.min(SCORE.multMax, run.combo + 1) : 1;
  run.lastSuccessAt = run.time;
  run.stats.topCombo = Math.max(run.stats.topCombo, run.combo);
  run.stats[type] += 1;
  run.score += ACTION[type].score * run.combo;
  emit(run, type, { combo: run.combo });
  emit(run, 'success', { action: type, combo: run.combo });
  if (run.combo >= 2) emit(run, 'combo', { n: run.combo });
}

function hit(run, type) {
  run.stats.hits += 1;
  run.stunT = RUN.stunSec;
  run.speed = 0;
  run.clock = Math.max(0, run.clock - RUN.hitPenalty);
  run.combo = 0;
  emit(run, 'hit', { obstacle: type });
}

function fall(run) {
  run.stats.falls += 1;
  run.combo = 0;
  run.clock = Math.max(0, run.clock - RUN.fallPenalty);
  const cp = run.course.checkpointAt(run.player.z);
  run.player.z = cp.z;
  run.player.x = 0;
  run.player.y = 0;
  run.player.acting = null;
  run.speed = Math.max(RUN.speedBase * 0.7, run.speed * 0.5);
  run.checkpoint = cp;
  run.nextStep = run.player.z + 3.5; // 回跑时脚步节拍立即恢复
  emit(run, 'fall', { at: cp.z });
}

function finish(run, reason) {
  run.phase = 'finished';
  run.reason = reason;
  run.win = reason === 'finish';
  emit(run, run.win ? 'win' : 'timeout', { score: Math.round(run.score) });
}

function tryAction(run) {
  const p = run.player;
  const course = run.course;
  let ob = null;
  for (const o of course.obstacles) {
    if (o.cleared) continue;
    const dz = o.z - p.z;
    if (dz > -2 && dz < ACTION.trigger) { ob = o; break; }
    if (dz >= ACTION.trigger) break;
  }
  if (!ob || ob.type === 'crane') return; // 吊臂靠对齐，不靠动作
  // 蹬墙持续到跨过缺口（缺口宽 / 当前速度），否则低速时半空掉下去
  const dur = ob.type === 'wallrun' ? Math.max(ACTION.wallrun.dur, ob.gapW / Math.max(1, run.speed) + 0.2) : ACTION[ob.type].dur;
  p.acting = { type: ob.type, t: 0, dur, ob };
}

function updateAction(run, dt) {
  const p = run.player;
  const a = p.acting;
  a.t += dt;
  if (a.type === 'vault') {
    const k = a.t / a.dur;
    p.y = Math.sin(clamp(k, 0, 1) * Math.PI) * ACTION.vault.arc;
  } else if (a.type === 'slide') {
    p.y = ACTION.slide.lowY;
  } else if (a.type === 'wallrun') {
    p.y = 0;
  }
  if (a.t >= a.dur) { p.acting = null; p.y = 0; }
}

function resolveObstacles(run) {
  const p = run.player;
  const course = run.course;
  for (const ob of course.obstacles) {
    if (ob.cleared) continue;
    if (ob.type === 'vault' || ob.type === 'slide') {
      if (p.z >= ob.z) {
        const doing = p.acting && p.acting.ob === ob && p.acting.type === ob.type;
        ob.cleared = true;
        if (doing) success(run, ob.type); else hit(run, ob.type);
      }
    } else {
      // wallrun / crane 缺口：进入缺口区间且无支撑 → 坠落
      const gapStart = ob.z, gapEnd = ob.z + ob.gapW;
      if (p.z >= gapEnd) { ob.cleared = true; continue; }
      if (p.z >= gapStart) {
        const supported = ob.type === 'wallrun'
          ? (p.acting && p.acting.ob === ob && p.acting.type === 'wallrun')
          : (Math.abs(p.x - cranePlatformX(ob, run.time)) <= ob.platformHalf);
        if (!supported) { ob.cleared = true; fall(run); return; }
        if (ob.type === 'wallrun' && !ob.scored) { ob.scored = true; success(run, 'wallrun'); }
      }
    }
  }
}

export function updateSim(run, input = {}) {
  const dt = STEP;
  input = { steer: 0, action: false, sprint: false, ...input };
  if (run.phase !== 'running') return run;

  run.time += dt;
  run.clock -= dt;
  if (run.clock <= 0) { finish(run, 'timeout'); return run; }

  const p = run.player;
  const course = run.course;

  // 体力
  const sprinting = input.sprint && run.stamina > 0 && run.stunT <= 0;
  if (sprinting) run.stamina = Math.max(0, run.stamina - RUN.sprintDrain * dt);
  else run.stamina = Math.min(RUN.staminaMax, run.stamina + RUN.staminaRegen * dt);

  // 速度（撞停后归零，再重新加速）
  if (run.stunT > 0) run.stunT -= dt;
  let target = RUN.speedBase + (RUN.speedMax - RUN.speedBase) * Math.min(1, run.time / RUN.speedRamp);
  if (sprinting) target *= RUN.sprintMul;
  if (run.stunT > 0) target = 0;
  run.speed += (target - run.speed) * Math.min(1, 6 * dt);

  // 推进 + 距离分（按最远距离计，坠落回跑不重复计分）
  p.z += run.speed * dt;
  const prevDist = run.dist;
  run.dist = Math.max(run.dist, p.z);
  run.score += (run.dist - prevDist) * SCORE.distPerM;

  // 脚步节拍（跑动中的可感知反馈：画面 bob + 轻脚步音）
  if (run.stunT <= 0 && !p.acting && run.speed > 2 && p.z >= run.nextStep) {
    run.nextStep += 3.5;
    emit(run, 'step');
  }

  // 横向（撞停/动作中不能转向）
  if (run.stunT <= 0 && !p.acting) p.x += input.steer * RUN.lateralSpeed * dt;

  // 侧向坠落（超出当前段宽度）
  if (Math.abs(p.x) > course.halfWidthAt(p.z)) { fall(run); return run; }

  // 上下文动作
  if (input.action && run.stunT <= 0 && !p.acting) tryAction(run);
  if (p.acting) updateAction(run, dt);

  // 障碍判定
  resolveObstacles(run);
  if (run.phase !== 'running') return run;

  // 时间加成拾取
  for (const pk of course.pickups) {
    if (pk.taken) continue;
    if (Math.abs(p.z - pk.z) < 2 && Math.abs(p.x - pk.x) < 2.2) {
      pk.taken = true; run.stats.pickups += 1;
      run.clock += RUN.pickupTime;
      emit(run, 'pickup', { at: pk.z });
    }
  }

  // 里程碑（每 100m 一个可感知事件 + 奖励；按最远距离，不重复触发）
  if (run.dist >= run.nextMilestone) {
    run.nextMilestone += SCORE.milestoneEvery;
    run.score += SCORE.milestoneBonus;
    emit(run, 'milestone', { m: Math.round(run.dist) });
  }

  // 段推进 → 更新检查点
  const sec = course.sectionAt(p.z);
  if (sec !== run.section) {
    run.section = sec;
    run.checkpoint = course.checkpointAt(p.z);
    emit(run, 'section', { n: sec });
  }

  // 终点
  if (p.z >= course.finishZ) { finish(run, 'finish'); return run; }

  return run;
}

export { ratingFor };
