#!/usr/bin/env node
// tools/make-materials.mjs — G6 物料：AI 原画 → poster.jpg / poster-1920.jpg / icon.png / game.gif / SEO.txt
// 出图走 ucloud C 机 qwen-image-xl（A 机 h3-image 常被训练占满，不死等）；提示词一律出自 Art Bible。
// 录 gif 用 Playwright 真实交互（开局→走→搬灯→点灯），不是标题画面。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildPrompt } from '/Users/admin/git/webgames/skills/game3d-pipeline/scripts/artbible.mjs';

globalThis.require = createRequire(import.meta.url);
const { serve, loadPlaywright } = await import('/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs');
const ROOT = path.resolve('.');
const C = 'http://117.50.89.18:8990';
const FF = '/opt/homebrew/bin/ffmpeg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

// ---------- 1) 原画 ----------
async function keyArt() {
  const out = path.join(ROOT, 'assets/_src3d/poster-raw.png');
  if (fs.existsSync(out) && !process.argv.includes('--force-art')) { log('原画已存在，跳过'); return out; }
  const { prompt, seed } = buildPrompt(ROOT, { category: 'poster', subject: 'a lone lighthouse keeper in a straw hat carrying a glowing brass storm lantern along a wet stone path, tiny against a tall striped lighthouse on a rocky island, storm clouds rolling in over a cold blue sea, warm lamp light spilling from the tower, seven unlit lamp posts leading inland' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (const name of ['qwen-image-xl', 'qwen-image']) {
    for (let i = 1; i <= 3; i++) {
      try {
        log(`原画 ${name} 第${i}次（prompt ${prompt.length} 字，seed ${seed}）`);
        const r = await fetch(`${C}/m/${name}/txt2img`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width: 1328, height: 752, steps: 24, seed: seed + i }),
          signal: AbortSignal.timeout(240000),
        });
        const j = await r.json();
        const b64 = j.image_base64 || (j.images || [])[0];
        if (!b64) throw new Error(JSON.stringify(j).slice(0, 140));
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        log(`原画 ok ${Math.round(fs.statSync(out).size / 1024)}KB`);
        return out;
      } catch (e) { log(`原画失败：${e.message}`); await sleep(6000); }
    }
  }
  throw new Error('原画三连失败（C 机不可用？）');
}

