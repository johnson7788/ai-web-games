// 生成交付物料：poster.jpg（1280×720，游戏画面）、icon.png（512）、favicon.png（64）。
// 用 playwright 起服务截图游戏真实画面；用完即关，不驻留。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8250);
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForFunction(() => window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);

  // poster：进入第一题的真实画面（霓虹场景 + 选项）
  await page.evaluate(() => { window.__ll.debug.startSeeded(0, 1); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

  // 程序化图标：霓虹交通灯（512 / 64）
  const drawIcon = (size) => page.evaluate((s) => {
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const x = c.getContext('2d');
    const u = s / 512;
    const g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#07070f');
    g.addColorStop(1, '#141430');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    x.strokeStyle = '#00e5ff';
    x.lineWidth = 10 * u;
    x.strokeRect(20 * u, 20 * u, s - 40 * u, s - 40 * u);
    // 信号灯
    x.fillStyle = '#1c1c30';
    x.fillRect(176 * u, 90 * u, 160 * u, 320 * u);
    const cols = ['#ff2d78', '#ffd166', '#4ade80'];
    for (let i = 0; i < 3; i += 1) {
      x.fillStyle = cols[i];
      x.beginPath();
      x.arc(256 * u, 150 * u + i * 100 * u, 42 * u, 0, Math.PI * 2);
      x.fill();
    }
    // 路面斑马线
    x.fillStyle = 'rgba(244,244,255,0.85)';
    for (let i = 0; i < 5; i += 1) x.fillRect((96 + i * 70) * u, 430 * u, 40 * u, 60 * u);
    return c.toDataURL('image/png');
  }, size);

  const iconData = await drawIcon(512);
  const faviconData = await drawIcon(64);
  writeFileSync(join(ROOT, 'icon.png'), Buffer.from(iconData.split(',')[1], 'base64'));
  writeFileSync(join(ROOT, 'favicon.png'), Buffer.from(faviconData.split(',')[1], 'base64'));

  console.log(`poster.jpg / icon.png / favicon.png written to ${ROOT}`);
} finally {
  await browser.close();
  server.close();
}
