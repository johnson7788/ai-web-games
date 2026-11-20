// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270 循环动图）
// 先录 webm（真实战斗：选技能→攻击→击杀），再 ffmpeg paletteuse 转 gif。
import { mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const webm = join(root, 'tests', 'artifacts', 'gameplay.webm');
const gif = join(root, 'game.gif');
mkdirSync(join(root, 'tests', 'artifacts'), { recursive: true });
rmSync(webm, { force: true });

const { server, port } = await serve(root, 8720);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: join(root, 'tests', 'artifacts'), size: { width: 1280, height: 720 } },
});
await ctx.addInitScript(() => { try { localStorage.setItem('heroes-quest:tutorial-done', 'true'); } catch { /* noop */ } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });

// 进入战斗（真实操作：开始 → 布阵 → 行军）
await page.evaluate(() => window.__ll.start());
await page.waitForFunction(() => window.__ll.run?.mode === 'formation', { timeout: 5000 });
await page.evaluate(() => window.__ll.debug.confirmFormation(['vanguard', 'ranger', 'seer']));
await page.waitForFunction(() => window.__ll.run?.mode === 'map', { timeout: 5000 });
await page.evaluate(() => window.__ll.debug.chooseNode('n1a'));
await page.waitForFunction(() => window.__ll.run?.mode === 'battle', { timeout: 5000 });

// 前 3 秒必须见核心动词 + 目标：在战斗里真实放技能打敌人
const t0 = Date.now();
while (Date.now() - t0 < 4200) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    if (r.mode === 'battle' && r.battle.waiting) {
      const t = r.battle.units.filter((u) => u.side === 'enemy' && u.alive).sort((a, b) => a.hp - b.hp)[0];
      if (t) r.step({ action: { skill: 'basic', target: t.id } });
      r.drainEvents();
    }
  });
  await page.waitForTimeout(260);
}
await page.waitForTimeout(300);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

// Playwright 录屏文件名是 UUID，关闭后找出来重命名为固定名
const artDir = join(root, 'tests', 'artifacts');
const found = readdirSync(artDir).filter((f) => f.endsWith('.webm')).sort().pop();
if (!found) { console.error('no webm recorded'); process.exit(1); }
renameSync(join(artDir, found), webm);
console.log('recorded', webm);

// ffmpeg：palettegen → paletteuse（480×270、15fps、循环）
const ff = '/opt/homebrew/bin/ffmpeg';
const pal = join(root, 'tests', 'artifacts', 'palette.png');
try {
  execFileSync(ff, ['-y', '-t', '4.5', '-i', webm, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', pal], { stdio: 'inherit' });
  execFileSync(ff, ['-y', '-t', '4.5', '-i', webm, '-i', pal, '-lavfi', 'fps=15,scale=480:270:flags=lanczos [x]; [x][1:v] paletteuse', '-loop', '0', gif], { stdio: 'inherit' });
  console.log('saved', gif);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
