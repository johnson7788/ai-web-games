#!/usr/bin/env node
// 浏览器自动玩测：greedy / random / noinput 三条策略 → tools/fun/autoplay.json
// 用真实 DOM 点击驱动，记录游戏内遥测（输入延迟、首胜、死亡、事件间隔等）。
// 用法：node tools/autoplay.mjs [--out tools/fun/autoplay.json]
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = process.cwd();
const outFile = path.resolve(root, process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'tools/fun/autoplay.json');

const DENOMS = [1000, 500, 100, 25, 10, 5, 1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { server, port } = await serve(root, 8130);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ll, null, { timeout: 10000 });
await page.evaluate(() => window.__ll.start());
await sleep(250);

async function state() {
  return page.evaluate(() => window.__ll.debug.state());
}
async function telemetry(policy) {
  return page.evaluate((p) => window.__ll.telemetry(p), policy);
}
async function clickFirst(selector) {
  const loc = page.locator(selector).first();
  await loc.click({ force: true, timeout: 4000 });
}

async function playGreedy(maxSteps = 40) {
  await page.evaluate(() => window.__ll.start());
  await sleep(150);
  for (let step = 0; step < maxSteps; step += 1) {
    const st = await state();
    if (st.phase === 'ending') break;
    if (st.phase === 'dayClear') {
      await clickFirst('button.upgrade-card');
      await sleep(450);
      continue;
    }
    if (st.phase === 'dayFail') {
      await page.locator('#btn-retry').click({ force: true });
      await sleep(450);
      continue;
    }
    if (st.phase === 'scan') {
      const remaining = st.items.filter((i) => !i.scanned).length;
      for (let i = 0; i < remaining; i += 1) {
        await clickFirst('button.item-row:not([disabled])');
        await sleep(55);
      }
      await sleep(80);
      continue;
    }
    if (st.phase === 'change') {
      let remaining = st.change - st.givenChange;
      for (const d of DENOMS) {
        while (remaining >= d) {
          await page.locator(`.money-btn[data-cents="${d}"]`).click({ force: true });
          remaining -= d;
          await sleep(30);
        }
      }
      await page.locator('#btn-give').click({ force: true });
      await sleep(420);
    }
  }
  return telemetry('greedy');
}

async function playRandom(ms = 12000) {
  await page.evaluate(() => window.__ll.start());
  await sleep(120);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await state();
    if (st.phase === 'ending') break;
    if (st.phase === 'dayClear') {
      await clickFirst('button.upgrade-card');
      await sleep(350);
      continue;
    }
    if (st.phase === 'dayFail') {
      await page.locator('#btn-retry').click({ force: true });
      await sleep(350);
      continue;
    }
    if (st.phase === 'scan') {
      const rows = page.locator('button.item-row:not([disabled])');
      const n = await rows.count();
      if (n > 0) await rows.nth(Math.floor(Math.random() * n)).click({ force: true }).catch(() => {});
    } else if (st.phase === 'change') {
      const roll = Math.random();
      if (roll < 0.65) {
        const btns = page.locator('.money-btn:not([disabled])');
        const n = await btns.count();
        if (n > 0) await btns.nth(Math.floor(Math.random() * n)).click({ force: true }).catch(() => {});
      } else if (roll < 0.85) {
        await page.locator('#btn-reset').click({ force: true }).catch(() => {});
      } else {
        await page.locator('#btn-give').click({ force: true }).catch(() => {});
      }
    }
    await sleep(140);
  }
  return telemetry('random');
}

async function playNoInput() {
  await page.evaluate(() => window.__ll.start());
  await sleep(300);
  await page.evaluate(() => window.__ll.debug.advance(45));
  await sleep(350);
  return telemetry('noinput');
}

const runs = [];
try {
  runs.push({ id: 'greedy-1', ...(await playGreedy()) });
  runs.push({ id: 'greedy-2', ...(await playGreedy()) });
  runs.push({ id: 'random-1', ...(await playRandom()) });
  runs.push({ id: 'noinput-1', ...(await playNoInput()) });
} catch (e) {
  errors.push(`playtest: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}

const payload = {
  game: 'market-cashier',
  genre: 'sim',
  source: 'bot',
  generatedAt: new Date().toISOString(),
  errors,
  runs,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`→ ${outFile}`);
for (const r of runs) console.log(r.id, r.policy, `firstSuccess=${r.firstSuccessSec}`, `actions=${r.actions}`, `days=${r.levelsReached}`, `completed=${r.completed}`);
if (errors.length) {
  console.error(errors.slice(0, 5).join('\n'));
  process.exitCode = 1;
}
