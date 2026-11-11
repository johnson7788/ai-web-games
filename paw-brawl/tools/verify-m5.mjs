import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/Users/admin/.npm-global/lib/node_modules/playwright', '/opt/homebrew/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('playwright not found');

const url = process.argv[2] || 'http://127.0.0.1:8124/';
const out = process.argv[3] || 'tests/artifacts-final';
const uncapped = process.env.PB_UNCAPPED === '1';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', ...(uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])],
});
const errors = [];
const failed = [];
const warnings = [];
const externalRequests = [];
const metrics = { screenshots: [], arenaRotation: [], sampling: uncapped ? 'uncapped-rAF' : 'vsync-rAF' };

function watch(page, prefix = '') {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${prefix}${message.text()}`);
    if (message.type() === 'warning') warnings.push(`${prefix}${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${prefix}${error.stack || error.message}`));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(url).origin) externalRequests.push(request.url());
  });
  page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
  });
}

function withQuery(query) {
  return `${url.split('?')[0]}?${query}`;
}

async function shot(page, name, options = {}) {
  await page.screenshot({ path: path.join(out, name), ...options });
  metrics.screenshots.push(name);
}

async function enterFromTitle(page) {
  await page.locator('#btnPlay').click();
  await page.locator('#btnModeNext').click();
  await page.waitForFunction(() => window.G.Game.mode === 'select');
}

async function startMatch(page) {
  await page.locator('#btnStartMatch').click();
  await page.waitForFunction(() => window.G.Game.mode === 'playing');
  await page.evaluate(() => { window.__pb.skip(); window.__pb.step(1); });
  await page.waitForTimeout(1500);
}

async function winAndAdvance(page) {
  return page.evaluate(() => {
    const before = window.G.Game.arena.id;
    window.__pb.winRound();
    window.__pb.step(1);
    window.__pb.skip();
    window.__pb.step(1);
    window.__pb.skip();
    window.__pb.step(1);
    return { before, after: window.G.Game.arena.id, round: window.__pb.match.round };
  });
}

try {
  const assetPage = await browser.newPage();
  const favicon = await assetPage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFD166';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 248, 62);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#2B2440';
    ctx.stroke();
    ctx.fillStyle = '#FF7A59';
    ctx.beginPath();
    ctx.ellipse(128, 153, 55, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, r] of [[66, 94, -0.35], [108, 67, -0.1], [153, 67, 0.1], [194, 96, 0.35]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 29, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync('favicon.png', Buffer.from(favicon, 'base64'));
  await assetPage.close();

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  watch(desktop, 'DESKTOP ');
  const started = Date.now();
  await desktop.goto(withQuery('debug=1&lang=en'), { waitUntil: 'networkidle' });
  await desktop.waitForFunction(() => Boolean(window.__pb));
  metrics.firstLoadMs = Date.now() - started;
  await desktop.waitForTimeout(400);
  await shot(desktop, '07-final-title.png');
  await desktop.keyboard.press('Tab');
  metrics.keyboardFocus = await desktop.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

  await desktop.locator('#btnSettings').click();
  await desktop.locator('#setting-sfx').click();
  await desktop.locator('#setting-music').click();
  await desktop.locator('#setting-quality').selectOption('low');
  metrics.settings = await desktop.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('pawbrawl_save_v1')).settings,
    effectiveQuality: window.__pb.stats().quality,
    dpr: window.__pb.stats().dpr,
    shadows: window.__pb.stats().shadows,
  }));
  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.waitForFunction(() => Boolean(window.__pb));
  await desktop.locator('#btnSettings').click();
  metrics.settings.persisted = await desktop.evaluate(() => ({
    sfx: document.getElementById('setting-sfx').getAttribute('aria-pressed'),
    music: document.getElementById('setting-music').getAttribute('aria-pressed'),
    quality: document.getElementById('setting-quality').value,
    effectiveQuality: window.__pb.stats().quality,
    shadows: window.__pb.stats().shadows,
  }));
  await desktop.locator('#setting-quality').selectOption('auto');
  await desktop.locator('#setting-sfx').click();
  await desktop.locator('#setting-music').click();
  await desktop.locator('#btnSettingsBack').click();
  await enterFromTitle(desktop);
  metrics.modeCoins = await desktop.locator('#mode-coins').textContent();
  await shot(desktop, '08-final-select.png');
  await startMatch(desktop);
  metrics.arenaRotation.push(await desktop.evaluate(() => ({ round: window.__pb.match.round, arena: window.G.Game.arena.id })));
  await shot(desktop, '07c-cloud.png');
  metrics.arenaRotation.push(await winAndAdvance(desktop));
  await desktop.waitForTimeout(1400);
  await shot(desktop, '09-candy.png');
  metrics.arenaRotation.push(await winAndAdvance(desktop));
  await desktop.waitForTimeout(1400);
  await shot(desktop, '10-ice.png');
  await desktop.evaluate(() => window.__pb.finishMatch());
  await desktop.waitForFunction(() => window.G.Game.mode === 'results');
  await desktop.waitForTimeout(450);
  await shot(desktop, '12-podium.png');

  const downloadEvent = desktop.waitForEvent('download');
  await desktop.locator('#btnShare').click();
  const download = await downloadEvent;
  await download.saveAs(path.join(out, 'share-card.png'));
  metrics.share = { filename: download.suggestedFilename(), failure: await download.failure() };

  await desktop.locator('#btnPlayAgain').click();
  await desktop.waitForFunction(() => window.G.Game.mode === 'playing');
  metrics.playAgainArena = await desktop.evaluate(() => window.G.Game.arena.id);
  await desktop.evaluate(() => window.__pb.finishMatch());
  await desktop.waitForFunction(() => window.G.Game.mode === 'results');
  await desktop.locator('#btnChangeMode').click();
  await desktop.locator('[data-mode="team"]').click();
  await desktop.locator('#btnModeNext').click();
  await startMatch(desktop);
  await shot(desktop, '11-team.png');
  await desktop.evaluate(() => window.__pb.resetStats());
  await desktop.waitForTimeout(10000);
  metrics.performance = await desktop.evaluate(() => window.__pb.stats());
  await desktop.evaluate(() => window.__pb.finishMatch());
  await desktop.waitForFunction(() => window.G.Game.mode === 'results');
  await shot(desktop, '11b-team-result.png');

  await desktop.locator('#btnPlayAgain').click();
  await desktop.waitForFunction(() => window.G.Game.mode === 'playing');
  metrics.geometrySwitches = [];
  for (const arena of ['candy-works', 'frozen-lake', 'cloud-ring', 'candy-works', 'frozen-lake', 'cloud-ring']) {
    metrics.geometrySwitches.push(await desktop.evaluate((id) => {
      window.__pb.switchArena(id);
      return window.__pb.stats();
    }, arena));
    await desktop.waitForTimeout(180);
  }
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  watch(mobile, 'MOBILE ');
  await mobile.goto(withQuery('debug=1&lang=en&mode=team'), { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => Boolean(window.__pb));
  await enterFromTitle(mobile);
  await startMatch(mobile);
  metrics.mobile = await mobile.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    dpr: window.__pb.stats().dpr,
    touchVisible: !document.getElementById('touch').hidden,
    buttons: [...document.querySelectorAll('.touch-button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    }),
  }));
  await mobile.evaluate(() => window.__pb.resetStats());
  await mobile.waitForTimeout(10000);
  metrics.mobile.performance = await mobile.evaluate(() => window.__pb.stats());
  await shot(mobile, '13-mobile.png');
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.waitForTimeout(200);
  metrics.mobile.portraitMask = await mobile.locator('#rotate-screen').evaluate((element) => getComputedStyle(element).display === 'grid');
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForTimeout(200);
  metrics.mobile.landscapeMaskHidden = await mobile.locator('#rotate-screen').evaluate((element) => getComputedStyle(element).display === 'none');
  await mobile.evaluate(() => window.__pb.finishMatch());
  await mobile.waitForFunction(() => window.G.Game.mode === 'results');
  await mobile.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        const file = data.files?.[0];
        window.__mobileShare = { count: data.files?.length ?? 0, name: file?.name, type: file?.type, size: file?.size };
      },
    });
  });
  await mobile.locator('#btnShare').click();
  await mobile.waitForFunction(() => Boolean(window.__mobileShare));
  metrics.mobile.share = await mobile.evaluate(() => window.__mobileShare);
  await mobile.close();

  const low = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await low.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  watch(low, 'LOW ');
  await low.goto(withQuery('debug=1'), { waitUntil: 'networkidle' });
  await low.waitForFunction(() => Boolean(window.__pb));
  metrics.autoLow = await low.evaluate(() => ({
    quality: window.__pb.stats().quality,
    dpr: window.__pb.stats().dpr,
    visibleOutlines: (() => {
      let count = 0;
      for (const actor of window.__pb.actors.values()) actor.group.traverse((object) => { if (object.userData.animalOutline && object.visible) count += 1; });
      return count;
    })(),
  }));
  await low.close();

  const zh = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  watch(zh, 'ZH ');
  await zh.goto(withQuery('debug=1&lang=zh'), { waitUntil: 'networkidle' });
  await zh.waitForFunction(() => Boolean(window.__pb));
  metrics.zh = { play: await zh.locator('#btnPlay').textContent() };
  await zh.locator('#btnSettings').click();
  metrics.zh.settings = await zh.locator('#screen-settings h2').textContent();
  await zh.locator('#btnSettingsBack').click();
  await zh.locator('#btnPlay').click();
  metrics.zh.mode = await zh.locator('#screen-mode h2').textContent();
  await zh.locator('#btnModeNext').click();
  metrics.zh.select = await zh.locator('#screen-select h2').textContent();
  await startMatch(zh);
  metrics.zh.round = await zh.locator('#round-label').textContent();
  await zh.evaluate(() => window.__pb.finishMatch());
  await zh.waitForFunction(() => window.G.Game.mode === 'results');
  metrics.zh.results = await zh.locator('#screen-results .match-card h2').textContent();
  await shot(zh, '14-zh-results.png');
  await zh.close();

  for (const [name, width, height] of [['post.jpg', 1280, 720], ['poster.jpg', 1920, 1080]]) {
    const poster = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    watch(poster, 'POSTER ');
    await poster.goto(withQuery('poster=1&lang=en'), { waitUntil: 'networkidle' });
    await poster.waitForTimeout(1800);
    await poster.screenshot({ path: name, type: 'jpeg', quality: 90 });
    metrics[name] = await poster.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      posterClass: document.body.classList.contains('poster'),
      visibleUi: [...document.querySelectorAll('.screen, #hud, #touch')].some((element) => getComputedStyle(element).display !== 'none'),
    }));
    await poster.close();
  }

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') || type === 'experimental-webgl' ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(withQuery('lang=en'), { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => !document.getElementById('webgl-fallback').hidden);
  metrics.webglFallback = await fallback.locator('#webgl-fallback p').textContent();
  await fallback.close();
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
} finally {
  const rotation = metrics.arenaRotation.map((entry) => entry.after || entry.arena);
  const geometryStable = metrics.geometrySwitches?.length === 6 && [0, 1, 2].every((index) =>
    metrics.geometrySwitches[index].sceneGeometries === metrics.geometrySwitches[index + 3].sceneGeometries);
  const report = { url, at: new Date().toISOString(), errors, failed, warnings, externalRequests, metrics, geometryStable };
  report.ok = errors.length === 0 && failed.length === 0 && warnings.length === 0 && externalRequests.length === 0 &&
    metrics.firstLoadMs < 3000 && /[0-9]/.test(metrics.modeCoins ?? '') && Boolean(metrics.keyboardFocus) &&
    metrics.settings?.saved.sfx === false && metrics.settings?.saved.music === false &&
    metrics.settings?.effectiveQuality === 'low' && metrics.settings?.dpr === 1 && metrics.settings?.shadows === false &&
    metrics.settings?.persisted.sfx === 'false' && metrics.settings?.persisted.music === 'false' &&
    metrics.settings?.persisted.quality === 'low' && metrics.settings?.persisted.effectiveQuality === 'low' && metrics.settings?.persisted.shadows === false &&
    rotation.join(',') === 'cloud-ring,candy-works,frozen-lake' && metrics.playAgainArena === 'cloud-ring' &&
    metrics.share?.failure === null && metrics.performance?.frameMs < 16 &&
    metrics.mobile?.performance?.fps >= 30 && metrics.mobile?.touchVisible &&
    metrics.mobile.buttons.every((button) => button.width >= 64 && button.height >= 64 && button.right <= 844 && button.bottom <= 390) &&
    metrics.mobile.portraitMask && metrics.mobile.landscapeMaskHidden &&
    metrics.autoLow?.quality === 'low' && metrics.autoLow?.dpr === 1 && metrics.autoLow?.visibleOutlines === 0 &&
    metrics.mobile.share?.count === 1 && metrics.mobile.share?.type === 'image/png' && metrics.mobile.share?.size > 10000 &&
    metrics.zh?.play === '开玩' && metrics.zh?.settings === '设置' && metrics.zh?.mode === '选择模式' &&
    metrics.zh?.select === '选择你的爪爪' && metrics.zh?.round.includes('回合') && metrics.zh?.results === '比赛结果' &&
    Boolean(metrics.webglFallback) && geometryStable && metrics['post.jpg']?.posterClass && !metrics['post.jpg']?.visibleUi &&
    metrics['poster.jpg']?.width === 1920 && metrics['poster.jpg']?.height === 1080;
  fs.writeFileSync(path.join(out, 'report-m5.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exitCode = 1;
}
