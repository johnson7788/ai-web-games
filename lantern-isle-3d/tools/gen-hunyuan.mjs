#!/usr/bin/env node
// tools/gen-hunyuan.mjs — 第二轮精修：概念图(C 机) → Hunyuan3D-2.1 形状+PBR 纹理(A 机，直接回 GLB 二进制) → 落 _raw3d → 台账状态推进。
// 跑法：node tools/gen-hunyuan.mjs [--only id,..] [--dry-run]；断点续跑（已有 .h3d.glb 就跳过）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildPrompt } from '/Users/admin/git/webgames/skills/game3d-pipeline/scripts/artbible.mjs';
const ROOT = path.resolve('.');
const B = 'http://117.50.180.88:8990';
const A = 'http://117.50.187.176:8990';
const AT = 'http://127.0.0.1:18991';   // h3-image 长请求走 SSH 隧道
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const dry = process.argv.includes('--dry-run');
let H3_UP = true;
const CONCEPTS_ONLY = process.argv.includes('--concepts-only');
const GENS_ONLY = process.argv.includes('--gens-only');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(ROOT, 'tools/gen-hunyuan.log');
const log = (m) => { const l = `[${new Date().toISOString().slice(5, 19).replace('T', ' ')}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/upgrade3d.json'), 'utf8')).assets
  .filter((a) => !only || only.split(',').includes(a.id));
async function req(u, p, opts = {}, t = 240000) {
  const r = await fetch(u + p, { ...opts, signal: AbortSignal.timeout(t) });
  const buf = await r.arrayBuffer();
  if (!r.ok) throw new Error(r.status + ' ' + Buffer.from(buf).toString('utf8').slice(0, 200));
  return buf;
}
async function ensure(name) {
  for (let i = 0; i < 40; i++) {
    try {
      const h = JSON.parse(Buffer.from(await req(A, '/v1/health', {}, 15000)).toString());
      if ((h.running || []).includes(name)) return true;
      const st = JSON.parse(Buffer.from(await req(A, '/v1/status/' + name, {}, 15000)).toString());
      if (st.status === 'starting') { await sleep(15000); continue; }
    } catch {}
    await sleep(10000);
  }
  return false;
}
async function concept(a) {
  const out = path.join(ROOT, 'assets/_src3d', a.id + '-r3.png');
  if (fs.existsSync(out) && !process.argv.includes('--force-art')) return out;
  const { prompt, seed } = buildPrompt(ROOT, { category: a.category === 'character' ? 'character' : a.category, subject: a.subject });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (let i = 1; i <= 3; i++) {
    try {
      // 照片级概念图走 krea2（C 机的写实模型）；qwen-image-xl 只当兜底
      // 照片级概念图：A 机 h3-image 2048²（走隧道）；起不来才兜底 C 机 qwen-image-xl
      const useH3 = H3_UP;
      const C2 = 'http://117.50.89.18:8990';
      const model = useH3 ? 'h3-image' : (i <= 2 ? 'qwen-image-xl' : 'qwen-image');
      const url = useH3 ? AT : C2;
      const body = useH3
        ? { prompt: prompt.replace(/ \|\| negative: [\s\S]*/, ''), width: 2048, height: 2048, seed: seed + i }
        : { prompt, width: 1024, height: 1024, steps: 24, seed: seed + i };
      const j = JSON.parse(Buffer.from(await req(url, '/m/' + model + '/txt2img', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, useH3 ? 900000 : 240000)).toString());
      const img = j.image_base64 || (j.images || [])[0];
      if (!img) throw new Error('no img');
      fs.writeFileSync(out, Buffer.from(img, 'base64'));
      a.source = a.source || {}; a.source.prompt = prompt;
      log(`${a.id} 概念图 ok`);
      return out;
    } catch (e) { log(a.id + ' 概念图 retry' + i + ': ' + String(e.message).slice(0, 90)); if (useH3 && i >= 2) { H3_UP = false; log('概念图兜底切 qwen-image-xl'); } await sleep(7000 * i); }
  }
  return null;
}
async function gen(a, png) {
  const out = path.join(ROOT, 'assets/_raw3d', a.id + '.r3.glb');
  if (fs.existsSync(out) && fs.statSync(out).size > 20000) { log(`${a.id} 已有 h3d GLB，跳过`); return out; }
  const img = fs.readFileSync(png).toString('base64');
  for (let i = 1; i <= 3; i++) {
    try {
      const buf = await req(A, '/m/hunyuan3d/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: img, texture: true, seed: 42 + i }) }, 1500000);
      const head = Buffer.from(buf.slice(0, 4)).toString('utf8');
      if (head !== 'glTF') throw new Error('返回不是 GLB：' + Buffer.from(buf.slice(0, 120)).toString('utf8'));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(buf));
      log(`${a.id} hunyuan3d ok ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
      return out;
    } catch (e) { log(`${a.id} hunyuan3d retry${i}: ${e.message}`); await sleep(15000 * i); if (!(await ensure('hunyuan3d'))) throw new Error('hunyuan3d 起不来'); }
  }
  return null;
}
function tunnel() {
  const p = spawn('ssh', ['-p', '23', '-o', 'ConnectTimeout=15', '-o', 'StrictHostKeyChecking=no', '-N', '-L', '18991:localhost:8990', 'root@117.50.187.176'], { stdio: 'ignore' });
  p.on('error', () => {});
  return () => { try { p.kill('SIGTERM'); } catch {} };
}
(async () => {
  log('==== gen-hunyuan start ====');
  // C 机被别的租户占满（60G/80G），qwen-image 起不来 → 概念图改走 A 机 h3-image（照片级 2048²）。
  // A 机同一时刻只跑一个 heavy：先停 hunyuan3d，出完概念图再停 h3-image 换回 hunyuan3d。
  const closeTunnel = tunnel();
  await sleep(4000);
  H3_UP = await (async () => { try { const h = JSON.parse(Buffer.from(await req(AT, '/v1/health', {}, 15000)).toString()); return (h.running || []).includes('h3-image'); } catch { return false; } })();
  log('h3-image 可用: ' + H3_UP);
  const h3Probe = async () => { try { const h = JSON.parse(Buffer.from(await req(AT, '/v1/health', {}, 12000)).toString()); return (h.running || []).includes('h3-image'); } catch { return false; } };
  if (dry) { for (const a of plan) log('DRY ' + a.id + ' ' + a.category); process.exit(0); }
  const mf = path.join(ROOT, 'assets/asset-manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  let ok = 0, bad = 0;
  for (const a of plan) {
    try {
      const png = await concept(a);
      if (!png) throw new Error('概念图失败');
      if (CONCEPTS_ONLY) { ok++; continue; }
      const glb = GENS_ONLY ? png : await gen(a, png);
      if (!glb) throw new Error('hunyuan3d 失败');
      const entry = m.assets.find((x) => x.id === a.id);
      if (entry) {
        entry.source = Object.assign(entry.source || {}, { pipeline: 'hunyuan3d', prompt: a.source?.prompt, subject: a.subject });
        entry.raw = 'assets/_raw3d/' + a.id + '.h3d.glb';
        entry.status = 'generated';
        delete entry.error;
      }
      ok++;
      fs.writeFileSync(mf, JSON.stringify(m, null, 2));
    } catch (e) { log(`FAIL ${a.id}: ${e.message}`); bad++; }
  }
  closeTunnel();
  log(`==== gen-hunyuan DONE ok=${ok} fail=${bad} ====`);
  process.exit(bad && !ok ? 1 : 0);
})();
