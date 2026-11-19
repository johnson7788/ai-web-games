// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题/tagline → playwright 截图。
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'tests', 'artifacts');
await mkdir(ART, { recursive: true });

const { server, port } = await serve(ROOT, 8201);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 1) 玩法底图（第 21 关月光舞会：月亮 + 星星 + 爱心，最有氛围）
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => window.__ll.tutorial.skip());
await page.evaluate(() => window.__ll.startLevel(21));
await page.waitForTimeout(500);
await page.screenshot({ path: join(ART, 'poster-base.png') });
await ctx.close();

// 2) HTML 叠字
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; background:#3a0f22; font-family:'PingFang SC','Segoe UI','Microsoft YaHei',sans-serif; }
img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(30,6,20,.10) 0%, rgba(30,6,20,.04) 42%, rgba(30,6,20,.82) 100%); }
.brand { position:absolute; left:0; right:0; top:140px; text-align:center; }
h1 { font-size:112px; font-weight:900; letter-spacing:.12em; color:#fff5f9; margin:0; text-shadow:0 0 26px rgba(255,111,165,.95), 0 0 66px rgba(255,111,165,.5), 0 4px 0 #7a1f48; }
.tag { margin-top:22px; font-size:30px; letter-spacing:.08em; color:#ffd166; text-shadow:0 0 18px rgba(255,209,102,.85); }
.badge { position:absolute; left:0; right:0; bottom:52px; text-align:center; font-size:26px; letter-spacing:.14em; color:#ffe3ee; text-shadow:0 2px 8px rgba(0,0,0,.7); }
</style></head><body>
<img class="bg" src="/tests/artifacts/poster-base.png">
<div class="shade"></div>
<div class="brand"><h1>KISS COLLECTOR</h1><div class="tag">24 sweet puzzles. One little cupid.</div></div>
<div class="badge">TAP · DRAG · HOLD — COLLECT EVERY KISS</div>
</body></html>`;
await writeFile(join(ART, 'poster.html'), html);

const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ppage = await pctx.newPage();
await ppage.goto(`http://127.0.0.1:${port}/tests/artifacts/poster.html`, { waitUntil: 'load', timeout: 20000 });
await ppage.waitForTimeout(400);
await ppage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await pctx.close();

await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
