// BUBBLE SHOOTER POP · 生成 8 张 vision-review 截图（tests/final/）+ poster.jpg
// 用法：node tools/scene-shots.mjs
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(GAME_DIR, 'tests', 'final');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/homebrew/lib/node_modules/playwright',
    '/Users/admin/.npm-global/lib/node_modules/playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

function portBusy(p) {
  return new Promise((resolve) => {
    const sock = net.connect({ port: p, host: '127.0.0.1' });
    const done = (busy) => { sock.destroy(); resolve(busy); };
    sock.setTimeout(250);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(true));
    sock.once('error', () => done(false));
  });
}

function serve(rootDir, startPort = 8240) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = decodeURIComponent(url.pathname);
    if (file === '/' || file.endsWith('/')) file += 'index.html';
    const target = path.join(rootDir, file);
    if (!target.startsWith(rootDir)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(target, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    const tryListen = async (p, attempt = 0) => {
      if (attempt < 40 && await portBusy(p)) { tryListen(p + 1, attempt + 1); return; }
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && attempt < 40) tryListen(p + 1, attempt + 1);
        else reject(e);
      });
      server.listen(p, '127.0.0.1', () => resolve({ server, port: p }));
    };
    tryListen(startPort);
  });
}

// 清空并布置一个静态场景（泡泡冻结、子弹注入）
const STAGE = (bubbles, bullets = [], powerups = []) => `(() => {
  const run = window.__ll.run;
  if (!run) return false;
  run.state.bubbles = [];
  run.state.bullets = [];
  run.state.powerups = [];
  const mk = (kind, x, y) => {
    run.spawnBubble(kind, x);
    const b = run.state.bubbles[run.state.bubbles.length - 1];
    b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.home = 0; b.age = 0;
    return b;
  };
  ${bubbles}
  ${bullets}
  ${powerups}
  return true;
})()`;

async function main() {
  const { server, port } = await serve(GAME_DIR, 8240);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message || e.stack));

  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const shot = async (name) => {
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join(OUT_DIR, name) });
    console.log('  ✓', name);
  };

  const startRun = async () => {
    await page.evaluate(() => { window.__ll.start(7); });
    await page.waitForTimeout(120);
  };

  // 01 基础泡泡 + 子弹
  await startRun();
  await page.evaluate(STAGE(
    `mk('normal', 320, 220); mk('normal', 520, 150); mk('normal', 820, 260);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x-6,y:330,vx:0,vy:-920,r:6,dead:false}); run.state.bullets.push({x:c.x,y:430,vx:0,vy:-920,r:6,dead:false});`,
    ``,
  ));
  await shot('01-play-basic.png');

  // 02 岩石泡泡（装甲，需多下命中）
  await page.evaluate(STAGE(
    `mk('rock', 520, 240); mk('normal', 320, 200); mk('normal', 800, 180); mk('normal', 1000, 300);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x-4,y:420,vx:0,vy:-920,r:6,dead:false}); run.state.bullets.push({x:c.x+4,y:520,vx:0,vy:-920,r:6,dead:false});`,
    ``,
  ));
  await shot('02-play-rock.png');

  // 03 黄金泡泡 + 道具
  await page.evaluate(STAGE(
    `mk('gold', 640, 220); mk('normal', 320, 300);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x,y:360,vx:0,vy:-920,r:6,dead:false});`,
    `run.state.powerups.push({kind:'rapid', x: 620, y: 430, vy: 120, r: 18, dead:false});`,
  ));
  await shot('03-play-gold.png');

  // 04 炸弹泡泡
  await page.evaluate(STAGE(
    `mk('bomb', 560, 260); mk('normal', 420, 180); mk('normal', 700, 190);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x,y:400,vx:0,vy:-920,r:6,dead:false});`,
    ``,
  ));
  await shot('04-play-bomb.png');

  // 05 四类泡泡混合 + 扇形子弹
  await page.evaluate(STAGE(
    `mk('normal', 260, 240); mk('rock', 520, 180); mk('gold', 800, 220); mk('bomb', 1060, 260); mk('normal', 400, 380);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x-20,y:340,vx:-120,vy:-920,r:6,dead:false}); run.state.bullets.push({x:c.x,y:360,vx:0,vy:-920,r:6,dead:false}); run.state.bullets.push({x:c.x+20,y:340,vx:120,vy:-920,r:6,dead:false});`,
    ``,
  ));
  await shot('05-play-mix.png');

  // 06 双道具下落
  await page.evaluate(STAGE(
    `mk('normal', 360, 180); mk('normal', 900, 220);`,
    `const c = run.state.cannon; run.state.bullets.push({x:c.x,y:420,vx:0,vy:-920,r:6,dead:false});`,
    `run.state.powerups.push({kind:'rapid', x: 480, y: 300, vy: 0, r: 18, dead:false}); run.state.powerups.push({kind:'triple', x: 720, y: 260, vy: 0, r: 18, dead:false});`,
  ));
  await shot('06-play-powerup.png');

  // 07 三连射（triple 弹幕）
  await page.evaluate(STAGE(
    `mk('normal', 420, 200); mk('normal', 640, 170); mk('normal', 860, 210);`,
    `const c = run.state.cannon; [-0.16, 0, 0.16].forEach((a)=>{ run.state.bullets.push({x:c.x+Math.sin(a)*30, y:420, vx:Math.sin(a)*920, vy:-Math.cos(a)*920, r:6, dead:false}); });`,
    ``,
  ));
  await shot('07-play-triple.png');

  // 08 标题屏
  await page.evaluate(() => { window.__ll.home(); });
  await page.waitForTimeout(250);
  await shot('08-title.png');

  // poster：战斗画面（全彩泡泡 + 炮台 + 弹幕）
  await page.evaluate(() => { window.__ll.start(7); });
  await page.waitForTimeout(120);
  await page.evaluate(STAGE(
    `mk('normal', 240, 180); mk('rock', 480, 120); mk('gold', 720, 160); mk('bomb', 960, 140); mk('normal', 640, 300);`,
    `const c = run.state.cannon; [-0.2,-0.1,0,0.1,0.2].forEach((a)=>{ run.state.bullets.push({x:c.x+Math.sin(a)*40, y:430, vx:Math.sin(a)*920, vy:-Math.cos(a)*920, r:6, dead:false}); });`,
    ``,
  ));
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 90 });
  console.log('  ✓ poster.jpg');

  await browser.close();
  server.close();
  console.log(JSON.stringify({ port, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
