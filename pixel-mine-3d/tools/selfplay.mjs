// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, getHud, drainEvents, buyUpgrade, recallToCamp } from '../src/game/sim.js';
import { WORLD, T, UPGRADES } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;
const SHAFT = { x: WORLD.SPAWN[0], z: WORLD.SPAWN[2] }; // 竖井列（也是软石裂缝）
const ORE = new Set([T.COAL, T.IRON, T.GOLD, T.DIAMOND, T.TREASURE]);
const idx = (x, y, z) => (y * WORLD.W + x) * WORLD.D + z;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function oreAt(run, x, y, z) {
  if (x < 0 || x >= WORLD.W || z < 0 || z >= WORLD.D || y < 0 || y >= WORLD.H) return 0;
  const t = run.blocks[idx(x, y, z)];
  return ORE.has(t) ? t : 0;
}
function pickOre(run, bx, by, bz) {
  const cands = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const t = oreAt(run, bx + dx, by + dy, bz + dz);
    if (t) cands.push({ t, pos: [bx + dx, by + dy, bz + dz] });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.t - a.t); // 越值钱越先挖
  return cands[0].pos;
}

function buyUpgrades(run) {
  const order = ['pick', 'pack', 'stamina', 'lamp', 'vein', 'double', 'smelt', 'sort', 'lava'];
  for (const id of order) {
    const u = UPGRADES[id];
    const stat = u.levels != null;
    const cur = run.upgrades[id];
    if (stat ? cur >= u.levels : cur) continue;
    const cost = stat ? u.costs[cur] : u.cost;
    if (run.coins >= cost) buyUpgrade(run, id);
  }
}

function greedyInput(run, mem) {
  const p = run.player;
  const hud = getHud(run);
  const inp = { yaw: 0, pitch: -0.2, f: 0, s: 0, jump: false, mine: false, place: false, target: null };
  const moveTo = (tx, tz) => {
    const dx = tx - p.x, dz = tz - p.z;
    const len = Math.hypot(dx, dz) || 1;
    inp.f = -dz / len; inp.s = dx / len;
  };
  const shaftTx = SHAFT.x + 0.5, shaftTz = SHAFT.z + 0.5;
  const distShaft = Math.hypot(shaftTx - p.x, shaftTz - p.z);
  const padTx = WORLD.SELL[0] + 0.5, padTz = WORLD.SELL[2] + 0.5;
  const distPad = Math.hypot(padTx - p.x, padTz - p.z);

  // 背包快满 → 回营地卖（传送回卖矿台，自动结算）
  if (hud.inv >= hud.capacity - 2) {
    if (hud.inv > 0) recallToCamp(run, true);
    return inp;
  }
  // 在营地且背包空 → 买升级
  if (hud.inv === 0 && distPad < 3) buyUpgrades(run);
  // 已下井或贴紧竖井中心 → 挖矿（优先相邻矿脉；体力低时站立回复）
  const inShaft = p.y < -0.4 || distShaft < 0.15;
  if (!inShaft) { moveTo(shaftTx, shaftTz); return inp; }
  if (hud.stamina < 25) return inp; // 站立回复
  const by = clamp(Math.floor(-p.y + 1e-9), 0, WORLD.H - 1);
  inp.target = pickOre(run, SHAFT.x, by, SHAFT.z) || [SHAFT.x, by, SHAFT.z];
  inp.mine = true;
  return inp;
}

function randomInput(run, mem) {
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.5;
    mem.rnd = { f: Math.random() * 2 - 1, s: Math.random() * 2 - 1, mine: Math.random() < 0.5 };
  }
  const p = run.player;
  const target = mem.rnd.mine
    ? [clamp(Math.floor(p.x) + Math.floor(Math.random() * 3 - 1), 0, WORLD.W - 1),
       clamp(Math.floor(-p.y + 1e-9), 0, WORLD.H - 1),
       clamp(Math.floor(p.z) + Math.floor(Math.random() * 3 - 1), 0, WORLD.D - 1)]
    : null;
  return { yaw: 0, pitch: -0.2, f: mem.rnd.f, s: mem.rnd.s, jump: false, mine: !!target, place: false, target };
}

function runPolicy(policy, seed) {
  const run = createSim({ seed, bestDepth: 0 });
  const mem = { state: 'dig', t: 0, rnd: { f: 0, s: 0, mine: false } };
  const events = [];
  const kinds = new Set();
  let actions = 0, prevSig = null;
  let firstInputSec = null, firstSuccessSec = null;
  let lastEventT = 0, maxGap = 0, idleSec = 0, maxLevel = 1, maxDepth = 0;
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { yaw: 0, pitch: 0, f: 0, s: 0, jump: false, mine: false, place: false, target: null };

    const active = !!(inp.f || inp.s || inp.mine || inp.jump || inp.target);
    if (active && firstInputSec == null) firstInputSec = t;
    const sig = `${inp.f || 0}|${inp.s || 0}|${inp.mine ? 1 : 0}|${inp.jump ? 1 : 0}|${inp.target ? inp.target.join(',') : ''}`;
    if (prevSig !== null && sig !== prevSig) actions++;
    prevSig = sig;

    updateSim(run, inp);
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t: +t.toFixed(2), type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (ev.type === 'sell' && firstSuccessSec == null) firstSuccessSec = t;
    }
    const hud = getHud(run);
    maxLevel = Math.max(maxLevel, hud.level);
    maxDepth = Math.max(maxDepth, hud.depth);
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const hud = getHud(run);
  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: +(firstInputSec == null ? t : firstInputSec).toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.stats.deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: maxLevel,
    completed: run.phase === 'finished',
    progressRate: +clamp(maxDepth / 40, 0, 1).toFixed(2),
    score: hud.coins,
    maxDepth: Math.floor(maxDepth),
    earned: run.stats.earned,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { chromium = require(c).chromium; break; } catch { /* next */ }
    }
    if (!chromium) throw new Error('playwright not found');
    const { spawn } = await import('node:child_process');
    const py = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => py.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(60); }
    const lat = await page.evaluate(() => window.__lat);
    await browser.close();
    py.kill();
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : 16;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    return 16;
  }
}

const runs = [
  runPolicy('greedy', 11), runPolicy('greedy', 22), runPolicy('greedy', 33),
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46),
  runPolicy('noinput', 55), runPolicy('noinput', 56),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), `${JSON.stringify({ game: 'pixel-mine-3d', genre: 'sim', source: 'bot', runs }, null, 2)}\n`);
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s sell=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} events=${r.uniqueEvents} lvl=${r.levelsReached} depth=${r.maxDepth} coins=${r.score} gap=${r.maxEventGapSec.toFixed(1)}s idle=${r.idleSec.toFixed(1)}s latency=${r.inputLatencyMs}ms`);
}
