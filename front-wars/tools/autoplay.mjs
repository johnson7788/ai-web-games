#!/usr/bin/env node
// 浏览器自动玩测：greedy（找最近敌人、移动、瞄准、开火）/ random / noinput。
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = process.cwd();
const outFile = path.resolve(root, 'tools/fun/autoplay.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, port } = await serve(root, 8185);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ll, null, { timeout: 10000 });

async function telemetry(policy) { return page.evaluate((p) => window.__ll.telemetry(p), policy); }

async function start() {
  await page.evaluate(() => window.__ll.start());
  await sleep(300);
}
async function state() { return page.evaluate(() => window.__ll.debug.state()); }
async function entities() {
  return page.evaluate(() => ({
    phase: window.__ll.state.phase,
    hud: window.__ll.debug.state(),
    players: window.__ll.sim.players.map((p) => ({ id: p.id, team: p.team, x: p.x, y: p.y, hp: p.hp, alive: p.alive, isBot: p.isBot })),
  }));
}

const keys = new Set();
async function setKey(code, on) {
  if (on && !keys.has(code)) { keys.add(code); await page.keyboard.down(code); }
  if (!on && keys.has(code)) { keys.delete(code); await page.keyboard.up(code); }
}
async function releaseKeys() { for (const k of [...keys]) await setKey(k, false); }

async function greedy(seconds = 70) {
  await start();
  let mouseDown = false;
  const t0 = Date.now();
  while (Date.now() - t0 < seconds * 1000) {
    const s = await entities();
    if (s.phase === 'over') break;
    if (s.hud.phase === 'roundOver') {
      await releaseKeys();
      if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      const card = page.locator('.perk-card').first();
      if (await card.count()) await card.click({ force: true });
      await sleep(700);
      continue;
    }
    if (s.hud.phase !== 'play' || !s.hud.alive) {
      await releaseKeys();
      if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      await sleep(250);
      continue;
    }
    const me = s.players[0];
    const enemies = s.players.filter((p) => p.team === 1 && p.alive).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    const target = enemies[0];
    if (target) {
      await page.mouse.move(Math.max(0, Math.min(1279, target.x)), Math.max(0, Math.min(719, target.y)), { steps: 1 });
      if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
      const dx = target.x - me.x;
      const dy = target.y - me.y;
      const d = Math.hypot(dx, dy);
      const close = d < 190;
      await setKey('KeyD', close ? dx > 0 : dx > 30);
      await setKey('KeyA', close ? dx < 0 : dx < -30);
      await setKey('KeyS', close ? dy > 0 : dy > 30);
      await setKey('KeyW', close ? dy < 0 : dy < -30);
      if (d < 260 && Math.random() < 0.12) { await page.keyboard.press('ShiftLeft'); }
    }
    await sleep(90);
  }
  await releaseKeys();
  if (mouseDown) await page.mouse.up();
  return telemetry('greedy');
}

async function random(seconds = 14) {
  await start();
  const t0 = Date.now();
  const pool = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  let down = false;
  while (Date.now() - t0 < seconds * 1000) {
    const s = await state();
    if (s.phase === 'over') break;
    if (s.phase === 'roundOver') {
      const card = page.locator('.perk-card').first();
      if (await card.count()) await card.click({ force: true });
      await sleep(500);
      continue;
    }
    const k = pool[Math.floor(Math.random() * pool.length)];
    await page.keyboard.down(k);
    await sleep(90 + Math.random() * 120);
    await page.keyboard.up(k);
    await page.mouse.move(200 + Math.random() * 900, 120 + Math.random() * 480);
    if (Math.random() < 0.35) {
      if (down) { await page.mouse.up(); down = false; } else { await page.mouse.down(); down = true; }
    }
    await sleep(80);
  }
  if (down) await page.mouse.up();
  return telemetry('random');
}

async function noinput() {
  await start();
  await sleep(4200);
  return telemetry('noinput');
}

const runs = [];
try {
  runs.push({ id: 'greedy-1', ...(await greedy()) });
  runs.push({ id: 'greedy-2', ...(await greedy()) });
  runs.push({ id: 'random-1', ...(await random()) });
  runs.push({ id: 'noinput-1', ...(await noinput()) });
} catch (e) {
  errors.push(`playtest: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
const payload = {
  game: 'front-wars',
  genre: 'action',
  source: 'bot',
  generatedAt: new Date().toISOString(),
  errors,
  runs,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`→ ${outFile}`);
for (const r of runs) console.log(r.id, r.policy, `firstSuccess=${r.firstSuccessSec}`, `actions=${r.actions}`, `days=${r.levelsReached}`, `completed=${r.completed}`, `deaths=${r.deaths}`);
if (errors.length) { console.error(errors.slice(0, 5).join('\n')); process.exitCode = 1; }
