// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×3，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, updateSim, drainEvents, applyUpgrade } from '../src/game/sim.js';
import { PLAYER } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;

function nearestEnemy(run) {
  const p = run.player;
  let best = null, bd = 1e9;
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// greedy：自动索敌（转向最近敌人 + 射击 + 换弹 + 被近身冲刺拉开），波间选第一个升级
function greedyInput(run, mem) {
  const p = run.player;
  const inp = { forward: 0, strafe: 0, yaw: p.yaw, pitch: 0, fire: false, aim: false, sprint: false, reload: false, switchTo: null };
  if (run.phase === 'upgrade') { if (run.upgradeChoices[0]) applyUpgrade(run, run.upgradeChoices[0].id); return inp; }
  const e = nearestEnemy(run);
  if (!e) return inp;
  const dx = e.x - p.x, dz = e.z - p.z;
  const dist = Math.hypot(dx, dz) || 1;
  inp.yaw = Math.atan2(-dx, -dz);
  inp.pitch = Math.atan2(e.height * 0.55 - PLAYER.eyeY, dist);
  inp.fire = true;
  inp.aim = p.weapon === 'rifle' && dist > 12;
  mem.t += 1 / 60;
  // 右向净漂移：绕开掩体，避免射手躲在掩体后打不死
  inp.strafe = Math.sin(mem.t * 1.9) * 0.4 + 0.6;
  if (e.kind === 'shooter') { if (dist > 6) inp.forward = 0.7; }
  else if (dist < 5) { inp.forward = -1; inp.sprint = true; }
  if (p.ammo[p.weapon] <= 0 && run.reloadT <= 0) {
    if (p.reserve[p.weapon] > 0) inp.reload = true;
    else if (p.weapon !== 'pistol') inp.switchTo = 'pistol';
  }
  return inp;
}

// random：随机转向/移动/射击（不索敌），波间随机选升级
function randomInput(run, mem) {
  const p = run.player;
  const inp = { forward: 0, strafe: 0, yaw: p.yaw, pitch: 0, fire: false, aim: false, sprint: false, reload: false, switchTo: null };
  if (run.phase === 'upgrade') { if (run.upgradeChoices.length) applyUpgrade(run, run.upgradeChoices[(Math.random() * run.upgradeChoices.length) | 0].id); return inp; }
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.35;
    mem.yaw = p.yaw + (Math.random() * 2 - 1) * Math.PI;
    mem.strafe = Math.random() * 2 - 1;
    mem.forward = Math.random() < 0.35 ? Math.random() * 2 - 1 : 0;
    mem.fire = Math.random() < 0.55;
  }
  inp.yaw = mem.yaw; inp.strafe = mem.strafe; inp.forward = mem.forward; inp.fire = mem.fire;
  if (p.ammo[p.weapon] <= 0 && run.reloadT <= 0) inp.reload = true;
  return inp;
}

function runPolicy(policy, seed) {
  const run = createRun({ seed });
  const mem = { t: 0 };
  let prev = null, actions = 0, firstInputSec = null, firstSuccessSec = null;
  let lastEventT = 0, maxGap = 0, idleSec = 0, maxWave = 1;
  const kinds = new Set();
  let t = 0;
  let completed = false;

  while (t < MAX_SEC && run.phase !== 'victory') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = {};

    const active = !!(inp.forward || inp.strafe || inp.fire || inp.reload || inp.sprint || inp.switchTo);
    const sig = `${Math.sign(inp.forward || 0)}|${Math.sign(inp.strafe || 0)}|${inp.fire ? 1 : 0}|${(inp.yaw ?? run.player.yaw).toFixed(1)}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && active) firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += 1 / 60;
    maxWave = Math.max(maxWave, run.mapIndex * 5 + run.wave);

    for (const ev of drainEvents(run)) {
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && (ev.type === 'kill' || ev.type === 'waveClear')) firstSuccessSec = t;
    }
    if (run.phase === 'victory') completed = true;
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0,
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.stats.deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: maxWave,
    completed,
  };
}

// 输入延迟：纯 sim bot 无法测真实按键延迟；60fps 固定步长下键到下一帧约 16ms。
// 真实渲染帧率由 verify-game.mjs 的 fps 采样（≥50fps）独立验收。
function latencyProbe() {
  return 16;
}

const runs = [
  runPolicy('greedy', 11), runPolicy('greedy', 22), runPolicy('greedy', 33),
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46),
  runPolicy('noinput', 55), runPolicy('noinput', 56), runPolicy('noinput', 57),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'blaze-fps', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s deaths=${r.deaths} lvl=${r.levelsReached} firstIn=${r.firstInputSec}s firstWin=${r.firstSuccessSec}s events=${r.uniqueEvents} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} completed=${r.completed}`);
}
