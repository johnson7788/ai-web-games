// make-final.mjs — 生成 tests/final 的 8 张「含玩法剪影」截图 + poster.jpg，
// 供 vision-review（只扫 tests/final 前 8 张）与交付物料使用。
// 纯菜单（暂停）截图留在 tests/artifacts，不放这里。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8220);
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log('✓', name);
}

async function waitPlaying(page) {
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'playing', { timeout: 8000 }).catch(() => {});
}

try {
  // ---- 桌面 1280×720 ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(base, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot(page, '01-title.png');

  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start());
  await waitPlaying(page);
  await page.waitForFunction(() => window.__ll.sim() && window.__ll.sim().phase === 'playerTurn', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '02-playing.png');

  await page.evaluate(() => window.__ll.debug.setCoins(200));
  await page.evaluate(() => window.__ll.debug.reveal());
  await page.waitForTimeout(300);
  await shot(page, '03-resolve.png');

  // 连击态（进入下一回合后设 combo=2）
  await page.waitForFunction(() => window.__ll.sim() && window.__ll.sim().phase !== 'resolving', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.__ll.debug.setCombo(2));
  await page.waitForTimeout(300);
  await shot(page, '04-combo.png');

  await page.evaluate(() => window.__ll.debug.win());
  await page.waitForTimeout(400);
  await shot(page, '05-result.png');

  // 中文标题（?lang=zh 覆盖）
  await page.goto(base + '?lang=zh', { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot(page, '06-title-zh.png');

  // 强化技能激活（playerTurn 下点亮 buff，无浮字）
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.start(); });
  await waitPlaying(page);
  await page.evaluate(() => window.__ll.debug.setCoins(200));
  await page.waitForFunction(() => window.__ll.sim() && window.__ll.sim().phase === 'playerTurn', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.__ll.run().useAbility('buff'));
  await page.waitForTimeout(300);
  await shot(page, '07-buff-play.png');

  await ctx.close();

  // ---- 移动端 844×390 横屏 ----
  const mctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await mpage.goto(base, { waitUntil: 'load', timeout: 20000 });
  await mpage.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await mpage.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await mpage.evaluate(() => window.__ll.start());
  await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase === 'playing', { timeout: 8000 }).catch(() => {});
  await mpage.waitForFunction(() => window.__ll.sim() && window.__ll.sim().phase === 'playerTurn', { timeout: 8000 }).catch(() => {});
  await mpage.waitForTimeout(400);
  await shot(mpage, '08-mobile.png');
  await mctx.close();

  // poster：标题屏 1280×720（游戏名 + 霓虹 demo）
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const ppage = await pctx.newPage();
  await ppage.goto(base, { waitUntil: 'load', timeout: 20000 });
  await ppage.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await ppage.waitForTimeout(900);
  await ppage.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log('✓ poster.jpg');
  await pctx.close();

  if (errors.length) {
    console.error('⚠ console/page errors:', errors.slice(0, 5));
    process.exitCode = 1;
  } else {
    console.log('\n✓ make-final done (0 error)');
  }
} finally {
  await browser.close();
  server.close();
}
