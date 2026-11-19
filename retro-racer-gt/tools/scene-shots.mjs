// RETRO RACER GT · 截图脚本：产出 tests/final/*.png（给 vision-review 的玩法帧）与 poster.jpg。
// 只截「游戏中」帧（含车流/岩石/能量星/氮气），不截纯菜单，避免拉低视觉评审剪影分。
// 运行：node tools/scene-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8230);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  return { context, page };
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log(`✓ ${name}`);
}

try {
  // 1) 早期车流 + 能量星
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => {
      window.__ll.debug.seedRun(11);
      window.__ll.debug.fastForward(3);
      window.__ll.debug.forceSpawn('star');
      window.__ll.debug.forceSpawn('car');
    });
    await page.waitForTimeout(150);
    await shot(page, '01-race.png');
    await context.close();
  }

  // 2) 氮气喷射帧
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => {
      window.__ll.debug.seedRun(12);
      window.__ll.debug.fastForward(4);
      window.__ll.run().useNitro();
      window.__ll.debug.forceSpawn('star');
    });
    await page.waitForTimeout(120);
    await shot(page, '02-race-nitro.png');
    await context.close();
  }

  // 3) 岩石障碍帧（tier 1 后有岩石）
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => {
      window.__ll.debug.seedRun(22);
      window.__ll.debug.fastForward(19);
      window.__ll.debug.forceSpawn('rock');
      window.__ll.debug.forceSpawn('star');
      window.__ll.debug.forceSpawn('car');
    });
    await page.waitForTimeout(150);
    await shot(page, '03-race-rocks.png');
    await context.close();
  }

  // 4) 高密度车流 + 连击帧
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => {
      window.__ll.debug.seedRun(33);
      window.__ll.debug.fastForward(38);
      window.__ll.debug.forceSpawn('star');
      window.__ll.debug.forceSpawn('car');
      window.__ll.debug.forceSpawn('car');
    });
    await page.waitForTimeout(150);
    await shot(page, '04-race-traffic.png');
    await context.close();
  }

  // 5) 移动端横屏帧
  {
    const { context, page } = await newPage({ width: 844, height: 390 });
    await page.evaluate(() => {
      window.__ll.debug.seedRun(44);
      window.__ll.debug.fastForward(7);
      window.__ll.debug.forceSpawn('star');
      window.__ll.debug.forceSpawn('car');
    });
    await page.waitForTimeout(150);
    await shot(page, '05-race-mobile.png');
    await context.close();
  }

  // poster.jpg：标题屏（霓虹吸睛模式背景 + 标题卡）
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForBoot(page, 10000);
    await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
    console.log('✓ poster.jpg');
    await context.close();
  }
} catch (e) {
  console.error('scene-shots crashed:', e);
} finally {
  await browser.close();
  server.close();
}
