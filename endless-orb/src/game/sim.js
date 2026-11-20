// ENDLESS ORB · 模拟/玩法核心（纯逻辑，零依赖，随机用 seed）
// 契约：docs/endless-orb/analysis.md（事件名 / 接口签名一字不差）
// 玩法：点击/空格把光子钉进中心旋转的能量核；撞到已钉光子判负；钉满目标数清环；12 环通关。
import {
  WORLD, STEP, CORE, TWIN, PHOTON, POLARITY, SCORE, slotHalf, angDist, normAngle, clamp,
} from '../../config/gameplay.js';
import { RING_COUNT, ringAt, sceneAt } from '../../config/levels.js';
import { UPGRADES_BY_ID } from '../../config/upgrades.js';
import { mulberry32 } from './rng.js';

const NEAR_MISS_EXTRA = 0.5; // 近距落点判定：最近角距 < 2.5*slotHalf 计为擦肩
const GRACE_SEC = 2.5; // grace 升级：每环开局 2.5s 内碰撞不判负
const START_PHASE = 0; // 核心初始相位

// ---------- 创建 run ----------
export function createRun({ seed = 0, startRing = 1 } = {}) {
  const rng = mulberry32(seed);
  const ring = clamp(startRing, 1, RING_COUNT);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    ring,
    ringPinned: 0,
    ringTarget: ringAt(ring).target,
    totalPins: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    nextHeavy: false,
    mods: { shield: false, polarityResist: false, heavyBonus: false, ghostSlot: false, comboBank: false, grace: false, biggerCore: false, slowCore: false, pinSpeed: false, resonance: false },
    upgradeIds: [],
    cores: [],
    pinned: [],
    photon: null,
    polarityEvery: polarityInterval(ring),
    polarityTimer: polarityInterval(ring),
    ringStartTime: 0,
    shieldUsed: false,
    ghostAt: -Infinity,
    nextId: 1,
    _lastMilestone: 0,
    stats: { ringReached: ring, score: 0, pins: 0, deaths: 0 },
    events: [],
  };

  run.cores = buildCores(run);
  run.nextHeavy = ((run.totalPins + 1) % PHOTON.OVERLOAD_EVERY) === 0;

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.applyUpgrade = (id) => applyUpgrade(run, id);
  run.jumpTo = (r) => {
    run.ring = clamp(r, 1, RING_COUNT);
    run.ringTarget = ringAt(run.ring).target;
    run.ringPinned = 0;
    run.pinned = [];
    run.combo = 0;
    run.shieldUsed = false;
    run.ringStartTime = run.time;
    run.cores = buildCores(run);
    run.polarityEvery = polarityInterval(run.ring);
    run.polarityTimer = run.polarityEvery;
  };
  run.debugPin = (n, heavy = false) => {
    for (let i = 0; i < n; i += 1) {
      const slot = normAngle((i / Math.max(1, n)) * Math.PI * 2);
      run.pinned.push({ id: run.nextId++, coreId: run.cores[0].id, slot, r: heavy ? PHOTON.HEAVY_R : PHOTON.R, heavy, value: heavy ? 2 : 1 });
      run.ringPinned += heavy ? 2 : 1;
      run.totalPins += 1;
    }
  };
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  // 核心自转 / 公转 / 摇摆 / 变速
  updateCores(run, dt);

  // 极性反转
  updatePolarity(run);

  // 发射
  if (input.fire && !run.photon) {
    firePhoton(run);
  }

  // 光子飞行 / 碰撞 / 钉入
  updatePhoton(run, dt);

  // 反馈密度：核心每 tick 旋转（无死时间基线）+ 每 5 钉里程碑
  emit(run, 'spin', { ring: run.ring });
  const mile = Math.floor(run.totalPins / 5);
  if (mile > run._lastMilestone) {
    run._lastMilestone = mile;
    emit(run, 'milestone', { pins: run.totalPins });
  }

  run.stats.score = run.score;
  run.stats.pins = run.totalPins;
}

// ---------- 核心构建 / 更新 ----------
function coreRadius(form, mods) {
  const R = form === 'twin' ? TWIN.R : CORE.R;
  return R * (mods.biggerCore ? 1.08 : 1);
}

