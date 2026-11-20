#!/usr/bin/env node
// tools/audio-check.mjs — 程序化音频离线校验：每个音效/循环层 RMS>0、峰值<0.95、无 NaN。
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器。
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
  tap: {}, tapCombo: {}, buy: {}, upgrade: {}, hire: {}, collect: {}, income: {},
  milestone: {}, buildingUp: {}, stockDay: {}, stockResolve: { up: true }, allIn: {},
  loan: {}, loanInterest: {}, repay: {}, bankrupt: {}, offlineIncome: {}, newRecord: {},
  ui: {}, chime: {},
};

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
  return { rms: Number(rms.toFixed(4)), peak: Number(peak.toFixed(4)), nan, samples: pcm.length, durSec: Number((pcm.length / SR).toFixed(3)) };
}

function checkPcm(pcm) {
  const a = analyze(pcm);
  const pass = a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0;
  return { ...a, pass };
}

function main() {
  const report = { generatedAt: new Date().toISOString(), sampleRate: SR, criteria: { rms: '>0', peak: '<0.95', nan: '===0' }, sfx: {}, loops: {}, api: {}, summary: {} };
  let total = 0, passed = 0, failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const r = checkPcm(synthSfx(name, SFX_PAYLOADS[name] ?? {}, SR));
    report.sfx[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`sfx:${name}`); }
  }
  for (const name of LOOP_NAMES) {
    const r = checkPcm(synthLoop(name, SR));
    report.loops[name] = r;
    total += 1;
    if (r.pass) passed += 1;
    else { failed += 1; failures.push(`loop:${name}`); }
  }

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
    audio.event('tap', {});
    audio.playBgm('main');
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
  lines.push('TYCOON EMPIRE · audio-check');
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('LOOPS');
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push(`SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));
  process.exitCode = allPass ? 0 : 1;
}

main();
