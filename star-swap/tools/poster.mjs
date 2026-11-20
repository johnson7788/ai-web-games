// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题/tagline
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 用现成玩法截图作底（capture.mjs 已产出 tests/final/01-play.png）
const baseShot = path.join(root, 'tests', 'final', '01-play.png');
if (!fs.existsSync(baseShot)) {
  console.error('缺少底图，先跑 node tools/capture.mjs');
  process.exit(1);
}
const b64 = fs.readFileSync(baseShot).toString('base64');

const { loadPlaywright } = await import('../../../skills/webgame-playbook/scripts/_lib.mjs');
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(`<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; font-family:'PingFang SC','Segoe UI',sans-serif; }
  .bg { position:absolute; inset:0; }
  .bg img { width:100%; height:100%; object-fit:cover; }
  .overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background: linear-gradient(180deg, rgba(10,6,24,0.35) 0%, rgba(10,6,24,0.05) 45%, rgba(10,6,24,0.72) 100%); }
  .logo { font-size:118px; font-weight:900; letter-spacing:0.14em; color:#fff;
    text-shadow: 0 0 24px rgba(160,107,255,1), 0 0 60px rgba(160,107,255,0.8), 0 4px 0 #3a1d6e; }
  .tag { margin-top:18px; font-size:26px; color:#e9e2ff; letter-spacing:0.06em;
    text-shadow: 0 0 14px rgba(0,0,0,0.9); }
</style></head><body>
  <div class="bg"><img src="data:image/png;base64,${b64}"></div>
  <div class="overlay"><div class="logo">STAR SWAP</div><div class="tag">Swap stardust. Forge supernovas.</div></div>
</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('✓ poster.jpg');
