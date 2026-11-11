#!/usr/bin/env node
// 封面 / 海报截图：把 tools/cover.html 渲染成 1280×720 封面与 1920×1080 海报。
// 用法：node tools/art-cover.mjs [--root .]
import path from 'node:path';
import fs from 'node:fs';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(process.cwd(), process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : '.');
const { chromium } = loadPlaywright();
const { server, port } = await serve(root, 8400);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${port}/tools/cover.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const poster = path.join(root, 'poster.jpg');
  await page.screenshot({ path: poster, type: 'jpeg', quality: 90 });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  const cover = path.join(root, 'cover.png');
  await page.screenshot({ path: cover, type: 'png' });

  console.log(JSON.stringify({ poster, cover, posterKB: Math.round(fs.statSync(poster).size / 1024), coverKB: Math.round(fs.statSync(cover).size / 1024) }, null, 2));
} finally {
  await browser.close();
  server.close();
}
