import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/Users/admin/.npm-global/lib/node_modules/playwright', '/opt/homebrew/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('playwright not found');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.cwd(), process.argv[2] || 'tests/artifacts-m6');
const rawDir = path.join(out, 'raw');
fs.mkdirSync(rawDir, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(`${root}${path.sep}`) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const errors = [];
const failed = [];
const warnings = [];
const metrics = { screenshots: [], videos: {} };
let browser;

function watch(page, prefix) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${prefix}${message.text()}`);
    if (message.type() === 'warning') warnings.push(`${prefix}${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${prefix}${error.stack || error.message}`));
  page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name) });
  metrics.screenshots.push(name);
}

async function openPage(context, lang = 'zh') {
  const page = await context.newPage();
  watch(page, `${lang.toUpperCase()} `);
  await page.goto(`${url}?debug=1&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__pb));
  return page;
}

async function enterFromTitle(page) {
  await page.locator('#btnPlay').click();
  await page.locator('#btnModeNext').click();
  await page.waitForFunction(() => window.G.Game.mode === 'select');
}

function helpLayout() {
  const card = document.querySelector('.help-card').getBoundingClientRect();
  const button = document.getElementById('btnHelpClose').getBoundingClientRect();
  return {
    viewport: [innerWidth, innerHeight],
    document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    card: { left: card.left, top: card.top, right: card.right, bottom: card.bottom },
    button: { left: button.left, top: button.top, right: button.right, bottom: button.bottom },
    overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight ||
      card.left < 0 || card.top < 0 || card.right > innerWidth || card.bottom > innerHeight ||
      button.left < 0 || button.top < 0 || button.right > innerWidth || button.bottom > innerHeight,
  };
}

async function freezeBots(page) {
  await page.evaluate(() => {
    const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false };
    window.__pb.brains.update = () => {};
    window.__pb.brains.intentOf = (id) => id === 'f0' ? null : { ...idle };
    const [player, target, ...others] = window.__pb.sim.fighters;
    Object.assign(player.pos, { x: -0.55, y: 0, z: 0 });
    Object.assign(target.pos, { x: 0.55, y: 0, z: 0 });
    player.facing = Math.PI / 2;
    target.facing = -Math.PI / 2;
    for (const fighter of [player, target]) {
      fighter.onGround = true;
      fighter.vel.x = fighter.vel.y = fighter.vel.z = 0;
      fighter.attack = null;
      fighter.charging = false;
    }
    others.forEach((fighter, index) => {
      const angle = index * Math.PI * 2 / Math.max(1, others.length);
      Object.assign(fighter.pos, { x: Math.sin(angle) * 4.5, y: 0, z: Math.cos(angle) * 4.5 });
      fighter.vel.x = fighter.vel.y = fighter.vel.z = 0;
    });
    window.__pb.step(0);
  });
  await page.waitForTimeout(650);
}

async function prepareFight(context, lang = 'en') {
  await context.addInitScript(() => {
    try { localStorage.setItem('pawbrawl_tutorial_v1', '1'); } catch {}
  });
  const page = await openPage(context, lang);
  await page.evaluate(() => {
    window.__pb.play();
    window.__pb.skip();
    window.__pb.step(1);
  });
  await freezeBots(page);
  return page;
}

async function cameraSnapshot(page) {
  return page.evaluate(() => {
    const player = window.__pb.sim.fighters[0];
    const ndc = window.__pb.actors.get(player.id).group.position.clone().project(window.__pb.camera);
    return {
      focus: window.__pb.__lastKoFocus,
      player: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      playerNdc: { x: ndc.x, y: ndc.y, z: ndc.z },
      target: { ...window.G.Game.camera.target },
      camera: window.__pb.camera.position.toArray(),
      deathOverlay: window.__pb.deathOverlay,
    };
  });
}

function probe(file) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', file], { encoding: 'utf8' }));
  return { duration: Number(result.format.duration), width: result.streams[0]?.width, height: result.streams[0]?.height };
}

