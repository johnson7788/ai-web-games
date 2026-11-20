#!/usr/bin/env node
// 自动玩测：greedy（完美记忆 bot）/ random / noinput，真实点击事件，产出 tools/fun/autoplay.json
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PLAYWRIGHT_PATHS = ['playwright', '/opt/homebrew/lib/node_modules/playwright'];
function loadPlaywright() {
  for (const c of PLAYWRIGHT_PATHS) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();

function serve(dir, startPort) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (file === '/' || file.endsWith('/')) file += 'index.html';
      const full = path.join(dir, file);
      fs.readFile(full, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        const ext = path.extname(full).toLowerCase();
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      });
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freshContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { context, page, errors };
}

/** 玩一关（真实点击）到 win/fail/timeout */
async function playRun(page, policy, levelIndex, maxSec = 150) {
  const t0 = Date.now();
  // 开局
  await page.evaluate((lv) => window.__ll.start(lv), levelIndex);
  await sleep(300);

  const run = {
    id: `${policy}-${levelIndex}`,
    policy,
    startedAt: t0,
    firstInputSec: null,
    inputLatencies: [],
    actions: 0,
    events: new Set(),
    firstSuccessSec: null,
    deaths: 0,
    lastEventAt: t0,
    maxGapSec: 0,
    idleStart: null,
    idleSec: 0,
    levelsReached: levelIndex,
    completed: false,
  };

  const markEvent = () => {
    const now = Date.now();
    run.maxGapSec = Math.max(run.maxGapSec, (now - run.lastEventAt) / 1000);
    run.lastEventAt = now;
    if (run.idleStart != null) {
      run.idleSec += (now - run.idleStart) / 1000;
      run.idleStart = null;
    }
  };

  const latency = async (t) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    run.inputLatencies.push(Date.now() - t);
  };

  const clickCard = async (idx) => {
    const before = await page.evaluate(() => window.__ll.run.deck.filter((c) => c.state !== 'down').length);
    const t = Date.now();
    await page.evaluate((i) => {
      const el = window.G.ui.cardEl(i);
      if (el) el.click();
      else window.__ll.run.deck[i] && window.G.ui.onCardClick(i);
    }, idx);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const after = await page.evaluate(() => window.__ll.run.deck.filter((c) => c.state !== 'down').length);
    if (after !== before || true) {
      if (run.firstInputSec === null) run.firstInputSec = (Date.now() - t0) / 1000;
      run.actions += 1;
      run.inputLatencies.push(Date.now() - t);
      markEvent();
      run.events.add('flip');
    }
  };

  const phase = async () => (await page.evaluate(() => window.__ll.state.phase));
  const deckState = async () => page.evaluate(() => window.__ll.run.deck.map((c) => ({ id: c.id, char: c.char, state: c.state, kind: c.kind })));
  const stats = async () => page.evaluate(() => ({
    pairs: window.__ll.run.pairsMatched, total: window.__ll.run.pairsTotal,
    movesLeft: window.__ll.run.movesLeft, combo: window.__ll.run.combo,
  }));

  if (policy === 'noinput') {
    // 什么都不做，观察自动推进/死时间
    while ((Date.now() - t0) / 1000 < maxSec) {
      const p = await phase();
      if (p !== 'game') break;
      await sleep(500);
    }
    run.idleSec = (Date.now() - t0) / 1000;
    run.events.add('start');
  } else if (policy === 'random') {
    // 乱点：4-10Hz 随机卡
    while ((Date.now() - t0) / 1000 < maxSec) {
      const p = await phase();
      if (p !== 'game') break;
      const deck = await deckState();
      const down = deck.filter((c) => c.state === 'down');
      if (!down.length) break;
      const card = down[Math.floor(Math.random() * down.length)];
      await clickCard(card.id);
      await sleep(120 + Math.random() * 130);
      // 处理误配翻回等待
      let guard = 0;
      while ((await phase()) === 'game' && (await page.evaluate(() => !!window.G)) && guard++ < 20) {
        const st = await stats();
        void st;
        const stillTwo = (await deckState()).filter((c) => c.state === 'up').length;
        if (stillTwo >= 2) await sleep(200);
        else break;
      }
      const s = await stats();
      if (s.pairs > 0) { run.events.add('match'); if (run.firstSuccessSec === null) run.firstSuccessSec = (Date.now() - t0) / 1000; markEvent(); }
    }
  } else if (policy === 'greedy') {
    // 拟真记忆 bot：只记真实翻过/peek 过的牌，12% 遗忘率，卡住时用提示
    const FORGET = 0.12;
    const memory = new Map(); // char -> [ids]（只含真实见过的）
    const learnUps = async () => {
      for (const c of await deckState()) {
        if (c.state === 'up' && c.kind !== 'obstacle') {
          const ids = memory.get(c.char) ?? [];
          if (!ids.includes(c.id)) ids.push(c.id);
          memory.set(c.char, ids);
        }
      }
    };
    let prevMoves = null;
    let peekUsed = 0;
    while ((Date.now() - t0) / 1000 < maxSec) {
      const p = await phase();
      if (p !== 'game') break;
      const deck = await deckState();
      for (const [ch, ids] of memory) memory.set(ch, ids.filter((id) => deck[id].state === 'down'));
      for (const [ch] of memory) if (Math.random() < FORGET) memory.delete(ch);
      const known = [...memory.entries()].filter(([, ids]) => ids.length >= 2 && ids.every((id) => deck[id].state === 'down'));
      const s = await stats();
      if (s.movesLeft !== prevMoves) { prevMoves = s.movesLeft; markEvent(); }
      // 卡住（无已知对）且还有提示 → 真实按钮点击
      if (!known.length && peekUsed < 2 && Math.random() < 0.7) {
        peekUsed++;
        await page.evaluate(() => document.getElementById('btn-peek').click());
        run.events.add('peek');
        markEvent();
        await sleep(1800);
        await learnUps(); // peek 亮出的两张也算见过
        continue;
      }
      if (known.length) {
        const [ch, ids] = known[0];
        await clickCard(ids[0]);
        await sleep(160);
        await clickCard(ids[1]);
        const s2 = await stats();
        if (s2.pairs > s.pairs) {
          run.events.add('match');
          if (s2.combo >= 2) run.events.add('combo');
          if (run.firstSuccessSec === null) run.firstSuccessSec = (Date.now() - t0) / 1000;
        } else {
          run.events.add('mismatch');
        }
        markEvent();
        await learnUps();
        await sleep(500);
      } else {
        // 开新区域：翻一张没见过的
        const seenIds = new Set([...memory.values()].flat());
        const down = deck.filter((c) => c.state === 'down' && c.kind !== 'obstacle' && !seenIds.has(c.id));
        const pool = down.length ? down : deck.filter((c) => c.state === 'down' && c.kind !== 'obstacle');
        if (!pool.length) break;
        const card = pool[Math.floor(Math.random() * pool.length)];
        await clickCard(card.id);
        await sleep(160);
        await learnUps();
        // 第二张：优先翻记忆里同角色的另一张，否则开新的
        const deck2 = await deckState();
        const up = deck2.find((c) => c.state === 'up');
        let target = null;
        if (up) {
          const ids = memory.get(up.char) ?? [];
          target = ids.find((id) => id !== up.id && deck2[id].state === 'down');
        }
        if (target == null) {
          const seen2 = new Set([...memory.values()].flat());
          const downs = deck2.filter((c) => c.state === 'down' && c.kind !== 'obstacle' && c.id !== up?.id && !seen2.has(c.id));
          const pool2 = downs.length ? downs : deck2.filter((c) => c.state === 'down' && c.kind !== 'obstacle' && c.id !== up?.id);
          target = pool2[Math.floor(Math.random() * pool2.length)]?.id;
        }
        if (target == null) break;
        const pairsBefore = (await stats()).pairs;
        await clickCard(target);
        const s3 = await stats();
        if (s3.pairs > pairsBefore) {
          run.events.add('match');
          if (s3.combo >= 2) run.events.add('combo');
          if (run.firstSuccessSec === null) run.firstSuccessSec = (Date.now() - t0) / 1000;
        } else run.events.add('mismatch');
        markEvent();
        await learnUps();
        await sleep(800);
      }
      const st2 = await stats();
      if (st2.pairs >= st2.total) break;
    }
  }

  const p = await phase();
  const s = await stats();
  run.durationSec = (Date.now() - t0) / 1000;
  run.completed = p === 'win' || s.pairs >= s.total;
  run.deaths = p === 'fail' ? 1 : 0;
  if (run.completed) { run.events.add('win'); run.events.add('level_clear'); }
  if (p === 'fail') run.events.add('fail');
  run.events.add('start');
  run.events.add('session_end');
  run.uniqueEvents = run.events.size;
  run.levelsReached = levelIndex + (run.completed ? 1 : 0);
  return run;
}

