#!/usr/bin/env node
// LAST LINE 终验：浏览器全流程 + 截图 + 性能 + 资源检查。
// 用法：node tools/verify.mjs [--port 8130] [--out tests/artifacts]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = { port: 8130, out: 'tests/artifacts' };
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === '--port') { args.port = Number(process.argv[i + 1]); i += 1; }
  if (process.argv[i] === '--out') { args.out = process.argv[i + 1]; i += 1; }
}
const outDir = path.resolve(root, args.out);
fs.mkdirSync(outDir, { recursive: true });

function loadPlaywright() {
  for (const candidate of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
    try { return require(candidate); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = decodeURIComponent(url.pathname);
  if (file === '/' || file.endsWith('/')) file += 'index.html';
  const target = path.join(root, file);
  if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});
await new Promise((resolve, reject) => {
  const tryListen = (p, n = 0) => {
    server.once('error', (e) => (e.code === 'EADDRINUSE' && n < 40 ? tryListen(p + 1, n + 1) : reject(e)));
    server.listen(p, '127.0.0.1', resolve);
  };
  tryListen(args.port);
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const report = { url: base, checks: [], errors: [], failedRequests: [], external: [], screenshots: [], perf: {}, pass: true };
function check(name, ok, detail = '') {
  report.checks.push({ name, ok: !!ok, detail });
  if (!ok) report.pass = false;
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
page.on('pageerror', (e) => report.errors.push(e.stack || e.message));
page.on('requestfailed', (r) => report.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) report.failedRequests.push(`${r.status()} ${r.url()}`); });
page.on('request', (r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== `http://127.0.0.1:${port}`) report.external.push(r.url()); });

const shot = async (name, opts = {}) => {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, ...opts });
  report.screenshots.push(name);
  return p;
};

async function boot(query = '') {
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
  await page.waitForTimeout(600);
}

// 1. 标题
await boot();
check('boot 到标题', await page.evaluate(() => window.__ll.state.phase) === 'title');
await shot('01-title.png');

// 2. 开场字卡
const before = await page.evaluate(() => window.__ll.state.phase);
await page.click('#btn-play');
await page.waitForTimeout(700);
const storyVisible = await page.locator('[data-screen="story"]').isVisible().catch(() => false);
check('开场字卡出现', storyVisible || before !== 'title');
if (storyVisible) await shot('02-story.png');
// 点击跳过字卡
for (let i = 0; i < 8; i += 1) {
  await page.locator('[data-screen="story"]').click({ position: { x: 640, y: 360 } }).catch(() => {});
  await page.waitForTimeout(140);
  if (!(await page.locator('[data-screen="story"]').isVisible().catch(() => false))) break;
}
await page.waitForTimeout(900);
const phaseAfterStory = await page.evaluate(() => window.__ll.state.phase);
check('字卡后进入幕卡/游戏', ['act', 'playing'].includes(phaseAfterStory), phaseAfterStory);
if (phaseAfterStory === 'act') await shot('03-act.png');

// 3. 进入游戏
if (phaseAfterStory === 'act') await page.click('#btn-act-enter');
await page.waitForTimeout(1200);
check('进入 playing', await page.evaluate(() => window.__ll.state.phase) === 'playing');
await page.mouse.move(900, 420);
await page.keyboard.down('KeyD');
await page.mouse.down();
await page.waitForTimeout(1600);
await page.mouse.up();
await page.keyboard.up('KeyD');
await page.waitForTimeout(300);
await shot('04-game-draft.png');
const gameState = await page.evaluate(() => {
  const ll = window.__ll; const run = ll.run;
  return { ink: run?.sim.player.hp, enemies: run?.sim.enemies.length, score: run?.getHud().score, shots: run?.sim.stats.shots, act: run?.actIndex };
});
check('射击被记录', (gameState.shots || 0) > 0, JSON.stringify(gameState));
check('玩家仍存活', (gameState.ink || 0) > 0);

// 4. 升级屏
await page.evaluate(() => window.__ll.demo.upgrade());
await page.waitForTimeout(700);
await shot('05-upgrade.png');
check('升级卡 3 张', await page.locator('#upgrade-cards .upgrade-card').count() === 3);
await page.locator('#upgrade-cards .upgrade-card').first().click();
await page.waitForTimeout(600);
check('选完升级回到 playing', await page.evaluate(() => window.__ll.state.phase) === 'playing');

// 5. 五幕地图
for (const [i, name] of [[1, 'blueprint'], [2, 'neon'], [4, 'blank']]) {
  await page.evaluate((n) => window.__ll.startAct(n), i);
  await page.waitForTimeout(1400);
  await shot(`06-act-${i + 1}-${name}.png`);
}

// 6. Boss HUD（blank 幕）
const bossSeen = await page.evaluate(() => {
  const run = window.__ll.run;
  return run ? run.sim.enemies.some((e) => e.type === 'blank') : false;
});
check('Boss 存在', bossSeen);

// 7. 结算 / 结局 / 画册 / 设置
await page.evaluate(() => window.__ll.demo.dead());
await page.waitForTimeout(600);
await shot('07-dead.png');
await page.evaluate(() => window.__ll.demo.ending());
await page.waitForTimeout(700);
await shot('08-ending.png');
await page.locator('#btn-end-finish').click();
await page.waitForTimeout(600);
await shot('09-ending-text.png');
await page.evaluate(() => window.__ll.demo.gallery());
await page.waitForTimeout(500);
await shot('10-gallery.png');
await page.evaluate(() => window.__ll.demo.settings());
await page.waitForTimeout(500);
await shot('11-settings.png');

// 8. 性能
await page.evaluate(() => window.__ll.startAct(2));
await page.waitForTimeout(1200);
report.perf = await page.evaluate(() => new Promise((resolve) => {
  const frames = [];
  let last = performance.now();
  const tick = (now) => {
    frames.push(now - last); last = now;
    if (frames.length < 120) requestAnimationFrame(tick);
    else {
      const avg = frames.slice(10).reduce((a, b) => a + b, 0) / (frames.length - 10);
      resolve({ avgFrameMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), frames: frames.length });
    }
  };
  requestAnimationFrame(tick);
}));
check('帧率 ≥ 50', report.perf.fps >= 50, JSON.stringify(report.perf));

// 9. 移动端
const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mobile = await mobileContext.newPage();
mobile.on('console', (m) => { if (m.type() === 'error') report.errors.push(`[mobile] ${m.text()}`); });
await mobile.goto(base, { waitUntil: 'load' });
await mobile.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: path.join(outDir, '12-mobile-title.png') });
report.screenshots.push('12-mobile-title.png');
await mobile.evaluate(() => window.__ll.startAct(0));
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: path.join(outDir, '13-mobile-game.png') });
report.screenshots.push('13-mobile-game.png');
await mobile.close();
await mobileContext.close();

check('0 console error', report.errors.length === 0, report.errors.slice(0, 5).join(' | '));
check('0 失败请求', report.failedRequests.length === 0, report.failedRequests.slice(0, 5).join(' | '));
check('0 外部请求', report.external.length === 0, report.external.slice(0, 5).join(' | '));

await browser.close();
server.close();

fs.writeFileSync(path.join(outDir, 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
