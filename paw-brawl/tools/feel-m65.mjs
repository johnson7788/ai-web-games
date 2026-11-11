import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim } from '../src/game/sim.js';
import { CHARACTERS } from '../config/characters.js';
import { CLOUD_RING } from '../config/arenas.js';
import { STEP } from '../config/game.config.js';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/Users/admin/.npm-global/lib/node_modules/playwright', '/opt/homebrew/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('playwright not found');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.cwd(), process.argv[2] || 'tests/artifacts-m6.5');
const rawRoot = path.join(out, 'raw');
fs.mkdirSync(rawRoot, { recursive: true });
const errors = [];
const failed = [];
const warnings = [];
const metrics = { playbackRate: 0.25, sourceFps: 60, videos: {}, screenshots: [], knockback: {} };
const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false };

function measureKnock(move) {
  const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: ['shiba'], seed: 42, eliminateOnFall: true });
  const [attacker, target] = sim.fighters;
  Object.assign(attacker.pos, { x: 0, y: 0, z: 0 });
  Object.assign(target.pos, { x: 0, y: 0, z: 1.2 });
  attacker.facing = 0;
  attacker.attack = { move, phase: 'startup', t: 0, hasHit: new Set(), facing: 0, lungeLeft: 0 };
  let hit = false;
  let staggerDistance = 0;
  let maxDistance = 0;
  let maxVisualY = 0;
  for (let frame = 0; frame < 90; frame++) {
    sim.step(STEP, new Map([['f0', idle], ['f1', idle]]));
    if (sim.events.some((event) => event.type === 'hit')) hit = true;
    if (!hit) continue;
    const distance = Math.hypot(target.pos.x, target.pos.z - 1.2);
    maxDistance = Math.max(maxDistance, distance);
    maxVisualY = Math.max(maxVisualY, target.anim.knockLift);
    if (target.staggerT > 0) staggerDistance = distance;
  }
  return { hit, staggerDistance, maxDistance, maxVisualY };
}

for (const [move, minimum] of [['punch1', 0.6], ['punch3', 2.5], ['charged', 3.5]]) {
  const result = measureKnock(move);
  metrics.knockback[move] = result;
  assert.ok(result.hit, `${move} did not hit`);
  assert.ok(result.staggerDistance >= minimum, `${move} stagger distance ${result.staggerDistance}`);
}
assert.ok(metrics.knockback.punch3.maxVisualY >= 0.8, `heavy visual height ${metrics.knockback.punch3.maxVisualY}`);

const harness = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#dff4ff}canvas{display:block;width:100%;height:100%}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script>
</head>
<body>
<canvas id="game"></canvas>
<script type="module">
import { createStage, buildEnvironment, resize } from '/src/render/scene.js';
import { createAnimal } from '/src/render/animal.js';
import { createFx } from '/src/render/fx.js';
import { createSim } from '/src/game/sim.js';
import { CLOUD_RING } from '/config/arenas.js';
import { CHARACTERS, CHARACTER_MAP } from '/config/characters.js';
import { CONFIG, STEP } from '/config/game.config.js';

