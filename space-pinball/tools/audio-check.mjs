#!/usr/bin/env node
// tools/audio-check.mjs — SPACE PINBALL · 音频离线校验
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器（振荡器+噪声+包络→PCM）。
// 通过标准：每个音效/BGM 循环 RMS > 0、峰值 < 0.95、无 NaN；createAudio API 形状正确。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

const SFX_PAYLOADS = {
  flipper: { id: 'left' },
  launch: { speed: 900 },
  bumperHit: { x: 505, y: 240, value: 110, combo: 1 },
  deflectorHit: { x: 400, y: 170 },
  launchpad: { x: 640, y: 500 },
  blackHole: { x: 520, y: 90 },
  blackHoleEject: { x: 520, y: 90 },
  portal: { x: 380, y: 560 },
  reactorHit: { x: 640, y: 340, value: 220, combo: 1 },
  reactorOverdrive: { wave: 2 },
  buttonHit: { x: 430, y: 585 },
  gateFlip: { x: 380, y: 90, active: true },
  groupComplete: { value: 7500 },
  shardHit: { x: 400, y: 300, level: 1, combo: 2 },
  shardLevelUp: { level: 2 },
  asteroidHit: { x: 450, y: 430, hp: 2 },
  asteroidDestroy: { x: 450, y: 430 },
  asteroidClear: { value: 1500 },
  starCollect: { x: 400, y: 100 },
  supernova: {},
  supernovaEnd: {},
  comboUp: { combo: 3, mult: 1.75 },
  comboBreak: {},
  drain: { x: 640, y: 744 },
  ballLost: {},
  gameOver: {},
  ui: {},
  newRecord: {},
  milestone: { score: 250 },
};

function analyze(pcm, sr) {
  let sum = 0, peak = 0, nan = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const x = pcm[i];
    if (Number.isNaN(x)) nan += 1;
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sum += x * x;
  }
  return { rms: Math.sqrt(sum / Math.max(1, pcm.length)), peak, nan, samples: pcm.length, durSec: pcm.length / sr };
}

const round = (n, d = 4) => Number(n.toFixed(d));

function checkPcm(pcm, sr) {
  const a = analyze(pcm, sr);
  const pass = a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0;
  return { rms: round(a.rms), peak: round(a.peak), nan: a.nan, samples: a.samples, durSec: round(a.durSec, 3), pass };
}

function main() {
  const report = { generatedAt: new Date().toISOString(), sampleRate: SR, sfx: {}, loops: {}, behavior: {}, api: {}, summary: {} };
  let total = 0, passed = 0, failed = 0;
  const failures = [];

  for (const name of SFX_NAMES) {
    const pcm = synthSfx(name, SFX_PAYLOADS[name] ?? {}, SR);
    const r = checkPcm(pcm, SR);
    report.sfx[name] = r;
    total += 1;
    if (r.pass) passed += 1; else { failed += 1; failures.push(`sfx:${name}`); }
  }
  for (const name of LOOP_NAMES) {
    const pcm = synthLoop(name, SR);
    const r = checkPcm(pcm, SR);
    report.loops[name] = r;
    total += 1;
    if (r.pass) passed += 1; else { failed += 1; failures.push(`loop:${name}`); }
  }

  report.behavior.bgmDurSec = round(analyze(synthLoop('bgm', SR), SR).durSec, 3);
  report.behavior.bgmLoopsOk = report.behavior.bgmDurSec > 4 && report.behavior.bgmDurSec < 10;

  let apiError = null;
  try {
    const audio = createAudio();
    for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm']) report.api[key] = typeof audio[key];
    audio.setVolume(0.5); audio.setMuted(true); audio.setMuted(false); audio.unlock();
    audio.event('bumperHit', { value: 1 }); audio.playBgm(); audio.stopBgm();
  } catch (e) { apiError = String(e && e.message ? e.message : e); }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null && report.behavior.bgmLoopsOk;
  report.summary = { total, passed, failed, allPass, failures };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [];
  lines.push('SPACE PINBALL · audio-check');
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  lines.push('');
  lines.push('SFX');
  for (const name of SFX_NAMES) { const r = report.sfx[name]; lines.push(`  ${name.padEnd(18)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`); }
  lines.push('');
  lines.push('LOOPS');
  for (const name of LOOP_NAMES) { const r = report.loops[name]; lines.push(`  ${name.padEnd(18)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`); }
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
