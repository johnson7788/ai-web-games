#!/usr/bin/env node
// tools/audio-check.mjs — Q ADVENTURE · 音频离线校验。
// Node 无 WebAudio，直接测 src/core/audio.js 的采样级合成器（振荡器 + 噪声 + 包络 → PCM）。
// 通过标准：每个音效/BGM 循环条 RMS > 0、峰值 < 0.95、无 NaN；createAudio API 形状正确。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, createAudio } from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

const SFX_PAYLOADS = {
  jump: { x: 100, y: 560 },
  doubleJump: { x: 100, y: 400 },
  wallJump: { x: 100, y: 400 },
  land: { x: 100, y: 560 },
  coin: { x: 360, y: 560 },
  star: { x: 700, y: 560 },
  stomp: { x: 300, y: 560 },
  enemyDefeat: { x: 300, y: 560 },
  hurt: { x: 300, y: 560 },
  death: {},
  respawn: { x: 80, y: 560 },
  checkpoint: { x: 1600 },
  goal: { x: 3050 },
  levelClear: { level: 1 },
  spring: { x: 1540, y: 400 },
  beat: { x: 100, y: 400 },
  nearMiss: { x: 300, y: 560 },
  milestone: { x: 160 },
  ui: {},
  win: {},
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
  return { rms: Math.sqrt(sum / Math.max(1, pcm.length)), peak, nan, samples: pcm.length, durSec: pcm.length / sr };
}

function checkPcm(pcm, sr) {
  const a = analyze(pcm, sr);
  return { rms: +a.rms.toFixed(4), peak: +a.peak.toFixed(4), nan: a.nan, samples: a.samples, durSec: +a.durSec.toFixed(3), pass: a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0 };
}

function main() {
  const report = { generatedAt: new Date().toISOString(), sampleRate: SR, criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' }, sfx: {}, loops: {}, api: {}, summary: {} };
  let total = 0; let passed = 0; let failed = 0; const failures = [];

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

  // createAudio 契约 API 形状（Node 下无 WebAudio，方法应为函数且安全空转）
  let apiError = null;
  try {
    const audio = createAudio();
    for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm', 'beatPhase']) {
      report.api[key] = typeof audio[key];
    }
    audio.setVolume(0.5);
    audio.setMuted(true);
    audio.setMuted(false);
    audio.unlock();
    audio.event('jump', {});
    audio.event('coinGet', {});
    audio.stopBgm();
  } catch (e) {
    apiError = String(e && e.message ? e.message : e);
  }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null;
  report.summary = { total, passed, failed, allPass, failures };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = ['Q ADVENTURE · audio-check', `sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`, '', 'SFX'];
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('', 'LOOPS');
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  ${name.padEnd(12)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('', 'API');
  for (const [k, v] of Object.entries(report.api)) lines.push(`  ${k} = ${v}`);
  lines.push('', `SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));
  process.exitCode = allPass ? 0 : 1;
}

main();
