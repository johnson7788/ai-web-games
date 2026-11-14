// DRIFT LIMITS · M4 音频自检：起本地静态服务 → Playwright 真实点击 START → 驾驶 3s
// → 采样 master 输出 RMS（AnalyserNode），峰值 RMS>0.02 判 PASS，0 console error。
// 用法：cd games/drift-limits && /opt/homebrew/bin/node tools/audio-check.mjs
// 产出：tools/audio-report.json
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPORT = fileURLToPath(new URL('./audio-report.json', import.meta.url));

let chromium;
for (const p of [
  '/Users/admin/.npm-global/lib/node_modules/playwright/index.mjs',
  '/opt/homebrew/lib/node_modules/playwright/index.mjs',
]) {
  try { ({ chromium } = await import(pathToFileURL(p).href)); break; } catch { /* try next */ }
}
if (!chromium) throw new Error('playwright not found');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  const file = resolve(ROOT, rel);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const HOST = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = { ok: false, passRMS: false, maxRMS: 0, maxPeak: 0, consoleErrors: [], failed: [], samples: 0, driveMs: 0, audio: {}, bgm404: false };
let browser = null;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  const failed = [];
  const urls404 = new Set();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.stack || e.message));
  page.on('requestfailed', (r) => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', (r) => {
    if (r.status() === 404) { urls404.add(new URL(r.url()).pathname); return; }
    if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
  });

  await page.goto(`${HOST}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__ll && window.G && window.G.Audio, null, { timeout: 15000 });

  // 真实点击 START（触发用户手势 → ensure() 建 AudioContext）
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__ll.state.simPhase === 'race', null, { timeout: 30000 });

  // 驾驶：漂移 + 氮气，覆盖引擎/漂移噪声/boost/警笛
  await page.evaluate(() => { window.__AUTO = { steer: 0.6, drift: true, nitro: true, launch: false }; });

  let maxRMS = 0, maxPeak = 0, samples = 0;
  const t0 = Date.now();
  const DRIVE_MS = 3000;
  while (Date.now() - t0 < DRIVE_MS) {
    const lv = await page.evaluate(() => window.G.Audio.getLevel());
    maxRMS = Math.max(maxRMS, lv.rms);
    maxPeak = Math.max(maxPeak, lv.peak);
    samples++;
    await sleep(100);
  }

  report.audio = await page.evaluate(() => ({
    ctxCreated: !!window.G.Audio.ctx,
    ctxState: window.G.Audio.ctx && window.G.Audio.ctx.state,
    bgmKind: window.G.Audio.bgm.kind,
    muted: window.G.Audio.muted,
  }));
  // bgm.mp3 本阶段尚未由 Lead 生成：缺失时降级 synthwave 属预期，其 404 不算失败。
  report.bgm404 = urls404.has('/assets/audio/bgm.mp3');
  const bgmOnly404 = report.bgm404 && [...urls404].every((p) => p.endsWith('bgm.mp3'));
  const hardErrors = bgmOnly404
    ? consoleErrors.filter((e) => !(/Failed to load resource/.test(e) && /404/.test(e)))
    : consoleErrors;
  report.passRMS = maxRMS > 0.02;
  report.maxRMS = maxRMS;
  report.maxPeak = maxPeak;
  report.samples = samples;
  report.driveMs = DRIVE_MS;
  report.consoleErrors = hardErrors;
  report.failed = failed;
  report.ok = report.passRMS && hardErrors.length === 0 && failed.length === 0;

  console.log(`ctx=${report.audio.ctxCreated}/${report.audio.ctxState} bgm=${report.audio.bgmKind} bgm404=${report.bgm404}`);
  console.log(`RMS max=${maxRMS.toFixed(4)}  peak=${maxPeak.toFixed(4)}  (${samples} samples / ${DRIVE_MS}ms)`);
  console.log(`consoleErrors=${hardErrors.length}  failedRequests=${failed.length}`);
  for (const e of hardErrors) console.log(`  [console] ${e}`);
  for (const f of failed) console.log(`  [request] ${f.url} ${f.status || f.error}`);
  console.log(`\nRESULT ${report.ok ? 'PASS' : 'FAIL'}  (${report.passRMS ? 'RMS>0.02' : 'RMS<=0.02'} / ${hardErrors.length === 0 ? '0 console error' : 'console error!'})`);
} catch (e) {
  report.consoleErrors.push(`SCRIPT ${e.stack || e.message}`);
  report.ok = false;
  console.error('audio-check SCRIPT ERROR:', e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
