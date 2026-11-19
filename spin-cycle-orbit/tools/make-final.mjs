// 生成 tests/final/ 的 8 张「含玩法剪影」截图 + 根目录 poster.jpg（1280×720）。
// 只放干净的状态图（标题 demo / 玩法 / 连击 / 金核 / 岩核 / 狂热 / 结算 / 中文标题），
// 供 vision-review 扫描前 8 张。运行：node tools/make-final.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8260);
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(`✓ ${name}`);
};

await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
await page.waitForTimeout(800);

// 1. 标题（demo 轨道剪影）
await shot('01-title.png');

// 2. 玩法（跳过首次教程，避免遮罩压低剪影分）
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.endTutorial());
await page.waitForTimeout(300);
await shot('02-playing.png');

// 3. 连击（3 连）
await page.evaluate(() => { window.__ll.debug.startSeeded(1); window.__ll.debug.forceCapture(3); });
await page.waitForTimeout(450);
await shot('03-capture.png');

// 4. 金核为下一节点
await page.evaluate(() => { window.__ll.debug.startSeeded(1); window.__ll.debug.forceCapture(6); });
await page.waitForTimeout(450);
await shot('04-golden.png');

// 5. 岩核为下一节点
await page.evaluate(() => { window.__ll.debug.startSeeded(1); window.__ll.debug.forceCapture(4); });
await page.waitForTimeout(450);
await shot('05-rock.png');

// 6. 狂热
await page.evaluate(() => { window.__ll.debug.startSeeded(1); window.__ll.debug.forceCapture(8); });
await page.waitForTimeout(450);
await shot('06-frenzy.png');

// 7. 结算（先拿几分再判负，让面板有真实数据 + 冻结场景剪影）
await page.evaluate(() => { window.__ll.debug.startSeeded(2); window.__ll.debug.forceCapture(3); window.__ll.debug.gameOver(); });
await page.waitForTimeout(450);
await shot('07-result.png');

// 8. 中文标题
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = document.getElementById('lang-select');
  s.value = 'zh';
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(300);
await shot('08-title-zh.png');

// poster.jpg：选一帧好看的玩法画面（狂热 + 高分）
await page.evaluate(() => { window.__ll.debug.startSeeded(1); window.__ll.debug.forceCapture(8); });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
console.log('✓ poster.jpg');

await browser.close();
server.close();
console.log('done');
