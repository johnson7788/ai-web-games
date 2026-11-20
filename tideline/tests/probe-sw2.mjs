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
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--no-proxy-server','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:960,height:540}});
const errs=[],cerr=[];
page.on('pageerror',e=>errs.push(String(e.message||e).slice(0,300)));
page.on('console',m=>{ if(m.type()==='error') cerr.push(m.text().slice(0,200)); });
const t0=Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
// poll via evaluate; log progress
let mode=null;
for (let i=0;i<150;i++) {
  const s = await page.evaluate(() => ({
    has: !!window.__tideline, mode: window.__tideline?.state?.mode,
    load: document.getElementById('loadingText')?.textContent,
    gpu: window.__tideline?.state?.gpu,
  })).catch(e=>({err:String(e).slice(0,120)}));
  if (i%10===0) console.log(`t=${((Date.now()-t0)/1000).toFixed(0)}s`, JSON.stringify(s));
  if (s.mode==='title') { mode='title'; break; }
  await page.waitForTimeout(2000);
}
if (mode!=='title') { console.log('TITLE NEVER REACHED', errs, cerr); await page.screenshot({path:dir+'/tests/sw-stuck.png'}); await browser.close(); server.close(); process.exit(1); }
console.log('SW load ms:', Date.now()-t0);
console.log('state:', JSON.stringify(await page.evaluate(()=>window.__tideline.state)));
await page.click('#btnStart');
for (let i=0;i<30;i++){ const m=await page.evaluate(()=>window.__tideline.state.mode); if(m==='racing')break; await page.waitForTimeout(500); }
await page.evaluate(()=>window.__tideline.autopilot(true));
await page.waitForTimeout(70000);
const s=await page.evaluate(()=>window.__tideline.state);
console.log('SW after 50s drive:', JSON.stringify({mode:s.mode,gates:s.gatesPassedTotal,cp:s.cp,fps:s.fps,speed:+s.speed.toFixed(1),res:s.quality.resolution}));
await page.screenshot({path:dir+'/tests/sw-drive.png'});
console.log('errors:', errs, 'consoleErrs:', cerr);
await browser.close(); server.close();
