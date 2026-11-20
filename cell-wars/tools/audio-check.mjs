#!/usr/bin/env node
// tools/audio-check.mjs — CELL WARS · M4 音效离线校验。
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器（振荡器 + 噪声 + 包络 → PCM）。
// 通过标准：每个音效/循环层 RMS > 0、峰值 < 0.95、无 NaN；额外输出行为校验与 createAudio API 形状。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio,
} from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

const SFX_PAYLOADS = {
  infect: { r: 3, c: 3 },
  capture: { chain: 0 },
  bigChain: { count: 4 },
  blocked: { r: 3, c: 3, power: 1, def: 2 },
  nutrient: { r: 3, c: 3 },
  phage: { cleared: 4 },
  phageReady: {},
  turn: {},
  dishClear: { dish: 1 },
  dishStart: { dish: 1 },
  virus: { r: 3, c: 3 },
  gameOver: {},
  victory: {},
  ui: {},
  newRecord: {},
  chime: {},
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

function round(n, d = 4) {
  return Number(n.toFixed(d));
}

function checkPcm(pcm, sr) {
  const a = analyze(pcm, sr);
  const pass = a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0;
  return { rms: round(a.rms), peak: round(a.peak), nan: a.nan, zcRate: round(a.zcRate, 1), samples: a.samples, durSec: round(a.durSec, 3), pass };
}

function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    sampleRate: SR,
    criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' },
    sfx: {},
    loops: {},
    behavior: {},
    api: {},
    summary: {},
  };

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

  for (const name of LOOP_NAMES) {
    const pcm = synthLoop(name, SR);
    const r = checkPcm(pcm, SR);
    report.loops[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`loop:${name}`); }
  }

  // 行为校验：占领音 chain 越高音越高
  const cap0 = analyze(synthSfx('capture', { chain: 0 }, SR), SR);
  const cap12 = analyze(synthSfx('capture', { chain: 12 }, SR), SR);
  report.behavior['capture.chainUpPitchUp'] = {
    chainLow: 0, chainHigh: 12,
    zcRateLow: round(cap0.zcRate, 1), zcRateHigh: round(cap12.zcRate, 1),
    ok: cap12.zcRate > cap0.zcRate,
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
    audio.event('infect', {});
    audio.event('capture', { chain: 0 });
    audio.playBgm('bgm');
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
  lines.push('CELL WARS · M4 audio-check');
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  lines.push('');
  lines.push('SFX');
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(11)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push('LOOPS');
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  ${name.padEnd(11)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push('BEHAVIOR (informational)');
  for (const [k, v] of Object.entries(report.behavior)) {
    lines.push(`  ${k}  ${v.ok ? 'OK' : 'MISMATCH'}  (zc ${v.zcRateLow} -> ${v.zcRateHigh})`);
  }
  lines.push('');
  lines.push('API');
  for (const [k, v] of Object.entries(report.api)) lines.push(`  ${k} = ${v}`);
  lines.push('');
  lines.push(`SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));

  process.exitCode = allPass ? 0 : 1;
}

main();
