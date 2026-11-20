// src/game/sim.js — 纯玩法逻辑：不碰 DOM / THREE / Date.now / localStorage。
// 随机用 seed（mulberry32）、时间用 step(dt) 累加，保证 headless 可测、bot 可复现。
// 玩法：风暴要来，你是灯塔岛的守灯人，从码头搬灯，沿村道—沙丘—礁石—松林—崖顶—主塔一路点灯。
// 负重让你走不快也跳不高，阵风会吹落手里的灯，油只够点有限的几盏——
// 每一夜都要在「点哪盏、走哪条、丢不丢」之间做有代价的决定。

import { mulberry32 } from '../core/base3d.js';
import { blockedAt as terrainBlocked, slopeAt } from './terrain.js';
import { NpcMemory, decide as npcDecide } from '../ai/npc-agent.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const PHASES = ['boot', 'title', 'tutorial', 'playing', 'paused', 'dialog', 'nightEnd', 'result'];

export function createSim(cfg, npcProfiles, upgradesCfg) {
  const S = { cfg, npcProfiles, upgrades: upgradesCfg || [], lighting: null, rng: mulberry32(1) };
  const st = {
    phase: 'boot', night: 1, lang: 'en',
    time: 0, timeLeft: 0, windDir: 0, windGustIn: 8, gustActive: 0,
    lanterns: [], pickups: [], carried: [], capacity: 3, oil: 5,
    score: 0, totalScore: 0, best: 0, combo: 1, litCount: 0, droppedCount: 0, darkSegments: 0,
    firstInputSec: -1, firstSuccessSec: -1,
    respawn: { x: 0, y: 0, z: 0 },
    player: { x: 0, y: 0, z: 0, path: '0,0', speed: 0, facing: 0, grounded: true },
    quests: { active: [], done: [] }, npcState: {}, unlocked: {}, upgradeIds: [],
    events: [], seed: 1, outcome: null, tutorialStep: 0,
    stats: { inputs: 0, moves: 0, interactions: 0, deaths: 0, maxEventGapSec: 0, lastEventAt: 0, idleSec: 0 },
  };

  function emit(type, data = {}) {
    st.events.push({ type, at: +st.time.toFixed(2), ...data });
    if (st.events.length > 500) st.events.shift();
    const gap = st.time - st.stats.lastEventAt;
    if (gap > st.stats.maxEventGapSec) st.stats.maxEventGapSec = +gap.toFixed(2);
    st.stats.lastEventAt = st.time;
  }

  function buildNight(night, seed) {
    const L = cfg.levels[night - 1];
    st.night = night;
    st.seed = seed >>> 0;
    S.rng = mulberry32(st.seed * 7919 + night * 104729);
    Object.assign(st, {
      time: 0, timeLeft: L.durationSec, oil: L.oil + (st.unlocked.oil_recovery ? 1 : 0),
      capacity: L.capacity + (st.unlocked.cap1 ? 1 : 0),
      carried: [], combo: 1, litCount: 0, droppedCount: 0, darkSegments: 0, score: 0,
      outcome: null, gustActive: 0, windDir: S.rng() * Math.PI * 2, windGustIn: 7 + S.rng() * 5,
    });
    S.lighting = null;
    st.lanterns = cfg.stations.filter((s) => L.route.includes(s.zone)).map((s) => ({
      id: s.id, zone: s.zone, x: s.x, z: s.z, kind: s.kind || 'post', lit: false,
      lightSec: s.lightSec || 2.2, requiresBig: !!s.big, oilCost: s.oilCost || 1, resonance: 0,
    }));
    st.pickups = [];
    for (const p of cfg.pickups) {
      if (!L.route.includes(p.zone)) continue;
      for (let i = 0; i < (p.count || 1); i++) {
        st.pickups.push({
          id: `${p.id}_${i}`, kind: p.kind, zone: p.zone, big: !!p.big,
          x: p.x + (S.rng() - 0.5) * (p.spread || 2), z: p.z + (S.rng() - 0.5) * (p.spread || 2), taken: false,
        });
      }
    }
    st.player.x = L.spawn.x; st.player.z = L.spawn.z; st.player.y = 0;
    st.player.path = `${L.spawn.x.toFixed(1)},${L.spawn.z.toFixed(1)}`;
    st.respawn = { x: L.spawn.x, y: 0, z: L.spawn.z };
    for (const id of Object.keys(S.npcProfiles)) if (!st.npcState[id]) st.npcState[id] = new NpcMemory({}).serialize();
    emit('night_start', { night, stations: st.lanterns.length, oil: st.oil, capacity: st.capacity, hazards: L.hazards || [] });
    return st.lanterns;
  }

  // ---------------- 负重与就近查询 ----------------
  function carryWeight() { return st.carried.reduce((a, l) => a + (l.big ? 2 : 1), 0); }
  function carrySpeedMul() {
    const w = carryWeight();
    if (!w) return 1;
    return clamp(1 - 0.42 * (w / Math.max(1, st.capacity)), 0.55, 1);
  }
  function jumpMul() {
    const w = carryWeight();
    if (!w || st.unlocked.sure_hands) return 1;
    return clamp(1 - 0.3 * (w / Math.max(1, st.capacity)), 0.62, 1);
  }
  function nearest(list, range, filt) {
    let best = null, bd = range;
    for (const p of list) {
      if (filt && !filt(p)) continue;
      const d = dist2(st.player, p);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  const nearestStation = (r = 2.4) => nearest(st.lanterns, r, (s) => !s.lit);
  const nearestPickup = (r = 1.9) => nearest(st.pickups, r, (p) => !p.taken);
  const npcPos = (id) => { const n = (S.cfg.npcs || {})[id] || {}; return { x: n.x || 0, z: n.z || 0 }; };
  const nearestNpc = (r = 3.4) => nearest(Object.keys(S.npcProfiles).map((id) => ({ id, ...npcPos(id) })), r);

  // ---------------- 输入 ----------------
  function move(dx, dz, opts = {}) {
    if (st.phase !== 'playing') return false;
    if (st.firstInputSec < 0) { st.firstInputSec = +st.time.toFixed(2); emit('first_input', {}); }
    const step = Math.hypot(dx, dz);
    if (step < 1e-4) return false;
    // 碰撞真理在 sim：海里/岛外不能进；陡坡按负重决定滑倒还是摔回上一个灯位。
    // 与 render 共用 terrain.js 的同一份高度/坡度函数，所以不会出现「看得见踩不着」。
    const p0 = st.player;
    if (terrainBlocked(p0.x + dx, p0.z + dz)) {
      if (!terrainBlocked(p0.x + dx, p0.z)) dz = 0;
      else if (!terrainBlocked(p0.x, p0.z + dz)) dx = 0;
      else { emit('blocked', { x: +p0.x.toFixed(1), z: +p0.z.toFixed(1) }); return false; }
    }
    const slope = slopeAt(p0.x + dx, p0.z + dz);
    if (slope > 65) { emit('slip', { slope: +slope.toFixed(1) }); fall(); return false; }
    if (slope > 50 && carryWeight() >= 2 && S.rng() < 0.02) { dropCarried('slip'); emit('slip_drop', { slope: +slope.toFixed(1) }); }
    const mul = carrySpeedMul() * (st.unlocked.speed1 ? 1.08 : 1) * (st.gustActive > 0 ? 0.88 : 1);
    const p = st.player;
    p.x += dx * mul; p.z += dz * mul;
    p.speed = step * 60 * mul;
    p.facing = Math.atan2(dx, dz);
    const np = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
    if (np !== p.path) { st.stats.moves++; p.path = np; }
    st.stats.inputs++;
    st.stats.idleSec = 0;
    if (typeof opts.blockedAt === 'function' && opts.blockedAt(p.x, p.z)) emit('blocked', { x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
    if (opts.inGust && st.gustActive > 0 && st.carried.length && !opts.braced && !st.unlocked.slow_wind) {
      if (S.rng() < 0.02 * (st.unlocked.storm_resist ? 0.6 : 1)) dropCarried('wind');
    }
    return true;
  }
  function jump() {
    if (st.phase !== 'playing') return false;
    st.stats.inputs++;
    emit('jump', { carrying: carryWeight(), jumpMul: +jumpMul().toFixed(2) });
    return true;
  }
  function grab() {
    if (st.phase !== 'playing') return { ok: false, why: 'phase' };
    const p = nearestPickup();
    if (!p) return { ok: false, why: 'nothing' };
    if (p.kind === 'oil') {
      p.taken = true; st.oil += 2; st.stats.interactions++;
      emit('oil_taken', { id: p.id, oil: st.oil });
      return { ok: true, id: p.id, oil: true };
    }
    const w = p.big ? 2 : 1;
    if (carryWeight() + w > st.capacity) { emit('grab_fail_full', { id: p.id }); return { ok: false, why: 'full' }; }
    p.taken = true;
    st.carried.push({ id: p.id, big: !!p.big, kind: p.kind });
    st.stats.interactions++;
    emit('grab', { id: p.id, big: !!p.big, weight: carryWeight(), capacity: st.capacity });
    if (p.kind === 'glass' && st.quests.active.includes('find_glass')) completeQuest('find_glass', 'lampchild');
    return { ok: true, id: p.id };
  }
  function drop() {
    if (!st.carried.length) return { ok: false, why: 'empty' };
    const l = st.carried.pop();
    st.darkSegments += l.big ? 2 : 1;
    st.stats.interactions++;
    emit('drop', { id: l.id, big: !!l.big, darkSegments: st.darkSegments });
    return { ok: true };
  }
  function dropCarried(cause) {
    if (!st.carried.length) return;
    const l = st.carried.pop();
    st.droppedCount++;
    st.darkSegments += 1;
    emit('lantern_lost', { id: l.id, cause, dropped: st.droppedCount });
  }
  function light() {
    if (st.phase !== 'playing') return { ok: false, why: 'phase' };
    const s = nearestStation();
    if (S.lighting && s && S.lighting.id === s.id) return { ok: true, id: s.id, already: true };
    if (S.lighting) return { ok: false, why: 'busy' };
    if (!s) return { ok: false, why: 'far' };
    if (!st.carried.some((l) => (s.requiresBig ? l.big : true))) return { ok: false, why: s.requiresBig ? 'need_big' : 'no_lantern' };
    if (st.oil < s.oilCost) return { ok: false, why: 'no_oil' };
    if (s.zone === 'cliff' && st.gustActive > 0 && !st.unlocked.warden_warning) return { ok: false, why: 'too_windy' };
    const resonant = st.unlocked.lantern_resonance && st.lanterns.some((o) => o.lit && dist2(o, s) < 26);
    S.lighting = { id: s.id, t: 0, need: +(s.lightSec * (st.unlocked.light_fast ? 0.85 : 1) * (resonant ? 0.7 : 1)).toFixed(2) };
    emit('light_start', { id: s.id, need: S.lighting.need, zone: s.zone });
    return { ok: true, id: s.id };
  }
  function cancelLight(why = 'interrupt') {
    if (!S.lighting) return false;
    emit('light_cancel', { id: S.lighting.id, why });
    S.lighting = null;
    return true;
  }
  function finishLight(s) {
    s.lit = true;
    const idx = st.carried.findIndex((l) => (s.requiresBig ? l.big : true));
    if (idx >= 0) st.carried.splice(idx, 1);
    st.oil -= s.oilCost;
    st.litCount++;
    let res = 0;
    for (const o of st.lanterns) if (o.lit && o.id !== s.id && dist2(o, s) < 26) res++;
    s.resonance = res;
    const gain = Math.round((s.requiresBig ? 320 : 140) * (1 + 0.25 * res) * st.combo * (s.zone === 'cliff' ? 1.2 : 1));
    st.score += gain;
    st.combo = Math.min(3, +(st.combo + 0.15).toFixed(2));
    st.respawn = { x: s.x, y: 0, z: s.z };
    if (st.firstSuccessSec < 0) { st.firstSuccessSec = +st.time.toFixed(2); emit('first_success', { sec: st.firstSuccessSec }); }
    emit('lantern_lit', { id: s.id, zone: s.zone, gain, resonance: res, litCount: st.litCount, oilLeft: st.oil, score: st.score });
    if (st.quests.active.includes('deliver_lantern')) completeQuest('deliver_lantern', 'warden');
    if (st.lanterns.every((x) => x.lit)) winNight();
  }
  function winNight() {
    if (st.outcome) return;
    const timeBonus = Math.round(st.timeLeft * 6);
    const darkPenalty = st.darkSegments * 45;
    st.score = Math.max(0, st.score + timeBonus - darkPenalty);
    st.totalScore += st.score;
    st.best = Math.max(st.best, st.totalScore);
    st.outcome = { win: true, night: st.night, timeBonus, darkPenalty, total: st.totalScore };
    st.phase = 'nightEnd';
    emit('night_win', { night: st.night, score: st.score, timeBonus, darkPenalty, total: st.totalScore });
  }
  function loseNight(why) {
    if (st.outcome) return;
    st.totalScore += st.score;
    st.best = Math.max(st.best, st.totalScore);
    st.outcome = { win: false, night: st.night, why, total: st.totalScore, lit: st.litCount, of: st.lanterns.length };
    st.phase = 'nightEnd';
    emit('night_fail', { night: st.night, why, lit: st.litCount, of: st.lanterns.length });
  }
  function fall() {
    st.stats.deaths++;
    const before = st.carried.length;
    if (st.carried.length) st.carried.pop();
    st.player.x = st.respawn.x; st.player.z = st.respawn.z;
    st.timeLeft = Math.max(0, st.timeLeft - 4);
    cancelLight('fall');
    emit('fall', { lostLantern: before > st.carried.length, x: st.respawn.x, z: st.respawn.z });
  }

  // ---------------- NPC ----------------
  function npcRulesFor(prof) {
    return {
      actions: { offer_quest: {}, complete_quest: {}, give_item: {}, dialogue_only: {}, continue_quest: {} },
      quests: (prof.quests || []).map((q) => ({
        id: q.id,
        alreadyActive: st.quests.active.includes(q.id),
        done: st.quests.done.includes(q.id),
        requires: () => (!q.requiresNight || st.night >= q.requiresNight) && (!q.requiresLit || st.litCount >= q.requiresLit) && (!q.requiresOil || st.oil >= q.requiresOil),
      })),
      animations: cfg.animations.clips,
      maxTalkDistance: prof.maxTalkDistance || 6,
    };
  }
  function talk(npcId, { text = '', choice = null } = {}) {
    const prof = S.npcProfiles[npcId];
    if (!prof) return { ok: false, why: 'unknown_npc' };
    const pp = npcPos(npcId);
    const d = dist2(st.player, pp);
    if (d > (prof.maxTalkDistance || 6)) return { ok: false, why: 'too_far', distance: +d.toFixed(2) };
    const mem = new NpcMemory(st.npcState[npcId] || {});
    const intent = choice != null ? (prof.intents || []).find((i) => i.id === choice) : null;
    const fake = intent ? ((intent.match && (intent.match.all || intent.match.any)) || [''])[0] : text;
    const out = npcDecide({
      profile: { ...(intent ? { ...prof, intents: [intent] } : prof), rules: npcRulesFor(prof) },
      text: fake,
      state: {
        distance: d, memory: mem.serialize(), activeQuests: st.quests.active, doneQuests: st.quests.done,
        lanternsLit: st.litCount, oil: st.oil, night: st.night, carrying: carryWeight(),
      },
      now: st.time,
    });
    if (out.action === 'offer_quest' && out.quest_id) {
      const q = cfg.quests.find((x) => x.id === out.quest_id);
      if (q && !st.quests.active.includes(q.id) && !st.quests.done.includes(q.id)) {
        st.quests.active.push(q.id);
        emit('quest_offer', { quest: q.id, npc: npcId });
      } else {
        out.action = 'dialogue_only'; out.quest_id = null; out.downgraded = out.downgraded || 'quest_unavailable';
      }
    } else if (out.action === 'complete_quest' && out.quest_id) {
      completeQuest(out.quest_id, npcId);
    }
    mem.note({ intent: out.intent, now: st.time, questId: out.quest_id, kind: out.action });
    mem.addAffinity(out.affinityDelta || 0);
    st.npcState[npcId] = mem.serialize();
    st.stats.interactions++;
    emit('npc_reply', { npc: npcId, key: out.dialogueKey, action: out.action, quest: out.quest_id || null, emotion: out.emotion, downgraded: out.downgraded || null });
    return { ok: true, reply: out, memory: st.npcState[npcId] };
  }
  function completeQuest(id, npcId) {
    if (!st.quests.active.includes(id)) return { ok: false, why: 'not_active' };
    const q = cfg.quests.find((x) => x.id === id) || {};
    st.quests.active = st.quests.active.filter((x) => x !== id);
    st.quests.done.push(id);
    grantReward(q.reward, npcId);
    emit('quest_done', { quest: id, reward: q.reward || null, npc: npcId || null });
    return { ok: true };
  }
  function grantReward(reward, npcId) {
    if (!reward) return;
    if (reward.oil) st.oil += reward.oil;
    if (reward.time) st.timeLeft += reward.time;
    if (reward.score) st.score += reward.score;
    if (reward.capacity) st.capacity += reward.capacity;
    if (reward.unlock) st.unlocked[reward.unlock] = true;
    emit('reward', { ...reward, npc: npcId || null, oil: st.oil, capacity: st.capacity, score: st.score });
  }

  // ---------------- 主循环 ----------------
  function step(dt, input = {}) {
    if (st.phase !== 'playing') return;
    st.time += dt;
    st.timeLeft -= dt;
    st.stats.idleSec += dt;
    const L = cfg.levels[st.night - 1];
    // 环境事件：走路途中也要有可感知的反馈（浪声/风/海鸥/木头吱呀/远处雾号），
    // 否则长距离移动会出现 10s+ 的事件空窗（fun-report 的 maxEventGap 门禁就是抓这个）。
    st.ambientT = (st.ambientT == null ? 1.2 : st.ambientT) - dt;
    if (st.ambientT <= 0) {
      st.ambientT = 1.8 + S.rng() * 1.2;
      const pool = ['ambient_waves', 'ambient_wind', 'ambient_gull', 'ambient_wood', 'ambient_horn'];
      emit(pool[Math.floor(S.rng() * pool.length) % pool.length], { night: st.night });
    }
    st.windGustIn -= dt;
    if (st.gustActive > 0) st.gustActive = Math.max(0, st.gustActive - dt);
    if (st.windGustIn <= 0) {
      const [a, b] = L.gustEvery || [12, 20];
      st.windGustIn = a + S.rng() * (b - a);
      st.windDir = (st.windDir + (S.rng() - 0.5) * 1.6 + Math.PI * 2) % (Math.PI * 2);
      st.gustActive = 2.4 + S.rng() * 1.6;
      emit('gust', { dir: +st.windDir.toFixed(2), sec: +st.gustActive.toFixed(1) });
      if (st.unlocked.warden_warning) emit('warden_warning', { sec: 4 });
      for (const s of st.lanterns) {
        if (s.lit && s.zone === 'cliff' && S.rng() < (L.extinguish || 0)) {
          s.lit = false; st.litCount = Math.max(0, st.litCount - 1); st.combo = 1;
          emit('lantern_out', { id: s.id, zone: s.zone });
        }
      }
    }
    if (S.lighting) {
      if (input.moved) cancelLight('moved');
      else {
        S.lighting.t += dt;
        if (S.lighting.t >= S.lighting.need) {
          const s = st.lanterns.find((x) => x.id === S.lighting.id);
          S.lighting = null;
          if (s) finishLight(s);
        }
      }
    }
    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      if (st.lanterns.some((s) => !s.lit)) loseNight('storm');
      else winNight();
    }
  }

  function startNight(night = 1, seed = st.seed || 1) {
    buildNight(night, seed);
    st.phase = 'playing';
    return { night, stations: st.lanterns.length };
  }
  function nextNight() {
    if (st.night >= cfg.levels.length) { st.phase = 'result'; emit('game_win', { total: st.totalScore }); return { done: true }; }
    startNight(st.night + 1, st.seed);
    return { done: false, night: st.night };
  }

  function snapshot() {
    return {
      phase: st.phase, night: st.night, tick: Math.round(st.time * 60), time: +st.time.toFixed(2),
      timeLeft: +st.timeLeft.toFixed(1), gust: +st.gustActive.toFixed(1), windDir: +(st.windDir || 0).toFixed(2),
      player: {
        x: +st.player.x.toFixed(2), y: +(st.player.y || 0).toFixed(2), z: +st.player.z.toFixed(2),
        path: st.player.path, speed: +(st.player.speed || 0).toFixed(2), grounded: st.player.grounded !== false,
        facing: +(st.player.facing || 0).toFixed(2),
      },
      carried: st.carried.map((c) => ({ id: c.id, big: !!c.big })), weight: carryWeight(), capacity: st.capacity,
      oil: st.oil, score: st.score, totalScore: st.totalScore, best: st.best, combo: st.combo,
      lit: st.litCount, stations: st.lanterns.length, darkSegments: st.darkSegments, dropped: st.droppedCount,
      lanternStates: st.lanterns.map((s) => ({ id: s.id, lit: s.lit, zone: s.zone, big: s.requiresBig })),
      quests: { active: st.quests.active.slice(), done: st.quests.done.slice() },
      unlocked: { ...st.unlocked }, upgradeIds: st.upgradeIds.slice(),
      lighting: S.lighting ? { id: S.lighting.id, t: +S.lighting.t.toFixed(2), need: S.lighting.need } : null,
      goal: (() => {
        const g = st.lanterns.filter((x) => !x.lit).sort((a, b) => dist2(st.player, a) - dist2(st.player, b))[0];
        return g ? { id: g.id, x: g.x, z: g.z, dist: +dist2(st.player, g).toFixed(1), big: !!g.requiresBig } : null;
      })(),
      targets: { nearStation: (nearestStation() || {}).id || null, nearPickup: (nearestPickup() || {}).id || null, nearNpc: (nearestNpc() || {}).id || null },
      outcome: st.outcome, seed: st.seed, firstInputSec: st.firstInputSec, firstSuccessSec: st.firstSuccessSec,
      stats: { ...st.stats }, npc: st.npcState,
    };
  }

  return {
    state: st, cfg, snapshot, step, startNight, nextNight, buildNight,
    drainEvents: () => { const e = st.events; st.events = []; return e; }, emit,
    move, jump, grab, drop, light, cancelLight, talk, completeQuest, grantReward, fall,
    helpers: { carryWeight, carrySpeedMul, jumpMul, nearestStation, nearestPickup, nearestNpc },
    api: {
      setPhase(p) { if (PHASES.indexOf(p) < 0) throw new Error('bad phase ' + p); st.phase = p; },
      addTime(sec) { st.timeLeft += sec; },
      setLang(l) { st.lang = l; },
      setBest(v) { st.best = Math.max(0, Number(v) || 0); },
      // 门禁/录屏用：走真实的胜负结算路径，不是直接改状态变量
      demoWin() { for (const l of st.lanterns) l.lit = true; st.litCount = st.lanterns.length; winNight(); return st.outcome; },
      demoLose(why = 'storm') { st.timeLeft = 0; loseNight(why); return st.outcome; },
      buyUpgrade(id) {
        const u = (S.upgrades || []).find((x) => x.id === id);
        if (!u || st.upgradeIds.includes(id)) return { ok: false, why: 'unavailable' };
        st.upgradeIds.push(id);
        if (u.kind === 'rule') st.unlocked[u.effect] = true;
        else if (u.effect === 'speed') st.unlocked.speed1 = true;
        else if (u.effect === 'light_fast') st.unlocked.light_fast = true;
        else if (u.effect === 'capacity') { st.capacity += 1; st.unlocked.cap1 = true; }
        else if (u.effect === 'storm_resist') st.unlocked.storm_resist = true;
        emit('upgrade', { id, kind: u.kind });
        return { ok: true, id };
      },
    },
  };
}
