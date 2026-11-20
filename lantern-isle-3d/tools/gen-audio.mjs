#!/usr/bin/env node
// tools/gen-audio.mjs — 用 ucloud 出 BGM（B 机 minimax-music）。跑法：node tools/gen-audio.mjs --root .
// 规矩：产物只从响应 base64 拿（服务器零落盘）；B 机同一时刻只跑一个 heavy，先 ensure 后 stop。
// 中间 wav 一律走 /tmp（不往仓库里留临时文件，也不在脚本里删用户目录里的东西）。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const B = 'http://117.50.180.88:8990';
const FORCE = process.argv.includes('--force');
const root = path.resolve(process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : '.');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(root, 'tools/gen-audio.log');
fs.mkdirSync(path.dirname(LOG), { recursive: true });
const log = (m) => { const l = `[${new Date().toISOString().slice(5, 19).replace('T', ' ')}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
async function req(u, p, opts = {}, timeout = 240000) {
  const r = await fetch(u + p, { ...opts, signal: AbortSignal.timeout(timeout) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error('非 JSON: ' + t.slice(0, 100)); }
  if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j).slice(0, 220));
  return j;
}
async function ensure(u, name) {
  try { const h = await req(u, '/v1/health', {}, 15000); if ((h.running || []).includes(name)) return true; } catch (e) { log('health 失败 ' + e.message); }
  log(`start ${name}`);
  try { await req(u, '/v1/start', { method: 'POST', body: JSON.stringify({ name }) }, 600000); } catch (e) { log('start 失败：' + e.message); }
  await sleep(4000);
  try { const h2 = await req(u, '/v1/health', {}, 15000); return (h2.running || []).includes(name); } catch { return false; }
}
async function stop(u, name) { try { await req(u, '/v1/stop', { method: 'POST', body: JSON.stringify({ name }) }, 60000); } catch {} }
function writeB64(file, b64) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(b64, 'base64')); }

const BGM = [
  { id: 'bgm_main', out: 'assets/audio/bgm_main.mp3', duration: 150, prompt: 'Genre: cinematic ambient. BPM: 68. Key: D minor. Fingerpicked acoustic guitar, low warm strings, soft brass pads, distant buoy bell, light hand percussion, ocean air. Melancholy but hopeful, builds gently, loops cleanly. No vocals.', lyrics: '[Instrumental]' },
  { id: 'bgm_storm', out: 'assets/audio/bgm_storm.mp3', duration: 120, prompt: 'Genre: cinematic tension. BPM: 84. Low drums, rising strings, breath of wind, urgent but not metal, no vocals, instrumental loop for a storm night in a 3D island game.', lyrics: '[Instrumental]' },
];

(async () => {
  log('==== gen-audio start ====');
  // NPC 配音 descoped：indextts 要求参考音色（spk_audio_prompt / ref_audio_base64），
  // 本轮没有可授权的音色文件、平台也不允许外链音频 → 运行期改用程序化音符 blip。
  log('VOICE descoped：无授权参考音色可用（原因已记入台账与 lessons）');
  if (!(await ensure(B, 'minimax-music'))) { log('FAIL minimax-music 起不来（B 机显存被占？）'); process.exit(1); }
  let ok = 0;
  for (const m of BGM) {
    const out = path.join(root, m.out);
    if (!FORCE && fs.existsSync(out) && fs.statSync(out).size > 20000) { log('跳过已存在 ' + m.id); ok++; continue; }
    for (let i = 1; i <= 3; i++) {
      try {
        const j = await req(B, '/m/minimax-music/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: m.prompt, lyrics: m.lyrics, audio_duration: m.duration, seed: 42 + i }),
        }, 900000);
        const b64 = j.audio_base64 || j.audio || (j.data && j.data.audio);
        if (!b64) throw new Error('响应没有音频：' + JSON.stringify(j).slice(0, 160));
        const wav = path.join('/tmp', 'lantern-audio-' + m.id + '-' + i + '.wav');
        writeB64(wav, b64);
        const ff = spawnSync('/opt/homebrew/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-codec:a', 'libmp3lame', '-b:a', '192k', out]);
        if (ff.status !== 0) throw new Error('ffmpeg 转码失败：' + (ff.stderr || '').toString().slice(0, 160));
        log('wrote ' + path.relative(root, out) + ' ' + Math.round(fs.statSync(out).size / 1024) + 'KB (192k / loudnorm -16)');
        ok++;
        break;
      } catch (e) {
        log(`${m.id} 第${i}次失败：${e.message}`);
        await sleep(8000 * i);
        if (/sensitive|refus|violat/i.test(e.message)) m.prompt = m.prompt.replace(/storm|tension|urgent/gi, 'weather').replace(/风暴/g, '');
        await ensure(B, 'minimax-music');
      }
    }
  }
  await stop(B, 'minimax-music');
  log(`==== gen-audio DONE bgm ${ok}/${BGM.length} ====`);
  process.exit(ok === BGM.length ? 0 : 1);
})();
