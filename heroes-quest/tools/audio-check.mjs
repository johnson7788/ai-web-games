#!/usr/bin/env node
// tools/audio-check.mjs — HEROES QUEST · 程序化音频离线校验
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器。
// 通过标准：每个音效/循环层 RMS > 0、峰值 < 0.95、无 NaN。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

function analyze(pcm, sr) {
  let sum = 0; let peak = 0; let nan = 0;
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

function check(pcm, sr) {
  const a = analyze(pcm, sr);
  return {
    rms: Number(a.rms.toFixed(4)),
    peak: Number(a.peak.toFixed(4)),
    nan: a.nan,
    samples: a.samples,
    durSec: Number(a.durSec.toFixed(3)),
    pass: a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0,
  };
}

function main() {
  const report = { generatedAt: new Date().toISOString(), sampleRate: SR, sfx: {}, loops: {}, api: {}, summary: {} };
  let total = 0, passed = 0, failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const r = check(synthSfx(name, {}, SR), SR);
    report.sfx[name] = r;
    total += 1;
    if (r.pass) passed += 1; else { failed += 1; failures.push(`sfx:${name}`); }
  }
  for (const name of LOOP_NAMES) {
    const r = check(synthLoop(name, SR), SR);
    report.loops[name] = r;
    total += 1;
    if (r.pass) passed += 1; else { failed += 1; failures.push(`loop:${name}`); }
  }

  let apiError = null;
  try {
    const audio = createAudio();
    for (const k of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm']) report.api[k] = typeof audio[k];
    audio.setVolume(0.5); audio.setMuted(true); audio.setMuted(false); audio.unlock();
    audio.event('nodeMarch', {}); audio.event('heroAttack', {}); audio.event('battleWin', {});
    audio.stopBgm();
  } catch (e) { apiError = String(e && e.message ? e.message : e); }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null;
  report.summary = { total, passed, failed, allPass, failures };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = ['HEROES QUEST · audio-check', `sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`, ''];
  for (const name of SFX_NAMES) { const r = report.sfx[name]; lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`); }
  lines.push('');
  for (const name of LOOP_NAMES) { const r = report.loops[name]; lines.push(`  loop ${name.padEnd(9)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`); }
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
