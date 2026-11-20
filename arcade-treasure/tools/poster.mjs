// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + 大标题（发光描边）+ tagline。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const shotPath = join(root, 'tests', 'final', '04-swarm.png');
const b64 = readFileSync(shotPath).toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; position:relative; font-family:"Courier New",monospace; }
.bg { position:absolute; inset:0; }
.bg img { width:1280px; height:720px; object-fit:cover; }
.dim { position:absolute; inset:0; background:radial-gradient(circle at 50% 42%, rgba(10,7,20,0.1) 0%, rgba(10,7,20,0.72) 88%); }
.title-wrap { position:absolute; left:0; right:0; top:36px; text-align:center; }
.title {
  font-size:96px; font-weight:900; letter-spacing:0.10em; color:#fff2fe;
  text-shadow: 0 0 14px #fff, 0 0 30px #ff4fd8, 0 0 60px #ff4fd8, 0 0 90px #ff4fd8;
}
.tagline {
  margin-top:14px; font-size:26px; color:#ffd166; letter-spacing:0.05em;
  text-shadow: 0 0 10px rgba(255,209,102,0.9);
}
.foot { position:absolute; left:0; right:0; bottom:30px; text-align:center; font-size:18px; color:#f6ecff; letter-spacing:0.08em; }
</style></head>
<body>
  <div class="bg"><img src="data:image/png;base64,${b64}"></div>
  <div class="dim"></div>
  <div class="title-wrap"><div class="title">ARCADE TREASURE</div><div class="tagline">Three cabinets. One coin purse. Light the GRAND PRIX.</div></div>
  <div class="foot">WHACK · CATCH · SHOOT</div>
</body></html>`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(200);
await page.screenshot({ path: join(root, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
const size = writeFileSync ? undefined : undefined;
console.log('poster.jpg written');
