// TILE TRIAD · 生成 icon.png / favicon.png（256×256，程序化，与游戏同款货品牌）。
// 用法：node tools/icon.mjs
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#0e1420}
  canvas{display:block}
</style></head><body><canvas id="c" width="256" height="256"></canvas>
<script>
function roundRect(g,x,y,w,h,r){const rr=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);g.beginPath();g.moveTo(x+rr,y);g.arcTo(x+w,y,x+w,y+h,rr);g.arcTo(x+w,y+h,x,y+h,rr);g.arcTo(x,y+h,x,y,rr);g.arcTo(x,y,x+w,y,rr);g.closePath();}
function drawIcon(g,type,cx,cy,s){g.save();g.translate(cx,cy);g.lineWidth=Math.max(1.5,s*0.08);
if(type===0){g.fillStyle='#C2472A';roundRect(g,-s*0.5,-s*0.25,s,s*1.05,s*0.18);g.fill();g.fillStyle='#7A2A16';roundRect(g,-s*0.34,-s*0.52,s*0.68,s*0.3,s*0.1);g.fill();g.fillStyle='#F5E6D0';g.fillRect(-s*0.5,s*0.15,s,s*0.22);}
else if(type===10){g.fillStyle='#C2472A';g.beginPath();g.ellipse(0,0,s*0.56,s*0.66,0,0,Math.PI*2);g.fill();g.strokeStyle='#7A2A16';g.lineWidth=s*0.06;for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(0,-s*0.66);g.quadraticCurveTo(i*s*0.4,0,0,s*0.66);g.stroke();}g.fillStyle='#FFD84E';g.fillRect(-s*0.16,-s*0.82,s*0.32,s*0.16);g.strokeStyle='#E0537A';g.lineWidth=s*0.08;g.beginPath();g.moveTo(0,s*0.66);g.lineTo(0,s*0.98);g.stroke();}
else{g.fillStyle='#C2472A';g.beginPath();g.arc(0,-s*0.05,s*0.66,Math.PI,0);g.closePath();g.fill();g.fillStyle='#E8D9C8';roundRect(g,-s*0.16,s*0.05,s*0.32,s*0.6,s*0.12);g.fill();g.fillStyle='#F5E6D0';g.beginPath();g.arc(-s*0.24,-s*0.28,s*0.12,0,Math.PI*2);g.arc(s*0.22,-s*0.2,s*0.1,0,Math.PI*2);g.fill();}
g.restore();}
const c=document.getElementById('c'),g=c.getContext('2d');
const bg=g.createLinearGradient(0,0,0,256);bg.addColorStop(0,'#FFE9B4');bg.addColorStop(0.5,'#F6D79A');bg.addColorStop(1,'#EAC188');g.fillStyle=bg;g.fillRect(0,0,256,256);
// 顶部篷条纹
for(let i=0;i<4;i++){g.fillStyle=i%2?'#F5E6D0':'#E8833A';g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64+64,0);g.lineTo(i*64+48,34);g.lineTo(i*64+16,34);g.closePath();g.fill();}
// 大牌底
const x=128,y=150,w=150,h=176;g.fillStyle='rgba(0,0,0,0.25)';roundRect(g,x-w/2+4,y-h/2+6,w,h,18);g.fill();
const cg=g.createLinearGradient(x-w/2,y-h/2,x+w/2,y+h/2);cg.addColorStop(0,'#FFF6DE');cg.addColorStop(1,'#F0DDB0');g.fillStyle=cg;roundRect(g,x-w/2,y-h/2,w,h,18);g.fill();
g.strokeStyle='#C9A24C';g.lineWidth=3;roundRect(g,x-w/2,y-h/2,w,h,18);g.stroke();
drawIcon(g,0,x,y+4,58);
// 顶部小灯笼与蘑菇装饰
drawIcon(g,10,44,60,22);
drawIcon(g,3,214,66,20);
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
await page.setContent(HTML);
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'icon.png') });
await page.screenshot({ path: join(ROOT, 'favicon.png') });
await browser.close();
console.log('icon.png / favicon.png done');
process.exit(0);
