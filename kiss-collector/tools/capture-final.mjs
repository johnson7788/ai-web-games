// tools/capture-final.mjs — 为 vision-review 捕获真实玩法截图到 tests/final/。
// 覆盖 4 章不同场景 + 移动端，保证「目标可见 / 剪影清晰 / 风格统一」的评分素材。
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
await mkdir(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8205);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function shotLevel(level, name, mobile = false) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
  await page.evaluate((lvl) => { window.__ll.startLevel(lvl); window.__ll.tutorial.skip(); }, level);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, name) });
  await ctx.close();
}

await shotLevel(1, '01-play.png');
await shotLevel(2, '02-drag.png');
await shotLevel(7, '03-garden.png');
await shotLevel(14, '04-mirror.png');
await shotLevel(18, '05-propose.png');
await shotLevel(21, '06-moon.png');
await shotLevel(24, '07-boss.png');
await shotLevel(1, '08-mobile.png', true);

await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }
console.log('saved final shots to', OUT);
process.exit(0);
