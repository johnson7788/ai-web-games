#!/usr/bin/env node
// 赤色要塞 · 程序化音频验收：9 scene + 全部 SFX 的 RMS/peak、解锁、静音/音量、切场景、0 console error / 0 外部请求。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright, serve, createErrorCollector, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'artifacts');
const reportPath = path.join(outDir, 'audio-report.json');

const SCENE_KEYS = ['title', 'jungle', 'river', 'desert', 'fortress', 'boss', 'clear', 'gameover', 'ending'];
const SFX_KEYS = [
  'shot_mg', 'shot_grenade', 'shot_tank', 'shot_rocket', 'explode_small', 'explode_big',
  'explode_huge', 'hit', 'kill', 'playerHit', 'playerDead', 'powPickup', 'deliver',
  'deliverMilestone', 'airstrike', 'heliIn', 'bossAwake', 'bossNodeDown', 'bossDead',
  'stageClear', 'shock', 'ui',
];

function fmt(v) { return typeof v === 'number' ? v.toFixed(4) : String(v); }

async function main() {
  const pw = loadPlaywright();
  const { server, port } = await serve(root);
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const collector = createErrorCollector();
  collector.attach(page, port);

  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await waitForBoot(page);

    // waitForBoot 可能在模块脚本执行前（readyState 已是 interactive）就返回，这里再显式等窗口对象就绪
    for (let i = 0; i < 60; i++) {
      const ok = await page.evaluate(() => !!(window.__ll && window.G && window.G.Audio)).catch(() => false);
      if (ok) break;
      await page.waitForTimeout(100);
    }

    // 解锁（模拟用户手势）
    await page.mouse.click(640, 360);
    await page.waitForTimeout(150);

    // 1) 就绪 + 静音/音量 + 切场景
    const ready = await page.evaluate(() => window.G.Audio.ready);
    await page.evaluate(() => { window.G.Audio.setVolumes({ music: 0.5, sfx: 0.8 }); window.G.Audio.setMuted(true); });
    const mutedGains = await page.evaluate(() => window.G.Audio.debug.gains());
    await page.evaluate(() => window.G.Audio.setMuted(false));
    const volGains = await page.evaluate(() => window.G.Audio.debug.gains());
    await page.evaluate(() => window.G.Audio.setScene('title'));
    await page.evaluate(() => window.G.Audio.setScene('jungle'));
    const voices = await page.evaluate(() => window.G.Audio.debug.activeVoices());
    const scene = await page.evaluate(() => window.G.Audio.currentScene);

    const checks = {
      ready,
      mute: !!(mutedGains && mutedGains.master === 0),
      volume: !!(volGains && Math.abs(volGains.music - 0.5) < 1e-9 && Math.abs(volGains.sfx - 0.8) < 1e-9),
      crossfade: voices === 1 && scene === 'jungle',
    };

    // 2) 9 个场景
    const scenes = [];
    for (const key of SCENE_KEYS) {
      const r = await page.evaluate((k) => window.G.Audio.debug.rmsFor(k), key);
      scenes.push({ name: key, rms: r.rms, peak: r.peak, pass: r.rms > 0.001 && r.peak < 1 });
    }

    // 3) 全部 SFX
    const sfx = [];
    for (const key of SFX_KEYS) {
      const r = await page.evaluate((k) => window.G.Audio.debug.rmsFor(k), key);
      sfx.push({ name: key, rms: r.rms, peak: r.peak, pass: r.rms > 0.001 && r.peak < 1 });
    }

    const errors = collector.toJSON();
    const noErrors = !collector.hasErrors();
    const noExternal = errors.externalRequests.length === 0;

    const pass = checks.ready && checks.mute && checks.volume && checks.crossfade
      && scenes.every((s) => s.pass) && sfx.every((s) => s.pass)
      && noErrors && noExternal;

    const report = {
      generatedAt: new Date().toISOString(),
      pass,
      checks,
      scenes,
      sfx,
      errors,
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 终端表格
    console.log('scene      rms     peak   pass');
    for (const s of scenes) console.log(`${s.name.padEnd(10)} ${fmt(s.rms).padStart(7)} ${fmt(s.peak).padStart(7)} ${s.pass ? '  ok' : '  FAIL'}`);
    console.log('');
    console.log('sfx                 rms     peak   pass');
    for (const s of sfx) console.log(`${s.name.padEnd(18)} ${fmt(s.rms).padStart(7)} ${fmt(s.peak).padStart(7)} ${s.pass ? '  ok' : '  FAIL'}`);
    console.log('');
    console.log('checks:');
    for (const [k, v] of Object.entries(checks)) console.log(`  ${k.padEnd(10)} ${v ? 'ok' : 'FAIL'}`);
    console.log(`  console/page errors ${noErrors ? '0 ok' : 'FAIL'}`);
    console.log(`  external requests  ${noExternal ? '0 ok' : 'FAIL'}`);
    console.log('');
    console.log(pass ? 'AUDIO CHECK: ALL GREEN' : 'AUDIO CHECK: FAILED');
    console.log(`report: ${reportPath}`);

    await browser.close();
    await new Promise((r) => server.close(r));
    process.exit(pass ? 0 : 1);
  } catch (err) {
    console.error('audio-check crashed:', err);
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
    process.exit(1);
  }
}

main();
