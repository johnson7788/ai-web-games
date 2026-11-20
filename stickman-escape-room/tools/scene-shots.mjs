// 截图脚本：产出 vision-review 用的 tests/final/*.png 与 poster.jpg（1280×720）。
// 自带静态服务，用完即关；端口 8200-8299 自增。运行：node tools/scene-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });
// 清掉 tutorial-check 等写进来的截图，保证 vision-review 只看到本脚本产出的干净帧
for (const f of fs.readdirSync(OUT)) {
  if (/\.(png|jpe?g|webp)$/i.test(f)) fs.rmSync(path.join(OUT, f));
}

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const collector = createErrorCollector();
collector.attach(page, port);

async function shot(name, type = 'png') {
  await page.screenshot({ path: path.join(OUT, name), type, quality: type === 'jpeg' ? 92 : undefined });
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(700);

  // 标题
  await shot('01-title.png');

  // 开始 + 跳教程
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(250);
  await shot('02-play.png');

  // 天花板下坠中（L1 descendTime=1.0）
  await page.evaluate(() => {
    const r = window.__ll.run();
    while (r.state.phase === 'countdown') r.step(1 / 20);
    r.step(0.28);
  });
  await page.waitForTimeout(80);
  await shot('03-descent.png');
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });

  // 第 3 关（岩石墙）变化
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(350);
  await shot('04-rock.png');
} finally {
  await browser.close();
  server.close();
}

if (collector.hasErrors()) {
  console.error(JSON.stringify(collector.toJSON(), null, 2));
  process.exit(1);
}
console.log('screenshots written to', OUT);
console.log('poster:', path.join(ROOT, 'poster.jpg'));
