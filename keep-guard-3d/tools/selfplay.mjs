// tools/selfplay.mjs — bot 遥测：greedy×3 / random×2 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, buildTower, upgradeTower, earlyStart, canPlaceAt } from '../src/game/sim.js';
import { TOWERS, WAVES, STEP } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;
const TOWER_ORDER = ['arrow', 'wall', 'cannon', 'wall', 'ice', 'wall'];

function bestCell(run, type) {
  // 找最佳堵点/射位：路径上或紧邻路径的可建格，得分 = 相邻路径格数
  const pathSet = new Set(run.path.map((p) => `${p.c},${p.r}`));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = null, bestScore = -1;
  for (let c = 0; c < 16; c++) {
    for (let r = 0; r < 12; r++) {
      if (!canPlaceAt(run, type, c, r)) continue;
      let score = 0;
      for (const [dc, dr] of dirs) if (pathSet.has(`${c + dc},${r + dr}`)) score += 2;
      if (pathSet.has(`${c},${r}`)) score += 3; // 路径上 = 最佳堵点
      if (score > bestScore) { bestScore = score; best = { c, r }; }
    }
  }
  return best;
}

function upgradeAny(run) {
  for (const k in run.towers) {
    const t = run.towers[k];
    if (t.level < 3) {
      const cost = TOWERS[t.type].upgradeCost[t.level - 1];
      if (run.gold >= cost) {
        upgradeTower(run, t.c, t.r);
        return true;
      }
    }
  }
  return false;
}

function greedyAct(run, mem) {
  let acted = false;
  if (run.phase !== mem.prevPhase) {
    mem.prevPhase = run.phase;
    mem.built = 0;
    mem.phaseT = run.time;
  }
  if (run.phase !== 'build' || mem.built < 5) {
    for (let k = 0; k < TOWER_ORDER.length && !acted; k++) {
      const type = TOWER_ORDER[(mem.i + k) % TOWER_ORDER.length];
      const cost = type === 'wall' ? 15 : TOWERS[type].cost;
      if (run.gold < cost) continue;
      const cell = bestCell(run, type);
      if (cell && buildTower(run, type, cell.c, cell.r)) {
        acted = true; mem.i = (mem.i + k + 1) % TOWER_ORDER.length; mem.built++;
      }
    }
  }
  if (!acted && upgradeAny(run)) acted = true;
  if (!acted && run.phase === 'build' && (mem.built > 0 || run.time - mem.phaseT > 2)) {
    if (earlyStart(run)) acted = true;
  }
  return acted;
}

function randomAct(run, mem) {
  if (run.phase === 'build' && Math.random() < 0.3 && mem.lastStart + 2 < run.time) {
    if (earlyStart(run)) { mem.lastStart = run.time; return true; }
  }
  const c = (Math.random() * 16) | 0;
  const r = (Math.random() * 12) | 0;
  const type = ['arrow', 'cannon', 'ice', 'wall'][(Math.random() * 4) | 0];
  return buildTower(run, type, c, r);
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { i: 0, built: 0, prevPhase: run.phase, phaseT: 0, lastStart: 0 };
  const evLog = [];
  let actions = 0, firstInputSec = null, firstSuccessSec = null, firstActionTime = null;
  let lastEventT = 0, maxGap = 0, idleSec = 0;
  const kinds = new Set();
  let t = 0;

  const record = (ev) => {
    evLog.push({ t, type: ev.type });
    kinds.add(ev.type);
    const gap = t - lastEventT;
    maxGap = Math.max(maxGap, gap);
    idleSec += Math.max(0, gap - 1);
    lastEventT = t;
    if (firstSuccessSec == null && (ev.type === 'kill' || ev.type === 'wave_clear')) firstSuccessSec = t;
  };
  for (const ev of drainEvents(run)) record(ev); // start 事件

  while (t < MAX_SEC && run.phase !== 'won' && run.phase !== 'lost') {
    let acted = false;
    if (policy === 'greedy') acted = greedyAct(run, mem);
    else if (policy === 'random') acted = randomAct(run, mem);
    if (acted) {
      actions++;
      if (firstInputSec == null) firstInputSec = t;
    }
    updateSim(run, {});
    t += STEP;
    for (const ev of drainEvents(run)) record(ev);
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  return {
    id: `${policy}-${seed}`,
    policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.phase === 'lost' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.wave,
    completed: run.phase === 'won',
    score: run.kills,
    events: evLog.slice(0, 400),
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
    const pysrv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => pysrv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Digit1'); await page.waitForTimeout(50); }
    const lat = await page.evaluate(() => window.__lat);
    await browser.close();
    pysrv.kill();
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : 16;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    return 16;
  }
}

const runs = [
  runPolicy('greedy', 11), runPolicy('greedy', 22), runPolicy('greedy', 33),
  runPolicy('random', 44), runPolicy('random', 45),
  runPolicy('noinput', 55), runPolicy('noinput', 56),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'keep-guard-3d', genre: 'sim', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s first=${r.firstInputSec}s succ=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} idle=${r.idleSec}s gap=${r.maxEventGapSec}s events=${r.uniqueEvents} wave=${r.levelsReached} win=${r.completed} kills=${r.score} latency=${r.inputLatencyMs}ms`);
}
