// HELIX ORBIT · M1 模拟/玩法核心（纯逻辑，零 DOM/零 Math.random/零 Date.now）
// 契约：docs/report.md（事件名 / 接口签名一字不差）
// 模型：球沿螺旋塔下落；玩家旋转塔层，使缺口（或窄缝）对齐球的正下方 → 穿落。
//       安全段弹跳；岩浆段判负（冻结期安全、陨石态可砸穿）；同层同段连弹 = 卡死。
import {
  BALL, ROT, TOWER, METEOR, FREEZE, SCORE, NEAR_MISS,
  STEP, clamp, normAngle, signedAngle, angleDist, angleInArcs,
} from '../../config/gameplay.js';
import { profileFor, themeFor } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const TWO_PI = 2 * Math.PI;
const LOOKAHEAD = 14;   // 预生成层数
const CULL_BEHIND = 3;  // 保留当前层以下这么多层

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    towerAngle: 0,
    currentLayer: 0,
    ballY: BALL.START_Y,
    ballVy: 0,
    score: 0,
    crystals: 0,
    freezeUntil: 0,
    meteorStreak: 0,
    meteorActive: false,
    deadlockStreak: 0,
    lastBounceSeg: null,
    nearMissAt: -Infinity,
    layers: new Map(),   // index -> layer
    events: [],
    stats: { depth: 0, score: 0, meteorSmashes: 0, crevices: 0, crystalsCollected: 0 },
  };
  ensureLayers(run);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  // 调试/验收辅助：用贪心策略自动推进 n 步（把最近缺口转到正下方）
  run.auto = (n) => {
    for (let k = 0; k < n && run.phase === 'playing'; k += 1) {
      run.step({ rotate: greedyRotate(run) });
    }
  };
  return run;
}

export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 层生成 ----------
function generateLayer(run, index) {
  const p = profileFor(index);
  const SLOTS = TOWER.SLOTS;
  const slot = TWO_PI / SLOTS;
  const crevice = index > 0 && (index % TOWER.CREVICE_EVERY) === TOWER.CREVICE_EVERY - 1;
  const gapWidth = crevice ? 0.5 : p.gapWidth;
  const gapCount = crevice ? 1 : p.gapCount;

  // 选缺口槽位（互不重复）
  const gapSlots = new Set();
  while (gapSlots.size < gapCount) {
    gapSlots.add(Math.floor(run.rng() * SLOTS));
  }

  const segments = [];
  const gaps = [];
  const magmaRatio = clamp(p.magmaRatio, 0, 1);

  for (let s = 0; s < SLOTS; s += 1) {
    const a0 = s * slot;
    const a1 = (s + 1) * slot;
    if (gapSlots.has(s)) {
      if (gapWidth < 1) {
        const center = (a0 + a1) / 2;
        const half = (slot * gapWidth) / 2;
        gaps.push({ a0: center - half, a1: center + half });
        if (center - half > a0) segments.push({ a0, a1: center - half, magma: run.rng() < magmaRatio });
        if (a1 > center + half) segments.push({ a0: center + half, a1, magma: run.rng() < magmaRatio });
      } else {
        gaps.push({ a0, a1 });
      }
    } else {
      segments.push({ a0, a1, magma: run.rng() < magmaRatio });
    }
  }

  const layer = {
    index,
    theme: p.theme,
    segments,
    gaps,
    baseAngle: run.rng() * TWO_PI,
    spin: 0,
    movingOffset: 0,
    reverse: !!p.reverse,
    movingDir: p.movingDir || 0,
    movingSpeed: p.movingSpeed || 0,
    crevice,
    doubleScore: crevice,
    crystal: run.rng() < TOWER.CRYSTAL_CHANCE,
    crystalCollected: false,
  };
  run.layers.set(index, layer);
  return layer;
}

function ensureLayers(run) {
  for (let i = run.currentLayer; i <= run.currentLayer + LOOKAHEAD; i += 1) {
    if (!run.layers.has(i)) generateLayer(run, i);
  }
  for (const index of [...run.layers.keys()]) {
    if (index < run.currentLayer - CULL_BEHIND) run.layers.delete(index);
  }
}

