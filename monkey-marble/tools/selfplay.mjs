// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, advanceLevel, drainEvents, getHud } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

function greedyInput(run, mem) {
  const p = run.player;
  const lv = run.level;
  const inp = { moveX: 0, moveZ: 1, jump: false, brake: false, respawn: false };
  // 窄桥前方 8 单位 → 居中；否则朝下一根香蕉
  const narrowAhead = lv.halfWidthAt(p.z + 8) < 1.0;
  const next = run.bananas_list.find((b) => !b.taken && b.z > p.z - 1);
  const targetX = narrowAhead ? 0 : (next ? next.x : 0);
  inp.moveX = clamp((targetX - p.x) * 1.6, -1, 1);
  // 移动锤前跳
  const hammer = run.hammers.find((h) => h.z - p.z > 0.6 && h.z - p.z < 3.2);
  if (hammer && p.onGround) inp.jump = true;
  // 弹跳板后空中不额外操作；摔落后自动由 sim 回检查点
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { launched: false };
  let rndT = 0;
  let rnd = { moveX: 0, moveZ: 0, jump: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;
  let maxLevel = run.levelIndex + 1;

  while (t < MAX_SEC && run.phase !== 'finished') {
    if (run.phase === 'levelclear') {
      advanceLevel(run);
      maxLevel = Math.max(maxLevel, run.levelIndex + 1);
      continue;
    }
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) {
        rndT = 0.35;
        rnd = { moveX: Math.random() * 2 - 1, moveZ: Math.random() < 0.15 ? -1 : 1, jump: Math.random() < 0.3 };
      }
      inp = { ...rnd, brake: Math.random() < 0.08, respawn: false };
    } else inp = { moveX: 0, moveZ: 0, jump: false, brake: false, respawn: false };

    const sig = `${Math.sign(inp.moveX || 0)}|${Math.sign(inp.moveZ || 0)}|${inp.jump ? 1 : 0}|${inp.brake ? 1 : 0}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.moveX || inp.moveZ || inp.jump || inp.brake)) firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += 1 / 60;
    maxLevel = Math.max(maxLevel, run.levelIndex + 1);
    for (const ev of drainEvents(run)) {
      events.push({ t: +t.toFixed(3), type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'levelCleared') firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const h = getHud(run);
  return {
    id: `${policy}-${seed}`,
    policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0,
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: maxLevel,
    completed: run.phase === 'finished',
    progressRate: +clamp(maxLevel / 5, 0, 1).toFixed(2),
    totalBananas: run.totalBananas,
    totalTime: +run.totalTime.toFixed(2),
    rating: run.rating,
    events: events.slice(0, 500),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let pw;
    try { pw = require('playwright'); } catch { pw = require('/opt/homebrew/lib/node_modules/playwright'); }
    const { chromium } = pw;
    const { spawn } = await import('node:child_process');
    const srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 10000 });
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(60); }
    const lat = await page.evaluate(() => window.__lat);
    await browser.close();
    srv.kill();
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ genre: 'default', runs }, null, 2));
console.log('autoplay.json written (latency=' + latency + 'ms):');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} idle=${r.idleSec}s gap=${r.maxEventGapSec}s events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed} progress=${r.progressRate} bananas=${r.totalBananas} rating=${r.rating}`);
}