const scenario = new URLSearchParams(location.search).get('scenario') || 'punch';
const stage = createStage(document.getElementById('game'), 'auto');
if (!stage) throw new Error('WebGL unavailable');
resize(stage);
const environment = buildEnvironment(stage.scene, CLOUD_RING);
const fx = createFx(stage.scene);
const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: ['shiba'], seed: 42, eliminateOnFall: true });
const [player, target] = sim.fighters;
Object.assign(player.pos, { x: 0, y: 0, z: 0 });
Object.assign(target.pos, { x: 0, y: 0, z: 1.2 });
player.facing = 0;
target.facing = Math.PI;
const actors = new Map();
for (const fighter of sim.fighters) {
  const actor = createAnimal(CHARACTER_MAP[fighter.charId], CONFIG.animation.gameplayScale);
  stage.scene.add(actor.group);
  actors.set(fighter.id, actor);
  fx.addShadow(fighter.id);
}
const heavy = scenario === 'heavy';
if (heavy) player.attack = { move: 'punch3', phase: 'startup', t: 0, hasHit: new Set(), facing: 0, lungeLeft: 0 };
if (scenario === 'ko') {
  target.eliminated = true;
  target.state = 'eliminated';
  target.onGround = false;
  target.pos.y = 2.2;
  target.vel.y = 0;
  fx.spawnKO(target.pos.x, target.pos.y, target.pos.z);
}
if (scenario === 'run') {
  stage.camera.position.set(1.2, 3.2, 10);
  stage.camera.lookAt(1.2, 0.8, 0.5);
} else if (scenario === 'ko') {
  stage.camera.position.set(9, 4.5, 5);
  stage.camera.lookAt(0, 0.3, 1.2);
} else {
  stage.camera.position.set(10, 5.5, 3);
  stage.camera.lookAt(0, 0.9, 3);
}
let frame = 0;
let hits = 0;
let hitstop = 0;
let trailT = 0;
const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false };
function intents() {
  const playerIntent = { ...idle };
  if (scenario === 'punch' && frame === 0) {
    playerIntent.punch = true;
    playerIntent.punchHeld = true;
  }
  if (scenario === 'run') playerIntent.mx = 1;
  return new Map([['f0', playerIntent], ['f1', { ...idle }]]);
}
function state() {
  return {
    frame,
    hits,
    hitstop,
    attack: player.attack ? { move: player.attack.move, phase: player.attack.phase, t: player.attack.t } : null,
    targetDistance: Math.hypot(target.pos.x, target.pos.z - 1.2),
    targetVisualY: target.anim.knockLift,
    targetY: target.pos.y,
    targetTumble: target.tumbleT,
    eliminated: target.eliminated,
  };
}
function advance() {
  let animationDt = STEP;
  if (hitstop > 0) {
    hitstop = Math.max(0, hitstop - STEP);
    animationDt = 0;
  } else if (!(heavy && hits > 0 && frame >= 45)) {
    sim.step(STEP, intents());
    for (const event of sim.events) {
      if (event.type === 'hit') {
        hits += 1;
        hitstop = event.hitstop;
        animationDt = 0;
        fx.spawnHit(event.x, event.y, event.z, event.heavy, { x: event.dx, z: event.dz });
      } else if (event.type === 'land') {
        fx.spawnDust(event.x, event.y, event.z);
      }
    }
  }
  for (const fighter of sim.fighters) {
    const actor = actors.get(fighter.id);
    actor.group.position.set(fighter.pos.x, fighter.pos.y, fighter.pos.z);
    const speed = Math.hypot(fighter.vel.x, fighter.vel.z);
    trailT -= STEP;
    if (fighter.tumbleT > 0 && speed > 6 && trailT <= 0) {
      fx.spawnGhost(fighter.pos, actor.character, CONFIG.animation.gameplayScale, fighter.facing);
      trailT = 0.05;
    } else if (fighter.tumbleT <= 0 || speed <= 6) trailT = 0;
    actor.update(animationDt, fighter);
    fx.updateShadow(fighter.id, fighter.pos.x, fighter.pos.y, fighter.pos.z, fighter.pos.y >= 0 && !fighter.eliminated);
  }
  environment.update(STEP, sim.time);
  fx.update(STEP);
  stage.renderer.render(stage.scene, stage.camera);
  frame += 1;
  return state();
}
advance();
window.feel = { advance, state };
</script>
</body>
</html>`;

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__feel-m65') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(harness);
      return;
    }
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
const url = `http://127.0.0.1:${server.address().port}/__feel-m65`;
let browser;

function watch(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
  });
}

function probe(file) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', file], { encoding: 'utf8' }));
  return { duration: Number(result.format.duration), width: result.streams[0]?.width, height: result.streams[0]?.height };
}

