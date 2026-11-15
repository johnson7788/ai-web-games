// Story-path check via the real menu flow: title → Story → chapter I → difficulty → select → loading → prologue
// (English cards) → battle (English objective/dialogue) → zh switch keeps the objective.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = path.resolve(import.meta.dirname, '..');
const out = import.meta.dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(dir, p === '/' ? 'index.html' : p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], consoleErrs = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });
const report = {};
const key = async (k, ms) => { await page.keyboard.press(k); await sleep(ms); };
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(7000);
  await key('Enter', 700);          // wake
  await key('Enter', 900);          // Story panel
  await key('Enter', 900);          // chapter I (open) → difficulty
  await key('Enter', 2000);         // Normal → select
  await page.screenshot({ path: path.join(out, 'story-select.png') });
  await key('Enter', 8000);         // deploy → loading → prologue
  report.prologueVisible = await page.evaluate(() => !document.getElementById('prologue').hidden);
  report.prologueText = await page.evaluate(() => document.querySelector('.pl-cols')?.textContent?.slice(0, 140));
  report.prologueEnClass = await page.evaluate(() => document.getElementById('prologue').classList.contains('enlang'));
  await page.screenshot({ path: path.join(out, 'story-prologue.png') });
  await key('Enter', 2500);         // next card
  await page.screenshot({ path: path.join(out, 'story-prologue-2.png') });
  await key('Escape', 5000);        // skip → stamp → battle
  await sleep(3500);
  report.battleReached = await page.evaluate(() => !document.getElementById('hud').hidden);
  report.objective = await page.evaluate(() => document.querySelector('.h-obj b')?.textContent);
  report.dialogue = await page.evaluate(() => document.querySelector('.h-dlg p')?.textContent);
  await page.screenshot({ path: path.join(out, 'story-battle.png') });
  await page.click('#pipy-lang-btn'); await sleep(800);
  report.zhObjective = await page.evaluate(() => document.querySelector('.h-obj b')?.textContent);
  report.zhName = await page.evaluate(() => document.querySelector('.h-player .name')?.textContent);
  await page.click('#pipy-lang-btn'); await sleep(600);
  report.enObjectiveRestored = await page.evaluate(() => document.querySelector('.h-obj b')?.textContent);
} catch (e) { report.fatal = String(e.message || e).split('\n')[0]; }
report.errors = errors; report.consoleErrs = consoleErrs;
fs.writeFileSync(path.join(out, 'story-report.json'), JSON.stringify(report, null, 2));
await browser.close(); srv.close();
console.log(JSON.stringify(report, null, 1));
process.exit(report.fatal || errors.length ? 1 : 0);