async function recordClip(kind) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
  });
  const page = await prepareFight(context);
  const started = Date.now();
  let observed;
  if (kind === 'player-ko') {
    await page.evaluate(() => window.__pb.forceKO('f0'));
    await page.waitForFunction(() => window.__pb.deathOverlay, { timeout: 2500 });
    observed = await cameraSnapshot(page);
    assert.equal(observed.focus, 'f0');
    assert.equal(observed.deathOverlay, true);
  } else {
    const heavy = kind === 'heavy-punch';
    await page.evaluate((isHeavy) => {
      const intent = { mx: 0, mz: 0, jump: false, dash: false, punch: !isHeavy, punchHeld: !isHeavy, grab: false, charge: false, charged: isHeavy };
      window.__pb.step(1, intent);
    }, heavy);
    await page.waitForFunction((minimum) => window.__pb.hitstopT >= minimum, heavy ? 0.09 : 0.05, { timeout: 2500 });
    observed = await page.evaluate(() => ({ hitstop: window.__pb.hitstopT, fovKick: window.__pb.fovKickT, shake: window.__pb.shakeAmp, fov: window.__pb.camera.fov }));
    assert.ok(observed.hitstop >= (heavy ? 0.09 : 0.05));
    assert.ok(observed.fov < 40);
  }
  await page.waitForTimeout(Math.max(0, 700 - (Date.now() - started)));
  const video = page.video();
  await context.close();
  const generated = await video.path();
  const raw = path.join(rawDir, `${kind}.webm`);
  await video.saveAs(raw);
  if (generated !== raw) fs.rmSync(generated, { force: true });
  const source = probe(raw);
  const output = path.join(out, `${kind}-025x.mp4`);
  const clipSeconds = 0.68;
  const clipStart = Math.max(0, source.duration - (kind === 'player-ko' ? 1.5 : clipSeconds));
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-vf', `trim=start=${clipStart}:duration=${clipSeconds},setpts=4*(PTS-STARTPTS),fps=30`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
  ]);
  const result = { ...probe(output), observed, sourceDuration: source.duration, playbackRate: 0.25 };
  assert.ok(result.duration >= 2 && result.duration <= 3, `${kind} duration ${result.duration}`);
  assert.equal(result.width, 1280);
  assert.equal(result.height, 720);
  metrics.videos[kind] = result;
}

