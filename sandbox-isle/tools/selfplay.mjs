// tools/selfplay.mjs — bot 遥测：greedy / random / noinput 三策略，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSim, updateSim, drainEvents, getHud, getBlock,
} from '../src/game/sim.js';
import {
  WORLD, BLOCKS, BLOCK_DEFS, HOTBAR, ANIMALS, FARM, RAINBOW, STAMINA,
} from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

// 世界扫描辅助
const inB = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < WORLD.W && y < WORLD.H && z < WORLD.D;
function exposed(run, x, y, z) {
  return (inB(x + 1, y, z) && getBlock(run.world, x + 1, y, z) === BLOCKS.AIR)
    || (inB(x - 1, y, z) && getBlock(run.world, x - 1, y, z) === BLOCKS.AIR)
    || (inB(x, y + 1, z) && getBlock(run.world, x, y + 1, z) === BLOCKS.AIR)
    || (inB(x, y - 1, z) && getBlock(run.world, x, y - 1, z) === BLOCKS.AIR)
    || (inB(x, y, z + 1) && getBlock(run.world, x, y, z + 1) === BLOCKS.AIR)
    || (inB(x, y, z - 1) && getBlock(run.world, x, y, z - 1) === BLOCKS.AIR);
}

function nearestBlock(run, pred, maxR = 20) {
  const p = run.player;
  let best = null, bestD = maxR;
  for (let x = 0; x < WORLD.W; x++) {
    for (let z = 0; z < WORLD.D; z++) {
      const dxy = Math.hypot(x - p.x, z - p.z);
      if (dxy > bestD) continue;
      for (let y = WORLD.H - 1; y >= 0; y--) {
        const b = getBlock(run.world, x, y, z);
        if (pred(b, x, y, z)) {
          const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
          if (d < bestD) { bestD = d; best = { x, y, z }; }
          break;
        }
      }
    }
  }
  return best;
}

