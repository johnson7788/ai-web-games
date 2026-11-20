// Sprout Hop · 生成 icon.png（256×256）与 favicon.png（48×48）：从游戏角色「豌豆」绘制。
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true });

function peaDraw(S) {
  return `(function(){
    const c=document.getElementById('c'); const g=c.getContext('2d');
    const r=${S}*0.30;
    // 背景（豆田绿径向）
    const bg=g.createRadialGradient(${S}/2,${S}/2,10,${S}/2,${S}/2,${S}*0.62);
    bg.addColorStop(0,'#B7F06A'); bg.addColorStop(0.5,'#5EB847'); bg.addColorStop(1,'#2F7A2E');
    g.fillStyle=bg; g.fillRect(0,0,${S},${S});
    const x=${S}/2, y=${S}/2;
    g.save(); g.translate(x,y);
    // 身体
    const grad=g.createRadialGradient(-r*0.3,-r*0.4,3,0,0,r*1.2);
    grad.addColorStop(0,'#D8FF8A'); grad.addColorStop(1,'#4CAF50');
    g.fillStyle=grad; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill();
    g.strokeStyle='#2F7A2E'; g.lineWidth=${S}*0.012; g.stroke();
    // 头顶豆芽
    g.strokeStyle='#4C9E3A'; g.lineWidth=${S}*0.02; g.lineCap='round';
    g.beginPath(); g.moveTo(0,-r*0.9); g.quadraticCurveTo(r*0.12,-r*1.5,0,-r*1.9); g.stroke();
    g.fillStyle='#7AD24B';
    g.beginPath(); g.ellipse(-r*0.28,-r*1.8,r*0.36,r*0.2,-0.5,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(r*0.28,-r*1.95,r*0.36,r*0.2,0.5,0,Math.PI*2); g.fill();
    // 眼睛
    g.fillStyle='#fff';
    g.beginPath(); g.arc(-r*0.32,-r*0.14,r*0.27,0,Math.PI*2); g.arc(r*0.32,-r*0.14,r*0.27,0,Math.PI*2); g.fill();
    g.fillStyle='#20331A';
    g.beginPath(); g.arc(-r*0.28,-r*0.1,r*0.14,0,Math.PI*2); g.arc(r*0.36,-r*0.1,r*0.14,0,Math.PI*2); g.fill();
    g.fillStyle='#fff';
    g.beginPath(); g.arc(-r*0.23,-r*0.18,r*0.055,0,Math.PI*2); g.arc(r*0.41,-r*0.18,r*0.055,0,Math.PI*2); g.fill();
    // 腮红
    g.fillStyle='rgba(255,150,150,0.5)';
    g.beginPath(); g.arc(-r*0.55,r*0.27,r*0.15,0,Math.PI*2); g.arc(r*0.55,r*0.27,r*0.15,0,Math.PI*2); g.fill();
    // 嘴
    g.strokeStyle='#2F5A22'; g.lineWidth=${S}*0.008;
    g.beginPath(); g.arc(0,r*0.32,r*0.18,0.15*Math.PI,0.85*Math.PI); g.stroke();
    g.restore();
    return c.toDataURL('image/png');
  })()`;
}

const page = await browser.newPage();
await page.setContent('<canvas id="c" width="256" height="256"></canvas>');
const icon256 = await page.evaluate(peaDraw(256));
writeFileSync(join(ROOT, 'icon.png'), Buffer.from(icon256.split(',')[1], 'base64'));

await page.setContent('<canvas id="c" width="48" height="48"></canvas>');
const favicon = await page.evaluate(peaDraw(48));
writeFileSync(join(ROOT, 'favicon.png'), Buffer.from(favicon.split(',')[1], 'base64'));

await browser.close().catch(() => {});
console.log('✓ icon.png (256×256)');
console.log('✓ favicon.png (48×48)');
process.exit(0);
