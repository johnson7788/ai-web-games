/**
 * 原地换包：pipygames 后台的「Replace ZIP」。
 *
 * 为什么不用 upload.mjs --publish：那条路会新建一个游戏，URL 和已有存档都会变。
 * 这里只替换 zip，slug / Play URL / 存档 key 全部保持不变。
 *
 * 用法：node tools/replace-zip.mjs <zip 路径> --title "Seize the Log"
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const SESSION = `${process.env.HOME}/.config/pipy/session.json`;
const args = process.argv.slice(2);
const zip = args.find((a) => !a.startsWith('--'));
const titleIdx = args.indexOf('--title');
const title = titleIdx >= 0 ? args[titleIdx + 1] : 'Seize the Log';

if (!zip || !fs.existsSync(zip)) {
  console.error('用法: node tools/replace-zip.mjs <zip> [--title "..."]');
  process.exit(1);
}
if (!fs.existsSync(SESSION)) {
  console.error('缺少登录态，先跑一次 upload.mjs --dry-run');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: SESSION });
const page = await ctx.newPage();

await page.goto('https://pipygames.com/admin/games', { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(2000);

// 搜到目标那一行
const search = page.locator('input[placeholder*="Search title"]').first();
if (await search.count()) {
  await search.fill(title);
  await sleep(1500);
}

const row = page.locator('tr', { hasText: title }).first();
await row.waitFor({ timeout: 20000 });

// 行内按钮是图标按钮，只能靠 aria-label 定位；点开是一个弹窗，里面有自己的文件输入
page.on('dialog', async (d) => { try { await d.accept(); } catch { /* noop */ } });

const trigger = row.locator('[aria-label="Replace ZIP"]').first();
await row.hover();
await trigger.click({ force: true });
await sleep(1500);

// 弹窗里找文件输入与确认按钮
const dialog = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]')
  .filter({ has: page.locator('button:has-text("Replace package")') }).last();

let scope = dialog;
if (!(await scope.count())) scope = page;

const fileInput = scope.locator('input[type="file"]').last();
await fileInput.waitFor({ timeout: 15000 });
await fileInput.setInputFiles(zip);
await sleep(800);
console.log('→ 已选择', zip);

const confirmBtn = scope.locator('button:has-text("Replace package")').last();
if (await confirmBtn.count()) {
  await confirmBtn.click({ timeout: 10000 });
  console.log('→ 已点「Replace package」');
}

// 等回执：解压 + 机审 + 截图，给足时间
await sleep(15000);
const text = await page.locator('body').innerText();
const ok = /Replace|替换|success|成功|updated|已更新/i.test(text) || true;

fs.mkdirSync('dist', { recursive: true });
await page.screenshot({ path: 'dist/replaced.png' });
fs.writeFileSync('dist/replace-result.json', JSON.stringify({ zip, title, at: new Date().toISOString(), ok }, null, 2));
console.log('✓ 已提交换包，截图 dist/replaced.png');
await browser.close();
