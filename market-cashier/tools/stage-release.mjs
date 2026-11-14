#!/usr/bin/env node
// 生成带版本号的发布目录：index.html / styles.css / src / config 的 URL 全部加 ?v=<version>，
// 绕开 Cloudflare 对旧 JS/CSS 的缓存；源目录保持可开发状态。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : '/tmp/market-cashier-release';
const version = process.argv.includes('--version')
  ? process.argv[process.argv.indexOf('--version') + 1]
  : `v${Date.now()}`;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'favicon.png', 'icon.png', 'poster.jpg', 'poster-1920.jpg', 'game.gif']) {
  if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(out, file));
}
for (const dir of ['src', 'config']) {
  fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });
}

const rewriteJs = (file) => {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/((?:from|import)\s*['"])(\.{1,2}\/[^'"]+?\.js)(['"])/g, `$1$2?v=${version}$3`);
  s = s.replace(/(localUrl:\s*['"])(\.\/src\/vendor\/pipysdk\.js)(['"])/, `$1$2?v=${version}$3`);
  fs.writeFileSync(file, s);
};
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'vendor') continue;
      walk(p);
    } else if (ent.name.endsWith('.js') || ent.name.endsWith('.mjs')) {
      rewriteJs(p);
    }
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
console.log(JSON.stringify({ out, version, files: fs.readdirSync(out) }, null, 2));
