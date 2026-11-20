// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法图 + 发光大标题 + tagline 叠字
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pw = require('/opt/homebrew/lib/node_modules/playwright/index.js');

const bg = readFileSync(join(ROOT, 'tests', 'final', '03-high-wall.png')).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; position:relative; overflow:hidden; font-family:'PingFang SC','Segoe UI',sans-serif; }
.bg { position:absolute; inset:0; background:url('data:image/png;base64,${bg}') center/cover no-repeat; }
.veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,10,4,0.15) 0%, rgba(20,10,4,0) 40%, rgba(20,10,4,0.55) 100%); }
.title { position:absolute; left:0; right:0; top:150px; text-align:center; color:#fff6e0; font-size:104px; font-weight:900; letter-spacing:0.12em; text-shadow:0 0 18px rgba(255,201,74,0.9), 0 0 46px rgba(255,201,74,0.55), 0 4px 6px rgba(0,0,0,0.6); }
.tagline { position:absolute; left:0; right:0; top:290px; text-align:center; color:#ffe9d0; font-size:30px; letter-spacing:0.05em; text-shadow:0 2px 6px rgba(0,0,0,0.7); }
.hint { position:absolute; left:0; right:0; bottom:48px; text-align:center; color:#ffe9d0; font-size:22px; letter-spacing:0.1em; text-shadow:0 2px 5px rgba(0,0,0,0.7); }
</style></head><body>
<div class="bg"></div><div class="veil"></div>
<div class="title">DONKEY HURDLE</div>
<div class="tagline">Run the Silk Road. Keep the jars.</div>
<div class="hint">TAP TO JUMP · HOLD TO LEAP · K TO DROP A JAR</div>
</body></html>`;

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
console.log('saved poster.jpg');
process.exit(0);
