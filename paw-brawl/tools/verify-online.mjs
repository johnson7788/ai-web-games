import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/Users/admin/.npm-global/lib/node_modules/playwright', '/opt/homebrew/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('playwright not found');

const base = process.argv[2] || 'http://127.0.0.1:8124';
const server = process.argv[3] || 'ws://127.0.0.1:8601/ws';
const out = path.resolve(process.cwd(), process.argv[4] || 'tests/artifacts-m7');
fs.mkdirSync(out, { recursive: true });
const onlineUrl = `${base}/online.html?lang=en&server=${encodeURIComponent(server)}`;
const errors = [];
const failed = [];
const checks = [];
const metrics = { screenshots: [], movement: {}, reconnect: {}, fullMatch: {}, mobile: {}, offline: {} };
let ok = false;

function watch(page, prefix) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${prefix} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${prefix} pageerror: ${error.stack || error.message}`));
  page.on('requestfailed', (request) => failed.push({ prefix, url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push({ prefix, url: response.url(), status: response.status() });
  });
}

function check(value, name, detail = undefined) {
  assert.ok(value, `${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  checks.push({ name, ok: true, ...(detail === undefined ? {} : { detail }) });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name) });
  metrics.screenshots.push(name);
}

async function openOnline(context, prefix) {
  const page = await context.newPage();
  watch(page, prefix);
  await page.goto(onlineUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__online?.connected, undefined, { timeout: 15000 });
  return page;
}

async function localState(page) {
  return page.evaluate(() => ({
    mode: window.__online.mode,
    phase: window.__online.phase,
    playerId: window.__online.playerId,
    fighterId: window.__online.fighterId,
    room: window.__online.room,
    tick: window.__online.tick,
    sequence: window.__online.sequence,
    ping: window.__online.ping,
    actors: window.__online.actorCount,
    positions: window.__online.positions,
    fighters: window.__online.fighters.map((fighter) => ({ id: fighter.id, state: fighter.state, eliminated: fighter.eliminated })),
  }));
}

