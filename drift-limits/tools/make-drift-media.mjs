// tools/make-drift-media.mjs — G6 物料：poster.jpg(1280×720) / poster-1920.jpg / icon.png(256) / game.gif(640×360) / SEO.txt
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const f = resolve(ROOT, rel);
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${server.address().port}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });

// ---------- game.gif：实拍漂移+氮气 4s ----------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(HOST + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ll, null, { timeout: 20000 });
  await page.click('#btn-start');
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForFunction(() => window.__ll.state.simPhase === 'race', null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__AUTO = { steer: 0, drift: false, nitro: false, brake: false, launch: false };
    const loop = () => {
      const r = window.__ll.run;
      if (r && r.phase === 'race') {
        const p = r.player;
        window.__AUTO.steer = Math.max(-1, Math.min(1, -p.t * 0.12 - p.angle * 0.7));
        window.__AUTO.drift = !!window.__drift;
        window.__AUTO.nitro = !!window.__nitro;
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
  await mkdir('/tmp/drift-gif2', { recursive: true });
  for (let i = 0; i < 40; i++) {
    if (i === 8) await page.evaluate(() => { window.__drift = true; });
    if (i === 24) await page.evaluate(() => { window.__drift = false; window.__nitro = true; });
    if (i === 32) await page.evaluate(() => { window.__nitro = false; });
    await page.screenshot({ path: `/tmp/drift-gif2/f${String(i).padStart(3, '0')}.png` });
    await sleep(60);
  }
  await page.close();
  execSync(`ffmpeg -y -framerate 10 -i /tmp/drift-gif2/f%03d.png -vf "scale=640:360:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 ${ROOT}/game.gif`, { stdio: 'ignore' });
  console.log('game.gif ok');
}

// ---------- poster：AI 原画 + HTML 叠字 ----------
const posterB64 = (await readFile(`${ROOT}/assets/poster-raw.jpg`)).toString('base64');
const posterHtml = (w, h) => `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; font-family: 'Segoe UI', 'PingFang SC', sans-serif; }
  .bg { position: absolute; inset: 0; background: url('data:image/jpeg;base64,${posterB64}') center/cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5,7,15,.25) 0%, rgba(5,7,15,0) 35%, rgba(5,7,15,.78) 100%); }
  .wrap { position: absolute; left: 0; right: 0; bottom: ${h * 0.06}px; text-align: center; color: #ecfbff; }
  h1 { font-size: ${w * 0.075}px; letter-spacing: ${w * 0.008}px; font-weight: 900; text-shadow: 0 0 18px #28e0ff, 0 0 46px rgba(40,224,255,.5), ${w * 0.003}px ${w * 0.003}px 0 rgba(255,45,120,.85); }
  p { font-size: ${w * 0.021}px; letter-spacing: ${w * 0.004}px; color: #ffd76b; font-weight: 700; margin-top: ${h * 0.012}px; text-shadow: 0 2px 8px rgba(0,0,0,.8); }
  .badges { margin-top: ${h * 0.018}px; display: flex; gap: ${w * 0.012}px; justify-content: center; }
  .b { font-size: ${w * 0.014}px; font-weight: 800; letter-spacing: 2px; padding: ${h * 0.008}px ${w * 0.014}px; border: 2px solid #28e0ff; border-radius: 999px; color: #28e0ff; background: rgba(5,7,15,.6); }
  .b.hot { border-color: #ff2d78; color: #ff2d78; }
</style></head><body>
  <div class="bg"></div><div class="shade"></div>
  <div class="wrap">
    <h1>DRIFT LIMITS</h1>
    <p>OUT-DRIFT THE COPS · 3 LAPS TO ESCAPE · 极限漂移</p>
    <div class="badges"><span class="b">DRIFT ×10 COMBOS</span><span class="b hot">POLICE CHASE</span><span class="b">NITRO ESCAPE</span></div>
  </div>
</body></html>`;
for (const [w, h, out] of [[1280, 720, 'poster.jpg'], [1920, 1080, 'poster-1920.jpg']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('about:blank');
  await page.setContent(posterHtml(w, h));
  await sleep(300);
  await page.screenshot({ path: `${ROOT}/${out}`, type: 'jpeg', quality: 88 });
  await page.close();
  console.log(out, 'ok');
}
await browser.close();
server.close();

// ---------- icon 256 ----------
execSync(`python3 -c "from PIL import Image; im=Image.open('${ROOT}/assets/icon-raw.png').convert('RGB').resize((256,256), Image.LANCZOS); im.save('${ROOT}/icon.png')"`);
console.log('icon.png ok');

// ---------- SEO.txt ----------
await writeFile(`${ROOT}/SEO.txt`, `TITLE: DRIFT LIMITS - 极限漂移
CATEGORY: Racing
TAGS: drift, police chase, racing, 3d, nitro, arcade, 漂移, 警车, 赛车
SHORT DESCRIPTION: Chain drifts to stack x10 multipliers, burn nitro to shake the cops, and survive 3 laps to escape the neon city. One crash resets it all.
LONG DESCRIPTION: DRIFT LIMITS is a 3D arcade drift-chase racer. Launch on the green light, slide through neon corners to build combo multipliers and charge nitro, weave traffic for near-miss bonuses, and outrun escalating police heat across three laps. Crashing resets your multiplier and lets the cops close in - push your luck for x10 or play it safe? Unlock garage perks, chase S-rank scores, and master the perfect getaway. 中文：绿灯起步、连击漂移叠倍率、氮气甩警车，撞一次倍率归零，三圈冲出霓虹城界。
`);
console.log('SEO.txt ok');