function buildCores(run) {
  const def = ringAt(run.ring);
  const mods = run.mods;
  const R = coreRadius(def.form, mods);
  const omegaBase = def.omega * (mods.slowCore ? 0.88 : 1);
  const fp = def.formParams || {};
  const common = {
    form: def.form,
    baseX: WORLD.CORE_X,
    baseY: WORLD.CORE_Y,
    R,
    omegaBase,
    rotation: START_PHASE,
    swingAmp: fp.swingAmp ?? 0,
    swingFreq: fp.swingFreq ?? 0,
    swingPhase: 0,
    varAmp: fp.varAmp ?? 0,
    varFreq: fp.varFreq ?? 0,
  };
  if (def.form === 'twin') {
    return [
      { ...common, id: run.nextId++, orbitPhase: 0, x: WORLD.CORE_X, y: WORLD.CORE_Y, omega: omegaBase },
      { ...common, id: run.nextId++, orbitPhase: Math.PI, x: WORLD.CORE_X, y: WORLD.CORE_Y, omega: omegaBase },
    ];
  }
  return [{ ...common, id: run.nextId++, orbitPhase: 0, x: WORLD.CORE_X, y: WORLD.CORE_Y, omega: omegaBase }];
}

function coreOmega(core, t) {
  if (core.varAmp > 0) {
    return core.omegaBase * (1 + core.varAmp * Math.sin(core.varFreq * t));
  }
  return core.omegaBase;
}

function updateCores(run, dt) {
  const t = run.time;
  const orbitAngle = TWIN.ORBIT_OMEGA * t;
  for (const c of run.cores) {
    c.omega = coreOmega(c, t);
    c.rotation = normAngle(c.rotation + c.omega * dt);
    if (c.form === 'twin') {
      c.x = c.baseX + TWIN.ORBIT_R * Math.cos(orbitAngle + c.orbitPhase);
      c.y = c.baseY + TWIN.ORBIT_R * Math.sin(orbitAngle + c.orbitPhase);
    } else if (c.form === 'swing') {
      c.x = c.baseX + c.swingAmp * Math.sin(c.swingFreq * t + c.swingPhase);
      c.y = c.baseY;
    } else {
      c.x = c.baseX;
      c.y = c.baseY;
    }
  }
}

// ---------- 极性反转 ----------
function polarityInterval(ring) {
  if (ring < POLARITY.ENABLE_RING) return Infinity;
  return clamp(POLARITY.BASE_INTERVAL - (ring - POLARITY.ENABLE_RING) * POLARITY.PER_RING, POLARITY.MIN_INTERVAL, POLARITY.BASE_INTERVAL);
}

function updatePolarity(run) {
  if (run.polarityEvery === Infinity) return;
  run.polarityTimer -= STEP;
  if (run.polarityTimer > 0) return;
  run.polarityTimer = run.polarityEvery;

  // 换向
  for (const c of run.cores) c.omegaBase = -c.omegaBase;
  emit(run, 'polarityReversal', { ring: run.ring });

  // 吸入已钉光子（polarityResist 只换向不吸）
  if (run.mods.polarityResist) return;
  if (run.pinned.length) {
    const victim = run.pinned[Math.floor(run.rng() * run.pinned.length)];
    const pos = pinnedPos(run, victim);
    removePinned(run, victim);
    run.ringPinned = Math.max(0, run.ringPinned - (victim.value ?? 1));
    emit(run, 'photonSuck', { x: pos.x, y: pos.y });
  }
}

function removePinned(run, p) {
  run.pinned = run.pinned.filter((x) => x.id !== p.id);
}

// ---------- 发射 / 光子 ----------
function firePhoton(run) {
  const heavy = run.nextHeavy;
  run.photon = {
    id: run.nextId++,
    x: WORLD.LAUNCH_X,
    y: WORLD.PHOTON_START_Y,
    r: heavy ? PHOTON.HEAVY_R : PHOTON.R,
    heavy,
  };
  run.nextHeavy = false;
  emit(run, 'shot', { heavy });
}

function photonSpeed(run) {
  return PHOTON.SPEED * (run.mods.pinSpeed ? 1.18 : 1);
}

function updatePhoton(run, dt) {
  const ph = run.photon;
  if (!ph) return;
  ph.y -= photonSpeed(run) * dt;

  // 1) 碰撞已钉光子 → 判负（护盾 / grace 可抵消一次）
  for (const p of run.pinned) {
    const pos = pinnedPos(run, p);
    const d = Math.hypot(ph.x - pos.x, ph.y - pos.y);
    if (d < ph.r + p.r) {
      const canForgive = run.mods.shield && !run.shieldUsed
        || (run.mods.grace && (run.time - run.ringStartTime) < GRACE_SEC);
      if (canForgive) {
        if (run.mods.shield && !run.shieldUsed) run.shieldUsed = true;
        run.photon = null;
        emit(run, 'shieldSave', { x: pos.x, y: pos.y });
        return;
      }
      die(run, pos);
      return;
    }
  }

  // 2) 触达能量核边缘 → 钉入（选最近的核）
  let stickCore = null;
  let stickDist = Infinity;
  for (const c of run.cores) {
    const d = Math.hypot(ph.x - c.x, ph.y - c.y);
    if (d <= c.R + ph.r && d < stickDist) {
      stickDist = d;
      stickCore = c;
    }
  }
  if (stickCore) {
    stickPhoton(run, ph, stickCore);
    return;
  }

  // 3) 飞出屏幕顶部（理论上不会发生，兜底回收）
  if (ph.y < -40) {
    run.photon = null;
    emit(run, 'miss', {});
  }
}

