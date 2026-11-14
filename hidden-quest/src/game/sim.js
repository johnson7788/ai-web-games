// 纯逻辑：场景生成（目标物 + 干扰物）+ 点击寻物 + 提示 + 计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { OBJECT_TYPES } from '../../config/objects.js';
import { SCENE, RULES } from '../../config/game.config.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uid = 0;
function placeObject(rng, objects, type, isTarget) {
  const r = RULES.objectRadius;
  const pad = r + 6;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const x = SCENE.X + pad + rng() * (SCENE.W - 2 * pad);
    const y = SCENE.Y + pad + rng() * (SCENE.H - 2 * pad);
    let ok = true;
    for (const o of objects) {
      if (Math.hypot(o.x - x, o.y - y) < r * 2 + 8) { ok = false; break; }
    }
    if (ok) {
      uid += 1;
      const obj = { id: uid, type, x, y, found: false, isTarget };
      objects.push(obj);
      return obj;
    }
  }
  return null;
}

export function createRun({ level = 1, seed = 1 } = {}) {
  const rng = makeRng(seed + level * 7919);
  const types = shuffle(OBJECT_TYPES.map((t) => t.id), rng);
  const targets = types.slice(0, RULES.targetsPerLevel);
  const decoyTypes = types.slice(RULES.targetsPerLevel);
  const objects = [];
  for (const t of targets) placeObject(rng, objects, t, true);
  const decoyCount = Math.min(RULES.maxDecoys, RULES.decoysBase + (level - 1) * RULES.decoysPerLevel);
  for (let i = 0; i < decoyCount; i += 1) {
    const t = decoyTypes[Math.floor(rng() * decoyTypes.length)];
    placeObject(rng, objects, t, false);
  }
  return {
    level,
    seed,
    objects,
    targets,
    found: new Set(),
    score: 0,
    hintsUsed: 0,
    hintTarget: null,
    phase: 'playing',
    events: [],
    rng,
  };
}

export function objectAt(run, x, y) {
  const r = RULES.objectRadius + 4;
  for (const o of run.objects) {
    if (!o.found && Math.hypot(o.x - x, o.y - y) <= r) return o;
  }
  return null;
}

export function clickAt(run, x, y) {
  if (run.phase !== 'playing') return { ok: false };
  const o = objectAt(run, x, y);
  if (!o) return { ok: false, kind: 'empty' };
  if (o.isTarget && !o.found) {
    o.found = true;
    run.found.add(o.type);
    run.score += RULES.scorePerFind;
    run.hintTarget = null;
    run.events.push({ type: 'find', id: o.id, objectType: o.type, x: o.x, y: o.y });
    let clear = false;
    if (run.found.size >= run.targets.length) {
      run.phase = 'clear';
      clear = true;
      run.events.push({ type: 'clear', level: run.level, score: run.score });
    }
    return { ok: true, kind: 'find', clear };
  }
  run.score = Math.max(0, run.score - RULES.wrongPenalty);
  run.events.push({ type: 'wrong', x: o.x, y: o.y });
  return { ok: false, kind: 'wrong' };
}

export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  const remaining = run.objects.filter((o) => o.isTarget && !o.found);
  if (remaining.length === 0) return null;
  const pick = remaining[Math.floor(run.rng() * remaining.length)];
  run.hintsUsed += 1;
  run.hintTarget = pick.id;
  run.events.push({ type: 'hint', id: pick.id });
  return pick;
}

export function nextLevel(run) {
  const fresh = createRun({ level: run.level + 1, seed: run.seed });
  fresh.score = run.score;
  Object.assign(run, fresh);
}

export function getHud(run) {
  return {
    level: run.level,
    score: run.score,
    found: run.found.size,
    total: run.targets.length,
    targets: run.targets,
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    phase: run.phase,
    objects: run.objects.length,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}