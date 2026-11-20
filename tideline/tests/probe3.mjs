// fail screen, retry, pause/resume, zh UI, best-time persistence (kit now injected)
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/tideline';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain' };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const fp=path.join(dir,p); if(!fs.existsSync(fp)||!fs.statSync(fp).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});
  fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--enable-webgl','--ignore-gpu-blocklist','--no-proxy-server']});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const errs=[],cerr=[];
page.on('pageerror',e=>errs.push(String(e.message||e)));
page.on('console',m=>{ if(m.type()==='error') cerr.push(m.text().slice(0,200)); });
async function waitState(modes, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const m = await page.evaluate(() => window.__tideline && window.__tideline.state.mode).catch(() => null);
    if (m && modes.includes(m)) return m;
    await page.waitForTimeout(400);
  }
  throw new Error('waitState timeout: ' + modes.join('|'));
}
await page.goto(`http://127.0.0.1:${server.address().port}/?lang=zh`,{waitUntil:'domcontentloaded'});
await waitState(['title'], 120000);
await page.screenshot({path:dir+'/tests/p3-zh-title.png'});
console.log('zh title text:', await page.evaluate(() => document.querySelector('#btnStart').textContent));
await page.click('#btnStart');
await waitState(['racing'], 30000);
console.log('zh HUD label:', await page.evaluate(() => document.querySelector('#gateTimerWrap .lbl').textContent));
// idle -> gate closes -> fail
await waitState(['failed'], 90000);
await page.screenshot({path:dir+'/tests/p3-zh-fail.png'});
console.log('fail screen OK');
await page.click('#btnRetry');
await waitState(['racing'], 30000);
console.log('retry OK');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
console.log('paused:', await page.evaluate(() => window.__tideline.state.mode));
await page.screenshot({path:dir+'/tests/p3-zh-pause.png'});
await page.click('#btnResume');
await page.waitForTimeout(400);
console.log('resumed:', await page.evaluate(() => window.__tideline.state.mode));
// best-time persistence via PipySDK
await page.evaluate(() => { window.PipySDK.save('best', 123.4); });
console.log('best load:', await page.evaluate(() => window.PipySDK.load('best', null)));
// drive a bit for a zh gameplay shot
await page.evaluate(() => window.__tideline.autopilot(true));
await page.waitForTimeout(15000);
await page.screenshot({path:dir+'/tests/p3-zh-drive.png'});
console.log('state:', JSON.stringify(await page.evaluate(() => { const s = window.__tideline.state; return {mode:s.mode, gates:s.gatesPassedTotal, fps:s.fps}; })));
console.log('errors:', errs, 'consoleErrs:', cerr);
await browser.close(); server.close();
