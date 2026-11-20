// tools/shots.mjs — 生成 tests/final/ 的验收截图（标题 / 玩法 / 金瀑 / 移动端 / 两换章）。
// 用真实浏览器 + 真实开局；用 debug 钩子摆出可读性最强的棋盘状态。
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'final');
mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8187);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const baseUrl = `http://127.0.0.1:${port}/`;

async function newPage(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await p.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 10000 });
  await p.waitForTimeout(600);
  return { p, ctx };
}

async function startAndSkip(p) {
  await p.click('#btn-start');
  await p.waitForTimeout(500);
  const skip = p.locator('[data-tutorial-skip]').first();
  if (await skip.count()) await skip.click({ force: true });
  await p.waitForTimeout(300);
}

const colorOf = (q, r) => (((q + r) % 6) + 6) % 6;

try {
  // 1) 标题
  let { p, ctx } = await newPage(1280, 720);
  await p.screenshot({ path: path.join(outDir, '01-title.png') });
  await ctx.close();

  // 2) 玩法：已落块 + 近满环幽灵 + HUD
  ({ p, ctx } = await newPage(1280, 720));
  await startAndSkip(p);
  await p.evaluate(() => { const color = (q, r) => (((q + r) % 6) + 6) % 6;
    const r = window.__ll.run;
    r.cells.forEach((c) => {
      if (!c.wall && c.r <= 0) { c.filled = true; c.color = color(c.q, c.r); }
    });
    const row1 = r.lines.find((l) => l.every((i) => r.cells[i].r === 1));
    if (row1) {
      for (let k = 0; k < row1.length; k += 1) {
        const i = row1[k];
        r.cells[i].filled = true;
        r.cells[i].color = color(r.cells[i].q, r.cells[i].r);
      }
      const gap = row1[Math.floor(row1.length / 2)];
      r.cells[gap].filled = false;
      r.hover = gap;
    }
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(outDir, '02-play.png') });
  await ctx.close();

  // 3) 金瀑：三环全满的黄金瞬间
  ({ p, ctx } = await newPage(1280, 720));
  await startAndSkip(p);
  await p.evaluate(() => { const color = (q, r) => (((q + r) % 6) + 6) % 6;
    const r = window.__ll.run;
    const rows = [2, 3, 4].map((rr) => r.lines.find((l) => l.every((i) => r.cells[i].r === rr))).filter(Boolean);
    for (const line of rows) {
      for (const i of line) {
        r.cells[i].filled = true;
        r.cells[i].color = color(r.cells[i].q, r.cells[i].r);
      }
    }
    window.G.renderer.burst(640, 400, 'cascade');
  });
  await p.waitForTimeout(140);
  await p.screenshot({ path: path.join(outDir, '03-cascade.png') });
  await ctx.close();

  // 4) 移动端玩法
  ({ p, ctx } = await newPage(844, 390, true));
  await startAndSkip(p);
  await p.evaluate(() => { const color = (q, r) => (((q + r) % 6) + 6) % 6;
    const r = window.__ll.run;
    r.cells.forEach((c) => {
      if (!c.wall && c.r <= 0) { c.filled = true; c.color = color(c.q, c.r); }
    });
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(outDir, '04-mobile.png') });
  await ctx.close();

  // 5) 换章：蜜库（琥珀）
  ({ p, ctx } = await newPage(1280, 720));
  await startAndSkip(p);
  await p.evaluate(() => { const color = (q, r) => (((q + r) % 6) + 6) % 6;
    const r = window.__ll.run;
    r.score = 1600;
    r._debug.advanceTier();
    r.cells.forEach((c) => {
      if (!c.wall && c.r <= 1) { c.filled = true; c.color = color(c.q, c.r); }
    });
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(outDir, '05-honey.png') });
  await ctx.close();

  // 6) 换章：冬巢（蓝白 + 窄盘）
  ({ p, ctx } = await newPage(1280, 720));
  await startAndSkip(p);
  await p.evaluate(() => { const color = (q, r) => (((q + r) % 6) + 6) % 6;
    const r = window.__ll.run;
    r.score = 5200;
    r._debug.advanceTier();
    r.cells.forEach((c) => {
      if (!c.wall && c.r <= 1) { c.filled = true; c.color = color(c.q, c.r); }
    });
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(outDir, '06-winter.png') });
  await ctx.close();

  console.log('shots written to', outDir);
} finally {
  await browser.close();
  server.close();
}
