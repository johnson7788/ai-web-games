// Sprout Hop · 海报生成：真实玩法画面（蓄力轨迹弧线）+ 大标题贴纸字（HTML 叠字）→ Playwright 截图。
// 输出 poster.jpg（1280×720）与 poster-1920.jpg（1920×1080，等比放大）。
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8291);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForTimeout(700);

// 进入蓄力状态，露出核心玩法（轨迹弧线 + 目标旗帜 + 豌豆）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  const r = window.__ll.run();
  r.aimStart();
  r.aimSet({ x: 95, y: -55 });
});
await page.waitForTimeout(350);

// 隐藏 HUD（海报更干净）
await page.addStyleTag({ content: '#hud{display:none!important;}' });

// 叠加贴纸字标题
await page.evaluate(() => {
  const el = document.createElement('div');
  el.id = 'poster-title';
  el.textContent = 'SPROUT HOP';
  Object.assign(el.style, {
    position: 'absolute', top: '56px', left: '0', right: '0', textAlign: 'center',
    zIndex: '30', pointerEvents: 'none',
    fontFamily: "'PingFang SC','Hiragino Sans','Segoe UI',sans-serif",
    fontSize: '108px', fontWeight: '900', letterSpacing: '0.05em', lineHeight: '1',
    background: 'linear-gradient(180deg,#D8FF8A 0%,#7AD24B 48%,#2F9E44 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    WebkitTextStroke: '3px #1E5A2E', paintOrder: 'stroke fill',
    filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.35))',
  });
  document.getElementById('game-container').appendChild(el);

  const sub = document.createElement('div');
  sub.id = 'poster-sub';
  sub.textContent = 'Sling the pea across the bean-vine trellis';
  Object.assign(sub.style, {
    position: 'absolute', top: '190px', left: '0', right: '0', textAlign: 'center',
    zIndex: '30', pointerEvents: 'none',
    fontFamily: "'PingFang SC','Hiragino Sans','Segoe UI',sans-serif",
    fontSize: '26px', fontWeight: '800', color: '#ffffff',
    textShadow: '0 2px 5px rgba(0,0,0,0.55)',
  });
  document.getElementById('game-container').appendChild(sub);
});
await page.waitForTimeout(200);

const poster = join(ROOT, 'poster.jpg');
await page.screenshot({ path: poster, type: 'jpeg', quality: 90 });
console.log('✓', poster);

await browser.close().catch(() => {});
server.close();

// 等比放大到 1920×1080
const poster1920 = join(ROOT, 'poster-1920.jpg');
try {
  execFileSync('ffmpeg', ['-y', '-i', poster, '-vf', 'scale=1920:1080:flags=lanczos', '-q:v', '3', poster1920], { stdio: 'ignore' });
  console.log('✓', poster1920);
} catch (e) {
  console.error('poster-1920 failed:', e.message);
}
process.exit(0);
