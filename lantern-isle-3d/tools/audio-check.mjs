#!/usr/bin/env node
// tools/audio-check.mjs — 音频实测：文件在、能解码、RMS/峰值不为 0、时长够。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const ROOT = path.resolve('.');
const FF = '/opt/homebrew/bin/ffmpeg';
const files = ['assets/audio/bgm_main.mp3', 'assets/audio/bgm_storm.mp3'];
let bad = 0;
const rows = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { rows.push({ f, ok: false, why: '文件不存在' }); bad++; continue; }
  const r = spawnSync(FF, ['-hide_banner', '-i', p, '-af', 'volumedetect', '-f', 'null', '/dev/null'], { encoding: 'utf8' });
  const out = (r.stderr || '') + (r.stdout || '');
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(out);
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(out);
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(out);
  const secs = dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : 0;
  const meanDb = mean ? parseFloat(mean[1]) : -99;
  const peakDb = peak ? parseFloat(peak[1]) : -99;
  const ok = secs >= 20 && meanDb > -30 && meanDb < -6 && peakDb > -6 && fs.statSync(p).size > 40000;
  rows.push({ f, ok, secs: +secs.toFixed(1), meanDb, peakDb, kb: Math.round(fs.statSync(p).size / 1024), why: ok ? '' : '时长/响度/体积不达标' });
  if (!ok) bad++;
}
fs.mkdirSync(path.join(ROOT, 'tools'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/audio-report.json'), JSON.stringify({ at: new Date().toISOString(), ok: bad === 0, rows }, null, 2));
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.f} ${r.secs || 0}s mean=${r.meanDb}dB peak=${r.peakDb}dB ${r.kb || 0}KB ${r.why || ''}`);
console.log(bad === 0 ? 'PASS 音频实测达标' : `FAIL ${bad} 项音频不达标`);
process.exit(bad === 0 ? 0 : 1);
