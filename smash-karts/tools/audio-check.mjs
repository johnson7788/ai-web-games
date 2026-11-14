// SMASH KARTS · M4 音效离线校验：起本地服务器 → 无头浏览器跑 audio.debugRender() → 打印 peak/RMS。
// 无网络依赖；服务器只起一次并在 finally 里 kill。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PLAYWRIGHT = pathToFileURL('/Users/admin/.npm-global/lib/node_modules/playwright/index.mjs').href;
const { chromium } = await import(PLAYWRIGHT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
};

const HARNESS = `<!doctype html><meta charset="utf-8"><script type="module">
  try {
    const { audio } = await import('./src/core/audio.js');
    window.__RESULT = await audio.debugRender();
  } catch (e) {
    window.__ERROR = String((e && e.stack) || e);
  }
  window.__DONE = true;
</script>`;

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/__audio-check.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(HARNESS);
    return;
  }
  const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
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

const port = await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

let browser = null;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/__audio-check.html`);
  await page.waitForFunction(() => window.__DONE === true, null, { timeout: 20000 });
  const err = await page.evaluate(() => window.__ERROR);
  if (err) throw new Error(`harness error: ${err}`);
  const results = await page.evaluate(() => window.__RESULT);

  let ok = results && results.length >= 12;
  if (!ok) console.error(`只有 ${results ? results.length : 0} 个音效，需 ≥12`);
  for (const r of results || []) {
    const pass = r.rms > 0.01 && r.peak <= 1.0;
    if (!pass) ok = false;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${r.name.padEnd(12)} peak=${r.peak.toFixed(4)} rms=${r.rms.toFixed(4)}`);
  }
  if (ok) console.log(`audio-check passed: ${results.length} 个音效，全部 rms>0.01 且 peak<=1.0`);
  else { console.error('audio-check FAILED'); process.exitCode = 1; }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