function encode(scenario, name) {
  const output = path.join(out, name);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', '15', '-i', path.join(rawRoot, scenario, 'frame-%03d.png'),
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', output,
  ]);
  const result = { ...probe(output), playbackRate: 0.25, sourceFrames: fs.readdirSync(path.join(rawRoot, scenario)).filter((file) => file.endsWith('.png')).length };
  assert.ok(result.duration >= 2 && result.duration <= 3, `${name} duration ${result.duration}`);
  assert.equal(result.width, 1280);
  assert.equal(result.height, 720);
  metrics.videos[name] = result;
}

function keepScreenshot(source, name) {
  const destination = path.join(out, name);
  fs.copyFileSync(source, destination);
  assert.ok(fs.statSync(destination).size > 10000, `${name} is empty`);
  metrics.screenshots.push(name);
}

async function record(scenario, frames) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page);
  await page.goto(`${url}?scenario=${scenario}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.feel));
  const directory = path.join(rawRoot, scenario);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  const captures = {};
  let finalState;
  for (let index = 0; index < frames; index++) {
    finalState = await page.evaluate(() => window.feel.advance());
    const file = path.join(directory, `frame-${String(index).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    if (scenario === 'punch' && !captures.windup && finalState.attack?.phase === 'startup' && finalState.attack.t >= 0.075) captures.windup = file;
    if (scenario === 'heavy') {
      if (!captures.before && finalState.hits === 0 && finalState.attack?.phase === 'startup' && finalState.attack.t >= 0.13) captures.before = file;
      if (!captures.impact && finalState.hits > 0) captures.impact = file;
      if (!captures.hurt && finalState.targetVisualY >= 0.75) captures.hurt = file;
      if (!captures.flight && finalState.targetDistance >= 1) captures.flight = file;
    }
    if (scenario === 'ko' && !captures.ko && index >= 12) captures.ko = file;
  }
  await context.close();
  if (scenario === 'punch') assert.ok(captures.windup, 'windup frame not captured');
  if (scenario === 'heavy') {
    for (const key of ['before', 'impact', 'hurt', 'flight']) assert.ok(captures[key], `heavy ${key} frame not captured`);
    assert.ok(finalState.targetDistance >= 2, `heavy flight distance ${finalState.targetDistance}`);
  }
  if (scenario === 'ko') assert.ok(captures.ko, 'KO frame not captured');
  return { captures, finalState };
}

try {
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
  const punch = await record('punch', 36);
  keepScreenshot(punch.captures.windup, 'windup.png');
  encode('punch', 'punch-slow.mp4');

  const heavy = await record('heavy', 42);
  keepScreenshot(heavy.captures.before, 'heavy-before.png');
  keepScreenshot(heavy.captures.impact, 'heavy-impact.png');
  keepScreenshot(heavy.captures.impact, 'impact.png');
  keepScreenshot(heavy.captures.hurt, 'hurt.png');
  keepScreenshot(heavy.captures.flight, 'heavy-flight-1m.png');
  metrics.heavyContact = heavy.finalState;
  encode('heavy', 'hurt-slow.mp4');
  encode('heavy', 'heavy-contact.mp4');

  await record('run', 36);
  encode('run', 'run-slow.mp4');

  const ko = await record('ko', 30);
  keepScreenshot(ko.captures.ko, 'ko.png');
  encode('ko', 'ko-slow.mp4');
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
} finally {
  const expectedVideos = ['punch-slow.mp4', 'hurt-slow.mp4', 'run-slow.mp4', 'ko-slow.mp4', 'heavy-contact.mp4'];
  const expectedShots = ['windup.png', 'impact.png', 'hurt.png', 'ko.png', 'heavy-before.png', 'heavy-impact.png', 'heavy-flight-1m.png'];
  const complete = expectedVideos.every((name) => metrics.videos[name]?.duration >= 2 && metrics.videos[name]?.duration <= 3) && expectedShots.every((name) => metrics.screenshots.includes(name));
  const report = { at: new Date().toISOString(), errors, failed, warnings, metrics };
  report.ok = errors.length === 0 && failed.length === 0 && complete;
  fs.writeFileSync(path.join(out, 'report-m6.5.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  if (!report.ok) process.exitCode = 1;
}