async function main() {
  const { server, port } = await serve(root, 8180);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });

  const runs = [];
  const pushRun = (r) => {
    runs.push({
      id: r.id,
      policy: r.policy,
      durationSec: +r.durationSec.toFixed(2),
      firstInputSec: r.firstInputSec == null ? null : +r.firstInputSec.toFixed(2),
      inputLatencyMs: r.inputLatencies.length ? +r.inputLatencies.sort((a, b) => a - b)[Math.floor(r.inputLatencies.length / 2)].toFixed(1) : 0,
      firstSuccessSec: r.firstSuccessSec == null ? null : +r.firstSuccessSec.toFixed(2),
      deaths: r.deaths,
      actions: r.actions,
      idleSec: +r.idleSec.toFixed(2),
      maxEventGapSec: +r.maxGapSec.toFixed(2),
      uniqueEvents: r.uniqueEvents,
      eventsList: [...r.events].sort(),
      levelsReached: r.levelsReached,
      completed: r.completed,
    });
  };

  const errors = [];
  try {
    // greedy：连续打 1→2→3 关
    {
      const { context, page, errors: errs } = await freshContext(browser);
      errors.push(...errs);
      await page.goto(`http://localhost:${port}/`);
      await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', null, { timeout: 15000 });
      await sleep(800);
      for (const lv of [1, 2, 3, 4]) {
        const r = await playRun(page, 'greedy', lv, 150);
        pushRun(r);
        // win 面板 → 点下一关；fail → 复活或重开
        if (r.completed) {
          await page.evaluate(() => {
            const next = document.getElementById('btn-next');
            if (next && !next.classList.contains('hidden')) next.click();
          });
          await sleep(400);
        } else {
          await page.evaluate(() => { window.__ll.start(1); });
        }
      }
      await context.close();
    }
    // random：L2 / L4 / L6 各乱点一局（边界与失败样本）
    for (const lv of [2, 4, 6]) {
      const { context, page, errors: errs } = await freshContext(browser);
      errors.push(...errs);
      await page.goto(`http://localhost:${port}/`);
      await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', null, { timeout: 15000 });
      await sleep(500);
      const r = await playRun(page, 'random', lv, 90);
      pushRun(r);
      await context.close();
    }
    // noinput：挂着不动 20s
    {
      const { context, page, errors: errs } = await freshContext(browser);
      errors.push(...errs);
      await page.goto(`http://localhost:${port}/`);
      await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', null, { timeout: 15000 });
      await page.evaluate(() => window.__ll.start(1));
      await sleep(1000);
      const r = await playRun(page, 'noinput', 1, 20);
      pushRun(r);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const out = { _howto: 'tools/selfplay.mjs 自动产出', runs, errors };
  fs.mkdirSync(path.join(root, 'tools/fun'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools/fun/autoplay.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  const ok = runs.length >= 3 && errors.length === 0;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
