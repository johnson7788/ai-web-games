// 生成 tests/final/ 截图（供 vision-review 与 poster 使用）。
// 用法：node tools/shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const collector = createErrorCollector();
collector.attach(page, port);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 90 });
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

const shots = [
  { floor: 1, name: '01-floor1.png' },
  { floor: 2, name: '02-floor2.png' },
  { floor: 3, name: '03-floor3.png' },
  { floor: 4, name: '04-floor4.png' },
  { floor: 5, name: '05-floor5.png' },
];
for (const s of shots) {
  await page.evaluate((f) => window.__ll.start(f), s.floor);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, s.name) });
}

// 结算（通关）截图
await page.evaluate(() => { window.__ll.start(1); window.__ll.debug.autoWin(); });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, '06-result.png') });

console.log('shots written to', outDir);
await browser.close();
server.close();
if (collector.hasErrors()) {
  console.error(JSON.stringify(collector.toJSON(), null, 2));
  process.exit(1);
}
