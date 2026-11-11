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
const out = process.argv[3] || 'tests/artifacts-m4';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const failed = [];
const consoleMessages = [];
const metrics = { screenshots: [] };

function watch(page, prefix = '') {
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: `${prefix}${message.text()}` });
    if (message.type() === 'error') errors.push(`${prefix}${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${prefix}${error.stack || error.message}`));
  page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
  });
}

function withQuery(query) {
  return `${url.split('?')[0]}?${query}`;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name) });
  metrics.screenshots.push(name);
}

async function startFromTitle(page) {
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G.Game.mode === 'mode');
}

async function enterMatch(page) {
  await page.locator('#btnModeNext').click();
  await page.waitForFunction(() => window.G.Game.mode === 'select');
  await page.locator('#btnStartMatch').click();
  await page.waitForFunction(() => window.G.Game.mode === 'playing');
  await page.evaluate(() => { window.__pb.skip(); window.__pb.step(1); });
  await page.waitForTimeout(700);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  watch(desktop, 'DESKTOP ');
  await desktop.goto(withQuery('debug=1&lang=en&mode=team&arena=candy-works'), { waitUntil: 'networkidle' });
  await desktop.waitForFunction(() => Boolean(window.__pb));
  await startFromTitle(desktop);
  await desktop.locator('[data-mode="team"]').click();
  await desktop.waitForTimeout(250);
  metrics.mode = await desktop.evaluate(() => ({
    selected: document.querySelector('.mode-card.selected')?.dataset.mode,
    cards: document.querySelectorAll('.mode-card').length,
    nextVisible: Boolean(document.getElementById('btnModeNext').offsetWidth),
  }));
  await shot(desktop, '04-mode-select.png');
  await enterMatch(desktop);
  metrics.candy = await desktop.evaluate(() => ({
    arena: window.G.Game.arena.id,
    teams: window.__pb.sim.fighters.map((fighter) => fighter.team),
    sweepers: window.__pb.sim.arena.hazards.filter((hazard) => hazard.type === 'sweeper').length,
  }));
  await shot(desktop, '01-map-candy.png');

  await desktop.evaluate(() => window.__pb.switchArena('frozen-lake'));
  await desktop.waitForTimeout(650);
  metrics.ice = await desktop.evaluate(() => ({ arena: window.G.Game.arena.id, friction: window.__pb.sim.arena.friction }));
  await shot(desktop, '02-map-ice.png');

  await desktop.evaluate(() => {
    window.__pb.switchArena('cloud-ring');
    window.__pb.match.teamScores[0] = 1;
    window.__pb.match.teamScores[1] = 0;
  });
  await desktop.waitForTimeout(500);
  metrics.teamHud = await desktop.evaluate(() => ({
    visible: !document.getElementById('team-score').hidden,
    red: document.getElementById('score-red').textContent,
    blue: document.getElementById('score-blue').textContent,
    teammateMarkers: document.querySelectorAll('.fighter-marker.team-0').length,
    enemyMarkers: document.querySelectorAll('.fighter-marker.team-1').length,
  }));
  await shot(desktop, '03-team-hud.png');

  await desktop.evaluate(() => window.__pb.finishMatch());
  await desktop.waitForFunction(() => window.G.Game.mode === 'results');
  await desktop.waitForTimeout(500);
  metrics.teamResult = await desktop.evaluate(() => ({
    banner: document.getElementById('team-result-winner').textContent,
    score: document.getElementById('team-result-score').textContent,
    summary: document.getElementById('match-summary').textContent,
    reward: document.getElementById('coin-total').textContent,
    changeMode: Boolean(document.getElementById('btnChangeMode').offsetWidth),
  }));
  await shot(desktop, '05-team-result.png');

  metrics.confettiPeak = await desktop.evaluate(() => {
    window.__pb.confetti();
    window.__pb.confetti();
    return window.__pb.confettiCount;
  });
  await desktop.waitForTimeout(7000);
  metrics.confettiAfterExpiry = await desktop.evaluate(() => window.__pb.confettiCount);
  metrics.confettiTransform = await desktop.evaluate(() => {
    const canvas = document.getElementById('confetti');
    const transform = canvas.getContext('2d').getTransform();
    return { a: transform.a, d: transform.d, dpr: devicePixelRatio, width: canvas.width, height: canvas.height };
  });

  await desktop.locator('#btnPlayAgain').click();
  await desktop.waitForFunction(() => window.G.Game.mode === 'playing');
  metrics.playAgain = await desktop.evaluate(() => ({ mode: window.G.Game.gameMode, char: window.__pb.sim.fighters[0].charId }));
  metrics.geometrySwitches = [];
  for (const arena of ['candy-works', 'frozen-lake', 'cloud-ring', 'candy-works', 'frozen-lake', 'cloud-ring']) {
    await desktop.evaluate((id) => window.__pb.switchArena(id), arena);
    await desktop.waitForTimeout(220);
    metrics.geometrySwitches.push(await desktop.evaluate(() => window.__pb.stats()));
  }
  await desktop.evaluate(() => window.__pb.resetStats());
  await desktop.waitForTimeout(4000);
  metrics.performance = await desktop.evaluate(() => window.__pb.stats());
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  watch(mobile, 'MOBILE ');
  await mobile.goto(withQuery('debug=1&lang=en&mode=team&arena=frozen-lake'), { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => Boolean(window.__pb));
  await startFromTitle(mobile);
  await enterMatch(mobile);
  metrics.mobile = await mobile.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    teamVisible: !document.getElementById('team-score').hidden,
    touchVisible: !document.getElementById('touch').hidden,
    scoreRect: (() => {
      const rect = document.getElementById('team-score').getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    })(),
  }));
  await shot(mobile, '06-mobile-team.png');
  await mobile.close();
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
} finally {
  const geometryStable = metrics.geometrySwitches?.length === 6 &&
    [0, 1, 2].every((index) => metrics.geometrySwitches[index].geometries === metrics.geometrySwitches[index + 3].geometries);
  const report = { url, at: new Date().toISOString(), errors, failed, metrics, geometryStable, console: consoleMessages };
  report.ok =
    errors.length === 0 && failed.length === 0 && geometryStable &&
    metrics.mode?.selected === 'team' && metrics.mode?.cards === 3 &&
    metrics.candy?.arena === 'candy-works' && metrics.candy?.sweepers === 2 &&
    metrics.candy?.teams?.join(',') === '0,1,0,1,0,1,0,1' &&
    metrics.ice?.arena === 'frozen-lake' && metrics.ice?.friction === 0.22 &&
    metrics.teamHud?.visible && metrics.teamHud?.red === '1' && metrics.teamHud?.blue === '0' &&
    metrics.teamHud?.teammateMarkers === 4 && metrics.teamHud?.enemyMarkers === 4 &&
    /WINS/.test(metrics.teamResult?.banner ?? '') && metrics.teamResult?.changeMode &&
    metrics.confettiPeak <= 220 && metrics.confettiAfterExpiry === 0 &&
    metrics.confettiTransform?.a === 1 && metrics.confettiTransform?.d === 1 &&
    metrics.playAgain?.mode === 'team' && metrics.performance?.averageFrameMs < 16 &&
    metrics.mobile?.teamVisible && metrics.mobile?.touchVisible &&
    metrics.mobile?.scoreRect?.left >= 0 && metrics.mobile?.scoreRect?.right <= 844 &&
    metrics.screenshots?.length === 6;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exitCode = 1;
}
