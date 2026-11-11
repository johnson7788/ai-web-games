#!/usr/bin/env node
// 浏览器端自动试玩：真的点 UI、真的按键盘/鼠标，跑完整流程并收集 runtime error。
// 用法：node tools/playtest-bot.mjs [--max-ms 300000] [--out tests/artifacts/playtest]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const maxMs = Number(process.argv.find(a=>a.startsWith('--max-ms='))?.split('=')[1] || '300000');
const outDir = path.join(root, process.argv.find(a=>a.startsWith('--out='))?.split('=')[1] || 'tests/artifacts/playtest');
fs.mkdirSync(outDir, { recursive: true });
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{let f=decodeURIComponent(new URL(req.url,'http://x').pathname); if(f==='/')f='/index.html'; fs.readFile(path.join(root,f),(e,d)=>{if(e){res.writeHead(404).end();return;} res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>server.listen(8220,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:8220/?lang=zh'); await page.waitForTimeout(1600);
const log=[]; const start=Date.now();
let held=null;
async function key(k,on){ if(on===held) return; if(held) await page.keyboard.up(held).catch(()=>{}); if(on) await page.keyboard.down(k).catch(()=>{}); held=on?k:null; }
await page.evaluate(()=>window.__ll.startAct(0));
await page.mouse.move(900,430); await page.mouse.down();
let lastAct=-1, shots=0;
while(Date.now()-start < maxMs){
  const st = await page.evaluate(()=>{
    const ll=window.__ll, r=ll.run;
    if(!r) return {phase:ll.state.phase};
    const p=r.sim.player, hud=r.getHud();
    let best=null,bd=1e9;
    for(const e of r.sim.enemies){ if(e.dead) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<bd){bd=d;best={x:e.x,y:e.y};} }
    return {phase:ll.state.phase, act:r.actIndex, wave:hud.wave, ink:hud.ink, mag:hud.mag, reloading:hud.reloading,
      px:p.x, py:p.y, ex:best?.x, ey:best?.y, enemies:r.sim.enemies.filter(e=>!e.dead).length, score:hud.score, kills:r.stats.kills,
      screen: document.querySelector('.screen.is-active')?.dataset.screen};
  }).catch(()=>null);
  if(!st || st.phase==='ending' || st.phase==='dead') { log.push(st); break; }
  if(st.phase==='upgrade'){ await page.locator('.upgrade-card').first().click({timeout:2000}).catch(()=>{}); await page.waitForTimeout(500); continue; }
  if(st.phase==='actclear'){ await page.click('#btn-act-continue',{timeout:2000}).catch(()=>{}); await page.waitForTimeout(900); continue; }
  if(st.phase==='act'){ await page.click('#btn-act-enter',{timeout:2000}).catch(()=>{}); await page.waitForTimeout(900); continue; }
  if(st.phase!=='playing'){ await page.waitForTimeout(200); continue; }
  if(st.act!==lastAct){ lastAct=st.act; await page.screenshot({path:path.join(outDir,`act-${st.act+1}.png`)}); log.push({type:'act',act:st.act,wave:st.wave,ink:st.ink}); }
  // aim nearest
  if(st.ex!=null){
    const s=await page.evaluate(({x,y})=>window.__ll.render().toScreen(x,y),{x:st.ex,y:st.ey-20});
    await page.mouse.move(Math.max(2,Math.min(1278,s.x)),Math.max(2,Math.min(718,s.y)));
    await key(st.ex>st.px+90?'KeyD':(st.ex<st.px-90?'KeyA':null), true);
  }
  if(st.reloading) await key('KeyD', true);
  if(st.ink<40 || (st.ex!=null && Math.abs(st.ex-st.px)<80)) { await page.keyboard.press('Shift'); }
  await page.waitForTimeout(110);
}
await page.mouse.up(); if(held) await page.keyboard.up(held).catch(()=>{});
await page.screenshot({path:path.join(outDir,'final.png')});
const summary=await page.evaluate(()=>{const ll=window.__ll,r=ll.run;return {phase:ll.state.phase, act:r?.actIndex, wave:r?.getHud().wave, ink:Math.round(r?.sim.player.hp||0), score:r?.getHud().score, kills:r?.stats.kills, save:ll.save()};}).catch(()=>null);
console.log(JSON.stringify({elapsed:Math.round((Date.now()-start)/1000), summary, progress:log, errors:errors.slice(0,8)},null,2));
await browser.close(); server.close();
