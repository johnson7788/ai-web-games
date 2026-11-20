// 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题/tagline → playwright 截图存 jpg
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'tests', 'artifacts');
mkdirSync(ART, { recursive: true });

const { server, port } = await serve(ROOT, 8149);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// 1) 玩法截图：进波次中段，敌人最多时打一发共鸣斩
const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page1 = await ctx1.newPage();
await page1.addInitScript(() => localStorage.setItem('hero-vanguard:tutorial-done', 'true'));
await page1.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page1.waitForFunction(() => typeof window.__ll?.start === 'function' && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page1.evaluate(() => window.__ll.start());
await page1.waitForTimeout(4300);
await page1.keyboard.press('KeyJ');
await page1.waitForTimeout(250);
await page1.screenshot({ path: join(ART, 'poster-bg.png') });
await ctx1.close();

// 2) HTML 叠字 → poster.jpg
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; }
body { width:1280px; height:720px; overflow:hidden; background:#051019; font-family:'Segoe UI','PingFang SC',sans-serif; }
.bg { position:absolute; inset:0; }
.bg img { width:1280px; height:720px; display:block; }
.veil { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 46%, rgba(5,16,25,0.05) 0%, rgba(5,16,25,0.72) 100%); }
.title { position:absolute; left:0; right:0; top:210px; text-align:center; color:#eaffff;
  font-size:96px; font-weight:800; letter-spacing:0.14em; text-shadow:0 0 8px #06121c, 0 0 22px #7ff2ff, 0 0 46px rgba(127,242,255,0.85); }
.tagline { position:absolute; left:0; right:0; top:352px; text-align:center; color:#ffd166;
  font-size:26px; letter-spacing:0.28em; text-transform:uppercase; text-shadow:0 0 10px rgba(0,0,0,0.8); }
</style></head><body>
<div class="bg"><img src="poster-bg.png"></div><div class="veil"></div>
<div class="title">HERO VANGUARD</div>
<div class="tagline">Twin-Hero Station Defense</div>
</body></html>`;
writeFileSync(join(ART, 'poster.html'), html);

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.goto(`http://127.0.0.1:${port}/tests/artifacts/poster.html`, { waitUntil: 'load' });
await page2.waitForTimeout(300);
await page2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await ctx2.close();

await browser.close();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
