// tools/audio-check.mjs — SPOT IT · 音效离线校验（Node 无 WebAudio，直接测采样级合成器）。
// 通过标准：每个音效/循环层 RMS > 0、峰值 < 0.95、无 NaN；另输出 createAudio API 形状。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAMPLE_RATE, SFX_NAMES, LOOP_NAMES, synthSfx, synthLoop, synthBgm, createAudio,
} from '../src/core/audio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'audio', 'audio-report.json');
const SR = SAMPLE_RATE;

const SFX_PAYLOADS = {
  find: { streak: 2 },
  decoy: {},
  wrong: {},
  levelClear: {},
  newScene: {},
  levelStart: {},
  scoreMilestone: {},
  batteryLow: {},
  batteryUp: {},
  checklist: {},
  won: {},
  fail: {},
  ui: {},
  newRecord: {},
  chime: {},
};

function analyze(pcm, sr) {
  let sum = 0; let peak = 0; let nan = 0; let zc = 0;
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
  const pass = a.samples > 0 && a.rms > 0 && a.peak < 0.95 && a.nan === 0;
  return { rms: round(a.rms), peak: round(a.peak), nan: a.nan, zcRate: round(a.zcRate, 1), samples: a.samples, durSec: round(a.durSec, 3), pass };
}

function main() {
  const report = {
    generatedAt: new Date().toISOString(), sampleRate: SR,
    criteria: { rms: '> 0', peak: '< 0.95', nan: '=== 0' },
    sfx: {}, loops: {}, bgm: {}, behavior: {}, api: {}, summary: {},
  };
  let total = 0; let passed = 0; let failed = 0;
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
  const bgmPcm = synthBgm('play', SR);
  const bgmR = checkPcm(bgmPcm, SR);
  report.bgm = bgmR;
  total += 1;
  if (bgmR.pass) passed += 1; else { failed += 1; failures.push('bgm'); }

  // 行为校验：连击越高 find 音越高
  const f0 = analyze(synthSfx('find', { streak: 0 }, SR), SR);
  const f12 = analyze(synthSfx('find', { streak: 12 }, SR), SR);
  report.behavior['find.streakUpPitchUp'] = { zcRateLow: round(f0.zcRate, 1), zcRateHigh: round(f12.zcRate, 1), ok: f12.zcRate > f0.zcRate };

  let apiError = null;
  try {
    const audio = createAudio();
    for (const key of ['unlock', 'event', 'setMuted', 'setVolume', 'playBgm', 'stopBgm']) report.api[key] = typeof audio[key];
    audio.setVolume(0.5); audio.setMuted(true); audio.setMuted(false); audio.unlock();
    audio.event('find', { streak: 1 }); audio.event('decoy', {}); audio.stopBgm();
  } catch (e) { apiError = String(e && e.message ? e.message : e); }
  if (apiError) report.api.error = apiError;

  const allPass = failed === 0 && apiError == null;
  report.summary = { total, passed, failed, allPass, failures };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = ['SPOT IT · audio-check'];
  lines.push(`sampleRate=${SR}  criteria: rms>0 && peak<0.95 && nan===0`);
  lines.push('SFX');
  for (const name of SFX_NAMES) {
    const r = report.sfx[name];
    lines.push(`  ${name.padEnd(13)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push('LOOPS');
  for (const name of LOOP_NAMES) {
    const r = report.loops[name];
    lines.push(`  ${name.padEnd(13)} rms=${String(r.rms).padEnd(7)} peak=${String(r.peak).padEnd(7)} nan=${r.nan} ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  lines.push(`BGM ${bgmR.pass ? 'PASS' : 'FAIL'} rms=${bgmR.rms} peak=${bgmR.peak} dur=${bgmR.durSec}s`);
  lines.push('BEHAVIOR');
  for (const [k, v] of Object.entries(report.behavior)) lines.push(`  ${k} ${v.ok ? 'OK' : 'MISMATCH'} (zc ${v.zcRateLow} -> ${v.zcRateHigh})`);
  lines.push('API');
  for (const [k, v] of Object.entries(report.api)) lines.push(`  ${k} = ${v}`);
  lines.push(`SUMMARY ${passed}/${total} passed  allPass=${allPass}${failures.length ? `  failures=[${failures.join(', ')}]` : ''}`);
  if (apiError) lines.push(`API ERROR: ${apiError}`);
  console.log(lines.join('\n'));
  process.exitCode = allPass ? 0 : 1;
}
main();
