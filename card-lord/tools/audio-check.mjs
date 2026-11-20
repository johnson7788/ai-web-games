#!/usr/bin/env node
// tools/audio-check.mjs — CARD LORD 音效离线校验：采样级合成器 RMS/峰值/NaN + createAudio API 形状。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

function analyze(pcm) {
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
  return { rms, peak, nan, samples: pcm.length, durSec: pcm.length / SR };
}

function checkPcm(pcm) {
  const a = analyze(pcm);
  const pass = a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0;
  return {
    rms: Number(a.rms.toFixed(4)),
    peak: Number(a.peak.toFixed(4)),
    nan: a.nan,
    samples: a.samples,
    durSec: Number(a.durSec.toFixed(3)),
    pass,
  };
}

function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    sampleRate: SR,
    criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' },
    sfx: {},
    loops: {},
    api: {},
    summary: {},
  };

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const r = checkPcm(synthSfx(name, {}, SR));
    report.sfx[name] = r;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`sfx:${name}`); }
  }
  for (const name of LOOP_NAMES) {
    const r = checkPcm(synthLoop(name, SR));
    report.loops[name] = r;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`loop:${name}`); }
  }

  let apiError = null;
  try {
    const audio = createAudio();
    report.api = {
      unlock: typeof audio.unlock,
      event: typeof audio.event,
      setMuted: typeof audio.setMuted,
      setVolume: typeof audio.setVolume,
      playBgm: typeof audio.playBgm,
      stopBgm: typeof audio.stopBgm,
    };
    audio.setVolume(0.5);
    audio.setMuted(true);
    audio.setMuted(false);
    audio.unlock();
    audio.event('play', {});
    audio.event('bomb', {});
    audio.stopBgm();
  } catch (e) {
    apiError = String(e && e.message ? e.message : e);
  }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null;
  report.summary = { total: SFX_NAMES.length + LOOP_NAMES.length, passed, failed, allPass, failures };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = ['CARD LORD · audio-check'];
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  lines.push('');
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(11)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  loop:${name.padEnd(6)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push(`SUMMARY ${passed}/${SFX_NAMES.length + LOOP_NAMES.length} passed  allPass=${allPass}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));
  process.exitCode = allPass ? 0 : 1;
}

main();
