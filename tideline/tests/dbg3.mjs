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
page.on('pageerror',e=>console.log('PAGEERR:',String(e.message||e).slice(0,200)));
await page.goto(`http://127.0.0.1:${server.address().port}/?lang=en_US.UTF-8`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__tideline&&window.__tideline.state.mode==='title',{timeout:120000});
console.log('A: title wait OK');
await page.screenshot({path:dir+'/tests/dbg2.png'});
console.log('B: screenshot OK');
try { await page.waitForFunction(()=>true,{timeout:5000}); console.log('C: waitForFunction(true) OK'); }
catch(e){ console.log('C: waitForFunction(true) FAILED:', e.message.split('\n')[0]); }
try { await page.waitForFunction(()=>window.__tideline.state.mode==='title',{timeout:5000,polling:250}); console.log('D: predicate OK'); }
catch(e){ console.log('D: predicate FAILED:', e.message.split('\n')[0]); }
await page.click('#btnStart');
console.log('F: clicked start');
await page.waitForTimeout(1000);
try { await page.waitForFunction(()=>true,{timeout:5000}); console.log('G: wf(true) after click OK'); } catch(e){ console.log('G: wf(true) after click FAILED'); }
console.log('H: mode =', await page.evaluate(()=>window.__tideline.state.mode));
try { await page.waitForFunction(()=>window.__tideline.state.mode==='racing',{timeout:10000,polling:250}); console.log('I: racing wait OK'); } catch(e){ console.log('I: racing wait FAILED'); }
console.log('J: mode =', await page.evaluate(()=>window.__tideline.state.mode));
await browser.close(); server.close();