// ---------- 2) 海报排版（HTML 叠字 → Playwright 截图）----------
function posterHtml(artB64, w, h) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0b1118;
    font-family:'PingFang SC','Hiragino Sans','Segoe UI',system-ui,sans-serif}
  .bg{position:absolute;inset:0;background:url('data:image/png;base64,${artB64}') center/cover no-repeat}
  .vig{position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 45%,rgba(0,0,0,0) 40%,rgba(4,8,14,.82) 100%)}
  .grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,10,18,.62) 0%,rgba(6,10,18,0) 34%,rgba(6,10,18,.72) 100%)}
  .top{position:absolute;top:${Math.round(h * 0.055)}px;left:${Math.round(w * 0.05)}px;right:${Math.round(w * 0.05)}px;display:flex;justify-content:space-between;align-items:center}
  .kicker{font-size:${Math.round(h * 0.026)}px;letter-spacing:.34em;color:#f4b23c;text-transform:uppercase;font-weight:700}
  .badges{display:flex;gap:${Math.round(w * 0.008)}px}
  .badge{font-size:${Math.round(h * 0.021)}px;letter-spacing:.12em;color:#ffe2b0;border:1px solid rgba(244,178,60,.55);border-radius:999px;padding:${Math.round(h * 0.008)}px ${Math.round(w * 0.012)}px;background:rgba(8,12,20,.5);text-transform:uppercase}
  .title{position:absolute;left:${Math.round(w * 0.05)}px;bottom:${Math.round(h * 0.17)}px;line-height:.92}
  .title b{display:block;font-size:${Math.round(h * 0.135)}px;letter-spacing:.04em;color:#fff;text-shadow:0 ${Math.round(h * 0.006)}px ${Math.round(h * 0.03)}px rgba(0,0,0,.75)}
  .title i{display:block;margin-top:${Math.round(h * 0.018)}px;font-style:normal;font-size:${Math.round(h * 0.037)}px;color:#ffd9a0;letter-spacing:.02em}
  .foot{position:absolute;left:${Math.round(w * 0.05)}px;right:${Math.round(w * 0.05)}px;bottom:${Math.round(h * 0.05)}px;display:flex;justify-content:space-between;align-items:flex-end}
  .foot p{font-size:${Math.round(h * 0.026)}px;color:#cdd8e4;max-width:${Math.round(w * 0.6)}px;line-height:1.45}
  .foot span{font-size:${Math.round(h * 0.024)}px;color:#8fa2b6;letter-spacing:.16em;text-transform:uppercase}
  .rule{position:absolute;left:${Math.round(w * 0.05)}px;bottom:${Math.round(h * 0.145)}px;width:${Math.round(w * 0.16)}px;height:${Math.round(h * 0.006)}px;background:linear-gradient(90deg,#ff8a3d,#f4b23c);border-radius:2px}
</style></head><body><div class="bg"></div><div class="grad"></div><div class="vig"></div>
<div class="top"><div class="kicker">Lantern Isle · 3D</div><div class="badges"><div class="badge">Carry</div><div class="badge">Light</div><div class="badge">Survive the storm</div></div></div>
<div class="title"><b>LANTERN ISLE</b><i>风暴登岛前，点亮全岛七盏灯</i></div>
<div class="rule"></div>
<div class="foot"><p>搬灯会拖累你的脚步，风会抢走手里的光。走近路还是绕远路、点主塔还是点村口——每一夜都要当场决定。</p><span>Blender · Three.js · AI Agent pipeline</span></div>
</body></html>`;
}
async function poster(art) {
  const { chromium } = loadPlaywright();
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
  const b64 = fs.readFileSync(art).toString('base64');
  for (const [w, h, file] of [[1280, 720, 'poster.jpg'], [1920, 1080, 'poster-1920.jpg'], [512, 512, 'icon.png']]) {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(file === 'icon.png' ? iconHtml(b64, w) : posterHtml(b64, w, h), { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const png = path.join(ROOT, 'tests/final', file.replace(/\.(jpg|png)$/, '.png'));
    fs.mkdirSync(path.dirname(png), { recursive: true });
    await page.screenshot({ path: png });
    const outp = path.join(ROOT, file);
    if (file.endsWith('.jpg')) spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', png, '-q:v', '4', outp]);
    else spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', png, '-vf', 'scale=256:256', outp]);
    log(`${file} ${Math.round(fs.statSync(outp).size / 1024)}KB`);
    await page.close();
  }
  await b.close();
}
function iconHtml(b64, s) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${s}px;height:${s}px;overflow:hidden;background:#0b1118;
  font-family:'PingFang SC','Segoe UI',system-ui,sans-serif}
  .bg{position:absolute;inset:0;background:url('data:image/png;base64,${b64}') center 30%/${s * 1.6}px no-repeat}
  .vig{position:absolute;inset:0;background:radial-gradient(80% 70% at 50% 40%,rgba(0,0,0,0) 30%,rgba(4,8,14,.86) 100%)}
  .t{position:absolute;left:0;right:0;bottom:${s * 0.1}px;text-align:center;color:#fff;font-weight:800;font-size:${s * 0.15}px;letter-spacing:.02em;text-shadow:0 4px 18px rgba(0,0,0,.85)}
  .g{position:absolute;left:50%;top:${s * 0.14}px;transform:translateX(-50%);width:${s * 0.2}px;height:${s * 0.2}px;border-radius:50%;
     background:radial-gradient(circle,#fff3c4 0%,#f4b23c 45%,rgba(244,178,60,0) 72%)}
</style></head><body><div class="bg"></div><div class="g"></div><div class="vig"></div><div class="t">LANTERN<br>ISLE</div></body></html>`;
}

// ---------- 3) game.gif：真实交互录制 ----------
async function gif() {
  const { chromium } = loadPlaywright();
  const { server, port } = await serve(ROOT, 8355);
  const videoDir = path.join('/tmp', 'lantern-video-' + Date.now());
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: videoDir, size: { width: 960, height: 540 } } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 90000 });
  await page.click('#btn-start');
  await page.evaluate(() => window.__ll.skipTutorial && window.__ll.skipTutorial());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game3d.call({ fn: 'teleport', args: { to: 'lantern_small_0' } }));
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game3d.call({ fn: 'teleport', args: { to: 'lamp_village' } }));
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.__game3d.call({ fn: 'teleport', args: { x: -24, z: -2 } }));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  await ctx.close();
  await browser.close();
  server.close();
  const vids = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
  if (!vids.length) throw new Error('没录到视频');
  const src = path.join(videoDir, vids[0]);
  const pal = '/tmp/lantern-pal.png';
  const out = path.join(ROOT, 'game.gif');
  // 从「已经在玩」的那一秒开始截，取 4.6s 循环，480x270
  spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1.4', '-t', '4.6', '-i', src, '-vf', 'fps=16,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', pal]);
  const r = spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1.4', '-t', '4.6', '-i', src, '-i', pal, '-lavfi', 'fps=16,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', out]);
  if (r.status !== 0) throw new Error('gif 合成失败：' + (r.stderr || '').toString().slice(0, 200));
  log(`game.gif ${Math.round(fs.statSync(out).size / 1048576 * 10) / 10}MB`);
}

// ---------- 4) SEO.txt ----------
function seo() {
  const txt = [
    'TITLE: LANTERN ISLE',
    'CATEGORY: Adventure',
    'TAGS: 3D, third person, exploration, time management, atmospheric, low poly, island, storm, quest, npc, singleplayer, casual',
    'SHORT DESCRIPTION: The storm lands before dawn. Carry lanterns across a 3D island and light every lamp before the timer runs out.',
    'LONG DESCRIPTION: LANTERN ISLE is a third-person 3D island game about a lighthouse keeper racing an incoming storm. Pick up lanterns at the harbour, then walk the village, dunes, rocks, pine slope and cliff path to light every lamp post. Carrying weight slows you down and weakens your jump, gusts can tear lanterns out of your hands, and oil is limited, so every night forces real choices: the shortcut along the cliff or the safe village road, the big lighthouse lamp worth triple or two cheap lamps that build a combo, drop a lantern to run faster and leave that stretch of shore dark. Three islanders remember what you carried, dropped and lit, and hand out tasks that pay in oil, seconds and permanent upgrades. Five nights, one walkable island, AI-generated 3D props and a hand-rigged animated keeper, all running in the browser with no downloads. Controls: WASD to walk, Shift to run, Space to jump, E to pick up, R to light, F to drop, T to talk, mouse to look. Touch controls included.',
    '',
    'TITLE（中文）: 灯火之岛',
    'CATEGORY（中文）: 冒险',
    'TAGS（中文）: 3D, 第三人称, 探索, 时间管理, 氛围, 海岛, 风暴, 任务, NPC, 单人, 休闲',
    'SHORT DESCRIPTION（中文）: 风暴天亮前登岛。搬着灯走遍 3D 海岛，在计时结束前点亮每一盏灯。',
    'LONG DESCRIPTION（中文）: 《灯火之岛》是一款第三人称 3D 海岛游戏：你是灯塔岛的守灯人，要在风暴登岛前把全岛七盏灯点亮。从码头搬灯出发，穿过村道、沙丘、礁石、松林坡和崖顶栈道。负重会让你走得更慢、跳得更低，阵风会把手里的灯抢走，油又只够点有限的几盏——所以每一夜都是真实取舍：走崖边近路还是村内远路，点三倍分的主塔大灯还是点两盏攒连击，要不要丢灯提速、让那段海岸一直黑着。三个岛民会记住你搬了什么、丢了什么、点亮了哪里，并给出用油、用秒数、用永久成长结算的任务。五个夜晚、一座可行走的岛、AI 生成的 3D 道具与手工绑骨的动画角色，全部在浏览器里运行，无需下载。操作：WASD 移动，Shift 奔跑，空格跳跃，E 拾取，R 点灯，F 丢弃，T 交谈，鼠标转视角；移动端有虚拟摇杆。',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'SEO.txt'), txt);
  log('SEO.txt 写好（5 个关键词大写 + 中英）');
}

const art = await keyArt();
await poster(art);
await gif();
seo();
log('==== make-materials DONE ====');
