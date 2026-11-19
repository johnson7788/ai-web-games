#!/usr/bin/env node
// tools/audio-check.mjs — ELITE GUNSTRIKE · 音效离线校验
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器 → PCM。
// 标准：每个音效/循环 RMS > 0、峰值 < 0.95、无 NaN；createAudio API 形状安全。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');

const SFX_PAYLOADS = {
  shoot: {},
  hit: { x: 640, y: 300 },
  kill: { x: 640, y: 300, combo: 3 },
  enemyShot: {},
  playerHit: { amount: 12 },
  explosion: { x: 640, y: 300 },
  chainExplosion: { x: 640, y: 300 },
  bounce: {},
  comboUp: { combo: 3, mult: 1.3 },
  comboBreak: {},
  milestone: {},
  levelCleared: { level: 2, stars: 3 },
  levelStart: { level: 2 },
  sceneEnter: { scene: 2 },
  captiveHit: { x: 640, y: 300 },
  death: {},
  victory: {},
  ui: {},
  newRecord: {},
  stars: { stars: 3 },
};

function analyze(pcm, sr) {
  let sum = 0;
  let peak = 0;
  let nan = 0;
  let zc = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const x = pcm[i];
    if (Number.isNaN(x)) nan += 1;
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sum += x * x;
    if (i > 0 && (x >= 0) !== (pcm[i - 1] >= 0)) zc += 1;
  }
  const rms = Math.sqrt(sum / Math.max(1, pcm.length));
  const zcRate = pcm.length > 1 ? (zc / (pcm.length - 1)) * (sr / 2) : 0;
  return { rms, peak, nan, zcRate, samples: pcm.length, durSec: pcm.length / sr };
}

function round(n, d = 4) { return Number(n.toFixed(d)); }

function checkPcm(pcm, sr) {
  const a = analyze(pcm, sr);
  return {
    rms: round(a.rms), peak: round(a.peak), nan: a.nan,
    zcRate: round(a.zcRate, 1), samples: a.samples, durSec: round(a.durSec, 3),
    pass: a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0,
  };
}

function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    sampleRate: SAMPLE_RATE,
    criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' },
    sfx: {}, loops: {}, behavior: {}, api: {}, summary: {},
  };

  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const pcm = synthSfx(name, SFX_PAYLOADS[name] ?? {}, SAMPLE_RATE);
    const r = checkPcm(pcm, SAMPLE_RATE);
    report.sfx[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`sfx:${name}`); }
  }

  for (const name of LOOP_NAMES) {
    const pcm = synthLoop(name, SAMPLE_RATE);
    const r = checkPcm(pcm, SAMPLE_RATE);
    report.loops[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`loop:${name}`); }
  }

  // 行为校验：kill 连击越高音越高
  const k0 = analyze(synthSfx('kill', { combo: 0 }, SAMPLE_RATE), SAMPLE_RATE);
  const k12 = analyze(synthSfx('kill', { combo: 12 }, SAMPLE_RATE), SAMPLE_RATE);
  report.behavior['kill.comboUpPitchUp'] = {
    comboLow: 0, comboHigh: 12,
    zcRateLow: round(k0.zcRate, 1), zcRateHigh: round(k12.zcRate, 1),
    ok: k12.zcRate > k0.zcRate,
  };

  let apiError = null;
  try {
    const audio = createAudio();
    for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm']) {
      report.api[key] = typeof audio[key];
    }
    audio.setVolume(0.5);
    audio.setMuted(true);
    audio.setMuted(false);
    audio.unlock();
    audio.event('shoot', {});
    audio.event('kill', { combo: 1 });
    audio.playBgm('foundry');
    audio.stopBgm();
  } catch (e) {
    apiError = String(e && e.message ? e.message : e);
  }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null;
  report.summary = { total, passed, failed, allPass, failures };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [];
  lines.push('ELITE GUNSTRIKE · audio-check');
  lines.push(`sampleRate=${SAMPLE_RATE}  criteria: rms>0 && peak<0.95 && nan===0`);
  lines.push('');
  lines.push('SFX');
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(13)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push('LOOPS');
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  ${name.padEnd(13)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push(`SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));

  process.exitCode = allPass ? 0 : 1;
}

main();
