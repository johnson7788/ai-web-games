#!/usr/bin/env node
// 生成带版本号的发布目录，绕开 CDN 对旧 JS/CSS 的缓存。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : '/tmp/smash-karts-release';
const version = process.argv.includes('--version')
  ? process.argv[process.argv.indexOf('--version') + 1]
  : `v${Date.now()}`;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'favicon.png', 'icon.png', 'poster.jpg', 'poster-1920.jpg', 'game.gif', 'SEO.txt']) {
  if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(out, file));
}
for (const dir of ['src', 'config']) fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });
// 只带运行期素材：assets/_src 是出图原始件（50MB+），不进发布包
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
for (const sub of ['bg', 'karts', 'sprites', 'keyart', 'audio']) {
  const from = path.join(root, 'assets', sub);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, 'assets', sub), { recursive: true });
}
const manifest = path.join(root, 'assets/manifest.json');
if (fs.existsSync(manifest)) fs.copyFileSync(manifest, path.join(out, 'assets/manifest.json'));

const rewriteJs = (file) => {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/((?:from|import)\s*['"])(\.{1,2}\/[^'"]+?\.js)(['"])/g, `$1$2?v=${version}$3`);
  s = s.replace(/(localUrl:\s*['"])(\.\/src\/vendor\/pipysdk\.js)(['"])/, `$1$2?v=${version}$3`);
  fs.writeFileSync(file, s);
};
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== 'vendor') walk(p); }
    else if (ent.name.endsWith('.js') || ent.name.endsWith('.mjs')) rewriteJs(p);
  }
};
walk(path.join(out, 'src'));
walk(path.join(out, 'config'));

const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
html = html.replace('href="styles.css"', `href="styles.css?v=${version}"`);
html = html.replace('src="src/main.js"', `src="src/main.js?v=${version}"`);
fs.writeFileSync(indexFile, html);
fs.writeFileSync(path.join(out, 'RELEASE_VERSION.txt'), `${version}\n`);
console.log(JSON.stringify({ out, version }, null, 2));
