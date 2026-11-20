#!/usr/bin/env node
// tools/audio-check.mjs — EGG BOOM · 音效离线校验
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器。
// 通过标准：每个音效 RMS > 0、峰值 < 0.95、无 NaN；createAudio API 形状正常。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, synthSfx, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

const SFX_PAYLOADS = {
  shoot: { y: 580, ammo: 13 },
  doughHit: { value: 3 },
  doughBreak: { value: 3, combo: 1 },
  jump: { charge: 0.8, y: 580 },
  land: {},
  comboUp: { combo: 3 },
  comboBreak: {},
  yolkReady: {},
  yolkFired: { hit: 2 },
  propGain: { kind: 'ammo' },
  shellBreak: {},
  shellRegrow: {},
  armorDeflect: {},
  rackClear: {},
  levelEnter: { level: 2 },
  sceneEnter: { scene: 'dessert' },
  milestone: {},
  chargeFull: {},
  noAmmo: {},
  death: {},
  win: {},
  ui: {},
  newRecord: {},
  chime: {},
};

function analyze(pcm, sr) {
  let sum = 0;
  let peak = 0;
  let nan = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const x = pcm[i];
    if (Number.isNaN(x)) nan += 1;
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sum += x * x;
  }
  const rms = Math.sqrt(sum / Math.max(1, pcm.length));
  return { rms, peak, nan, samples: pcm.length, durSec: pcm.length / sr };
}

function round(n, d = 4) { return Number(n.toFixed(d)); }

function checkPcm(pcm, sr) {
  const a = analyze(pcm, sr);
  return { rms: round(a.rms), peak: round(a.peak), nan: a.nan, samples: a.samples, durSec: round(a.durSec, 3), pass: a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0 };
}

function main() {
  const report = { generatedAt: new Date().toISOString(), sampleRate: SR, criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' }, sfx: {}, behavior: {}, api: {}, summary: {} };
  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const pcm = synthSfx(name, SFX_PAYLOADS[name] ?? {}, SR);
    const r = checkPcm(pcm, SR);
    report.sfx[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`sfx:${name}`); }
  }

  // 行为校验：连击越高破团音越高（zcRate 上升）
  const db1 = analyze(synthSfx('doughBreak', { combo: 0 }, SR), SR);
  const db9 = analyze(synthSfx('doughBreak', { combo: 9 }, SR), SR);
  report.behavior['combo.upPitchUp'] = { comboLow: 0, comboHigh: 9, zcRateLow: round(db1.peak, 3), zcRateHigh: round(db9.peak, 3), ok: db9.peak > db1.peak };

  let apiError = null;
  try {
    const audio = createAudio();
    for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm']) report.api[key] = typeof audio[key];
    audio.setVolume(0.5);
    audio.setMuted(true);
    audio.setMuted(false);
    audio.unlock();
    audio.event('shoot', {});
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
  lines.push('EGG BOOM · audio-check');
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push(`SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));

  process.exitCode = allPass ? 0 : 1;
}

main();
