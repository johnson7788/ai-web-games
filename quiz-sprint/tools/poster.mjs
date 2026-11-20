// tools/poster.mjs — 玩法截图叠大标题 + tagline → 1280×720 poster.jpg。
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8150);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const img = `http://127.0.0.1:${port}/tests/final/05-scholar.png`;
await page.setContent(`<!DOCTYPE html><html><head><style>
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #0b1026; }
  .bg { position: absolute; inset: 0; width: 1280px; height: 720px; object-fit: cover; filter: brightness(0.62) saturate(1.05); }
  .overlay { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 96px; }
  .logo { font: 800 92px/1 'PingFang SC','Hiragino Sans','Segoe UI',monospace; letter-spacing: 0.12em; color: #eaffff;
    text-shadow: 0 0 22px rgba(74,240,255,0.95), 0 0 60px rgba(74,240,255,0.5), 0 2px 0 #0a2a44; }
  .tag { margin-top: 18px; font: 600 30px/1.4 'PingFang SC','Segoe UI',monospace; letter-spacing: 0.06em; color: #ffd166;
    text-shadow: 0 0 16px rgba(255,209,102,0.7); max-width: 900px; text-align: center; }
</style></head><body>
  <img class="bg" src="${img}">
  <div class="overlay">
    <div class="logo">QUIZ SPRINT</div>
    <div class="tag">Answer right to sprint &middot; Chain 5 for Scholar Sprint &middot; Wager when you dare</div>
  </div>
</body></html>`);
await page.waitForTimeout(600);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
