// tools/poster.mjs — 玩法图 + HTML 叠大标题/发光描边 → poster.jpg（1280×720）。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const base = readFileSync(join(ROOT, 'tests/final/06-jackpot.png')).toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1280px; height: 720px; overflow: hidden; background: #160906; font-family: 'PingFang SC','Segoe UI',monospace; }
  .bg { position: absolute; inset: 0; background: url(data:image/png;base64,${base}) center/cover no-repeat; }
  .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,8,3,0.86) 0%, rgba(20,8,3,0.15) 46%, rgba(20,8,3,0.55) 100%); }
  .title { position: absolute; top: 58px; left: 0; right: 0; text-align: center; }
  .logo {
    font-size: 96px; font-weight: 900; letter-spacing: 0.12em; color: #ffe9b8;
    text-shadow: 0 0 8px #ffcf6a, 0 0 24px #ffcf6a, 0 0 60px rgba(255,207,106,0.8), 0 4px 0 #7a3c08;
  }
  .tagline {
    margin-top: 16px; font-size: 30px; letter-spacing: 0.06em; color: #fff4da;
    text-shadow: 0 0 10px rgba(255,207,106,0.9), 0 2px 0 rgba(0,0,0,0.6);
  }
  .cta {
    position: absolute; left: 0; right: 0; bottom: 40px; text-align: center;
    font-size: 22px; letter-spacing: 0.14em; color: #ffd84a;
    text-shadow: 0 0 12px rgba(255,216,74,0.9);
  }
</style></head><body>
  <div class="bg"></div>
  <div class="veil"></div>
  <div class="title">
    <div class="logo">SLOT LEGENDS</div>
    <div class="tagline">Spin the reels · Match the heroes</div>
  </div>
  <div class="cta">侠盗的传说筹码 · 纯娱乐无真钱</div>
</body></html>`;

writeFileSync('/tmp/slot-legends-poster.html', html);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file:///tmp/slot-legends-poster.html', { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('saved', join(ROOT, 'poster.jpg'));
