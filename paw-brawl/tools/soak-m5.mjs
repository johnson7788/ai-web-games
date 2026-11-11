import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/admin/.npm-global/lib/node_modules/playwright');
const url = process.argv[2] || 'http://127.0.0.1:8124/?debug=1&lang=en&mode=team';
const durationMs = Number(process.env.PB_SOAK_MS || 600000);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
const warnings = [];
const failed = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('requestfailed', (request) => failed.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('response', (response) => {
  if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
});

async function sample(phase) {
  return page.evaluate((samplePhase) => ({
    at: Date.now(),
    phase: samplePhase,
    heap: performance.memory?.usedJSHeapSize ?? null,
    stats: window.__pb.stats(),
  }), phase);
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__pb));
  await page.locator('#btnPlay').click();
  await page.locator('#btnModeNext').click();
  await page.locator('#btnStartMatch').click();
  await page.waitForFunction(() => window.G.Game.mode === 'playing');
  await page.evaluate(() => { window.__pb.skip(); window.__pb.step(1); window.__pb.resetStats(); });
  await page.waitForTimeout(10000);
  const performance10s = await page.evaluate(() => window.__pb.stats());
  const started = Date.now();
  const samples = [await sample('live')];
  const arenas = ['candy-works', 'frozen-lake', 'cloud-ring'];
  let index = 0;
  while (Date.now() - started < durationMs) {
    await page.waitForTimeout(Math.min(30000, durationMs - (Date.now() - started)));
    if (index % 2 === 0) {
      const arena = arenas[(index / 2) % arenas.length];
      await page.evaluate((id) => {
        window.__pb.switchArena(id);
        window.__pb.play();
        window.__pb.skip();
        window.__pb.step(1);
      }, arena);
      await page.waitForTimeout(200);
      samples.push(await sample('reset'));
    } else {
      samples.push(await sample('live'));
    }
    index += 1;
    console.log(`SOAK ${Math.round((Date.now() - started) / 1000)}s ${samples.at(-1).phase} ${samples.at(-1).stats.arena} geometries=${samples.at(-1).stats.geometries}`);
  }
  const resets = samples.filter((entry) => entry.phase === 'reset');
  const geometryStable = arenas.every((arena) => {
    const entries = resets.filter((entry) => entry.stats.arena === arena);
    const steady = entries.slice(1);
    return entries.length > 2 &&
      entries.every((entry) => entry.stats.sceneGeometries === entries[0].stats.sceneGeometries) &&
      steady.every((entry) =>
        entry.stats.geometries === steady[0].stats.geometries &&
        entry.stats.textures === steady[0].stats.textures);
  });
  const heaps = samples.map((entry) => entry.heap).filter(Number.isFinite);
  const report = {
    url,
    at: new Date().toISOString(),
    durationMs: Date.now() - started,
    sampling: 'vsync-rAF',
    performance10s,
    geometryStable,
    heap: heaps.length ? { start: heaps[0], end: heaps.at(-1), min: Math.min(...heaps), max: Math.max(...heaps) } : null,
    errors,
    warnings,
    failed,
    samples,
  };
  report.ok = report.durationMs >= durationMs && geometryStable && errors.length === 0 && warnings.length === 0 && failed.length === 0;
  fs.writeFileSync(new URL('../tests/artifacts-final/soak-m5.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, durationMs: report.durationMs, performance10s, geometryStable, heap: report.heap, errors, warnings, failed }, null, 2));
  if (!report.ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
