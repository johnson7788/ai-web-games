// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { cranePlatformX } from '../src/game/course.js';
import { ACTION, RUN } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 320;

function greedyInput(run, mem) {
  const inp = { steer: 0, action: false, sprint: false };
  if (run.phase !== 'running') return inp;
  const p = run.player;
  const course = run.course;
  let ob = null;
  for (const o of course.obstacles) { if (!o.cleared && o.z > p.z) { ob = o; break; } }
  const dz = ob ? ob.z - p.z : 999;
  // 上下文动作：障碍前按空格
  if (ob && ob.type !== 'crane' && dz < ACTION.trigger - 0.3 && dz > 0.3) inp.action = true;
  // 转向：吊臂前对齐平台，否则靠中
  if (ob && ob.type === 'crane' && dz < 22) inp.steer = clamp((cranePlatformX(ob, run.time) - p.x) * 2.5, -1, 1);
  else inp.steer = clamp((0 - p.x) * 1.5, -1, 1);
  // 冲刺（滞回，避免体力阈值抖动）
  if (run.stamina > 65) mem.sprint = true;
  else if (run.stamina < 35) mem.sprint = false;
  inp.sprint = mem.sprint && (dz > 14 || !ob);
  return inp;
}

function randomInput(run, mem) {
  mem.rndT -= 1 / 60;
  if (mem.rndT <= 0) {
    mem.rndT = 0.25 + Math.random() * 0.3;
    mem.r = { steer: Math.random() * 2 - 1, action: Math.random() < 0.4, sprint: Math.random() < 0.3 };
  }
  return { ...mem.r };
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { sprint: false, rndT: 0, r: { steer: 0, action: false, sprint: false } };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = {};

    const sig = `${Math.sign(inp.steer || 0)}|${!!inp.action}|${!!inp.sprint}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.steer || inp.action || inp.sprint)) firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && (ev.type === 'vault' || ev.type === 'slide' || ev.type === 'wallrun' || ev.type === 'success')) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const h = getHud(run);
  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0,
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.stats.falls,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.section,
    completed: run.win === true,
    progressRate: +clamp(run.player.z / RUN.finishZ, 0, 1).toFixed(2),
    score: h.score, topCombo: run.stats.topCombo, vaults: run.stats.vault, slides: run.stats.slide, wallruns: run.stats.wallrun,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let pw = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { pw = require(c); break; } catch { /* next */ }
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
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(60); }
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'vault-run', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} combo×${r.topCombo} vault=${r.vaults} slide=${r.slides} wall=${r.wallruns} death=${r.deaths} completed=${r.completed} lvl=${r.levelsReached} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} latency=${r.inputLatencyMs}ms`);
}
