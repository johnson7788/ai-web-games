#!/usr/bin/env node
// tools/selfplay.mjs — bot 遥测：node 里跑纯 sim，产出 tools/fun/autoplay.json（playtest-protocol §3）。
// 策略：greedy（会走路的玩家：拿灯→点灯→没油才取油，卡住 1.5s 就转向绕）/ random（乱按）/ noinput（什么都不做）。
// 另用 Playwright 实测「真按键 → 画面里位置变化」的输入延迟，不用 run.step 直调冒充。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve('.');
const { CONFIG } = await import('../config/game.config.js');
const { createSim } = await import('../src/game/sim.js');
const { NPC_PROFILES } = await import('../config/npc.js');
const { blockedAt, slopeAt } = await import('../src/game/terrain.js');

const DT = 1 / 60;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function runPolicy(strategy, seed, night = 1, maxSec = 240) {
  const sim = createSim(CONFIG, NPC_PROFILES, CONFIG.upgrades);
  sim.startNight(night, seed);
  const st = sim.state;
  const P = CONFIG.player;
  let ops = 0, firstInput = -1, firstSuccess = -1, lastEvent = 0, maxGap = 0, idle = 0;
  const kinds = new Set();
  let guard = 0, avoid = 0, stuck = 0, lastKey = '';
  while (st.phase === 'playing' && guard++ < maxSec * 60) {
    sim.step(DT, { moved: false });
    let dx = 0, dz = 0;
    if (strategy !== 'noinput') {
      const unlit = st.lanterns.filter((x) => !x.lit);
      const lamps = (st.pickups || []).filter((p) => !p.taken && p.kind === 'lantern');
      const oils = (st.pickups || []).filter((p) => !p.taken && p.kind === 'oil');
      const nearestOf = (l) => l.slice().sort((a, b) => dist(st.player, a) - dist(st.player, b))[0];
      let target = null;
      if (strategy === 'random') {
        const r = ((seed * 9301 + guard * 49297) % 233280) / 233280;
        const a = r * Math.PI * 2;
        dx = Math.cos(a); dz = Math.sin(a);
        sim.move(dx * P.walkSpeed * 0.05, dz * P.walkSpeed * 0.05, { inGust: true });
        ops++;
        if (firstInput < 0) firstInput = st.time;
        if (guard % 90 === 0) { const k = guard % 3; if (k === 0) sim.grab(); else if (k === 1) sim.light(); else sim.jump(); }
      } else {
        if (st.carried.length === 0) target = nearestOf(lamps);
        if (!target && st.oil <= 0 && unlit.length) target = nearestOf(oils);
        if (!target) target = nearestOf(unlit);
        if (!target) target = nearestOf([...oils, ...lamps]);
        if (target) {
          // 卡住检测：位置 1.5s 没变才转向绕；常态走直线，贴墙靠 sim.move 的轴分离滑动
          const key = st.player.x.toFixed(1) + ',' + st.player.z.toFixed(1);
          if (key === lastKey) stuck++; else { stuck = 0; lastKey = key; }
          if (stuck > 90) { avoid = 1.7; stuck = 0; }
          let tx = target.x, tz = target.z;
          if (avoid > 0.05) {
            const ang = Math.atan2(tz - st.player.z, tx - st.player.x) + avoid;
            avoid = Math.max(0, avoid - 0.03);
            tx = st.player.x + Math.cos(ang) * 3.4; tz = st.player.z + Math.sin(ang) * 3.4;
          }
          const d = dist(st.player, { x: tx, z: tz });
          if (d > 1.5) {
            dx = (tx - st.player.x) / d; dz = (tz - st.player.z) / d;
            const L = P.walkSpeed * 0.05;
            sim.move(dx * L, dz * L, { inGust: true, braced: false });
            ops++;
            if (firstInput < 0) firstInput = st.time;
          } else if (!sim.snapshot().lighting) {
            if (st.carried.length === 0 || st.oil <= 0) sim.grab(); else sim.light();
            ops++;
          }
        }
      }
    }
    for (const e of sim.drainEvents()) {
      kinds.add(e.type);
      maxGap = Math.max(maxGap, e.at - lastEvent);
      lastEvent = e.at;
      if (e.type === 'lantern_lit' && firstSuccess < 0) firstSuccess = e.at;
    }
    const busy = !!sim.snapshot().lighting;
    if (Math.hypot(dx, dz) < 0.01 && !busy && strategy !== 'noinput') idle += DT;
    if (guard % 900 === 0) {
      const npc = Object.values(CONFIG.npcs).find((n) => dist(st.player, n) < 4);
      if (npc) sim.talk(npc.id, { choice: 'greet' });
    }
  }
  const dur = Math.max(1, st.time);
  return {
    // fun-report 的字段名（references/playtest-protocol.md §3）：policy/actions/idleSec/uniqueEvents/levelsReached/completed
    id: `${strategy}-n${night}-${seed}`, policy: strategy, strategy, seed, night,
    outcome: st.outcome ? (st.outcome.win ? 'win' : 'fail') : 'timeout',
    durationSec: +st.time.toFixed(1),
    firstInputSec: firstInput < 0 ? null : +firstInput.toFixed(1),
    firstSuccessSec: firstSuccess < 0 ? null : +firstSuccess.toFixed(1),
    actionsPerMin: Math.round((ops / dur) * 60),
    ops, actions: ops,
    idleSec: +(idle).toFixed(1),
    uniqueEvents: kinds.size,
    levelsReached: st.night,
    completed: !!(st.outcome && st.outcome.win),
    idleRatio: +(idle / dur).toFixed(2),
    maxEventGapSec: +Math.max(0, maxGap, st.time - lastEvent).toFixed(2),
    eventKinds: kinds.size,
    progressRate: +(st.litCount / Math.max(1, st.lanterns.length)).toFixed(2),
    lit: st.litCount, of: st.lanterns.length,
    score: st.score, deaths: st.stats.deaths + (st.outcome && !st.outcome.win ? 1 : 0), falls: st.stats.deaths, lampsLost: st.droppedCount,
    questsDone: st.quests.done.length, moveCount: st.stats.moves,
  };
}

