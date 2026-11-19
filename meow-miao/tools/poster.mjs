// 生成 poster.jpg（1280×720）：起本地服务，截标题屏与战斗屏，选最好的一张做海报。
// 运行：node tools/poster.mjs（用完即关服务）
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'tests', 'artifacts'), { recursive: true });
const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);
await page.waitForTimeout(800);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'poster-title.png'), type: 'png' });

await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.startSeeded(2, 5); });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const r = window.__ll.run;
  if (!r) return;
  let g = 0;
  while (g < 5 && r.state.phase === 'playing') {
    const s = r._solution[r._solIdx];
    if (s === undefined) break;
    r._solIdx += 1;
    const t = r.freeTiles().find((x) => x.symbol === s);
    if (!t) break;
    r.pick(t.id);
    g += 1;
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'poster-game.png'), type: 'png' });

await browser.close();
server.close();
console.log('wrote tests/artifacts/poster-title.png + poster-game.png');
