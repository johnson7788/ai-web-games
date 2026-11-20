// Sandbox retest: iframe sandbox="allow-scripts" (opaque origin) + ACAO:*
// Verifies boot, real gameplay, storage fallback, 0 pageerror.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/void-survivor';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!doctype html><html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
  const errors = [], cerr = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const frame = page.frames().find(f => f.url().includes('index.html'));
  if (!frame) { console.log('FAIL: no iframe'); process.exit(1); }

  const boot = await frame.evaluate(() => ({
    void: !!window.__VOID__,
    state: window.__VOID__ ? window.__VOID__.state() : null,
    storageThrows: (() => { try { localStorage.setItem('x', '1'); return false; } catch (e) { return true; } })(),
    origin: location.origin,
  }));
  console.log('SANDBOX BOOT', JSON.stringify(boot));

  await frame.click('#vs-start');
  await page.waitForTimeout(2500);

  // real gameplay inside the sandbox: move + aim/fire at nearest enemy
  const play = await frame.evaluate(async () => {
    const V = window.__VOID__;
    const canvas = document.getElementById('three');
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    key('KeyD', true);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 640, clientY: 300, bubbles: true }));
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      if (V.state() !== 'playing') break;
      const s = V.nearestEnemyScreen();
      if (s) canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x, clientY: s.y, bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
    }
    key('KeyD', false);
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
    return { state: V.state(), stats: V.stats(), player: V.player(), audio: V.game.audioManager.audioContext ? V.game.audioManager.audioContext.state : 'none' };
  });
  console.log('SANDBOX PLAY', JSON.stringify(play));
  await page.screenshot({ path: path.join(dir, 'tests/final/11-sandbox.png') });

  const ok = boot.void && boot.state === 'title' && play.stats.shots > 0 && play.stats.kills > 0 && errors.length === 0;
  console.log('SANDBOX ERRORS', JSON.stringify(errors));
  console.log('SANDBOX CONSOLE_ERR', JSON.stringify(cerr));
  console.log(ok ? '✓ SANDBOX OK' : '✗ SANDBOX FAIL');
  await browser.close();
  srv.close();
  process.exit(ok ? 0 : 1);
})();