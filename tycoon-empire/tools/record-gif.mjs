// tools/record-gif.mjs — 录制真实玩法 → webm（再用 ffmpeg 转 game.gif）。
// 从「已经在玩」的瞬间开始录；前 3 秒必须出现核心动词（点楼产出）+ 目标（购买产业）。
import { readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs';
const { chromium } = loadPlaywright();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REC_DIR = join(ROOT, 'tests', 'artifacts');
mkdirSync(REC_DIR, { recursive: true });

const { server, port } = await serve(ROOT, 8151);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: REC_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 }).catch(() => {});
// 进玩法（跳过引导）
await page.locator('#btn-start').click({ force: true, timeout: 8000 });
await page.waitForTimeout(400);
await page.locator('[data-tutorial-skip]').first().click({ force: true });
await page.waitForTimeout(200);

const canvas = page.locator('#canvas');
// 核心动词：真实点楼产出（金币粒子可见）
for (let i = 0; i < 8; i += 1) {
  await canvas.click({ position: { x: 300, y: 300 }, force: true });
  await page.waitForTimeout(100);
}
await page.evaluate(() => window.__ll.debug.advance(5));
await page.waitForTimeout(300);
for (let i = 0; i < 7; i += 1) {
  await canvas.click({ position: { x: 300, y: 300 }, force: true });
  await page.waitForTimeout(100);
}
await page.evaluate(() => window.__ll.debug.advance(15));
await page.waitForTimeout(400);
for (let i = 0; i < 6; i += 1) {
  await canvas.click({ position: { x: 300, y: 300 }, force: true });
  await page.waitForTimeout(100);
}
await page.evaluate(() => window.__ll.debug.advance(20));
await page.waitForTimeout(500);
await canvas.click({ position: { x: 300, y: 300 }, force: true });
await page.waitForTimeout(500);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const webm = readdirSync(REC_DIR).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
console.log('recorded', join(REC_DIR, webm));
process.exit(0);
