// 调试版上传：抓全部网络请求/响应，失败自动重试提交（最多 5 次）
// 用法: node tools/upload-debug.mjs <manifest.json>
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';

const m = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const HOME = process.env.HOME;
const SESSION_FILE = path.join(HOME, '.config/pipy/session.json');
const cred = JSON.parse(fs.readFileSync(path.join(HOME, '.config/pipy/credentials.json'), 'utf8'));
const OUT = path.dirname(m.zip);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await pw.chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: SESSION_FILE });
const page = await ctx.newPage();

page.on('response', (r) => {
  if (r.request().method() !== 'GET' && r.status() >= 300) console.log(`[resp] ${r.request().method()} ${r.url().slice(0, 90)} -> ${r.status()}`);
});
page.on('requestfailed', (r) => console.log(`[FAIL] ${r.method()} ${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('https://pipygames.com/admin/games', { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(800);
await page.click('button:has-text("Upload game package")');
await sleep(900);

await page.locator('input[placeholder="Super Runner"]').fill(m.title);
// 分类：Puzzle 主分类（同 upload.mjs 的点 label 方式）
const cats = await page.evaluate((want) => {
  const log = [];
  const btn = [...document.querySelectorAll('button')].find((b) => /分类|Categor/i.test(b.innerText) || (b.innerText.includes('▼') && b.closest('label,div')?.innerText.includes('分类')));
  const find = (name) => [...document.querySelectorAll('label')].find((l) => l.innerText.trim() === name);
  const checked = (l) => l.querySelector('input')?.checked;
  if (btn) btn.click();
  return { log, find: typeof find, btn: !!btn };
}, m.categories);
// 简化：直接用页面点击流程
{
  const btn = page.locator('button:has-text("分类")').first();
  if (await btn.count()) { await btn.click(); await sleep(400); }
  for (const name of m.categories) {
    const lab = page.locator(`label:has-text("${name}")`).first();
    if (await lab.count()) {
      const isOn = await lab.locator('input').isChecked().catch(() => false);
      if (!isOn) await lab.click();
    }
  }
  const btn2 = page.locator('button:has-text("分类")').first();
  if (await btn2.count()) await btn2.click().catch(() => {});
  await sleep(300);
}
await page.locator('input[placeholder="runner,arcade"]').fill(m.tags.join(','));
await page.locator('textarea').nth(0).fill(m.short);
await page.locator('textarea').nth(1).fill(m.long);
await page.locator('input[type=file][accept*=".zip"]').setInputFiles(m.zip);
console.log('→ 表单已填（zip:', path.basename(m.zip), '），跳过封面/GIF 上传（后台自动截图）');

let done = false;
for (let attempt = 1; attempt <= 5 && !done; attempt += 1) {
  console.log(`→ 第 ${attempt} 次提交…`);
  const respPromise = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('admin'), { timeout: 180000 }).catch(() => null);
  await page.click('button:has-text("Upload & Publish")');
  const resp = await respPromise;
  if (resp) {
    console.log('→ POST', resp.url().slice(0, 100), '->', resp.status());
    try {
      const body = await resp.text();
      console.log('→ body:', body.slice(0, 300));
    } catch { /* noop */ }
    if (resp.status() < 300) done = true;
  } else {
    console.log('→ POST 无响应（超时）');
  }
  await sleep(8000);
  const errTxt = await page.locator('text=Failed to fetch').count().catch(() => 0);
  const processing = await page.locator('text=Processing').count().catch(() => 0);
  console.log(`→ 页面状态: failed-to-fetch=${errTxt} processing=${processing}`);
  await page.screenshot({ path: path.join(OUT, `attempt-${attempt}.png`) });
  if (processing) { done = true; }
  if (!done && attempt < 5) {
    console.log('→ 等 60s 后重试…');
    await sleep(60000);
  }
}

// 等处理完成并回列表找 URL
await sleep(20000);
await page.goto(`https://pipygames.com/admin/games?q=${encodeURIComponent(m.title)}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(4000);
const url = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /^\/games\//.test(x.getAttribute('href') || ''));
  return a ? a.getAttribute('href') : null;
});
console.log('GAME-URL:', url);
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ title: m.title, gameUrl: url }, null, 2));
await browser.close();
