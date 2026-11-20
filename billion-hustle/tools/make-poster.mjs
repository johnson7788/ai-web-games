// 生成 poster.jpg：真实玩法截图 + 发光大标题 + tagline，1280×720 JPEG。
// 用法：node tools/make-poster.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT = process.argv[2] || 'tests/final/06-play2.png';
const OUT = process.argv[3] || 'poster.jpg';

const b64 = readFileSync(join(ROOT, SHOT)).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;width:1280px;height:720px;overflow:hidden;background:#0c0a06;font-family:'PingFang SC','Segoe UI','Microsoft YaHei',sans-serif">
<img src="data:image/png;base64,${b64}" style="position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;filter:brightness(0.5) saturate(1.1)">
<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:18px;padding:0 80px">
  <div style="font-size:104px;font-weight:900;letter-spacing:0.1em;color:#ffd76a;text-shadow:0 0 34px rgba(255,201,74,0.95),0 0 70px rgba(255,201,74,0.55),0 5px 0 #5a3a00,0 10px 24px rgba(0,0,0,0.6)">BILLION HUSTLE</div>
  <div style="font-size:27px;color:#fff4d6;text-shadow:0 2px 10px #000,0 0 18px rgba(255,201,74,0.5);max-width:760px">Click a garage startup into a ¥100M unicorn — tap, upgrade, hire, and bet the trend.</div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, OUT), type: 'jpeg', quality: 88 });
await browser.close();
writeFileSync(join(ROOT, 'tests/artifacts/poster.html'), html);
console.log('saved', join(ROOT, OUT));
process.exit(0);
