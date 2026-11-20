// tools/capture-final.mjs — 生成 tests/final/*.png 验收截图（标题/玩法/格挡/涟漪/三场景/结算/移动端）。
// 8 张，以玩法为主（vision-review 只扫 tests/final 前 8 张）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests/final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const url = `http://127.0.0.1:${port}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log('shot', name);
}

try {
  // ---- 桌面 ----
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.setItem('sky-drop-dodge:tutorial-done', 'true'));
  await page.reload({ waitUntil: 'load' });
  await waitForBoot(page, 10000);
  await sleep(500);

  await shot(page, '01-title.png');

  await page.click('#btn-start');
  await sleep(400);
  // 进波 2 密雨（画面更满、目标更明确），临时无敌保证截图期存活
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.waveIndex = 2;
    r.waveTime = 0;
    r.player.invulnUntil = r.time + 30;
  });
  await sleep(1400);
  await shot(page, '02-play.png');

  await page.keyboard.down('Space');
  await sleep(350);
  await shot(page, '03-block.png');
  await page.keyboard.up('Space');

  // 涟漪（slow-mo）
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.rippleUntil = r.time + 2;
    r.player.invulnUntil = r.time + 30;
  });
  await sleep(250);
  await shot(page, '04-ripple.png');

  // 雷雨场景
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.waveIndex = 5;
    r.waveTime = 0;
    r.player.invulnUntil = r.time + 30;
  });
  await sleep(900);
  await shot(page, '05-thunder.png');

  // 晚霞场景
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.waveIndex = 9;
    r.waveTime = 0;
    r.player.invulnUntil = r.time + 30;
  });
  await sleep(900);
  await shot(page, '06-dusk.png');

  // 结算卡（快进到死亡）
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.player.invulnUntil = -Infinity;
    for (let k = 0; k < 60 * 400 && r.phase === 'playing'; k += 1) {
      r.step({ steerX: 640, block: false });
      r.drainEvents();
    }
  });
  await sleep(700);
  await shot(page, '07-dead.png');

  await context.close();

  // ---- 移动端 ----
  const mctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await mpage.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(mpage, 10000);
  await mpage.evaluate(() => localStorage.setItem('sky-drop-dodge:tutorial-done', 'true'));
  await mpage.reload({ waitUntil: 'load' });
  await waitForBoot(mpage, 10000);
  await mpage.click('#btn-start');
  await sleep(1500);
  await shot(mpage, '08-mobile.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log('capture-final done →', outDir);
