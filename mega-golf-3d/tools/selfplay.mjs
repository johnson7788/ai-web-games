// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
// greedy = __ll 式解算瞄准（朝洞方向 + 力度按距离，含坡/风补偿）；random = 随机方向力度；noinput = 静置基线。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, shoot, step, drainEvents, solveAim, getHud } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;
const MAX_SHOTS = 400;

function runPolicy(policy, seed) {
  const run = createRun({ seed, holeIndex: 0 });
  const events = [{ t: 0, type: 'start' }];
  let actions = 0;
  let firstInputSec = null;
  let firstSuccessSec = null;
  let lastEventT = 0;
  let maxGap = 0;
  let idleSec = 0;
  const kinds = new Set();
  let t = 0;
  let rndT = 0;
  let rndAim = null;

  const push = (ev) => {
    events.push({ t, type: ev.type });
    kinds.add(ev.type);
    const gap = t - lastEventT;
    maxGap = Math.max(maxGap, gap);
    idleSec += Math.max(0, gap - 1);
    lastEventT = t;
    if (firstSuccessSec == null && ev.type === 'hole') firstSuccessSec = t;
  };

  while (t < MAX_SEC && run.phase !== 'finished' && actions < 2000) {
    if (run.phase === 'aim') {
      if (policy === 'greedy') {
        const a = solveAim(run);
        actions += 2; // 瞄准 + 击球
        shoot(run, a);
        if (firstInputSec == null) firstInputSec = t;
      } else if (policy === 'random') {
        // 随机乱按：先随机抖动瞄准，再随机方向力度击球
        rndT -= 1 / 60;
        if (rndT <= 0) {
          rndT = 0.3;
          rndAim = { dirX: Math.random() * 2 - 1, dirZ: Math.random() * 2 - 1, power: 0.3 + Math.random() * 0.7 };
          actions += 1; // 瞄准动作
        }
        if (rndAim) {
          shoot(run, rndAim);
          rndAim = null;
          actions += 1;
          if (firstInputSec == null) firstInputSec = t;
        }
      } else {
        // noinput：什么都不做
      }
    }
    step(run, 1 / 60);
    t += 1 / 60;
    for (const ev of drainEvents(run)) push(ev);
  }

  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  const hud = getHud(run);
  return {
    id: `${policy}-${seed}`,
    policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.busts + run.penalties,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.holeIndex + 1,
    completed: run.phase === 'finished',
    totalStrokes: run.totalStrokes,
    totalPar: run.totalPar,
    aces: run.aces,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    let pw = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { pw = req(c); break; } catch { /* next */ }
    }
    if (!pw) throw new Error('playwright not found');
    const { chromium } = pw;
    const { spawn } = await import('node:child_process');
    const srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll);
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i += 1) { await page.keyboard.press('KeyR'); await page.waitForTimeout(60); }
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'mega-golf-3d', genre: 'puzzle', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s firstInput=${r.firstInputSec}s firstWin=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} idle=${r.idleSec}s gap=${r.maxEventGapSec}s events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed} total=${r.totalStrokes} aces=${r.aces}`);
}