export function layerAt(run, index) {
  if (!run.layers.has(index)) generateLayer(run, index);
  return run.layers.get(index);
}

// ---------- 层动态（反向自旋 / 移动缝）----------
function updateLayerDynamics(run, dt, rotate) {
  for (const layer of run.layers.values()) {
    if (layer.reverse) layer.spin = normAngle(layer.spin - rotate * ROT.REVERSE_SPEED * dt);
    if (layer.movingSpeed) layer.movingOffset = normAngle(layer.movingOffset + layer.movingDir * layer.movingSpeed * dt);
  }
}

// ---------- 角度 / 覆盖 ----------
export function effectiveAngle(run, layer) {
  return normAngle(run.towerAngle + layer.baseAngle + layer.spin + layer.movingOffset);
}

/** 当前位于「正下方」（world 0）的层内角（已归一化） */
export function frontLocal(run, layer) {
  return normAngle(-effectiveAngle(run, layer));
}

/** 正下方覆盖情况：{ gap, magma, segIdx, arc } */
export function frontCoverage(run, layer) {
  const phi = frontLocal(run, layer);
  const segIdx = layer.segments.findIndex((s) => phi >= s.a0 && phi <= s.a1);
  if (segIdx >= 0) return { gap: false, magma: layer.segments[segIdx].magma, segIdx, arc: layer.segments[segIdx] };
  return { gap: true, magma: false, segIdx: null, arc: null };
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  const rotate = clamp(input.rotate ?? 0, -1, 1);
  run.towerAngle = normAngle(run.towerAngle + rotate * ROT.SPEED * dt);
  updateLayerDynamics(run, dt, rotate);

  run.ballVy += BALL.GRAVITY * dt;
  if (run.ballVy > BALL.MAX_FALL) run.ballVy = BALL.MAX_FALL;
  run.ballY += run.ballVy * dt;

  // 下落时逐层解析（穿落/弹跳/砸穿/死亡）
  while (run.phase === 'playing' && run.ballVy > 0 && run.ballY >= run.currentLayer) {
    resolveLayer(run);
  }

  // 冻结到期
  if (run.freezeUntil > 0 && run.time >= run.freezeUntil) {
    run.freezeUntil = 0;
    emit(run, 'freezeEnd', {});
  }

  maybeNearMiss(run);
  ensureLayers(run);
  run.stats.depth = run.currentLayer;
  run.stats.score = run.score;
}

function isFrozen(run) {
  return run.freezeUntil > run.time;
}

function resolveLayer(run) {
  const layer = layerAt(run, run.currentLayer);
  const cov = frontCoverage(run, layer);

  if (cov.gap) {
    run.currentLayer += 1;
    run.score += layer.doubleScore ? SCORE.CREVICE_MULT : SCORE.PASS;
    onPass(run, layer, 'gap');
  } else if (cov.magma) {
    if (isFrozen(run)) {
      bounce(run, layer, cov.segIdx);
    } else if (run.meteorActive) {
      run.currentLayer += 1;
      run.score += SCORE.METEOR_SMASH;
      breakSegment(run, layer, cov.segIdx);
      onPass(run, layer, 'smash');
      emit(run, 'meteorSmash', { layer: layer.index, score: SCORE.METEOR_SMASH });
      run.stats.meteorSmashes += 1;
    } else {
      die(run, 'magma');
    }
  } else {
    bounce(run, layer, cov.segIdx);
  }
}

function bounce(run, layer, segIdx) {
  run.ballVy = -BALL.BOUNCE_VEL;
  // 落在安全段上：陨石态结束、连穿清零
  run.meteorActive = false;
  run.meteorStreak = 0;
  if (run.lastBounceSeg === segIdx) run.deadlockStreak += 1;
  else { run.deadlockStreak = 1; run.lastBounceSeg = segIdx; }
  emit(run, 'bounce', { layer: layer.index });
  if (run.deadlockStreak >= TOWER.DEADLOCK_MAX) die(run, 'stuck');
}