const runs = [
  runPolicy('greedy', 11, 1), runPolicy('greedy', 22, 2), runPolicy('greedy', 33, 3),
  runPolicy('greedy', 44, 4), runPolicy('greedy', 55, 5),
  runPolicy('random', 66, 1), runPolicy('random', 77, 2),
  runPolicy('noinput', 88, 1), runPolicy('noinput', 99, 3),
];

async function latencyProbe() {
  const { serve, loadPlaywright } = await import('/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs');
  globalThis.require = require;
  const { chromium } = loadPlaywright();
  const { server, port } = await serve(ROOT, 8231);
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 30000 });
    await page.click('#btn-start').catch(() => page.evaluate(() => window.__ll.start()));
    await page.waitForTimeout(1500);
    const lat = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        const before = window.__game3d.state().player.path;
        const t0 = performance.now();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        await new Promise((res) => {
          let n = 0;
          const tick = () => {
            n++;
            if (window.__game3d.state().player.path !== before) { out.push(performance.now() - t0); res(); }
            else if (n > 40) res();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        await new Promise((r) => setTimeout(r, 80));
      }
      return out;
    });
    await browser.close(); server.close();
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : null;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    await browser.close().catch(() => {}); server.close();
    return null;
  }
}
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;
fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'lantern-isle-3d', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json runs=' + runs.length + ' latency=' + latency + 'ms');
for (const r of runs) console.log(`  ${r.strategy.padEnd(8)} n${r.night} ${r.outcome.padEnd(7)} lit=${r.lit}/${r.of} 进度=${r.progressRate} ops=${r.ops} 首触=${r.firstInputSec}s 首成=${r.firstSuccessSec}s gap=${r.maxEventGapSec}s 空转=${r.idleRatio}`);