async function drive(page, directions, seconds = 10) {
  const before = await localState(page);
  const ownId = before.fighterId;
  const origin = before.positions[ownId];
  let maxDistance = 0;
  for (let index = 0; index < seconds * 2; index += 1) {
    const direction = directions[index % directions.length];
    await page.keyboard.down(direction);
    await page.keyboard.press('j');
    if (index % 8 === 4) await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.up(direction);
    const state = await localState(page);
    const position = state.positions[ownId];
    const own = state.fighters.find((fighter) => fighter.id === ownId);
    if (origin && position && !own?.eliminated) maxDistance = Math.max(maxDistance, Math.hypot(position.x - origin.x, position.z - origin.z));
  }
  const after = await localState(page);
  return { before, after, maxDistance };
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const a = await openOnline(contextA, 'A');
  const b = await openOnline(contextB, 'B');
  await a.locator('#online-name').fill('Alpha');
  await a.locator('[data-char="shiba"]').click();
  await a.locator('#btnOnlineCreate').click();
  await a.waitForFunction(() => /^[A-Z]{4}$/.test(window.__online.room?.code ?? ''));
  const code = await a.evaluate(() => window.__online.room.code);
  await a.waitForFunction(() => document.querySelector('#online-player-list')?.textContent.includes('Alpha'));
  check(code.length === 4, 'A created a four-letter room', code);

  await b.locator('#online-name').fill('Bravo');
  await b.locator('[data-char="cat"]').click();
  await b.locator('#online-room-input').fill(code);
  await b.locator('#btnOnlineJoin').click();
  await b.waitForFunction((roomCode) => window.__online.room?.code === roomCode, code);
  await a.waitForFunction(() => document.querySelectorAll('#online-player-list .online-player-row').length === 2);
  check(await a.locator('#online-player-list').textContent().then((text) => text.includes('Bravo')), 'B joined A room with selected nickname');
  await shot(a, '00-desktop-room.png');

  await a.locator('#btnOnlineReady').click();
  await b.locator('#btnOnlineReady').click();
  await a.waitForFunction(() => !document.getElementById('btnOnlineStart').disabled);
  await a.locator('#btnOnlineStart').click();
  await Promise.all([
    a.waitForFunction(() => window.__online.mode === 'playing' && window.__online.phase === 'fight' && window.__online.actorCount === 8, undefined, { timeout: 15000 }),
    b.waitForFunction(() => window.__online.mode === 'playing' && window.__online.phase === 'fight' && window.__online.actorCount === 8, undefined, { timeout: 15000 }),
  ]);
  check(true, 'Both clients entered the same eight-fighter match');

  const [movementA, movementB] = await Promise.all([
    drive(a, ['d', 'w', 'a', 's']),
    drive(b, ['a', 's', 'd', 'w']),
  ]);
  metrics.movement = { a: movementA, b: movementB };
  check(movementA.maxDistance > 0.25, 'A moved through real keyboard input', movementA.maxDistance);
  check(movementB.maxDistance > 0.25, 'B moved through real keyboard input', movementB.maxDistance);
  check(movementA.after.tick > movementA.before.tick, 'A snapshots advanced', [movementA.before.tick, movementA.after.tick]);
  check(movementB.after.tick > movementB.before.tick, 'B snapshots advanced', [movementB.before.tick, movementB.after.tick]);
  check(movementA.after.sequence > movementA.before.sequence, 'A input sequence advanced', [movementA.before.sequence, movementA.after.sequence]);
  check(movementB.after.sequence > movementB.before.sequence, 'B input sequence advanced', [movementB.before.sequence, movementB.after.sequence]);
  check(Number.isFinite(movementA.after.ping), 'A measured latency', movementA.after.ping);
  check(Number.isFinite(movementB.after.ping), 'B measured latency', movementB.after.ping);
  await shot(a, '01-desktop-a-gameplay.png');
  await shot(b, '02-desktop-b-gameplay.png');

  const reconnectBefore = await b.evaluate(() => ({
    token: localStorage.getItem('pawbrawl_online_token_v1'),
    playerId: window.__online.playerId,
    fighterId: window.__online.fighterId,
    room: window.__online.room?.code,
  }));
  await b.reload({ waitUntil: 'networkidle' });
  try {
    await b.waitForFunction((expected) => window.__online?.connected && window.__online.mode === 'playing' && window.__online.playerId === expected && window.__online.tick > 0, reconnectBefore.playerId, { timeout: 20000 });
  } catch (error) {
    metrics.reconnect.debug = await b.evaluate(() => ({
      state: window.__online ? {
        mode: window.__online.mode, phase: window.__online.phase, playerId: window.__online.playerId,
        fighterId: window.__online.fighterId, room: window.__online.room, tick: window.__online.tick,
        connected: window.__online.connected, actors: window.__online.actorCount,
      } : null,
      connection: document.getElementById('online-connection-label')?.textContent,
      overlay: document.getElementById('connection-overlay')?.hidden,
      token: Boolean(localStorage.getItem('pawbrawl_online_token_v1')),
    }));
    await shot(b, 'debug-reconnect-failure.png');
    throw error;
  }
  const reconnectAfter = await b.evaluate(() => ({
    token: localStorage.getItem('pawbrawl_online_token_v1'),
    playerId: window.__online.playerId,
    fighterId: window.__online.fighterId,
    room: window.__online.room?.code,
    tick: window.__online.tick,
  }));
  metrics.reconnect = { before: { ...reconnectBefore, token: reconnectBefore.token ? 'present' : null }, after: { ...reconnectAfter, token: reconnectAfter.token ? 'present' : null }, sameToken: reconnectBefore.token === reconnectAfter.token };
  check(reconnectBefore.token && reconnectBefore.token === reconnectAfter.token, 'B refresh retained the reconnect token');
  check(reconnectAfter.playerId === reconnectBefore.playerId && reconnectAfter.fighterId === reconnectBefore.fighterId, 'B token reconnect restored the original seat', reconnectAfter);
  check(reconnectAfter.room === code, 'B reconnect restored the original room', reconnectAfter.room);
  await shot(b, '03-desktop-b-reconnected.png');

  const fullMatch = await Promise.all([a, b].map(async (page) => {
    await page.waitForFunction(() => window.__online.mode === 'results', undefined, { timeout: 260000 });
    return page.evaluate(() => ({
      mode: window.__online.mode,
      phase: window.__online.phase,
      round: window.__online.round,
      standings: document.querySelectorAll('#online-match-standings .online-standing-row').length,
    }));
  }));
  metrics.fullMatch = { a: fullMatch[0], b: fullMatch[1] };
  check(fullMatch.every((state) => state.mode === 'results' && state.phase === 'matchEnd' && state.round === 3), 'Both clients completed all three rounds', metrics.fullMatch);
  check(fullMatch.every((state) => state.standings === 8), 'Both clients rendered eight final standings', fullMatch.map((state) => state.standings));
  await shot(a, '03b-desktop-match-end.png');

  await b.close();
  await contextB.close();
  await a.close();

  const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await openOnline(mobileContext, 'MOBILE');
  metrics.mobile.lobbyLayout = await mobile.evaluate(() => {
    const ids = ['btnOnlineCreate', 'btnOnlineJoin', 'online-character-grid'];
    return {
      viewport: [innerWidth, innerHeight],
      scrollWidth: document.documentElement.scrollWidth,
      controls: ids.map((id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return { id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
      title: [...document.querySelectorAll('.online-intro h1 > *')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    };
  });
  check(metrics.mobile.lobbyLayout.scrollWidth <= 844, 'Mobile lobby has no horizontal page overflow', metrics.mobile.lobbyLayout);
  check(metrics.mobile.lobbyLayout.controls.every((rect) => rect.left >= 0 && rect.right <= 844), 'Mobile lobby controls stay inside the viewport', metrics.mobile.lobbyLayout.controls);
  check(metrics.mobile.lobbyLayout.title.every((rect) => rect.left >= 0 && rect.right <= 844), 'Mobile title stays inside the viewport', metrics.mobile.lobbyLayout.title);
  await shot(mobile, '04-mobile-lobby.png');

  await mobile.locator('#online-name').fill('Mobile');
  await mobile.locator('[data-char="fox"]').tap();
  await mobile.locator('#btnOnlineCreate').tap();
  await mobile.waitForFunction(() => /^[A-Z]{4}$/.test(window.__online.room?.code ?? ''));
  await mobile.locator('#btnOnlineReady').tap();
  await mobile.locator('#btnOnlineStart').tap();
  try {
    await mobile.waitForFunction(() => window.__online?.connected && window.__online.mode === 'playing' && window.__online.phase === 'fight' && window.__online.actorCount === 8, undefined, { timeout: 20000 });
    await mobile.waitForFunction(() => !document.getElementById('touch').hidden, undefined, { timeout: 5000 });
  } catch (error) {
    metrics.mobile.debug = await mobile.evaluate(() => ({
      state: window.__online ? {
        mode: window.__online.mode, phase: window.__online.phase, playerId: window.__online.playerId,
        fighterId: window.__online.fighterId, room: window.__online.room, tick: window.__online.tick,
        connected: window.__online.connected, actors: window.__online.actorCount,
      } : null,
      connection: document.getElementById('online-connection-label')?.textContent,
      touchHidden: document.getElementById('touch')?.hidden,
    }));
    await shot(mobile, 'debug-mobile-failure.png');
    throw error;
  }
  const mobileBefore = await localState(mobile);
  const cdp = await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 250, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 185, y: 250, id: 1 }] });
  await mobile.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.locator('[data-action="punch"]').tap();
  await mobile.locator('[data-action="grab"]').tap();
  await mobile.locator('[data-action="jump"]').tap();
  await mobile.waitForTimeout(400);
  const mobileAfter = await localState(mobile);
  const mobileOrigin = mobileBefore.positions[mobileBefore.fighterId];
  const mobilePosition = mobileAfter.positions[mobileAfter.fighterId];
  metrics.mobile.before = mobileBefore;
  metrics.mobile.after = mobileAfter;
  metrics.mobile.distance = mobileOrigin && mobilePosition ? Math.hypot(mobilePosition.x - mobileOrigin.x, mobilePosition.z - mobileOrigin.z) : 0;
  metrics.mobile.touchLayout = await mobile.evaluate(() => ({
    visible: !document.getElementById('touch').hidden,
    viewport: [innerWidth, innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll('.touch-button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { action: button.dataset.action, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  }));
  check(metrics.mobile.distance > 0.1, 'Mobile joystick moved the predicted fighter', metrics.mobile.distance);
  check(mobileAfter.sequence > mobileBefore.sequence, 'Mobile touch controls emitted network input', [mobileBefore.sequence, mobileAfter.sequence]);
  check(metrics.mobile.touchLayout.visible, 'Mobile touch controls are visible in landscape gameplay');
  check(metrics.mobile.touchLayout.scrollWidth <= 844 && metrics.mobile.touchLayout.buttons.every((rect) => rect.left >= 0 && rect.right <= 844 && rect.top >= 0 && rect.bottom <= 390), 'Mobile gameplay buttons stay inside 844x390', metrics.mobile.touchLayout);
  await shot(mobile, '05-mobile-gameplay.png');
  await mobileContext.close();

  const offlineContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const offline = await offlineContext.newPage();
  watch(offline, 'OFFLINE');
  await offline.goto(`${base}/index.html?debug=1&lang=en`, { waitUntil: 'networkidle' });
  await offline.waitForFunction(() => Boolean(window.__pb));
  check(await offline.locator('a[href="./online.html"]').count() === 1, 'Offline title has exactly one ONLINE link');
  await offline.locator('#btnPlay').click();
  await offline.locator('#btnModeNext').click();
  await offline.locator('#btnStartMatch').click();
  await offline.waitForFunction(() => window.G.Game.mode === 'playing');
  await offline.evaluate(() => { window.__pb.skip(); window.__pb.step(1); });
  await offline.waitForTimeout(500);
  metrics.offline = await offline.evaluate(() => ({ mode: window.G.Game.mode, fighters: window.__pb.sim.fighters.length, phase: window.__pb.match.phase }));
  check(metrics.offline.mode === 'playing' && metrics.offline.fighters === 8, 'Offline index.html still starts an eight-fighter match', metrics.offline);
  await shot(offline, '06-offline-gameplay.png');
  await offlineContext.close();
  await contextA.close();

  check(errors.length === 0, 'Zero console errors and page errors', errors);
  check(failed.length === 0, 'Zero failed requests and HTTP errors', failed);
  ok = true;
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
} finally {
  const report = { at: new Date().toISOString(), base, server, ok: ok && errors.length === 0 && failed.length === 0, checks, errors, failed, metrics };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