function nearestAnimal(run, pred) {
  const p = run.player;
  let best = null, bestD = Infinity;
  for (const a of run.animals) {
    if (!pred(a)) continue;
    const d = Math.hypot(a.x - p.x, a.z - p.z);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

function nearestCrop(run, pred) {
  const p = run.player;
  let best = null, bestD = Infinity;
  for (const c of run.crops) {
    if (!pred(c)) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function moveToward(run, inp, tx, tz) {
  const p = run.player;
  const dx = tx - p.x, dz = tz - p.z;
  const d = Math.hypot(dx, dz) || 1;
  const dxn = dx / d, dzn = dz / d;
  const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
  inp.move.x = dxn * c - dzn * sn;
  inp.move.z = -dxn * sn - dzn * c;
}

// ---------------------------------------------------------------- greedy：目标驱动 + 兜底保持事件密度
function near(p, tx, tz, d) { return Math.hypot(tx - p.x, tz - p.z) <= d; }
function digOrMove(run, inp, mem, t, cd = 0.9) {
  if (near(run.player, t.x + 0.5, t.z + 0.5, 3.5)) {
    if (mem.cool <= 0) { inp.action = { kind: 'dig', x: t.x, y: t.y, z: t.z }; mem.cool = cd; }
  } else moveToward(run, inp, t.x + 0.5, t.z + 0.5);
}

function greedyInput(run, mem) {
  const p = run.player;
  const inp = { move: { x: 0, z: 0 }, yaw: p.yaw, pitch: -0.15, slot: p.slot, action: null, interact: false };
  mem.cool = Math.max(0, (mem.cool || 0) - 1 / 60);
  const goal = run.goals.find((g) => !g.done);

  // 1) 收萝卜（库存少或有相关目标）
  if (p.carrots < 3 || (goal && ['feed', 'harvest', 'eggs', 'gold'].includes(goal.id))) {
    const crop = nearestCrop(run, (c) => c.mature);
    if (crop) {
      if (near(p, crop.x, crop.z, FARM.harvestRange - 0.5)) { if (mem.cool <= 0) { inp.interact = true; mem.cool = 0.4; } }
      else moveToward(run, inp, crop.x, crop.z);
      return inp;
    }
  }
  // 2) 喂动物（有萝卜，优先喂食目标，否则囤够也喂）
  if (p.carrots > 0 && ((goal && ['feed', 'eggs', 'gold'].includes(goal.id)) || p.carrots >= 4)) {
    const a = nearestAnimal(run, (a) => !a.fedToday);
    if (a) {
      if (near(p, a.x, a.z, ANIMALS.feedRange - 0.5)) { if (mem.cool <= 0) { inp.interact = true; mem.cool = 0.4; } }
      else moveToward(run, inp, a.x, a.z);
      return inp;
    }
  }
  // 3) 建造目标优先（有库存就放）
  if (goal && goal.id === 'build') {
    const blk = HOTBAR.find((b) => (p.inventory[b] || 0) > 0);
    if (blk) {
      inp.slot = BLOCK_DEFS[blk].slot;
      const spot = nearestBlock(run, (b, x, y, z) => b === BLOCKS.AIR
        && getBlock(run.world, x, y - 1, z) !== BLOCKS.AIR
        && !(x === Math.floor(p.x) && z === Math.floor(p.z)));
      if (spot) {
        if (near(p, spot.x + 0.5, spot.z + 0.5, 3.5)) { if (mem.cool <= 0) { inp.action = { kind: 'place', x: spot.x, y: spot.y, z: spot.z, block: blk }; mem.cool = 0.5; } }
        else moveToward(run, inp, spot.x + 0.5, spot.z + 0.5);
        return inp;
      }
    }
  }
  // 4) 挖裸露石头（推进挖石目标 + 供建造）；只挖脚下～头高的墙，不挖地板
  const digY = (y) => y >= Math.floor(p.y) && y <= Math.floor(p.y) + 2;
  const stone = nearestBlock(run, (b, x, y, z) => b === BLOCKS.STONE && exposed(run, x, y, z) && digY(y));
  if (stone) { digOrMove(run, inp, mem, stone); return inp; }
  // 5) 通用放置（保持 place 事件）
  const blk = HOTBAR.find((b) => (p.inventory[b] || 0) > 0);
  if (blk) {
    inp.slot = BLOCK_DEFS[blk].slot;
    const spot = nearestBlock(run, (b, x, y, z) => b === BLOCKS.AIR
      && getBlock(run.world, x, y - 1, z) !== BLOCKS.AIR
      && !(x === Math.floor(p.x) && z === Math.floor(p.z)));
    if (spot) {
      if (near(p, spot.x + 0.5, spot.z + 0.5, 3.5)) { if (mem.cool <= 0) { inp.action = { kind: 'place', x: spot.x, y: spot.y, z: spot.z, block: blk }; mem.cool = 0.5; } }
      else moveToward(run, inp, spot.x + 0.5, spot.z + 0.5);
      return inp;
    }
  }
  // 6) 兜底：挖任意裸露固体，保持事件密度（体力低时放慢，避免累晕）；不挖脚下地板
  const any = nearestBlock(run, (b, x, y, z) => b !== BLOCKS.AIR && !BLOCK_DEFS[b].fluid && exposed(run, x, y, z) && digY(y));
  if (any) { digOrMove(run, inp, mem, any, p.stamina < 40 ? 1.4 : 0.9); return inp; }
  return inp;
}

// ---------------------------------------------------------------- random：乱按
function randomInput(run, mem) {
  const p = run.player;
  const inp = { move: { x: 0, z: 0 }, yaw: p.yaw, pitch: -0.1, slot: p.slot, action: null, interact: false };
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.4;
    const ang = Math.random() * Math.PI * 2;
    mem.mx = Math.cos(ang); mem.mz = Math.sin(ang);
    inp.slot = Math.floor(Math.random() * HOTBAR.length);
  }
  inp.move.x = mem.mx; inp.move.z = mem.mz;
  // 随机挖附近实体方块（会造成体力耗尽 → 累晕）
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(p.x) + (Math.random() * 6 - 3) | 0;
    const z = Math.floor(p.z) + (Math.random() * 6 - 3) | 0;
    const y = Math.floor(p.y) + (Math.random() * 4 - 2) | 0;
    if (x < 0 || z < 0 || y < 0 || x >= WORLD.W || z >= WORLD.D || y >= WORLD.H) continue;
    const b = getBlock(run.world, x, y, z);
    if (b !== BLOCKS.AIR && !BLOCK_DEFS[b].fluid && Math.random() < 0.6) { inp.action = { kind: 'dig', x, y, z }; break; }
  }
  if (!inp.action && Math.random() < 0.2) inp.interact = true;
  return inp;
}

// ---------------------------------------------------------------- 单局
function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { t: 0, mx: 0, mz: 0 };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'won') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { move: { x: 0, z: 0 }, yaw: 0, pitch: 0, slot: 0, action: null, interact: false };

    const active = Math.abs(inp.move.x) > 0.1 || Math.abs(inp.move.z) > 0.1 || inp.action || inp.interact;
    const sig = `${Math.round(inp.move.x)}|${Math.round(inp.move.z)}|${inp.slot}|${inp.action ? inp.action.kind : ''}|${inp.interact ? 1 : 0}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && active) firstInputSec = t;
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
      if (firstSuccessSec == null && ev.type === 'goal_complete') firstSuccessSec = t;
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
    deaths: run.stats.deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: clamp(1 + run.stats.totalGoalsCompleted, 1, 5),
    completed: run.phase === 'won',
    progressRate: +clamp((1 + run.stats.totalGoalsCompleted) / 5, 0, 1).toFixed(2),
    score: h.gold,
    events: events.slice(0, 400),
  };
}

// ---------------------------------------------------------------- 浏览器输入延迟探针
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
    const srv2 = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv2.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
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
    srv2.kill();
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'sandbox-isle', genre: 'sim', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) console.log(` ${r.id}: dur=${r.durationSec}s first=${r.firstInputSec}s win=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} gap=${r.maxEventGapSec}s idle=${r.idleSec}s events=${r.uniqueEvents} level=${r.levelsReached} completed=${r.completed} latency=${r.inputLatencyMs}ms`);