try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const desktop = await openPage(desktopContext, 'zh');

  await desktop.locator('#btnTitleHelp').click();
  await desktop.waitForFunction(() => window.__pb.helpOpen);
  await desktop.locator('#btnHelpClose').click();
  assert.equal(await desktop.evaluate(() => window.__pb.helpOpen), false);
  assert.equal(await desktop.evaluate(() => localStorage.getItem('pawbrawl_tutorial_v1')), null);

  await enterFromTitle(desktop);
  await desktop.locator('#btnStartMatch').click();
  await desktop.waitForFunction(() => window.__pb.helpOpen);
  metrics.firstRun = await desktop.evaluate(() => ({
    mode: window.G.Game.mode,
    paused: window.G.Game.paused,
    simTime: window.__pb.sim.time,
    phase: window.__pb.match.phase,
    phaseT: window.__pb.match.phaseT,
    stored: localStorage.getItem('pawbrawl_tutorial_v1'),
    title: document.getElementById('help-title').textContent,
  }));
  await desktop.waitForTimeout(250);
  assert.equal(await desktop.evaluate(() => window.__pb.sim.time), 0);
  assert.equal(await desktop.evaluate(() => window.__pb.match.phaseT), 0);
  assert.equal(metrics.firstRun.stored, null);
  assert.equal(metrics.firstRun.title, '怎么玩');
  metrics.desktopHelp = await desktop.evaluate(helpLayout);
  assert.equal(metrics.desktopHelp.overflow, false);
  await shot(desktop, '01-tutorial.png');

  await desktop.locator('#btnHelpClose').click();
  assert.equal(await desktop.evaluate(() => localStorage.getItem('pawbrawl_tutorial_v1')), '1');
  await desktop.evaluate(() => { window.__pb.skip(); window.__pb.step(1); });
  await desktop.locator('#help-button').click();
  const helpTime = await desktop.evaluate(() => window.__pb.sim.time);
  await desktop.waitForTimeout(200);
  assert.equal(await desktop.evaluate(() => window.__pb.sim.time), helpTime);
  assert.equal(await desktop.evaluate(() => window.G.Game.paused), true);
  await desktop.locator('#btnHelpClose').click();

  await desktop.locator('#pause-button').click();
  await desktop.locator('#btnPauseHelp').click();
  await desktop.waitForFunction(() => window.__pb.helpOpen);
  await shot(desktop, '05-help-pause.png');
  await desktop.locator('#btnHelpClose').click();
  assert.equal(await desktop.locator('#pause-screen').isVisible(), true);
  await desktop.locator('#btnResume').click();

  await freezeBots(desktop);
  const otherBefore = await cameraSnapshot(desktop);
  const returnedFocus = await desktop.evaluate(() => window.__pb.forceKO('f1'));
  await desktop.waitForTimeout(140);
  const otherAfter = await cameraSnapshot(desktop);
  assert.equal(returnedFocus, null);
  assert.equal(otherAfter.focus, null);
  assert.ok(Math.abs(otherAfter.playerNdc.x) < 0.5 && Math.abs(otherAfter.playerNdc.y) < 0.65);
  metrics.otherKo = { legacyFocus: 'f1', before: otherBefore, after: otherAfter };
  await shot(desktop, '02-camera-other-ko.png');

  await desktop.evaluate(() => window.__pb.forceKO('f0'));
  await desktop.waitForFunction(() => window.__pb.deathOverlay, { timeout: 2500 });
  await desktop.waitForTimeout(120);
  metrics.selfKo = await cameraSnapshot(desktop);
  assert.equal(metrics.selfKo.focus, 'f0');
  assert.equal(metrics.selfKo.deathOverlay, true);
  assert.equal(await desktop.locator('#death-overlay').isVisible(), true);
  assert.ok(metrics.selfKo.target.y < 0);
  await shot(desktop, '03-camera-self-death.png');

  await desktop.evaluate(() => window.__pb.play());
  assert.equal(await desktop.evaluate(() => window.__pb.helpOpen), false);
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobile = await openPage(mobileContext, 'zh');
  await mobile.locator('#btnTitleHelp').click();
  await mobile.waitForFunction(() => window.__pb.helpOpen);
  metrics.mobileHelp = await mobile.evaluate(helpLayout);
  assert.equal(metrics.mobileHelp.overflow, false);
  await shot(mobile, '06-tutorial-mobile.png');
  await mobileContext.close();

  const hitContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const hit = await prepareFight(hitContext);
  await hit.evaluate(() => window.__pb.step(1, { mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false, charged: true }));
  await hit.waitForFunction(() => window.__pb.hitstopT >= 0.09, { timeout: 2500 });
  metrics.hitFreeze = await hit.evaluate(() => ({ hitstop: window.__pb.hitstopT, fovKick: window.__pb.fovKickT, shake: window.__pb.shakeAmp, fov: window.__pb.camera.fov }));
  assert.ok(metrics.hitFreeze.fov <= 38.6);
  await shot(hit, '04-hit-freeze.png');
  await hitContext.close();

  await recordClip('light-punch');
  await recordClip('heavy-punch');
  await recordClip('player-ko');
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
} finally {
  const expectedShots = ['01-tutorial.png', '02-camera-other-ko.png', '03-camera-self-death.png', '04-hit-freeze.png', '05-help-pause.png', '06-tutorial-mobile.png'];
  const screenshotsComplete = expectedShots.every((name) => {
    const file = path.join(out, name);
    return metrics.screenshots.includes(name) && fs.existsSync(file) && fs.statSync(file).size > 10000;
  });
  const videosComplete = ['light-punch', 'heavy-punch', 'player-ko'].every((name) => metrics.videos[name]?.duration >= 2 && metrics.videos[name]?.duration <= 3);
  const report = { url, at: new Date().toISOString(), errors, failed, warnings, metrics };
  report.ok = errors.length === 0 && failed.length === 0 && screenshotsComplete && videosComplete;
  fs.writeFileSync(path.join(out, 'report-m6.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  if (!report.ok) process.exitCode = 1;
}