function stickPhoton(run, ph, core) {
  const slot = normAngle(Math.atan2(ph.y - core.y, ph.x - core.x) - core.rotation);
  const value = ph.heavy ? (run.mods.heavyBonus ? 3 : 2) : 1;
  const x = ph.x;
  const y = ph.y;
  const pinned = { id: run.nextId++, coreId: core.id, slot, r: ph.r, heavy: ph.heavy, value };
  run.pinned.push(pinned);
  run.ringPinned += value;
  run.totalPins += 1;
  run.combo += 1;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;

  // 擦肩：落在已占空档旁（近距落点）
  let near = false;
  let nearest = Infinity;
  for (const p of run.pinned) {
    if (p.id === pinned.id) continue;
    const d = Math.abs(angDist(slot, p.slot));
    if (d < nearest) nearest = d;
  }
  if (nearest < (2 + NEAR_MISS_EXTRA) * slotHalf(ph.r, core.R)) {
    near = true;
    run.combo = run.mods.comboBank || run.mods.ghostSlot ? run.combo : 0;
    emit(run, 'nearMiss', { x, y, slot });
  }

  emit(run, ph.heavy ? 'heavyPin' : 'pin', { x, y, slot, heavy: !!ph.heavy, near });

  // 得分
  const resonance = run.mods.resonance ? 1.3 : 1;
  let gained = (ph.heavy ? SCORE.HEAVY_PIN : SCORE.PIN) * run.ring * resonance;
  if (run.mods.comboBank) gained += run.combo * 2;
  run.score += Math.round(gained);
  if (near) run.score += SCORE.NEAR_MISS * (run.mods.ghostSlot ? 3 : 1);

  run.photon = null;
  run.nextHeavy = ((run.totalPins + 1) % PHOTON.OVERLOAD_EVERY) === 0;
  if (run.nextHeavy) emit(run, 'overloadReady', {});

  // 清环
  if (run.ringPinned >= run.ringTarget) clearRing(run);
}

function clearRing(run) {
  emit(run, 'ringClear', { ring: run.ring, score: run.score });
  run.score += SCORE.RING_CLEAR * run.ring;
  run.stats.ringReached = Math.max(run.stats.ringReached, run.ring + 1);
  run.ring += 1;
  if (run.ring > RING_COUNT) {
    run.phase = 'won';
    emit(run, 'win', { score: run.score });
    return;
  }
  run.ringPinned = 0;
  run.pinned = [];
  run.combo = 0;
  run.shieldUsed = false;
  run.ringTarget = ringAt(run.ring).target;
  run.ringStartTime = run.time;
  run.cores = buildCores(run);
  run.polarityEvery = polarityInterval(run.ring);
  run.polarityTimer = run.polarityEvery;
  emit(run, 'sceneEnter', { ring: run.ring, scene: ringAt(run.ring).scene });
}

// ---------- 判负 / 通关 ----------
function die(run, pos) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.photon = null;
  run.stats.deaths = 1;
  emit(run, 'death', { x: pos ? pos.x : WORLD.CORE_X, y: pos ? pos.y : WORLD.CORE_Y });
}

// ---------- 升级 ----------
function applyUpgrade(run, id) {
  const up = UPGRADES_BY_ID[id];
  if (!up) return false;
  run.mods[id] = true;
  run.upgradeIds.push(id);
  if (id === 'biggerCore' || id === 'slowCore') {
    run.cores = buildCores(run); // 几何/转速类升级重建核心
  }
  emit(run, 'upgradeChosen', { id });
  return true;
}

// ---------- 位置 / HUD / 事件 ----------
function coreById(run, id) {
  for (const c of run.cores) if (c.id === id) return c;
  return run.cores[0];
}

export function pinnedPos(run, p) {
  const c = coreById(run, p.coreId);
  const a = c.rotation + p.slot;
  return { x: c.x + c.R * Math.cos(a), y: c.y + c.R * Math.sin(a) };
}

function getHud(run) {
  const scene = sceneAt(run.ring);
  return {
    ring: run.ring,
    ringTotal: RING_COUNT,
    ringPinned: run.ringPinned,
    ringTarget: run.ringTarget,
    score: run.score,
    combo: run.combo,
    nextHeavy: run.nextHeavy,
    scene: scene.id,
    sceneKey: scene.key,
    sceneLabel: scene.label,
    omega: run.cores[0] ? run.cores[0].omega : 0,
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
