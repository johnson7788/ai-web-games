// tools/poster.mjs — 生成 1280×720 poster.jpg：玩法截图 + 大标题（发光描边）+ tagline
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'tests', 'artifacts'), { recursive: true });

const posterHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#050a12;}
  .wrap{position:relative;width:1280px;height:720px;}
  .bg{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;filter:brightness(0.72) saturate(1.05);}
  .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,18,0.15) 0%,rgba(5,10,18,0.35) 55%,rgba(5,10,18,0.85) 100%);}
  .title{position:absolute;left:0;right:0;top:210px;text-align:center;font-family:'PingFang SC','Arial Black',sans-serif;font-size:120px;font-weight:900;letter-spacing:0.16em;color:#fff;
    text-shadow:0 0 12px #54e7ff,0 0 30px #54e7ff,0 0 70px #ff5d5d,0 4px 6px rgba(0,0,0,0.7);}
  .tag{position:absolute;left:0;right:0;top:390px;text-align:center;font-family:'PingFang SC',sans-serif;font-size:30px;letter-spacing:0.12em;color:#dffaff;text-shadow:0 0 14px rgba(84,231,255,0.8);}
  .zh{position:absolute;left:0;right:0;top:452px;text-align:center;font-family:'PingFang SC',sans-serif;font-size:22px;letter-spacing:0.3em;color:#ffd76a;text-shadow:0 0 10px rgba(255,215,106,0.6);}
</style></head><body>
<div class="wrap">
  <img class="bg" src="tests/final/03-combat.png">
  <div class="shade"></div>
  <div class="title">GUN LEGEND</div>
  <div class="tag">AIM · FIRE · ROLL · TRIGGER THE WHITE DOVE</div>
  <div class="zh">枪神传说 · 雨巷双枪</div>
</div>
</body></html>`;

const { server, port } = await serve(ROOT, 8160);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(posterHtml, { waitUntil: 'load' });
// 背景图同源加载（relative 到 server root）
await page.evaluate((port) => {
  const img = document.querySelector('.bg');
  img.src = `http://127.0.0.1:${port}/tests/final/03-combat.png`;
}, port);
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.close();
console.log('saved poster.jpg');
process.exit(0);
