#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'tests', 'artifacts');
const { chromium } = loadPlaywright();
const { server, port } = await serve(root, 8125);
const errors = createErrorCollector();
const results = [];
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal'],
  });

  const scenarios = [
    { name: 'high-dpr1', quality: 'high', dpr: 1 },
    { name: 'high-dpr2', quality: 'high', dpr: 2 },
    { name: 'low-dpr1', quality: 'low', dpr: 1 },
  ];

  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: scenario.dpr,
    });
    const page = await context.newPage();
    errors.attach(page, port);
    await page.goto(`http://127.0.0.1:${port}/tools/renderbench.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__bench && window.__ll?.state.phase === 'bench');
    await page.evaluate(({ quality }) => {
      window.__bench.setStage(3);
      if (quality === 'low') {
        window.__bench.setQuality('high');
        window.__bench.stress();
      }
      window.__bench.setQuality(quality);
      window.__bench.setReducedMotion(false);
      window.__bench.stress();
    }, scenario);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__bench.resetStats());
    await page.waitForTimeout(3600);
    const stats = await page.evaluate(() => window.__bench.getStats());
    results.push({ name: scenario.name, ...stats });

    if (scenario.name === 'high-dpr1') {
      fs.mkdirSync(artifactDir, { recursive: true });
      await page.screenshot({ path: path.join(artifactDir, 'm2-renderbench.png') });
    }
    await context.close();
  }

  const report = {
    resolution: '1280x720',
    scenario: 'fortress / 60 enemies / particle cap / boss / bullets',
    results: results.map((r) => ({
      ...r,
      avgDrawMs: Number(r.avgDrawMs.toFixed(3)),
      p95DrawMs: Number(r.p95DrawMs.toFixed(3)),
      avgFrameMs: Number(r.avgFrameMs.toFixed(3)),
      p95FrameMs: Number(r.p95FrameMs.toFixed(3)),
      fps: Number(r.fps.toFixed(1)),
    })),
    ...errors.toJSON(),
  };
  console.log(JSON.stringify(report, null, 2));

  const failedPerformance = results.some((r) => r.fps < 55 || (r.quality === 'high' && r.avgDrawMs >= 8));
  if (failedPerformance || errors.hasErrors()) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