function onPass(run, layer, via) {
  run.meteorStreak += 1;
  if (!run.meteorActive && run.meteorStreak >= METEOR.STREAK) {
    run.meteorActive = true;
    emit(run, 'meteorStart', {});
  }
  run.deadlockStreak = 0;
  run.lastBounceSeg = null;
  if (layer.crystal && !layer.crystalCollected) {
    layer.crystalCollected = true;
    collectCrystal(run);
  }
  if (layer.doubleScore) {
    emit(run, 'crevice', { layer: layer.index, score: SCORE.CREVICE_MULT });
    run.stats.crevices += 1;
  } else if (via === 'gap') {
    emit(run, 'layerPass', { layer: layer.index, meteor: run.meteorActive });
  }
  if (run.currentLayer > 0 && run.currentLayer % SCORE.MILESTONE_EVERY === 0) {
    emit(run, 'milestone', { layer: run.currentLayer });
  }
}

function breakSegment(run, layer, segIdx) {
  if (segIdx == null) return;
  const [seg] = layer.segments.splice(segIdx, 1);
  if (seg) layer.gaps.push({ a0: seg.a0, a1: seg.a1 });
}

function collectCrystal(run) {
  run.crystals = Math.min(FREEZE.NEED, run.crystals + 1);
  run.stats.crystalsCollected += 1;
  emit(run, 'crystal', { count: run.crystals });
  if (run.crystals >= FREEZE.NEED && !isFrozen(run)) {
    run.crystals = 0;
    run.freezeUntil = run.time + FREEZE.SEC;
    emit(run, 'freezeStart', {});
  }
}

function die(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { reason });
}

// ---------- nearMiss ----------
function maybeNearMiss(run) {
  if (run.phase !== 'playing' || run.ballVy <= 0) return;
  if (run.time - run.nearMissAt < NEAR_MISS.THROTTLE) return;
  const layer = layerAt(run, run.currentLayer);
  const phi = frontLocal(run, layer);
  const inGap = layer.gaps.some((g) => phi >= g.a0 && phi <= g.a1);
  if (inGap) return;
  let d = Infinity;
  for (const g of layer.gaps) {
    d = Math.min(d, Math.min(Math.abs(phi - g.a0), Math.abs(phi - g.a1)));
  }
  if (d < NEAR_MISS.GAP) {
    run.nearMissAt = run.time;
    emit(run, 'nearMiss', { layer: layer.index });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const theme = themeFor(run.currentLayer);
  const freezeLeft = isFrozen(run) ? run.freezeUntil - run.time : 0;
  return {
    depth: run.currentLayer,
    score: run.score,
    crystals: run.crystals,
    freezeActive: isFrozen(run),
    freezeLeft,
    meteorActive: run.meteorActive,
    meteorStreak: run.meteorStreak,
    theme: theme.key,
    themeName: `theme.${theme.key}`,
    phase: run.phase,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// ---------- 贪心策略提示（selfplay 复用；把最近缺口转到正下方）----------
export function greedyRotate(run) {
  const layer = layerAt(run, run.currentLayer);
  const phi = frontLocal(run, layer);

  // 已在缺口内 → 稳住（返回 0）
  for (const g of layer.gaps) {
    if (phi >= g.a0 && phi <= g.a1) return 0;
  }
  // 找最近的缺口中心
  let best = null;
  let bestD = Infinity;
  for (const g of layer.gaps) {
    const c = (g.a0 + g.a1) / 2;
    const d = angleDist(phi, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best == null) return 0;
  // 需要把 frontLocal 从 phi 移到 best：frontLocal 增/减由 towerAngle 反向驱动
  const delta = signedAngle(phi, best);
  const mag = clamp(Math.abs(delta) * 2.2, 0, 1);
  return -Math.sign(delta) * mag;
}
