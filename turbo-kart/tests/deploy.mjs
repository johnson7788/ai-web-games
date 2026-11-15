// Rebuild _src and deploy dist to the game root, then re-inject the platform kit.
// Usage: node tests/deploy.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '..');
const src = path.join(dir, '_src');
execFileSync('/opt/homebrew/bin/node', ['./node_modules/webpack/bin/webpack.js', '--config', './bundler/webpack.prod.js'], { cwd: src, stdio: 'inherit' });
const dist = path.join(src, 'dist');
// archive old hashed bundles from root (recoverable, never hard-deleted)
const oldDir = path.join(dir, 'tests', '.old-bundles');
fs.mkdirSync(oldDir, { recursive: true });
for (const f of fs.readdirSync(dir)) {
  if (/^bundle\.[0-9a-f]+\.js(\.LICENSE\.txt)?$/.test(f)) fs.renameSync(path.join(dir, f), path.join(oldDir, f));
}
for (const f of fs.readdirSync(dist)) {
  const s = path.join(dist, f), d = path.join(dir, f);
  if (fs.statSync(s).isDirectory()) fs.cpSync(s, d, { recursive: true });
  else fs.copyFileSync(s, d);
}
execFileSync('/opt/homebrew/bin/node', [path.resolve(dir, '../../tools/template3d/inject-sdk.mjs'), '--dir', dir, '--slug', 'turbo-kart', '--title', 'Turbo Kart 3D — Free Racing Game'], { stdio: 'inherit' });
console.log('deployed:', fs.readdirSync(dir).filter(f => f.startsWith('bundle.')).join(', '));